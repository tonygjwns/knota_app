import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Circle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

export default function StudentAssignment() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [problems, setProblems] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Assignment fetch
        const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
        if (assignments.length === 0) throw new Error('숙제를 찾을 수 없어요');
        const a = assignments[0];

        // 권한 체크: 학생의 class_id 와 일치해야 함
        if (!user || a.class_id !== user.class_id) {
          toast.error('이 숙제를 볼 권한이 없어요');
          navigate('/home');
          return;
        }

        setAssignment(a);

        // Problems fetch
        const problemIds = JSON.parse(a.problem_ids || '[]');
        if (problemIds.length > 0) {
          const allProblems = await base44.entities.Problem.filter({}, '-created_date', 1000);
          const filtered = allProblems.filter(p => problemIds.includes(p.id));
          setProblems(filtered);
        }

        // My attempts
        const attempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: assignmentId },
          '-submitted_at',
          100
        );
        setMyAttempts(attempts);
      } catch (e) {
        console.error('Error loading assignment:', e);
        setError(e.message || '데이터를 불러오지 못했어요');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignmentId, user, navigate]);

  if (loading) return <AppLayout><InlineLoader message="숙제 불러오는 중..." /></AppLayout>;
  if (error) return <AppLayout><div className="text-center py-12 text-red-500">{error}</div></AppLayout>;
  if (!assignment) return null;

  const attemptMap = new Map(myAttempts.map(a => [a.problem_id, a]));
  const doneCount = myAttempts.filter(a => a.problem_id).length;
  const totalCount = problems.length;
  const allDone = doneCount >= totalCount;

  // 안 푼 문제 첫 번째 찾기
  const nextUnfinishedProblem = problems.find(p => !attemptMap.has(p.id));

  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  const now = new Date();
  const isUrgent = deadline && deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <AppLayout>
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/problems')} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{assignment.title}</h1>
              <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                {assignment.status === 'active' ? '진행중' : '마감'}
              </Badge>
            </div>
            {deadline && (
              <p className="text-xs text-muted-foreground">
                마감: {deadline.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {isUrgent && <span className="text-red-500 ml-2">(D-{daysLeft} 마감 임박!)</span>}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {assignment.description && (
          <Card className="p-4">
            <p className="text-sm">{assignment.description}</p>
          </Card>
        )}

        {/* Progress summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">진행률</p>
            <p className="text-sm font-bold">{doneCount}/{totalCount} 문제</p>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          {allDone && (
            <p className="text-sm text-emerald-600 font-semibold mt-2">🎉 모든 문제를 풀었어요!</p>
          )}
        </Card>

        {/* Continue button */}
        {assignment.status === 'active' && (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              if (nextUnfinishedProblem) {
                navigate(`/problem/${nextUnfinishedProblem.id}?assignment_id=${assignment.id}`);
              } else if (problems.length > 0) {
                navigate(`/problem/${problems[0].id}?assignment_id=${assignment.id}`);
              }
            }}
            disabled={assignment.status !== 'active'}
          >
            {allDone ? '다시 풀기' : nextUnfinishedProblem ? '이어 풀기' : '문제 풀기'}
          </Button>
        )}

        {/* Problem list */}
        <div>
          <h2 className="text-lg font-semibold mb-3">출제된 문제</h2>
          <div className="space-y-2">
            {problems.map(p => {
              const attempt = attemptMap.get(p.id);
              const isDone = !!attempt;
              return (
                <Card
                  key={p.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50'
                      : 'border-border hover:bg-muted'
                  }`}
                  onClick={() => navigate(`/problem/${p.id}?assignment_id=${assignment.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted-foreground mb-1">{p.id.slice(0, 8)}...</p>
                      <p className="text-sm font-medium mb-1">{p.domain_name || '(도메인 없음)'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {parseProblemText(p.content).substring(0, 60)}...
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {isDone ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-bold">{attempt.score}점</span>
                        </div>
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}