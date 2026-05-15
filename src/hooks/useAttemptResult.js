/**
 * useAttemptResult — ResultView / RemediationResult 공통 데이터 로딩 + 상태 hook
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { redirectByRole } from '@/lib/auth-utils';
import { GRADING_SCHEMA, buildToolsBlock, buildSolutionsBlock, buildGradingPrompt, sanitizeGradingResult } from '@/lib/grading';
import { toast } from 'sonner';

export default function useAttemptResult({ attemptId, user, skipAuthCheck = false }) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [solutionSteps, setSolutionSteps] = useState([]);
  const [bookmarkedToolIds, setBookmarkedToolIds] = useState(new Set());
  const [bookmarkIdMap, setBookmarkIdMap] = useState(new Map());
  const [problemBookmarked, setProblemBookmarked] = useState(false);
  const [problemBookmarkId, setProblemBookmarkId] = useState(null);

  // UI state
  const [showOCR, setShowOCR] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showMatchedSolution, setShowMatchedSolution] = useState(false);
  const [tooltipTool, setTooltipTool] = useState(null);
  const [showOcrComplainModal, setShowOcrComplainModal] = useState(false);
  const [ocrHint, setOcrHint] = useState('');
  const [reRecognizing, setReRecognizing] = useState(false);
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => { if (attemptId) loadAttempt(); }, [attemptId]);

  useEffect(() => {
    if (attempt) {
      const fast = attempt.answer_check_result === 'correct' || attempt.answer_check_result === 'correct_via_solution';
      if (!fast) setShowDetail(true);
    }
  }, [attempt?.id]);

  // Polling for background grading
  useEffect(() => {
    if (!attempt) return;
    const fast = attempt.answer_check_result === 'correct' || attempt.answer_check_result === 'correct_via_solution';
    if (!fast || grading) return;
    if (attempt.tool_mapping_status !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const [updated] = await base44.entities.StudentAttempt.filter({ id: attempt.id }, '-created_date', 1);
        if (!updated) return;
        if (updated.claude_grade_json || updated.tool_mapping_status === 'done' || updated.tool_mapping_status === 'failed') {
          setAttempt(updated);
          if (updated.claude_grade_json) {
            try { const p = JSON.parse(updated.claude_grade_json); setGrading(p?.response ?? p); } catch {}
          }
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    const timeout = setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [attempt?.id, grading]);

  const loadAttempt = async () => {
    setLoading(true);
    try {
      const attempts = await base44.entities.StudentAttempt.filter({ id: attemptId }, '-created_date', 1);
      if (attempts.length === 0) { setLoading(false); return; }
      const a = attempts[0];

      if (!skipAuthCheck && user) {
        const isOwn = a.student_id === user.id;
        const isAdmin = user.role === 'admin';
        let isAuthorized = isOwn || isAdmin;
        if (!isAuthorized && user.role === 'teacher') {
          try {
            const allClasses = await base44.entities.Class.list('name', 500);
            const myClassIds = new Set(
              allClasses.filter(c =>
                c.main_teacher_id === user.id ||
                (c.assistant_teacher_ids || []).includes(user.id)
              ).map(c => c.id)
            );
            if (myClassIds.size > 0) {
              const allStudents = await base44.entities.User.list('full_name', 500);
              isAuthorized = allStudents.some(s => s.id === a.student_id && myClassIds.has(s.class_id));
            }
          } catch {}
        }
        if (!isAuthorized && user.role === 'owner') {
          try {
            const [studentUser] = await base44.entities.User.filter({ id: a.student_id }, '-created_date', 1);
            isAuthorized = studentUser?.academy_id === user.academy_id;
          } catch {}
        }
        if (!isAuthorized) {
          toast.error('이 결과를 볼 권한이 없어요');
          navigate(redirectByRole(user));
          return;
        }
      }

      setAttempt(a);
      if (a.claude_grade_json) {
        try { const p = JSON.parse(a.claude_grade_json); setGrading(p?.response ?? p); } catch {}
      }

      if (a.problem_id) {
        const problems = await base44.entities.Problem.filter({ id: a.problem_id }, '-created_date', 1);
        if (problems.length > 0) {
          const prob = problems[0];
          setProblem(prob);
          let toolIds = [];
          try { toolIds = JSON.parse(prob.tool_ids || '[]').filter(Boolean); } catch {}

          const fetchPromises = [
            toolIds.length > 0 ? base44.entities.MathTool.list('name', 100) : Promise.resolve([]),
            base44.entities.Solution.filter({ problem_id: prob.problem_id }, 'priority', 20),
          ];
          if (user) {
            fetchPromises.push(
              base44.entities.BookmarkedTool.filter({ user_id: user.id }),
              base44.entities.BookmarkedProblem.filter({ user_id: user.id, problem_id: a.problem_id }, '-created_date', 1),
            );
          }
          const [allTools, sols, myToolBookmarks, myProblemBookmarks] = await Promise.all(fetchPromises);

          if (toolIds.length > 0) setTools((allTools || []).filter(t => toolIds.includes(t.tool_id)));

          if (sols && sols.length > 0) {
            setSolutions(sols);
            const stepArrays = await Promise.all(
              sols.map(s => base44.entities.SolutionStep.filter({ solution_id: s.solution_id }, 'sequence_order', 50))
            );
            setSolutionSteps(stepArrays.flat());
          }

          if (user && myToolBookmarks) {
            setBookmarkedToolIds(new Set(myToolBookmarks.filter(b => toolIds.includes(b.tool_id)).map(b => b.tool_id)));
            setBookmarkIdMap(new Map(myToolBookmarks.map(b => [b.tool_id, b.id])));
          }
          if (user && myProblemBookmarks && myProblemBookmarks.length > 0) {
            setProblemBookmarked(true);
            setProblemBookmarkId(myProblemBookmarks[0].id);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = async (tool) => {
    if (!user || !attempt) return;
    const isBookmarked = bookmarkedToolIds.has(tool.tool_id);
    if (isBookmarked) {
      const id = bookmarkIdMap.get(tool.tool_id);
      if (!id) return;
      await base44.entities.BookmarkedTool.delete(id);
      setBookmarkedToolIds(prev => { const next = new Set(prev); next.delete(tool.tool_id); return next; });
      toast.success('즐겨찾기 해제했어요');
    } else {
      const created = await base44.entities.BookmarkedTool.create({ user_id: user.id, tool_id: tool.tool_id, context_attempt_id: attempt.id });
      setBookmarkedToolIds(prev => new Set([...prev, tool.tool_id]));
      setBookmarkIdMap(prev => new Map(prev).set(tool.tool_id, created.id));
      toast.success('즐겨찾기에 추가했어요');
    }
  };

  const toggleProblemBookmark = async () => {
    if (!user || !attempt) return;
    if (problemBookmarked) {
      await base44.entities.BookmarkedProblem.delete(problemBookmarkId);
      setProblemBookmarked(false); setProblemBookmarkId(null);
      toast.success('문제 즐겨찾기를 해제했어요');
    } else {
      const created = await base44.entities.BookmarkedProblem.create({
        user_id: user.id, problem_id: attempt.problem_id,
        problem_content_preview: (attempt.problem_content || '').slice(0, 100),
        problem_domain: attempt.problem_domain || '',
      });
      setProblemBookmarked(true); setProblemBookmarkId(created.id);
      toast.success('문제를 즐겨찾기에 추가했어요');
    }
  };

  const handleOCRReRecognize = async () => {
    if (!attempt || !problem) return;
    setReRecognizing(true);
    setShowOcrComplainModal(false);
    try {
      const imageUrl = attempt.canvas_image_url || attempt.photo_url;
      if (!imageUrl) { toast.error('원본 풀이 이미지가 없어요'); return; }
      const reRecognizePrompt = `당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.\n\n이 학생의 손글씨 풀이를 OCR 해주세요. JSON 으로 응답.\n\n이전 OCR 결과는 다음과 같았어요:\n"""\n${attempt.ocr_text || ''}\n"""\n\n학생이 이 OCR 결과가 잘못됐다고 신고했어요.\n${ocrHint.trim() ? `학생 힌트: "${ocrHint.trim()}"` : ''}\n좀 더 신중히 다시 인식해 주세요. LaTeX 표기 정확히, 학생이 안 쓴 내용 추가 금지.\n\nJSON: {"markdown_text": "풀이 (LaTeX 포함)", "confidence": 0-100, "notes": "특이사항"}`;
      const ocrRaw = await base44.integrations.Core.InvokeLLM({
        prompt: reRecognizePrompt, file_urls: [imageUrl], model: 'gemini_3_flash',
        response_json_schema: { type: 'object', properties: { markdown_text: { type: 'string' }, confidence: { type: 'number' }, notes: { type: 'string' } }, required: ['markdown_text'] },
      });
      const newOcrText = (ocrRaw?.response ?? ocrRaw)?.markdown_text || '';
      if (!newOcrText) throw new Error('OCR 결과 없음');

      const problemText = (() => { try { return JSON.parse(problem.content || '[]').map(b => b.text || '').join('\n\n'); } catch { return String(problem.content || ''); } })();
      const verifiedAnswer = problem.verified_answer || '';
      const toolIds = (() => { try { return JSON.parse(problem.tool_ids || '[]'); } catch { return []; } })();
      const [allTools, allSolutions] = await Promise.all([
        toolIds.length > 0 ? base44.entities.MathTool.list('name', 100) : Promise.resolve([]),
        base44.entities.Solution.filter({ problem_id: problem.problem_id }, 'priority', 20),
      ]);
      const relevantTools = allTools.filter(t => toolIds.includes(t.tool_id));
      const solutionsSlice = allSolutions.slice(0, 5);
      const solutionIds = solutionsSlice.map(s => s.solution_id);
      const stepsBySol = new Map();
      if (solutionIds.length > 0) {
        const stepArrays = await Promise.all(solutionIds.map(sid => base44.entities.SolutionStep.filter({ solution_id: sid }, 'sequence_order', 50)));
        solutionIds.forEach((sid, i) => stepsBySol.set(sid, stepArrays[i]));
      }
      const gradingPrompt = buildGradingPrompt({ problemText, verifiedAnswer, solutionsBlock: buildSolutionsBlock(solutionsSlice, stepsBySol, relevantTools), toolsBlock: buildToolsBlock(relevantTools), studentOcrSolution: newOcrText, studentAnswer: attempt.student_answer || '' });
      const gradeRaw = await base44.integrations.Core.InvokeLLM({ prompt: gradingPrompt, model: 'claude_sonnet_4_6', response_json_schema: GRADING_SCHEMA });
      const gradeResult = sanitizeGradingResult(gradeRaw?.response ?? gradeRaw, { validToolIds: new Set(relevantTools.map(t => t.tool_id)), validSolutionIds: new Set(solutionIds), stepsBySolutionId: stepsBySol });
      await base44.entities.StudentAttempt.update(attempt.id, { ocr_text: newOcrText, claude_grade_json: JSON.stringify(gradeResult), score: gradeResult.score || 0, correctness: gradeResult.correctness || 'wrong' });
      setGrading(gradeResult);
      setAttempt(prev => ({ ...prev, ocr_text: newOcrText, score: gradeResult.score || 0, correctness: gradeResult.correctness || 'wrong', claude_grade_json: JSON.stringify(gradeResult) }));
      setOcrHint('');
      setShowDetail(true);
      toast.success('다시 인식해서 채점했어요!');
    } catch (err) {
      console.error(err);
      toast.error('재인식 중 문제가 생겼어요. 다시 시도해 주세요');
    } finally {
      setReRecognizing(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await base44.entities.StudentAttempt.update(attempt.id, { review_requested: true, review_request_note: reviewNote.trim() || null });
      setAttempt(prev => ({ ...prev, review_requested: true, review_request_note: reviewNote.trim() || null }));
      setShowReviewRequestModal(false);
      toast.success('선생님께 전달했어요');
    } catch { toast.error('전송 실패. 다시 시도해 주세요'); }
    finally { setSubmittingReview(false); }
  };

  // remediationToolIds
  const weakStepToolIds = (grading?.step_feedback || []).filter(s => s.status === 'partial' || s.status === 'wrong').map(s => s.tool_id).filter(Boolean);
  const errorToolIds = (grading?.error_locations || []).map(e => e.tool_id).filter(Boolean);
  const gapToolIds = (grading?.gap_locations || []).map(g => g.tool_id).filter(Boolean);
  const remediationToolIds = [...new Set([...weakStepToolIds, ...errorToolIds, ...gapToolIds])];

  return {
    attempt, setAttempt, problem, tools, loading, grading, solutions, solutionSteps,
    bookmarkedToolIds, bookmarkIdMap, problemBookmarked, problemBookmarkId,
    showOCR, setShowOCR, showDetail, setShowDetail, showMatchedSolution, setShowMatchedSolution,
    tooltipTool, setTooltipTool,
    showOcrComplainModal, setShowOcrComplainModal, ocrHint, setOcrHint, handleOCRReRecognize, reRecognizing,
    showReviewRequestModal, setShowReviewRequestModal, reviewNote, setReviewNote, submittingReview, handleSubmitReview,
    feedbackSent, setFeedbackSent,
    toggleBookmark, toggleProblemBookmark,
    remediationToolIds,
  };
}