import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import AssignmentProblemStats from '@/components/AssignmentProblemStats';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AssignmentForm from '@/components/AssignmentForm';
import MathRenderer from '@/components/MathRenderer';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

export default function AssignmentDetail() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: teacherData } = useTeacher();
  const { user } = useAuth();

  const [assignment, setAssignment] = useState(null);
  const [problems, setProblems] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [solByProblem, setSolByProblem] = useState(new Map());
  const [stepsBySol, setStepsBySol] = useState(new Map());
  const [toolMap, setToolMap] = useState(new Map());
  const [expandedProblemId, setExpandedProblemId] = useState(null);
  const [bookmarkedToolIds, setBookmarkedToolIds] = useState(new Set());
  const [toolBookmarkIdMap, setToolBookmarkIdMap] = useState(new Map());

  useEffect(() => {
    const load = async () => {
      try {
        // 숙제 fetch
        const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
        if (assignments.length === 0) throw new Error('숙제를 찾을 수 없어요');
        const assignmentData = assignments[0];
        setAssignment(assignmentData);

        // 문제 fetch
        const problemIds = JSON.parse(assignmentData.problem_ids || '[]');
        let filteredProblems = [];
        if (problemIds.length > 0) {
          const problemsData = await base44.entities.Problem.filter({}, '-created_date', 1000);
          filteredProblems = problemsData.filter(p => problemIds.includes(p.id));
          setProblems(filteredProblems);

          // Solution + SolutionStep fetch
          const problemVarchars = filteredProblems.map(p => p.problem_id).filter(Boolean);
          if (problemVarchars.length > 0) {
            const [allTools, solArrays, myToolBookmarks] = await Promise.all([
              base44.entities.MathTool.list('name', 100),
              Promise.all(problemVarchars.map(pv =>
                base44.entities.Solution.filter({ problem_id: pv }, 'priority', 20)
              )),
              user ? base44.entities.BookmarkedTool.filter({ user_id: user.id }) : Promise.resolve([]),
            ]);
            setBookmarkedToolIds(new Set(myToolBookmarks.map(b => b.tool_id)));
            setToolBookmarkIdMap(new Map(myToolBookmarks.map(b => [b.tool_id, b.id])));

            const newToolMap = new Map(allTools.map(t => [t.tool_id, t]));
            setToolMap(newToolMap);

            const newSolByProblem = new Map();
            problemVarchars.forEach((pv, i) => newSolByProblem.set(pv, solArrays[i]));
            setSolByProblem(newSolByProblem);

            const allSolIds = solArrays.flat().map(s => s.solution_id);
            if (allSolIds.length > 0) {
              const stepArrays = await Promise.all(
                allSolIds.map(sid =>
                  base44.entities.SolutionStep.filter({ solution_id: sid }, 'sequence_order', 50)
                )
              );
              const newStepsBySol = new Map();
              allSolIds.forEach((sid, i) => newStepsBySol.set(sid, stepArrays[i]));
              setStepsBySol(newStepsBySol);
            }
          }
        }

        // 학급의 학생들 찾기
        const classStudents = teacherData?.my_students?.filter(
          s => s.class_id === assignmentData.class_id
        ) || [];

        // 각 학생의 제출 현황 fetch
        const submissions = [];
        for (const student of classStudents) {
          const attempts = await base44.entities.StudentAttempt.filter(
            { student_id: student.id, assignment_id: assignmentId },
            '-submitted_at',
            100
          );
          const uniqueProblemIds = [...new Set(attempts.map(a => a.problem_id))];
          const avgScore = attempts.length > 0
            ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length)
            : 0;
          const correctCount = attempts.filter(a => a.correctness === 'correct').length;
          const correctRate = attempts.length > 0
            ? Math.round((correctCount / uniqueProblemIds.length) * 100)
            : 0;

          submissions.push({
            student,
            attempts,
            progressCount: uniqueProblemIds.length,
            totalCount: problemIds.length,
            avgScore,
            correctRate,
          });
        }
        setStudentSubmissions(submissions);
      } catch (e) {
        console.error('Error loading assignment:', e);
        setError(e.message || '데이터를 불러오지 못했어요');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignmentId, teacherData]);

  const handleToggleToolBookmark = async (tool) => {
    if (!user) return;
    try {
      if (bookmarkedToolIds.has(tool.tool_id)) {
        const id = toolBookmarkIdMap.get(tool.tool_id);
        if (!id) return;
        await base44.entities.BookmarkedTool.delete(id);
        setBookmarkedToolIds(prev => { const s = new Set(prev); s.delete(tool.tool_id); return s; });
        toast.success('즐겨찾기 해제');
      } else {
        const created = await base44.entities.BookmarkedTool.create({ user_id: user.id, tool_id: tool.tool_id });
        setBookmarkedToolIds(prev => new Set([...prev, tool.tool_id]));
        setToolBookmarkIdMap(prev => new Map(prev).set(tool.tool_id, created.id));
        toast.success('즐겨찾기에 추가');
      }
    } catch {
      toast.error('즐겨찾기 처리 중 오류가 발생했어요');
    }
  };

  const handleSave = async (assignmentData) => {
    try {
      await base44.entities.Assignment.update(assignmentId, assignmentData);
      toast.success('숙제가 수정되었어요');
      setShowEditForm(false);
      // 페이지 새로고침
      window.location.reload();
    } catch (e) {
      toast.error('수정 실패: ' + e.message);
    }
  };

  const handleClose = async () => {
    try {
      await base44.entities.Assignment.update(assignmentId, { status: 'closed' });
      toast.success('숙제가 마감되었어요');
      setAssignment(prev => ({ ...prev, status: 'closed' }));
    } catch (e) {
      toast.error('마감 실패: ' + e.message);
    }
  };

  const handleDelete = async () => {
    try {
      await base44.entities.Assignment.delete(assignmentId);
      toast.success('숙제가 삭제되었어요');
      navigate('/teacher/assignments');
    } catch (e) {
      toast.error('삭제 실패: ' + e.message);
    }
  };

  if (loading) return <InlineLoader message="숙제 정보 불러오는 중..." />;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!assignment) return null;

  const submissionCount = studentSubmissions.reduce((sum, s) => sum + s.attempts.length, 0);

  return (
    <div className="space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{assignment.title}</h1>
              <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                {assignment.status === 'active' ? '진행중' : '마감'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {teacherData?.my_classes?.find(c => c.id === assignment.class_id)?.name || assignment.class_id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowEditForm(true)}
            disabled={submissionCount > 0}
            title={submissionCount > 0 ? '제출이 있으면 수정할 수 없어요' : ''}
          >
            수정
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {assignment.status === 'active' && (
                <DropdownMenuItem onClick={handleClose}>
                  마감
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(true)}>
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 날짜 정보 */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>출제일: {format(new Date(assignment.created_date), 'MMM d, HH:mm')}</span>
        {assignment.deadline && (
          <span>마감: {format(new Date(assignment.deadline), 'MMM d, HH:mm')}</span>
        )}
      </div>

      {/* 설명 */}
      {assignment.description && (
        <Card className="p-4">
          <p className="text-sm">{assignment.description}</p>
        </Card>
      )}

      {/* 출제된 문제 리스트 — accordion */}
      <div>
        <h2 className="text-lg font-semibold mb-3">출제된 문제 ({problems.length}개)</h2>
        <div className="grid gap-3">
          {problems.map(p => {
            const isOpen = expandedProblemId === p.id;
            // 이 문제에 대한 이번 숙제의 attempts
            const problemAttempts = studentSubmissions
              .flatMap(s => s.attempts)
              .filter(a => a.problem_id === p.id);
            const solutions = solByProblem.get(p.problem_id) || [];
            return (
              <Card key={p.id} className="overflow-hidden">
                <button
                  className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedProblemId(isOpen ? null : p.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted-foreground mb-1">{p.id.slice(0, 8)}...</p>
                      <p className="text-sm font-medium mb-1">{p.domain_name || '(도메인 없음)'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {parseProblemText(p.content).substring(0, 80)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{problemAttempts.length}건</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t px-4 pb-4">
                    <AssignmentProblemStats
                      problem={p}
                      attempts={problemAttempts}
                      solutions={solutions}
                      stepsBySol={stepsBySol}
                      toolMap={toolMap}
                      bookmarkedToolIds={bookmarkedToolIds}
                      onToggleBookmark={handleToggleToolBookmark}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* 학생별 제출 현황 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">학생별 제출 현황</h2>
        {studentSubmissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">이 학급에 배정된 학생이 없어요</p>
        ) : (
          <div className="grid gap-3">
            {studentSubmissions.map(submission => (
              <Card
                key={submission.student.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/teacher/assignments/${assignmentId}/student/${submission.student.id}`)}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <p className="font-medium">{submission.student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{submission.student.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {submission.progressCount}/{submission.totalCount} 문제
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>평균: {submission.avgScore}점</span>
                      <span>정답: {submission.correctRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{
                      width: `${submission.totalCount > 0 ? (submission.progressCount / submission.totalCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {showEditForm && (
        <AssignmentForm
          classId={assignment.class_id}
          assignment={assignment}
          onSave={handleSave}
          onClose={() => setShowEditForm(false)}
        />
      )}

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>숙제를 삭제하시겠어요?</AlertDialogTitle>
          <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              삭제
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}