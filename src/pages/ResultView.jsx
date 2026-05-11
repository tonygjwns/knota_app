import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, RotateCcw, ChevronRight, Clock, Wrench, Star, BookOpen } from 'lucide-react';
import SolutionCard from '@/components/SolutionCard';
import { toast } from 'sonner';

const REGRADE_PROMPT_TEMPLATE = (problemContent, correctedText, toolsBlock = '', solutionsBlock = '(별해 데이터 없음)', verifiedAnswer = '(검증된 정답 없음)') => `당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생이 OCR 결과를 직접 수정한 버전으로 재채점합니다.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. "틀렸어요" 같은 부정적 표현 금지. "이 부분 다시 살펴볼까요?" 형태로
3. 별해 매칭 — 학생 풀이가 <solutions> 안의 어느 별해와 가장 비슷한지 판정해
   matched_solution_id에 그 별해의 solution_id를 채워주세요. 어느 것과도 비슷하지 않으면 null.
   별해가 0개면 항상 null.
4. 정답 처리 — 학생이 매칭 별해의 path와 일치하면서 verified_answer에 도달하면 score 80+ (correct).
   사소한 계산/표기 오류는 허용. 개념적 오류만 score 크게 차감.
5. 오류 분류: calculation / conceptual / notation
6. 할루시 방지 — 학생이 쓰지 않은 내용 추측 금지
7. Actionable feedback — 어느 자리/왜를 명시
8. 매듭 매핑 (엄격) — step_feedback, error_locations, gap_locations 의 각 항목에서 tool_id 를 채울 때, 반드시 <available_tools> 안에 있는 tool_id 중 하나만 사용하세요. 매칭된 별해의 path 도구를 우선 매핑. 불명확하면 null. <available_tools> 가 비어있으면 모두 null.

## 점수 기준
- 100 = 정답 + 풀이 완전 + 표기 정합
- 80-99 = 정답 + 풀이 정합 + 사소한 오류
- 60-79 = 정답 도달 + 풀이 일부 누락
- 40-59 = 풀이 일부 정합 + 정답 미도달
- 20-39 = 풀이 일부 정합 + 다수 오류
- 1-19 = 풀이 형식만 일부 정합
- 0 = 풀이 없음 / 완전 오답

<problem>
${problemContent || ''}
</problem>

<verified_answer>
${verifiedAnswer}
</verified_answer>

<solutions>
${solutionsBlock}
</solutions>

<available_tools>
${toolsBlock || '(도구 정보 없음)'}
</available_tools>

학생 풀이가 어느 별해 path와 가장 가까운지 판정해 matched_solution_id에 채우고,
step_feedback[].tool_id 는 그 별해의 도구로 매핑하세요.

<student_ocr_solution>
${correctedText}
</student_ocr_solution>

위 학생 풀이를 GradingOutput JSON 스키마 양식으로 채점해 주세요.`;

