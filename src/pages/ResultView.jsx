import React from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import LoadingOverlay, { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, ChevronRight, Star, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import AttemptResultBody from '@/components/AttemptResultBody';
import useAttemptResult from '@/hooks/useAttemptResult';

const BACK_LABELS = {
  assignment: '숙제로 돌아가기',
  type: '단원으로 돌아가기',
  domain: '영역으로 돌아가기',
  tool: '도구로 돌아가기',
  wrong: '틀린 문제 목록으로',
  recommend: '추천 목록으로',
};

const NEXT_LABELS = {
  assignment: '다음 문제 (숙제)',
  type: '같은 단원 다음 문제',
  domain: '같은 영역 다음 문제',
  tool: '같은 도구 다음 문제',
  wrong: '다음 틀린 문제',
  recommend: '다음 추천 문제',
};

export default function ResultView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const fromRecommend = fromParam === 'recommend';
  const recommendReason = searchParams.get('reason');
  const typeId = searchParams.get('type_id');
  const toolId = searchParams.get('tool_id');
  const domainId = searchParams.get('domain_id');
  const gradeId = searchParams.get('grade');
  const { user } = useAuth();

  const {
    attempt, setAttempt, problem, tools, loading, grading, solutions, solutionSteps,
    bookmarkedToolIds, problemBookmarked, problemBookmarkId,
    showOCR, setShowOCR, showDetail, setShowDetail,
    showMatchedSolution, setShowMatchedSolution,
    tooltipTool, setTooltipTool,
    showOcrComplainModal, setShowOcrComplainModal, ocrHint, setOcrHint,
    handleOCRReRecognize, reRecognizing,
    showReviewRequestModal, setShowReviewRequestModal, reviewNote, setReviewNote,
    submittingReview, handleSubmitReview,
    feedbackSent, setFeedbackSent,
    toggleBookmark, toggleProblemBookmark,
    remediationToolIds,
    studentInfo,
  } = useAttemptResult({ attemptId: id, user });

  const viewerIsOwner = attempt?.student_id === user?.id;
  const effectiveFrom = attempt?.assignment_id ? 'assignment' : (fromParam || null);
  const backLabel = BACK_LABELS[effectiveFrom] || '문제 탭으로';
  const nextLabel = NEXT_LABELS[effectiveFrom] || '다음 문제';

  const handleBack = () => {
    if (effectiveFrom === 'assignment') {
      navigate(`/assignment/${attempt.assignment_id}`);
      return;
    }
    const params = new URLSearchParams();
    if (effectiveFrom === 'type' || effectiveFrom === 'domain') {
      params.set('mode', 'domain');
      if (domainId) params.set('selected_domain', domainId);
    } else if (effectiveFrom === 'tool') {
      params.set('mode', 'tool');
      if (gradeId) params.set('grade', gradeId);
      if (domainId) params.set('domain_id', domainId);
      if (typeId) params.set('type_id', typeId);
    } else if (effectiveFrom === 'wrong') {
      params.set('mode', 'wrong');
      if (gradeId) params.set('grade', gradeId);
      if (domainId) params.set('domain_id', domainId);
    } else if (effectiveFrom === 'recommend') {
      params.set('mode', 'recommended');
    } else {
      navigate('/problems');
      return;
    }
    navigate(`/problems?${params}`);
  };

  const handleNextProblem = async () => {
    if (effectiveFrom === 'assignment') {
      const assignment = (await base44.entities.Assignment.filter({ id: attempt.assignment_id })).pop();
      if (assignment) {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const myAttempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: attempt.assignment_id }, '-submitted_at', 100
        );
        const doneIds = new Set(myAttempts.map(a => a.problem_id));
        const remaining = problemIds.filter(pid => !doneIds.has(pid));
        if (remaining.length === 0) {
          toast.success('이 숙제를 다 풀었어요! 🎉');
          navigate(`/assignment/${attempt.assignment_id}`);
          return;
        }
        navigate(`/problem/${remaining[0]}?assignment_id=${attempt.assignment_id}`);
      }
      return;
    }

    const allProblems = await base44.entities.Problem.list('-created_date', 1000);
    let pool = [];
    let emptyMessage = '';
    let hubUrl = '/problems';

    if (fromParam === 'type' && typeId) {
      const pts = await base44.entities.ProblemType.filter({ type_id: typeId }, '-created_date', 500);
      const pidSet = new Set(pts.map(p => p.problem_id));
      pool = allProblems.filter(p => pidSet.has(p.problem_id));
      emptyMessage = '이 단원의 모든 문제를 다 풀었어요!';
      const p = new URLSearchParams({ mode: 'domain' });
      if (domainId) p.set('selected_domain', domainId);
      hubUrl = `/problems?${p}`;
    } else if (fromParam === 'tool' && toolId) {
      pool = allProblems.filter(p => { try { return JSON.parse(p.tool_ids || '[]').includes(toolId); } catch { return false; } });
      emptyMessage = '이 도구의 모든 문제를 다 풀었어요!';
      const p = new URLSearchParams({ mode: 'tool' });
      if (gradeId) p.set('grade', gradeId);
      if (domainId) p.set('domain_id', domainId);
      if (typeId) p.set('type_id', typeId);
      hubUrl = `/problems?${p}`;
    } else if (fromParam === 'wrong') {
      const myAttempts = await base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200);
      const latestByProblem = new Map();
      for (const a of myAttempts) {
        const prev = latestByProblem.get(a.problem_id);
        if (!prev || new Date(a.submitted_at) > new Date(prev.submitted_at)) latestByProblem.set(a.problem_id, a);
      }
      const wrongPids = [...latestByProblem.values()].filter(a => (a.score || 0) < 60 || a.correctness === 'wrong').map(a => a.problem_id);
      pool = allProblems.filter(p => wrongPids.includes(p.id));
      emptyMessage = '틀린 문제를 다 다시 풀었어요! 잘했어요 🎉';
      const p = new URLSearchParams({ mode: 'wrong' });
      if (gradeId) p.set('grade', gradeId);
      if (domainId) p.set('domain_id', domainId);
      hubUrl = `/problems?${p}`;
    } else if (fromParam === 'recommend') {
      pool = allProblems;
      emptyMessage = '추천 문제를 다 풀었어요!';
      hubUrl = '/problems?mode=recommended';
    } else {
      pool = allProblems;
      emptyMessage = '푼 적 없는 문제를 다 풀었어요!';
      hubUrl = '/problems';
    }

    const myAttempts = await base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200);
    const donePids = new Set(myAttempts.map(a => a.problem_id));
    const unsolved = fromParam === 'wrong' ? pool : pool.filter(p => !donePids.has(p.id));

    if (unsolved.length === 0) {
      toast.success(emptyMessage);
      navigate(hubUrl);
      return;
    }

    const pick = unsolved[Math.floor(Math.random() * unsolved.length)];
    const np = new URLSearchParams();
    if (fromParam) np.set('from', fromParam);
    if (typeId) np.set('type_id', typeId);
    if (toolId) np.set('tool_id', toolId);
    if (domainId) np.set('domain_id', domainId);
    if (gradeId) np.set('grade', gradeId);
    navigate(`/problem/${pick.id}?${np}`);
  };

  const handleRemediation = async (remToolId) => {
    try {
      const allProblems = await base44.entities.Problem.list('-created_date', 1000);
      const matching = allProblems.filter(p => {
        try { return JSON.parse(p.tool_ids || '[]').includes(remToolId); } catch { return false; }
      });
      const pool = matching.filter(p => p.id !== attempt.problem_id);
      if (pool.length === 0) { toast.error('이 도구의 다른 문제가 없어요'); return; }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      navigate(`/remediation/solve/${pick.id}?target_tool=${remToolId}&parent_attempt=${attempt.id}&original_attempt=${attempt.id}`);
    } catch {
      toast.error('문제를 불러오지 못했어요');
    }
  };

  if (loading) return <AppLayout><InlineLoader message="결과 불러오는 중..." /></AppLayout>;
  if (!attempt) return <AppLayout><div className="text-center py-12 text-muted-foreground">결과를 찾을 수 없어요.</div></AppLayout>;

  const actionButtons = viewerIsOwner && (
    <div className="space-y-2 pt-2">
      <Button variant="outline" className="w-full" onClick={handleBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
      </Button>
      {(attempt.correctness === 'wrong' || attempt.correctness === 'partial') && (
        <Button variant="outline" className="w-full" onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
          <RotateCcw className="w-4 h-4 mr-1" /> 문제 다시 풀기
        </Button>
      )}
      <Button className="w-full" onClick={handleNextProblem}>
        {nextLabel} <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
      <div className="text-center">
        <Link to="/diagnosis" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          내 진단 보기
        </Link>
      </div>
    </div>
  );

  return (
    <AppLayout>
      {reRecognizing && <LoadingOverlay stage="grading" />}
      <div className="space-y-5 pb-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          {viewerIsOwner ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/problems')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 문제 탭
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => {
              const from = searchParams.get('from');
              if (from === 'student_detail' && searchParams.get('studentId')) {
                navigate(`/teacher/students/${searchParams.get('studentId')}`);
              } else if (from === 'assignment_student' && searchParams.get('assignmentId') && searchParams.get('studentId')) {
                navigate(`/teacher/assignments/${searchParams.get('assignmentId')}/student/${searchParams.get('studentId')}`);
              } else if (from === 'problem_attempts' && searchParams.get('problemId')) {
                navigate(`/teacher/problems/${searchParams.get('problemId')}`);
              } else {
                navigate(-1);
              }
            }}>
              <ArrowLeft className="w-4 h-4" /> 뒤로
            </Button>
          )}

          {!viewerIsOwner && studentInfo && (
            <div className="text-right">
              <p className="text-sm font-medium">{studentInfo.name || studentInfo.email}</p>
              {studentInfo.name && <p className="text-xs text-muted-foreground">{studentInfo.email}</p>}
            </div>
          )}

          {viewerIsOwner && (
            <button
              onClick={toggleProblemBookmark}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-sm"
            >
              <Star className={`w-4 h-4 ${problemBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-muted-foreground text-xs">{problemBookmarked ? '문제 저장됨' : '문제 저장'}</span>
            </button>
          )}
        </div>

        <AttemptResultBody
          attempt={attempt} setAttempt={setAttempt}
          grading={grading} problem={problem} tools={tools}
          solutions={solutions} solutionSteps={solutionSteps}
          showDetail={showDetail} setShowDetail={setShowDetail}
          showOCR={showOCR} setShowOCR={setShowOCR}
          showMatchedSolution={showMatchedSolution} setShowMatchedSolution={setShowMatchedSolution}
          viewerIsOwner={viewerIsOwner}
          bookmarkedToolIds={bookmarkedToolIds} toggleBookmark={toggleBookmark}
          tooltipTool={tooltipTool} setTooltipTool={setTooltipTool}
          showOcrComplainModal={showOcrComplainModal} setShowOcrComplainModal={setShowOcrComplainModal}
          ocrHint={ocrHint} setOcrHint={setOcrHint}
          handleOCRReRecognize={handleOCRReRecognize} reRecognizing={reRecognizing}
          showReviewRequestModal={showReviewRequestModal} setShowReviewRequestModal={setShowReviewRequestModal}
          reviewNote={reviewNote} setReviewNote={setReviewNote}
          submittingReview={submittingReview} handleSubmitReview={handleSubmitReview}
          fromRecommend={fromRecommend} recommendReason={recommendReason}
          feedbackSent={feedbackSent} setFeedbackSent={setFeedbackSent}
          user={user}
          onRemediation={handleRemediation}
          remediationToolIds={remediationToolIds}
          extraBottomSlot={actionButtons}
        />
      </div>
    </AppLayout>
  );
}