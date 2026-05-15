/**
 * RemediationResult — /remediation/result/:attemptId
 * ResultView와 동일한 본문, 보강 전용 액션 버튼만 다름.
 */
import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import LoadingOverlay, { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, ChevronRight, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import AttemptResultBody from '@/components/AttemptResultBody';
import useAttemptResult from '@/hooks/useAttemptResult';

export default function RemediationResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const originalAttemptId = searchParams.get('original_attempt');
  const parentAttemptId = searchParams.get('parent_attempt');
  const targetToolId = searchParams.get('target_tool');

  const { user } = useAuth();

  const {
    attempt, setAttempt, problem, tools, loading, grading, solutions, solutionSteps,
    bookmarkedToolIds, problemBookmarked,
    showOCR, setShowOCR, showDetail, setShowDetail, showMatchedSolution, setShowMatchedSolution,
    tooltipTool, setTooltipTool,
    showOcrComplainModal, setShowOcrComplainModal, ocrHint, setOcrHint, handleOCRReRecognize, reRecognizing,
    showReviewRequestModal, setShowReviewRequestModal, reviewNote, setReviewNote, submittingReview, handleSubmitReview,
    feedbackSent, setFeedbackSent,
    toggleBookmark,
    remediationToolIds,
  } = useAttemptResult({ attemptId, user });

  const viewerIsOwner = attempt?.student_id === user?.id;

  const handleRemediation = async (toolId) => {
    try {
      const allProblems = await base44.entities.Problem.list('-created_date', 1000);
      const matching = allProblems.filter(p => {
        try { return JSON.parse(p.tool_ids || '[]').includes(toolId); } catch { return false; }
      });
      const pool = matching.filter(p => p.id !== attempt.problem_id);
      if (pool.length === 0) { toast.error('이 도구의 다른 문제가 없어요'); return; }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const chainOriginal = attempt.original_attempt_id || attempt.parent_attempt_id;
      const p = new URLSearchParams();
      p.set('target_tool', toolId);
      p.set('parent_attempt', attempt.id);
      if (chainOriginal) p.set('original_attempt', chainOriginal);
      navigate(`/remediation/solve/${pick.id}?${p.toString()}`);
    } catch { toast.error('문제를 불러오지 못했어요'); }
  };

  if (loading) return <AppLayout><InlineLoader message="결과 불러오는 중..." /></AppLayout>;
  if (!attempt) return <AppLayout><div className="text-center py-12 text-muted-foreground">결과를 찾을 수 없어요.</div></AppLayout>;

  const actionButtons = viewerIsOwner && (
    <div className="space-y-2 pt-2">
      {originalAttemptId && (
        <Button variant="outline" className="w-full" onClick={() => navigate(`/result/${originalAttemptId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 원래 채점결과로 돌아가기
        </Button>
      )}
      {problem && (
        <Button className="w-full" onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
          <RotateCcw className="w-4 h-4 mr-1" /> 원래 문제로 돌아가기 (다시 풀기)
        </Button>
      )}
      <div className="text-center">
        <Link to="/diagnosis" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />내 진단 보기
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
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </Button>
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">보강 풀이 결과</span>
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
          fromRecommend={false} feedbackSent={feedbackSent} setFeedbackSent={setFeedbackSent}
          user={user}
          onRemediation={handleRemediation}
          remediationToolIds={remediationToolIds}
          extraBottomSlot={actionButtons}
        />
      </div>
    </AppLayout>
  );
}