const REGRADE_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string', enum: ['v1'] },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    correctness: { type: 'string', enum: ['correct', 'partial', 'wrong'] },
    summary: { type: 'string' },
    step_feedback: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step_number: { type: 'integer', minimum: 1 },
          student_step: { type: 'string' },
          status: { type: 'string', enum: ['correct', 'partial', 'missing', 'wrong'] },
          comment: { type: 'string' },
          correction: { type: 'string' },
          tool_id: { type: 'string', description: 'available_tools 안의 ID 또는 null. 자유 문자열 금지.' }
        },
        required: ['step_number', 'student_step', 'status', 'comment']
      }
    },
    gap_locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          expected_step: { type: 'string' },
          tool_id: { type: 'string' }
        },
        required: ['description', 'expected_step']
      }
    },
    error_locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          student_wrote: { type: 'string' },
          correct_form: { type: 'string' },
          error_type: { type: 'string', enum: ['calculation', 'conceptual', 'notation'] },
          tool_id: { type: 'string' }
        },
        required: ['description', 'student_wrote', 'correct_form', 'error_type']
      }
    },
    matched_solution_id: { type: 'string', description: '학생 풀이와 가장 가까운 별해 solution_id. 매칭 안 되면 null. 별해 0개면 null.' },
    matched_solution_priority: { type: 'integer', description: '매칭 별해의 priority (UI 표시용). 없으면 null.' },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    ocr_quality_concern: { type: 'string' }
  },
  required: ['schema_version', 'score', 'correctness', 'summary', 'step_feedback', 'gap_locations', 'error_locations', 'confidence']
};

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
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]); // MathTool[]
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);
  const [showOCR, setShowOCR] = useState(false);
  const [editingOCR, setEditingOCR] = useState(false);
  const [correctedText, setCorrectedText] = useState('');
  const [regrading, setRegrading] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const [tooltipTool, setTooltipTool] = useState(null); // tool entity for tooltip modal
  const [dismissedRemediation, setDismissedRemediation] = useState(false);
  const [bookmarkedToolIds, setBookmarkedToolIds] = useState(new Set());
  const [bookmarkIdMap, setBookmarkIdMap] = useState(new Map());
  const [problemBookmarked, setProblemBookmarked] = useState(false);
  const [problemBookmarkId, setProblemBookmarkId] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [solutionSteps, setSolutionSteps] = useState([]);
  const [showMatchedSolution, setShowMatchedSolution] = useState(false);

  useEffect(() => {
    loadAttempt();
  }, [id]);

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
        setCorrectedText(a.ocr_corrected_text || a.ocr_text || '');

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

  const handleRegrade = async () => {
    if (!attempt || !correctedText.trim()) return;
    setRegrading(true);
    try {
      // Build tools block
      const toolsBlock = tools.length > 0
        ? tools.map(t => `- tool_id: "${t.tool_id}"\n  name: "${t.name}"\n  goal: "${t.goal || ''}"`).join('\n')
        : '(도구 정보 없음)';

      // Build solutions block (same pattern as ProblemSolve)
      const parseContentsLocal = (contents) => {
        try {
          const blocks = JSON.parse(contents || '[]');
          return Array.isArray(blocks) ? blocks.map(b => b.text || '').join('\n') : String(contents);
        } catch { return String(contents || ''); }
      };
      const solutionsSlice = solutions.slice(0, 5);
      const solutionIds = solutionsSlice.map(s => s.solution_id);
      const solutionsBlock = solutionsSlice.length === 0
        ? '(별해 데이터 없음)'
        : solutionsSlice.map(sol => {
            const body = parseContentsLocal(sol.contents);
            const steps = solutionSteps
              .filter(s => s.solution_id === sol.solution_id)
              .sort((a, b) => a.sequence_order - b.sequence_order);
            const pathText = steps.map(s => {
              const toolName = tools.find(t => t.tool_id === s.tool_id)?.name || s.tool_id;
              return `  Step ${s.sequence_order}: 도구="${s.tool_id}" (${toolName})\n    선택사유: ${s.reason || ''}\n    적용: ${s.application || ''}\n    결과: ${s.appended_info || ''}`;
            }).join('\n');
            return `<solution priority="${sol.priority}" id="${sol.solution_id}">\n<body>\n${body}\n</body>\n<path>\n${pathText}\n</path>\n</solution>`;
          }).join('\n\n');

      const verifiedAnswer = problem?.verified_answer || '(검증된 정답 없음)';

      const resultRaw = await base44.integrations.Core.InvokeLLM({
        prompt: REGRADE_PROMPT_TEMPLATE(attempt.problem_content, correctedText, toolsBlock, solutionsBlock, verifiedAnswer),
        model: 'claude_sonnet_4_6',
        response_json_schema: REGRADE_SCHEMA
      });

      const result = resultRaw?.response ?? resultRaw;

      // Sanitize tool_ids against registry
      const validIds = new Set(tools.map(t => t.tool_id));
      const sanitize = (arr) => (arr || []).map(item => ({
        ...item,
        tool_id: validIds.has(item.tool_id) ? item.tool_id : null
      }));
      result.step_feedback = sanitize(result.step_feedback);
      result.error_locations = sanitize(result.error_locations);
      result.gap_locations = sanitize(result.gap_locations);

      // Sanitize matched_solution_id
      const validSolIds = new Set(solutionIds);
      if (!validSolIds.has(result.matched_solution_id)) {
        result.matched_solution_id = null;
        result.matched_solution_priority = null;
      }

      await base44.entities.StudentAttempt.update(attempt.id, {
        ocr_corrected_text: correctedText,
        claude_grade_json: JSON.stringify(result),
        score: result?.score || 0,
        correctness: result?.correctness || 'wrong',
      });

      setGrading(result);
      setAttempt(prev => ({ ...prev, score: result?.score || 0, correctness: result?.correctness }));
      setEditingOCR(false);
      toast.success('다시 채점됐어요!');
    } catch (err) {
      console.error(err);
      toast.error('다시 채점 중 문제가 생겼어요. 다시 시도해 주세요');
    } finally {
      setRegrading(false);
    }
  };

  const handleNextProblem = async () => {
    // 숙제 안에서는 다음 안 푼 문제로 이동
    if (attempt.assignment_id) {
      const assignment = await base44.entities.Assignment.filter({ id: attempt.assignment_id }).then(r => r[0]);
      if (assignment) {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const myAttempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: attempt.assignment_id },
          '-submitted_at',
          100
        );
        const doneIds = new Set(myAttempts.map(a => a.problem_id));
        const nextId = problemIds.find(id => !doneIds.has(id));
        if (nextId) {
          navigate(`/problem/${nextId}?assignment_id=${attempt.assignment_id}`);
          return;
        }
      }
    }
    // 일반 자유 풀이
    const problems = await base44.entities.Problem.list('-created_date', 1000);
    if (problems.length > 0) {
      const idx = Math.floor(Math.random() * problems.length);
      navigate(`/problem/${problems[idx].id}`);
    }
  };

  if (loading) return <AppLayout><InlineLoader message="결과 불러오는 중..." /></AppLayout>;
  if (!attempt) return <AppLayout><div className="text-center py-12 text-muted-foreground">결과를 찾을 수 없어요.</div></AppLayout>;

  // Only the student who submitted can perform write actions
  const viewerIsOwner = attempt.student_id === user?.id;

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

  // Unique tool_ids from errors/gaps for "이 매듭 더 연습하기"
  const weakToolIds = [...new Set([
    ...errors.map(e => e.tool_id).filter(Boolean),
    ...gaps.map(g => g.tool_id).filter(Boolean),
  ])];
  const weakToolNames = weakToolIds.map(id => getToolName(id)).filter(Boolean);

  return (
    <AppLayout>
      {regrading && <LoadingOverlay stage="grading" />}

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
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> 뒤로
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

        {/* Score card */}
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
        </Card>

        {/* Tools used chips */}
        {tools.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">이 문제에 사용된 도구</p>
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
        {grading?.ocr_quality_concern && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 text-sm font-medium">필기 인식에 의문이 있어요</p>
              <p className="text-amber-700 text-sm mt-0.5">{grading.ocr_quality_concern}</p>
            </div>
          </div>
        )}

        {/* Low confidence warning */}
        {grading?.confidence !== undefined && grading.confidence < 70 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 text-sm">채점 자신감이 낮아요 ({grading.confidence}점). 관리자가 검토할 거예요.</p>
          </div>
        )}

        {/* Step feedback */}
        {steps.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">단계별 피드백</h2>
            <div className="space-y-2">
              {steps.map((step, i) => <StepCard key={i} step={step} getToolName={getToolName} onToolClick={handleToolChipClick} onBookmarkTool={(toolId) => { const t = tools.find(t => t.tool_id === toolId); if (t) toggleBookmark(t); }} bookmarkedToolIds={bookmarkedToolIds} />)}
            </div>
          </div>
        )}

        {/* Gap locations */}
        {gaps.length > 0 && (
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
        {errors.length > 0 && (
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
        {matchedSolution && (
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
        {otherSolutions.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              다른 풀이도 있어요
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

        {/* OCR section — 소유자: 편집+재채점, 강사/관리자: 읽기 전용 조회 */}
        <div>
          <button
            className="w-full flex items-center justify-between p-3 bg-muted rounded-xl"
            onClick={() => setShowOCR(o => !o)}>
            <span className="text-sm font-medium text-muted-foreground">OCR 인식 결과 보기</span>
            {showOCR ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showOCR && (
            <Card className="mt-2 p-4 bg-slate-50">
              {!editingOCR ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Gemini가 인식한 풀이</p>
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border">
                    {attempt.ocr_corrected_text || attempt.ocr_text || '(OCR 결과 없음)'}
                  </pre>
                  {viewerIsOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setCorrectedText(attempt.ocr_corrected_text || attempt.ocr_text || '');
                        setEditingOCR(true);
                      }}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      OCR이 잘못됐어요
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">OCR 결과를 수정해 주세요</p>
                  <Textarea
                    value={correctedText}
                    onChange={e => setCorrectedText(e.target.value)}
                    className="font-mono text-sm min-h-32"
                    placeholder="수정할 풀이를 입력해 주세요..."
                  />
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => setEditingOCR(false)}>취소</Button>
                    <Button size="sm" onClick={handleRegrade}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      수정해서 다시 채점
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>

        {/* 매듭 보강 권유 카드 — remediation 중이 아니면 표시 (소유자만) */}
        {viewerIsOwner && (attempt.correctness === 'partial' || attempt.correctness === 'wrong') && weakToolIds.length > 0 && attempt.attempt_type !== 'remediation_retry' && attempt.attempt_type !== 'remediation_practice' && !dismissedRemediation && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">🎯 매듭 보강하기</h3>
                <p className="text-xs text-muted-foreground">
                  {weakToolNames.length > 0
                    ? `[${weakToolNames.join(', ')}] 부분이 어려웠어요`
                    : '일부 매듭이 부족했어요'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              매듭 학습 + 유사 문제 3 개로 보강해 봐요
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => navigate(`/remediation/${attempt.id}/retry`)}
              >
                보강 시작하기
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDismissedRemediation(true)}
              >
                그냥 넘어가기
              </Button>
            </div>
          </Card>
        )}

        {/* Remediation flow buttons — 소유자만 */}
        {viewerIsOwner && attempt.attempt_type === 'remediation_retry' && (
          <div className="pt-2">
            {attempt.correctness === 'correct' ? (
              <Button size="lg" className="w-full" onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/practice/0`)}>
                매듭 보강 계속하기 (단계 3)
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/lesson`)}>
                매듭 학습하기 (단계 2)
              </Button>
            )}
          </div>
        )}

        {viewerIsOwner && attempt.attempt_type === 'remediation_practice' && (
          <div className="pt-2">
            <Button size="lg" className="w-full" onClick={() => {
              const parentAttemptId = attempt.parent_attempt_id;
              navigate(`/remediation/${parentAttemptId}/complete`);
            }}>
              🎉 보강 완료!
            </Button>
          </div>
        )}

        {/* Regular action buttons */}
        {viewerIsOwner && attempt.attempt_type !== 'remediation_retry' && attempt.attempt_type !== 'remediation_practice' && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" size="sm" className="btn-touch" onClick={() => navigate(-1)}>
              뒤로
            </Button>
            {attempt.assignment_id ? (
              <Button size="sm" className="btn-touch" onClick={() => navigate(`/assignment/${attempt.assignment_id}`)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> 숙제로 돌아가기
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="btn-touch"
                      onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
                <RotateCcw className="w-4 h-4 mr-1" /> 다시 풀기
              </Button>
            )}
          </div>
        )}
        {viewerIsOwner && attempt.attempt_type !== 'remediation_retry' && attempt.attempt_type !== 'remediation_practice' && (
          <Button size="sm" className="btn-touch w-full mt-2" onClick={handleNextProblem}>
            {attempt.assignment_id ? '다음 문제 (숙제)' : '다음 문제'} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </AppLayout>
  );
}