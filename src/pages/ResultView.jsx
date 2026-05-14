import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { redirectByRole } from '@/lib/auth-utils';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import MathRenderer from '@/components/MathRenderer';
import { InlineLoader } from '@/components/LoadingOverlay';
import LoadingOverlay from '@/components/LoadingOverlay';
import ScoreBadge, { ScoreSummaryText, StepStatusBadge } from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, RotateCcw, ChevronRight, Clock, Wrench, Star, BookOpen, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SolutionCard from '@/components/SolutionCard';
import { toast } from 'sonner';
import { GRADING_SCHEMA, buildToolsBlock, buildSolutionsBlock, buildGradingPrompt, sanitizeGradingResult } from '@/lib/grading';

// REGRADE_PROMPT_TEMPLATE and REGRADE_SCHEMA moved to lib/grading.js

function StepCard({ step, getToolName, onToolClick, onBookmarkTool, bookmarkedToolIds }) {
  const [open, setOpen] = useState(step.status !== 'correct');
  const toolName = getToolName ? getToolName(step.tool_id) : null;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      step.status === 'correct' ? 'border-emerald-200 bg-emerald-50/30' :
      step.status === 'partial' ? 'border-amber-200 bg-amber-50/30' :
      step.status === 'missing' ? 'border-slate-200 bg-slate-50/30' :
      'border-red-200 bg-red-50/30'
    }`}>
      <button
        className="w-full p-4 flex items-start justify-between gap-3 text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
            {step.step_number}단계
          </span>
          {toolName ? (
            <div className="inline-flex items-center gap-0 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onToolClick && onToolClick(step.tool_id); }}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-primary/20 transition-colors"
              >
                <Wrench className="w-3 h-3" />
                {toolName}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onBookmarkTool && onBookmarkTool(step.tool_id); }}
                className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-r-full hover:bg-primary/20 transition-colors"
              >
                <Star className={`w-3 h-3 ${bookmarkedToolIds?.has(step.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            </div>
          ) : (
            step.student_step && (
              <span className="text-sm text-foreground truncate">
                {step.student_step.slice(0, 50)}
              </span>
            )
          )}
          <StepStatusBadge status={step.status} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> :
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-current/10">
          {step.student_step && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">학생 풀이</p>
              <div className="bg-white/60 rounded-lg p-3 text-sm">
                <MathRenderer content={step.student_step} />
              </div>
            </div>
          )}
          {step.comment && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">피드백</p>
              <p className="text-sm text-foreground">{step.comment}</p>
            </div>
          )}
          {step.correction && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">정정</p>
              <div className="bg-white/60 rounded-lg p-3 text-sm border border-current/10">
                <MathRenderer content={step.correction} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]); // MathTool[]
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);
  const [showOCR, setShowOCR] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showOcrComplainModal, setShowOcrComplainModal] = useState(false);
  const [ocrHint, setOcrHint] = useState('');
  const [reRecognizing, setReRecognizing] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const [tooltipTool, setTooltipTool] = useState(null); // tool entity for tooltip modal
  const [bookmarkedToolIds, setBookmarkedToolIds] = useState(new Set());
  const [bookmarkIdMap, setBookmarkIdMap] = useState(new Map());
  const [problemBookmarked, setProblemBookmarked] = useState(false);
  const [problemBookmarkId, setProblemBookmarkId] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [solutionSteps, setSolutionSteps] = useState([]);
  const [showMatchedSolution, setShowMatchedSolution] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadAttempt();
  }, [id]);

  // isFastGrade: 빠른 채점으로 즉시 처리된 케이스
  const isFastGradeRef = useRef(false);

  const summaryMode = searchParams.get('summary') === 'true';

  // showDetail: Stage 3 오답은 처음부터 펼침, summaryMode면 항상 접힘
  useEffect(() => {
    if (attempt) {
      const fast = attempt.answer_check_result === 'correct' || attempt.answer_check_result === 'correct_via_solution';
      isFastGradeRef.current = fast;
      if (summaryMode) { setShowDetail(false); return; }
      if (!fast) setShowDetail(true);
    }
  }, [attempt?.id, summaryMode]);

  // 5초 polling — 빠른 채점 + 백그라운드 완료 대기
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
            try {
              const parsed = JSON.parse(updated.claude_grade_json);
              setGrading(parsed?.response ?? parsed);
            } catch {}
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
      const attempts = await base44.entities.StudentAttempt.filter({ id }, '-created_date', 1);
      if (attempts.length > 0) {
        const a = attempts[0];
        if (user) {
          const isOwn = a.student_id === user.id;
          const isAdmin = user.role === 'admin';
          let isMyStudent = false;
          if (user.role === 'teacher' && !isOwn) {
            // Teacher can view their students' attempts
            // Fetch students who belong to classes the teacher manages
            try {
              const allClasses = await base44.entities.Class.filter({ main_teacher_id: user.id }, 'name', 100);
              const classIds = new Set(allClasses.map(c => c.id));
              if (classIds.size > 0) {
                const allStudents = await base44.entities.User.list('full_name', 500);
                isMyStudent = allStudents.some(s => s.id === a.student_id && classIds.has(s.class_id));
              }
            } catch { isMyStudent = false; }
          }
          if (!isOwn && !isAdmin && !isMyStudent) {
            toast.error('이 결과를 볼 권한이 없어요');
            navigate(redirectByRole(user));
            return;
          }
        }
        setAttempt(a);
        if (a.claude_grade_json) {
          try {
            const parsed = JSON.parse(a.claude_grade_json);
            setGrading(parsed?.response ?? parsed);
          } catch {}
        }
        // setCorrectedText removed (OCR edit replaced by re-recognize modal)

        // Fetch problem + tools
        if (a.problem_id) {
          const problems = await base44.entities.Problem.filter({ id: a.problem_id }, '-created_date', 1);
          if (problems.length > 0) {
            const prob = problems[0];
            setProblem(prob);
            // Parse tool_ids and fetch MathTools
            let toolIds = [];
            try {
              const parsed = JSON.parse(prob.tool_ids || '[]');
              if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
            } catch {}
            // Fetch tools + solutions + bookmarks in parallel
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

            if (toolIds.length > 0) {
              setTools((allTools || []).filter(t => toolIds.includes(t.tool_id)));
            }

            // Solutions + steps
            if (sols && sols.length > 0) {
              setSolutions(sols);
              const stepArrays = await Promise.all(
                sols.map(s => base44.entities.SolutionStep.filter({ solution_id: s.solution_id }, 'sequence_order', 50))
              );
              setSolutionSteps(stepArrays.flat());
            }

            // Bookmarks
            if (user && myToolBookmarks) {
              const bookmarkedSet = new Set(myToolBookmarks.filter(b => toolIds.includes(b.tool_id)).map(b => b.tool_id));
              const idMap = new Map(myToolBookmarks.map(b => [b.tool_id, b.id]));
              setBookmarkedToolIds(bookmarkedSet);
              setBookmarkIdMap(idMap);
            }
            if (user && myProblemBookmarks && myProblemBookmarks.length > 0) {
              setProblemBookmarked(true);
              setProblemBookmarkId(myProblemBookmarks[0].id);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Build toolId → name/entity map
  const toolNameMap = new Map(tools.map(t => [t.tool_id, t.name]));
  const toolEntityMap = new Map(tools.map(t => [t.tool_id, t]));

  const getToolName = (toolId) => {
    if (!toolId) return null;
    return toolNameMap.get(toolId) || null;
  };

  const getToolEntity = (toolId) => toolEntityMap.get(toolId) || null;

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
      const created = await base44.entities.BookmarkedTool.create({
        user_id: user.id,
        tool_id: tool.tool_id,
        context_attempt_id: attempt.id,
      });
      setBookmarkedToolIds(prev => new Set([...prev, tool.tool_id]));
      setBookmarkIdMap(prev => new Map(prev).set(tool.tool_id, created.id));
      toast.success('즐겨찾기에 추가했어요');
    }
  };

  const toggleProblemBookmark = async () => {
    if (!user || !attempt) return;
    if (problemBookmarked) {
      await base44.entities.BookmarkedProblem.delete(problemBookmarkId);
      setProblemBookmarked(false);
      setProblemBookmarkId(null);
      toast.success('문제 즐겨찾기를 해제했어요');
    } else {
      const created = await base44.entities.BookmarkedProblem.create({
        user_id: user.id,
        problem_id: attempt.problem_id,
        problem_content_preview: (attempt.problem_content || '').slice(0, 100),
        problem_domain: attempt.problem_domain || '',
      });
      setProblemBookmarked(true);
      setProblemBookmarkId(created.id);
      toast.success('문제를 즐겨찾기에 추가했어요');
    }
  };

  const handleToolChipClick = (toolId) => {
    const entity = getToolEntity(toolId);
    if (entity) setTooltipTool(entity);
  };

  const handleOCRReRecognize = async () => {
    if (!attempt || !problem) return;
    setReRecognizing(true);
    setShowOcrComplainModal(false);
    try {
      const imageUrl = attempt.canvas_image_url || attempt.photo_url;
      if (!imageUrl) { toast.error('원본 풀이 이미지가 없어요'); return; }

      const reRecognizePrompt = `당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.

이 학생의 손글씨 풀이를 OCR 해주세요. JSON 으로 응답.

이전 OCR 결과는 다음과 같았어요:
"""
${attempt.ocr_text || ''}
"""

학생이 이 OCR 결과가 잘못됐다고 신고했어요.
${ocrHint.trim() ? `학생 힌트: "${ocrHint.trim()}"` : ''}
좀 더 신중히 다시 인식해 주세요. LaTeX 표기 정확히, 학생이 안 쓴 내용 추가 금지.

JSON: {"markdown_text": "풀이 (LaTeX 포함)", "confidence": 0-100, "notes": "특이사항"}`;

      const ocrRaw = await base44.integrations.Core.InvokeLLM({
        prompt: reRecognizePrompt,
        file_urls: [imageUrl],
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            markdown_text: { type: 'string' },
            confidence: { type: 'number' },
            notes: { type: 'string' },
          },
          required: ['markdown_text'],
        },
      });
      const newOcrText = (ocrRaw?.response ?? ocrRaw)?.markdown_text || '';
      if (!newOcrText) throw new Error('OCR 결과 없음');

      const problemText = (() => {
        try { return JSON.parse(problem.content || '[]').map(b => b.text || '').join('\n\n'); }
        catch { return String(problem.content || ''); }
      })();
      const verifiedAnswer = problem.verified_answer || '';
      const toolIds = (() => { try { return JSON.parse(problem.tool_ids || '[]'); } catch { return []; } })();
      const [allTools, allSolutions] = await Promise.all([
        toolIds.length > 0 ? base44.entities.MathTool.list('name', 100) : Promise.resolve([]),
        base44.entities.Solution.filter({ problem_id: problem.problem_id }, 'priority', 20),
      ]);
      const relevantTools = allTools.filter(t => toolIds.includes(t.tool_id));
      const toolsBlock = buildToolsBlock(relevantTools);
      const solutionsSlice = allSolutions.slice(0, 5);
      const solutionIds = solutionsSlice.map(s => s.solution_id);
      const stepsBySol = new Map();
      if (solutionIds.length > 0) {
        const stepArrays = await Promise.all(
          solutionIds.map(sid => base44.entities.SolutionStep.filter({ solution_id: sid }, 'sequence_order', 50))
        );
        solutionIds.forEach((sid, i) => stepsBySol.set(sid, stepArrays[i]));
      }
      const solutionsBlock = buildSolutionsBlock(solutionsSlice, stepsBySol, relevantTools);
      const gradingPrompt = buildGradingPrompt({
        problemText, verifiedAnswer, solutionsBlock, toolsBlock,
        studentOcrSolution: newOcrText,
        studentAnswer: attempt.student_answer || '',
      });
      const gradeRaw = await base44.integrations.Core.InvokeLLM({
        prompt: gradingPrompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: GRADING_SCHEMA,
      });
      const gradeResult = sanitizeGradingResult(gradeRaw?.response ?? gradeRaw, {
        validToolIds: new Set(relevantTools.map(t => t.tool_id)),
        validSolutionIds: new Set(solutionIds),
        stepsBySolutionId: stepsBySol,
      });
      await base44.entities.StudentAttempt.update(attempt.id, {
        ocr_text: newOcrText,
        claude_grade_json: JSON.stringify(gradeResult),
        score: gradeResult.score || 0,
        correctness: gradeResult.correctness || 'wrong',
      });
      setGrading(gradeResult);
      setAttempt(prev => ({
        ...prev,
        ocr_text: newOcrText,
        score: gradeResult.score || 0,
        correctness: gradeResult.correctness || 'wrong',
        claude_grade_json: JSON.stringify(gradeResult),
      }));
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

  const effectiveFrom = attempt?.assignment_id ? 'assignment' : (fromParam || null);

  const BACK_LABELS = {
    assignment: '숙제로 돌아가기',
    type: '단원으로 돌아가기',
    domain: '영역으로 돌아가기',
    tool: '도구로 돌아가기',
    wrong: '틀린 문제 목록으로',
    recommend: '추천 목록으로',
  };
  const backLabel = BACK_LABELS[effectiveFrom] || '문제 탭으로';

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

  const NEXT_LABELS = {
    assignment: '다음 문제 (숙제)',
    type: '같은 단원 다음 문제',
    domain: '같은 영역 다음 문제',
    tool: '같은 도구 다음 문제',
    wrong: '다음 틀린 문제',
    recommend: '다음 추천 문제',
  };
  const nextLabel = NEXT_LABELS[effectiveFrom] || '다음 문제';

  const handleNextProblem = async () => {
    if (effectiveFrom === 'assignment') {
      const assignment = (await base44.entities.Assignment.filter({ id: attempt.assignment_id })).pop();
      if (assignment) {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const myAttempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: attempt.assignment_id }, '-submitted_at', 100
        );
        const doneIds = new Set(myAttempts.map(a => a.problem_id));
        const remaining = problemIds.filter(id => !doneIds.has(id));
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
      // StudentAttempt.problem_id is Problem.id (entity id)
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

  if (loading) return <AppLayout><InlineLoader message="결과 불러오는 중..." /></AppLayout>;
  if (!attempt) return <AppLayout><div className="text-center py-12 text-muted-foreground">결과를 찾을 수 없어요.</div></AppLayout>;

  // Only the student who submitted can perform write actions (not teachers viewing student work)
  const viewerIsOwner = attempt?.student_id === user?.id;

  const isFastGrade = attempt.answer_check_result === 'correct' || attempt.answer_check_result === 'correct_via_solution';

  const problemText = (() => {
    if (!problem) return '';
    try {
      const arr = JSON.parse(problem.content || '[]');
      return Array.isArray(arr) ? arr.map(b => b.text || '').join('\n\n') : String(problem.content || '');
    } catch { return String(problem.content || ''); }
  })();

  const score = attempt.score || 0;
  const scoreColor = score >= 80 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' :
                     score >= 40 ? 'from-amber-50 to-amber-100/50 border-amber-200' :
                     'from-red-50 to-red-100/50 border-red-200';

  const steps = grading?.step_feedback || [];
  const gaps = grading?.gap_locations || [];
  const errors = grading?.error_locations || [];

  // toolMap for SolutionCard
  const toolMapForSolution = new Map(tools.map(t => [t.tool_id, t]));

  // matched solution
  const matchedSolution = grading?.matched_solution_id
    ? solutions.find(s => s.solution_id === grading.matched_solution_id)
    : null;
  const otherSolutions = solutions.filter(s => s.solution_id !== grading?.matched_solution_id);

  // UX-3: 도구 추출 (partial/wrong step_feedback + error_locations + gap_locations)
  const weakStepToolIds = (grading?.step_feedback || [])
    .filter(s => s.status === 'partial' || s.status === 'wrong')
    .map(s => s.tool_id).filter(Boolean);
  const errorToolIds = (grading?.error_locations || []).map(e => e.tool_id).filter(Boolean);
  const gapToolIds = (grading?.gap_locations || []).map(g => g.tool_id).filter(Boolean);
  const remediationToolIds = [...new Set([...weakStepToolIds, ...errorToolIds, ...gapToolIds])];

  const handleRemediation = async (toolId) => {
    try {
      const allProblems = await base44.entities.Problem.list('-created_date', 1000);
      const matching = allProblems.filter(p => {
        try { return JSON.parse(p.tool_ids || '[]').includes(toolId); } 
        catch { return false; }
      });
      const pool = matching.filter(p => p.id !== attempt.problem_id);
      if (pool.length === 0) {
        toast.error('이 도구의 다른 문제가 없어요');
        return;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      navigate(`/problem/${pick.id}?remediation_for=${attempt.id}&target_tool=${toolId}`);
    } catch {
      toast.error('문제를 불러오지 못했어요');
    }
  };

  return (
    <AppLayout>
      {reRecognizing && <LoadingOverlay stage="grading" />}

      {/* Tool tooltip modal */}
      {tooltipTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setTooltipTool(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <Card className="relative z-10 p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-primary" />
              <p className="font-semibold text-foreground">{tooltipTool.name}</p>
            </div>
            {tooltipTool.goal && <p className="text-sm text-muted-foreground mb-2">{tooltipTool.goal}</p>}
            {tooltipTool.description && <p className="text-sm text-foreground">{tooltipTool.description}</p>}
            <div className="flex gap-2 mt-4">
              {user && viewerIsOwner && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleBookmark(tooltipTool)}>
                  <Star className={`w-3 h-3 mr-1 ${bookmarkedToolIds.has(tooltipTool.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                  {bookmarkedToolIds.has(tooltipTool.tool_id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
                </Button>
              )}
              <Button size="sm" onClick={() => setTooltipTool(null)}>닫기</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-5 pb-8">
        {/* Back + Problem bookmark */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/problems')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> 문제 탭
          </Button>
          {user && attempt && viewerIsOwner && (
            <button
              onClick={toggleProblemBookmark}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-sm"
            >
              <Star className={`w-4 h-4 ${problemBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-muted-foreground text-xs">{problemBookmarked ? '문제 저장됨' : '문제 저장'}</span>
            </button>
          )}
        </div>

        {/* 점수 카드 — 항상 표시 */}
        <Card className={`p-6 bg-gradient-to-br ${scoreColor} border text-center`}>
          <div className="text-6xl font-bold mb-2" style={{
            color: score >= 80 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626'
          }}>
            {score}점
          </div>
          <div className="text-xl font-semibold mt-2">
            <ScoreSummaryText score={score} />
          </div>
          {grading?.summary && (
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{grading.summary}</p>
          )}
          {/* 메타 정보 */}
          <div className="flex gap-2 text-xs text-muted-foreground justify-center mt-3 flex-wrap">
            {problem?.domain_name && <span>{problem.domain_name}</span>}
            {attempt?.submitted_at && (
              <>
                <span>·</span>
                <span>{new Date(attempt.submitted_at).toLocaleDateString('ko-KR', {
                  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </>
            )}
            {attempt?.duration_sec > 0 && (
              <>
                <span>·</span>
                <span>{Math.floor(attempt.duration_sec / 60)}분 {attempt.duration_sec % 60}초</span>
              </>
            )}
          </div>
          {/* 매칭 별해 뱃지 */}
          {grading?.matched_solution_id && matchedSolution && (
            <div className="mt-3">
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                🎯 풀이 #{matchedSolution.priority} 방식{matchedSolution.priority === 1 ? ' (대표)' : ''}
              </span>
            </div>
          )}
          {/* 강사 검토 뱃지 */}
          {attempt?.review_resolved_at && (
            <div className="mt-2">
              <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                📝 선생님 검토 완료
              </span>
            </div>
          )}
        </Card>

        {/* 문제 + 학생 답 / 정답 / 상세 버튼 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 좌측: 문제 본문 */}
          <Card className="lg:col-span-2 p-4 bg-blue-50/50 border-blue-100">
            <p className="text-xs text-muted-foreground mb-2 font-medium">문제</p>
            {problem ? (
              <MathRenderer content={problemText} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">문제를 불러오는 중...</p>
            )}
          </Card>

          {/* 우측: 학생 답 / 실제 정답 / 상세 버튼 */}
          <div className="space-y-2">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">학생 정답</p>
              {attempt?.student_answer ? (
                <MathRenderer
                  content={attempt.student_answer.includes('$') ? attempt.student_answer : `$${attempt.student_answer}$`}
                  className="text-base"
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">(답을 적지 않음)</p>
              )}
            </Card>

            {problem?.verified_answer && (
              <Card className="p-3 bg-emerald-50 border-emerald-200">
                <p className="text-xs text-emerald-700 mb-1 font-medium">실제 정답</p>
                <MathRenderer
                  content={problem.verified_answer.includes('$') ? problem.verified_answer : `$${problem.verified_answer}$`}
                  className="text-base"
                />
              </Card>
            )}

            {/* "내 풀이 상세" 버튼 — !showDetail 일 때만 */}
            {!showDetail && (
              isFastGrade && !grading ? (
                <Card className="p-3 border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                    </svg>
                    <p className="text-xs font-medium">AI 채점 중...</p>
                  </div>
                  <Button size="sm" disabled className="w-full">내 풀이 상세 (분석 중...)</Button>
                </Card>
              ) : isFastGrade && attempt.tool_mapping_status === 'failed' ? (
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">상세 채점 실패</p>
                </Card>
              ) : (
                <Button className="w-full" onClick={() => setShowDetail(true)}>
                  내 풀이 상세 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )
            )}
          </div>
        </div>

        {/* Tools used chips */}
        {showDetail && tools.length > 0 && grading && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              {grading.matched_solution_id ? '당신의 풀이에 사용된 도구' : '이 문제의 풀이 도구'}
            </p>
            <div className="flex flex-wrap gap-2">
              {tools.map(tool => (
                <div key={tool.tool_id} className="inline-flex items-center gap-0 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  <button
                    onClick={() => setTooltipTool(tool)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-primary/20 rounded-l-full transition-colors"
                  >
                    <Wrench className="w-3 h-3" />
                    {tool.name}
                  </button>
                  {user && viewerIsOwner && (
                    <button
                      onClick={() => toggleBookmark(tool)}
                      className="px-2 py-1.5 hover:bg-primary/20 rounded-r-full transition-colors"
                      aria-label={bookmarkedToolIds.has(tool.tool_id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
                    >
                      <Star className={`w-3 h-3 ${bookmarkedToolIds.has(tool.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OCR quality warning */}
        {showDetail && grading?.ocr_quality_concern && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 text-sm font-medium">필기 인식에 의문이 있어요</p>
              <p className="text-amber-700 text-sm mt-0.5">{grading.ocr_quality_concern}</p>
            </div>
          </div>
        )}

        {/* Low confidence warning */}
        {showDetail && grading?.confidence !== undefined && grading.confidence < 70 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 text-sm">채점 자신감이 낮아요 ({grading.confidence}점). 관리자가 검토할 거예요.</p>
          </div>
        )}

        {/* Step feedback with grouping by matched_solution_step_number */}
        {showDetail && steps.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">단계별 피드백</h2>
            <div className="space-y-2">
              {(() => {
                // Group steps by matched_solution_step_number
                const stepGroups = [];
                let current = null;
                for (const sf of steps) {
                  const key = sf.matched_solution_step_number ?? null;
                  if (current && current.key === key) {
                    current.items.push(sf);
                  } else {
                    current = { key, items: [sf] };
                    stepGroups.push(current);
                  }
                }

                return stepGroups.map((g, gi) => {
                  const solStep = matchedSolution && g.key
                    ? solutionSteps.find(s => s.solution_id === matchedSolution.solution_id && s.sequence_order === g.key)
                    : null;
                  const toolName = solStep ? getToolName(solStep.tool_id) : null;

                  return (
                    <div key={gi} className="space-y-2">
                      {/* Group header — show whenever matched solution step + tool resolved */}
                      {solStep && toolName && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2 pl-1">
                          <span>📍 정해 Step {g.key} — {toolName} (학생 풀이 {g.items.length}줄에 해당)</span>
                        </div>
                      )}
                      {/* Individual step cards */}
                      {g.items.map((step, i) => (
                        <StepCard
                          key={`${gi}-${i}`}
                          step={step}
                          getToolName={getToolName}
                          onToolClick={handleToolChipClick}
                          onBookmarkTool={(toolId) => { const t = tools.find(t => t.tool_id === toolId); if (t) toggleBookmark(t); }}
                          bookmarkedToolIds={bookmarkedToolIds}
                        />
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Gap locations */}
        {showDetail && gaps.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2 text-amber-700">빠진 단계</h2>
            <div className="space-y-2">
              {gaps.map((gap, i) => {
                const toolName = getToolName(gap.tool_id);
                const toolEntity = getToolEntity(gap.tool_id);
                return (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {toolName && toolEntity ? (
                        <div className="inline-flex items-center gap-0">
                          <button
                            onClick={() => setTooltipTool(toolEntity)}
                            className="text-xs bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-amber-200 transition-colors"
                          >
                            <Wrench className="w-3 h-3" />
                            {toolName}
                          </button>
                          {user && viewerIsOwner && (
                            <button
                              onClick={() => toggleBookmark(toolEntity)}
                              className="text-xs bg-amber-200/60 text-amber-800 px-1.5 py-0.5 rounded-r-full hover:bg-amber-200 transition-colors"
                            >
                              <Star className={`w-3 h-3 ${bookmarkedToolIds.has(gap.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </button>
                          )}
                        </div>
                      ) : null}
                      <p className="text-xs text-amber-600 font-medium">
                        {toolName ? '— 여기에 단계가 빠졌어요' : '여기에 단계가 빠졌어요'}
                      </p>
                    </div>
                    <p className="text-sm text-amber-800">{gap.description}</p>
                    {gap.expected_step && (
                      <div className="mt-2 bg-white/60 rounded-lg p-2">
                        <MathRenderer content={gap.expected_step} className="text-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error locations */}
        {showDetail && errors.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2 text-red-700">오류 위치</h2>
            <div className="space-y-2">
              {errors.map((err, i) => {
                const toolName = getToolName(err.tool_id);
                const toolEntity = getToolEntity(err.tool_id);
                const errTypeLabel = err.error_type === 'calculation' ? '계산 오류' :
                                     err.error_type === 'conceptual' ? '개념 오류' : '표기 오류';
                return (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {toolName && toolEntity ? (
                        <div className="inline-flex items-center gap-0">
                          <button
                            onClick={() => setTooltipTool(toolEntity)}
                            className="text-xs bg-red-200/60 text-red-800 px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-red-200 transition-colors"
                          >
                            <Wrench className="w-3 h-3" />
                            {toolName}
                          </button>
                          {user && viewerIsOwner && (
                            <button
                              onClick={() => toggleBookmark(toolEntity)}
                              className="text-xs bg-red-200/60 text-red-800 px-1.5 py-0.5 rounded-r-full hover:bg-red-200 transition-colors"
                            >
                              <Star className={`w-3 h-3 ${bookmarkedToolIds.has(err.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </button>
                          )}
                        </div>
                      ) : null}
                      <p className="text-xs text-red-600 font-medium">{toolName ? `— ${errTypeLabel}` : errTypeLabel}</p>
                    </div>
                    <p className="text-sm text-red-800 mb-2">{err.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-red-100 rounded p-2">
                        <p className="text-red-500 mb-1">학생 풀이</p>
                        <MathRenderer content={err.student_wrote} />
                      </div>
                      <div className="bg-emerald-100 rounded p-2">
                        <p className="text-emerald-600 mb-1">올바른 풀이</p>
                        <MathRenderer content={err.correct_form} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 매칭된 별해 배너 */}
        {showDetail && matchedSolution && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
            <button
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => setShowMatchedSolution(o => !o)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="font-medium text-foreground">풀이 #{matchedSolution.priority} 방식으로 푸셨네요!</span>
                {matchedSolution.priority === 1 && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">대표</span>
                )}
              </div>
              {showMatchedSolution ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {showMatchedSolution && (
              <div className="border-t px-4 pb-4 pt-2">
                <SolutionCard
                  solution={matchedSolution}
                  steps={solutionSteps.filter(s => s.solution_id === matchedSolution.solution_id)}
                  toolMap={toolMapForSolution}
                  defaultOpen={true}
                />
              </div>
            )}
          </div>
        )}

        {/* 다른 풀이도 있어요 */}
        {showDetail && otherSolutions.length > 0 && grading && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {grading.matched_solution_id ? '다른 풀이도 있어요' : '이 문제의 풀이 방법들'}
              <span className="text-xs text-muted-foreground font-normal">({otherSolutions.length}개)</span>
            </h2>
            <div className="space-y-2">
              {otherSolutions.map(sol => (
                <SolutionCard
                  key={sol.id}
                  solution={sol}
                  steps={solutionSteps.filter(s => s.solution_id === sol.solution_id)}
                  toolMap={toolMapForSolution}
                  defaultOpen={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* OCR section — showDetail + ocr_text 있을 때만 */}
        {showDetail && (attempt.ocr_text || attempt.ocr_corrected_text) && (
          <div>
            <button
              className="w-full flex items-center justify-between p-3 bg-muted rounded-xl"
              onClick={() => setShowOCR(o => !o)}>
              <span className="text-sm font-medium text-muted-foreground">OCR 인식 결과 보기</span>
              {showOCR ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showOCR && (
              <Card className="mt-2 p-4 bg-slate-50">
                <p className="text-xs text-muted-foreground mb-2">Gemini가 인식한 풀이</p>
                <pre className="text-sm whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border">
                  {attempt.ocr_corrected_text || attempt.ocr_text}
                </pre>
                {viewerIsOwner && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowOcrComplainModal(true)}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    OCR이 잘못됐어요
                  </Button>
                )}
              </Card>
            )}
          </div>
        )}

        {/* 검토 요청 - 학생만, 정답 케이스 제외 */}
        {viewerIsOwner && !attempt.review_requested && !isFastGrade && (
          <Card className="p-3 border-dashed">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">채점이 이상한가요?</p>
                <p className="text-xs text-muted-foreground mt-0.5">선생님께 검토를 요청할 수 있어요</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowReviewRequestModal(true)}>
                검토 요청하기
              </Button>
            </div>
          </Card>
        )}
        {viewerIsOwner && attempt.review_requested && !attempt.review_resolved_at && (
          <Card className="p-3 bg-emerald-50 border-emerald-200">
            <p className="text-sm text-emerald-700">✓ 선생님께 다시 봐달라고 요청했어요</p>
          </Card>
        )}
        {viewerIsOwner && attempt.teacher_review_json && (
          <Card className="p-4 bg-primary/5 border-primary/30">
            <p className="text-sm font-medium mb-2">📝 선생님이 다시 채점했어요</p>
            {(() => {
              try {
                const tr = JSON.parse(attempt.teacher_review_json);
                return (
                  <>
                    {tr.score_adjustment !== undefined && (
                      <p className="text-sm">점수 보정: {tr.score_adjustment > 0 ? '+' : ''}{tr.score_adjustment}점</p>
                    )}
                    {tr.comment && (
                      <p className="text-sm text-foreground mt-2">{tr.comment}</p>
                    )}
                  </>
                );
              } catch { return null; }
            })()}
          </Card>
        )}

        {/* 추천 피드백 카드 */}
        {viewerIsOwner && fromRecommend && !feedbackSent && (
          <Card className="p-4 bg-primary/5 border-primary/30">
            <p className="text-sm font-medium mb-2">이 추천 문제는 어땠나요?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                try {
                  await base44.entities.RecommendationFeedback.create({
                    user_id: user.id,
                    attempt_id: attempt.id,
                    problem_id: attempt.problem_id,
                    reason_type: recommendReason || 'unknown',
                    feedback: 'helpful',
                  });
                  setFeedbackSent(true);
                  toast.success('피드백 감사합니다');
                } catch { toast.error('피드백 저장 실패'); }
              }}>
                👍 도움 됐어요
              </Button>
              <Button size="sm" variant="outline" onClick={async () => {
                try {
                  await base44.entities.RecommendationFeedback.create({
                    user_id: user.id,
                    attempt_id: attempt.id,
                    problem_id: attempt.problem_id,
                    reason_type: recommendReason || 'unknown',
                    feedback: 'not_helpful',
                  });
                  setFeedbackSent(true);
                  toast.success('피드백 감사합니다');
                } catch { toast.error('피드백 저장 실패'); }
              }}>
                👎 안 맞아요
              </Button>
            </div>
          </Card>
        )}
        {viewerIsOwner && fromRecommend && feedbackSent && (
          <p className="text-xs text-muted-foreground">피드백을 보내주셔서 감사해요</p>
        )}

        {/* UX-3: 도구별 보강 카드 */}
        {viewerIsOwner && (attempt.correctness === 'partial' || attempt.correctness === 'wrong') && 
         remediationToolIds.length > 0 && 
         attempt.attempt_type !== 'remediation_retry' && (
          <div className="space-y-2">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              도구 보강하기
            </h2>
            <p className="text-xs text-muted-foreground">
              이 문제에서 부족했던 도구를 그 도구의 다른 문제로 연습할 수 있어요
            </p>
            {remediationToolIds.map(toolId => {
              const toolName = getToolName(toolId) || toolId;
              return (
                <Card key={toolId} className="p-3 flex items-center justify-between border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="text-sm font-medium truncate">{toolName}</p>
                  </div>
                  <Button size="sm" onClick={() => handleRemediation(toolId)}>
                    연습하기 <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        {/* 보강 풀이 결과 - 원래 문제로 돌아가기 */}
        {viewerIsOwner && attempt.attempt_type === 'remediation_retry' && attempt.parent_attempt_id && (
          <Card className="p-4 bg-primary/5 border-primary/30">
            <p className="text-sm font-medium mb-2">📚 보강 풀이 완료!</p>
            <p className="text-xs text-muted-foreground mb-3">원래 문제로 돌아가 다시 풀어볼까요?</p>
            <Button size="sm" className="w-full" onClick={async () => {
              const parents = await base44.entities.StudentAttempt.filter({ id: attempt.parent_attempt_id }, '-created_date', 1);
              if (parents.length > 0) {
                navigate(`/problem/${parents[0].problem_id}`);
              } else {
                toast.error('원래 문제를 찾지 못했어요');
              }
            }}>
              원래 문제 다시 풀기 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        )}

        {/* Action buttons */}
        {viewerIsOwner && attempt.attempt_type !== 'remediation_retry' && attempt.attempt_type !== 'remediation_practice' && (
          <div className="space-y-2 pt-2">
            <Button variant="outline" className="w-full" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
            </Button>
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
        )}

          {/* OCR 재인식 모달 */}
          {showOcrComplainModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                 onClick={() => !reRecognizing && setShowOcrComplainModal(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <Card className="relative z-10 p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h2 className="font-semibold mb-1">OCR 다시 인식 요청</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  어떤 부분이 잘못됐나요? (선택 — AI에게 힌트로 전달)
                </p>
                <Textarea
                  value={ocrHint}
                  onChange={e => setOcrHint(e.target.value)}
                  placeholder="예: x가 y로 인식됐어요"
                  className="min-h-20"
                  disabled={reRecognizing}
                />
                <div className="flex gap-2 mt-4 justify-end">
                  <Button variant="outline" disabled={reRecognizing} onClick={() => setShowOcrComplainModal(false)}>
                    취소
                  </Button>
                  <Button disabled={reRecognizing} onClick={handleOCRReRecognize}>
                    {reRecognizing ? '재인식 중...' : '다시 인식 요청'}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* 검토 요청 모달 */}
          {showReviewRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !submittingReview && setShowReviewRequestModal(false)}>
           <div className="absolute inset-0 bg-black/40" />
           <Card className="relative z-10 p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
             <h2 className="font-semibold mb-1">채점 다시 요청</h2>
             <p className="text-xs text-muted-foreground mb-3">어떤 점이 이상한가요? (선택)</p>
             <Textarea
               value={reviewNote}
               onChange={e => setReviewNote(e.target.value)}
               placeholder="예: 제 풀이가 맞다고 생각해요"
               className="min-h-24"
               disabled={submittingReview}
             />
             <div className="flex gap-2 mt-4 justify-end">
               <Button variant="outline" disabled={submittingReview} onClick={() => setShowReviewRequestModal(false)}>
                 취소
               </Button>
               <Button disabled={submittingReview} onClick={async () => {
                 setSubmittingReview(true);
                 try {
                   await base44.entities.StudentAttempt.update(attempt.id, {
                     review_requested: true,
                     review_request_note: reviewNote.trim() || null,
                   });
                   setAttempt(prev => ({ ...prev, review_requested: true, review_request_note: reviewNote.trim() || null }));
                   setShowReviewRequestModal(false);
                   toast.success('선생님께 전달했어요');
                 } catch {
                   toast.error('전송 실패. 다시 시도해 주세요');
                 } finally {
                   setSubmittingReview(false);
                 }
               }}>
                 요청 보내기
               </Button>
             </div>
           </Card>
          </div>
          )}
          </div>
          </AppLayout>
          );
          }