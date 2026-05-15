import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ScoreBadge from '@/components/ScoreBadge';
import MathRenderer from '@/components/MathRenderer';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

export default function AssignmentStudentDetail() {
  const { assignmentId, studentId } = useParams();
  const navigate = useNavigate();
  const { data: teacherData, loading: teacherLoading } = useTeacher();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [problems, setProblems] = useState([]);
  const [attemptsByProblem, setAttemptsByProblem] = useState(new Map());

  useEffect(() => {
    if (teacherLoading) return;
    if (!teacherData) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const stu = teacherData.my_students?.find(s => s.id === studentId);
        if (!stu) {
          toast.error('이 학생을 볼 권한이 없어요');
          navigate(-1);
          return;
        }

        const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
        const asgn = assignments[0];
        if (!asgn) { navigate(-1); return; }
        setAssignment(asgn);
        setStudent(stu);

        const problemIds = JSON.parse(asgn.problem_ids || '[]');
        const [allProblems, attempts] = await Promise.all([
          base44.entities.Problem.filter({}, '-created_date', 1000),
          base44.entities.StudentAttempt.filter(
            { student_id: studentId, assignment_id: assignmentId },
            '-submitted_at', 200
          ),
        ]);

        const filtered = allProblems.filter(p => problemIds.includes(p.id));
        setProblems(filtered);

        // latest attempt per problem
        const byProblem = new Map();
        for (const a of attempts) {
          const prev = byProblem.get(a.problem_id);
          if (!prev || new Date(a.submitted_at) > new Date(prev.submitted_at)) {
            byProblem.set(a.problem_id, a);
          }
        }
        setAttemptsByProblem(byProblem);
      } catch (e) {
        console.error('AssignmentStudentDetail load failed:', e);
        toast.error('데이터를 불러오지 못했어요: ' + (e.message || ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId, studentId, teacherData, teacherLoading]);

  if (loading || teacherLoading) return <InlineLoader message="불러오는 중..." />;
  if (!assignment || !student) return null;

  const submittedCount = [...attemptsByProblem.values()].length;

  return (
    <div className="space-y-5 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{student.full_name || student.email}</h1>
          <p className="text-sm text-muted-foreground">{assignment.title}</p>
        </div>
      </div>

      {/* 진행률 */}
      <Card className="p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">진행률</span>
          <span className="text-muted-foreground">{submittedCount} / {problems.length} 문제</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${problems.length > 0 ? (submittedCount / problems.length) * 100 : 0}%` }}
          />
        </div>
      </Card>

      {/* 문제별 카드 */}
      <div className="space-y-3">
        {problems.map((p, idx) => {
          const attempt = attemptsByProblem.get(p.id);
          const preview = parseProblemText(p.content).slice(0, 80);
          return (
            <Card
              key={p.id}
              className={`p-4 ${attempt ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              onClick={() => attempt && navigate(`/record/${attempt.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">문제 {idx + 1}</p>
                  {p.domain_name && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-block mb-1">
                      {p.domain_name}
                    </span>
                  )}
                  <p className="text-sm text-foreground line-clamp-2">{preview || '(내용 없음)'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {attempt ? (
                    <>
                      <ScoreBadge score={attempt.score || 0} size="sm" />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">미제출</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}