import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const statusLabel = (s) => ({ correct: '정답', partial: '부분', missing: '누락', wrong: '오답' }[s] || s);

export default function TeacherReviewDetail() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith('/admin');
  const backPath = isAdminMode ? '/admin/review' : '/teacher/review';
  const [attempt, setAttempt] = useState(null);
  const [student, setStudent] = useState(null);
  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]);
  const [grading, setGrading] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [stepsBySol, setStepsBySol] = useState(new Map());
  const [selectedSolutionId, setSelectedSolutionId] = useState(null);
  const [stepJudgments, setStepJudgments] = useState({});
  const [finalScore, setFinalScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [attemptId]);

  const initStepJudgments = (solId, solStepsMap, gradingData) => {
    const steps = solStepsMap.get(solId) || [];
    const initial = {};
    steps.forEach(s => {
      const sf = (gradingData?.step_feedback || []).find(x => x.matched_solution_step_number === s.sequence_order);
      initial[s.sequence_order] = {
        status: sf?.status || 'missing',
        tool_id: s.tool_id,
      };
    });
    return initial;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [a] = await base44.entities.StudentAttempt.filter({ id: attemptId }, '-created_date', 1);
      if (!a) { toast.error('찾을 수 없어요'); navigate(backPath); return; }
      setAttempt(a);
      setFinalScore(a.score || 0);

      let parsedGrading = null;
      if (a.claude_grade_json) {
        try {
          const parsed = JSON.parse(a.claude_grade_json);
          parsedGrading = parsed?.response ?? parsed;
          setGrading(parsedGrading);
        } catch {}
      }

      // Fetch student name
      if (a.student_id) {
        try {
          const [stu] = await base44.entities.User.filter({ id: a.student_id }, '-created_date', 1);
          if (stu) setStudent({ name: stu.full_name || null, email: a.student_email });
          else setStudent({ name: null, email: a.student_email });
        } catch (e) {
          console.warn('Student fetch failed:', e);
          setStudent({ name: null, email: a.student_email });
        }
      }

      let prob = null;
      let allToolsList = [];
      if (a.problem_id) {
        try {
          const [p] = await base44.entities.Problem.filter({ id: a.problem_id }, '-created_date', 1);
          if (p) {
            prob = p;
            setProblem(p);
            let toolIds = [];
            try { toolIds = JSON.parse(p.tool_ids || '[]'); } catch {}
            if (toolIds.length > 0) {
              allToolsList = await base44.entities.MathTool.list('name', 100);
              setTools(allToolsList.filter(t => toolIds.includes(t.tool_id)));
            }

            // Fetch solutions + steps
            const sols = await base44.entities.Solution.filter({ problem_id: p.problem_id }, 'priority', 20);
            setSolutions(sols);
            const solStepsMap = new Map();
            if (sols.length > 0) {
              const stepArrays = await Promise.all(
                sols.map(s => base44.entities.SolutionStep.filter({ solution_id: s.solution_id }, 'sequence_order', 50))
              );
              sols.forEach((s, i) => solStepsMap.set(s.solution_id, stepArrays[i]));
            }
            setStepsBySol(solStepsMap);

            // Determine initial selectedSolutionId
            const defaultSolId = parsedGrading?.matched_solution_id || (sols[0]?.solution_id ?? null);
            setSelectedSolutionId(defaultSolId);

            // Load existing teacher_review_json or init from AI
            if (a.teacher_review_json) {
              try {
                const tr = JSON.parse(a.teacher_review_json);
                setStepJudgments(tr.step_judgments || initStepJudgments(defaultSolId, solStepsMap, parsedGrading));
                if (tr.selected_solution_id) setSelectedSolutionId(tr.selected_solution_id);
                if (tr.final_score !== undefined) setFinalScore(tr.final_score);
                setComment(tr.comment || '');
              } catch {}
            } else {
              setStepJudgments(initStepJudgments(defaultSolId, solStepsMap, parsedGrading));
            }
          }
        } catch (e) {
          console.error('Problem/solution fetch failed:', e);
          toast.error('문제/별해 데이터를 불러오지 못했어요: ' + (e.message || ''));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSolutionChange = (solId) => {
    setSelectedSolutionId(solId);
    const newSteps = stepsBySol.get(solId) || [];
    const initial = {};
    newSteps.forEach(s => {
      const sf = (grading?.step_feedback || []).find(x => x.matched_solution_step_number === s.sequence_order);
      initial[s.sequence_order] = {
        status: sf?.status || 'missing',
        tool_id: s.tool_id,
      };
    });
    setStepJudgments(initial);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const teacherReview = {
        selected_solution_id: selectedSolutionId,
        step_judgments: stepJudgments,
        final_score: finalScore,
        comment: comment.trim() || null,
        reviewed_at: new Date().toISOString(),
      };
      await base44.entities.StudentAttempt.update(attempt.id, {
        teacher_review_json: JSON.stringify(teacherReview),
        review_resolved_at: new Date().toISOString(),
        score: finalScore,
      });
      toast.success('검토 결과가 저장됐어요');
      navigate(backPath);
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoader message="불러오는 중..." />;
  if (!attempt) return null;

  const toolMap = new Map(tools.map(t => [t.tool_id, t]));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 검토 큐
        </Button>
        <h1 className="text-xl font-bold">검토 상세</h1>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium">
          {student?.name || student?.email || attempt.student_email}
          {student?.name && <span className="text-xs text-muted-foreground ml-2">({student.email})</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{attempt.problem_domain}</p>
        {attempt.review_request_note && (
          <div className="mt-3 p-3 bg-muted/40 rounded">
            <p className="text-xs text-muted-foreground mb-1">학생 메모</p>
            <p className="text-sm">{attempt.review_request_note}</p>
          </div>
        )}
      </Card>

      {problem && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">문제</p>
          <MathRenderer content={(() => {
            try { return JSON.parse(problem.content || '[]').map(b => b.text).join('\n'); }
            catch { return problem.content; }
          })()} className="text-sm" />
        </Card>
      )}

      {(attempt.canvas_image_url || attempt.photo_url) && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">학생 풀이</p>
          <img src={attempt.canvas_image_url || attempt.photo_url} alt="풀이" className="max-w-full rounded" />
        </Card>
      )}

      {/* 별해 선택 */}
      {solutions.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-2">학생이 사용한 별해</p>
          <Select value={selectedSolutionId || ''} onValueChange={handleSolutionChange}>
            <SelectTrigger><SelectValue placeholder="별해 선택" /></SelectTrigger>
            <SelectContent>
              {solutions.map(sol => (
                <SelectItem key={sol.solution_id} value={sol.solution_id}>
                  풀이 #{sol.priority}{sol.priority === 1 ? ' (대표)' : ''}
                  {sol.solution_id === grading?.matched_solution_id ? ' 🤖 AI 매칭' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {/* 단계별 보정 — 별해 단계 기준 */}
      {selectedSolutionId && (() => {
        const solSteps = (stepsBySol.get(selectedSolutionId) || []).slice().sort((a, b) => a.sequence_order - b.sequence_order);
        const unmapped = (grading?.step_feedback || []).filter(sf =>
          sf.matched_solution_step_number === null || sf.matched_solution_step_number === undefined
        );
        return (
          <Card className="p-4">
            <p className="text-sm font-medium mb-3">단계별 보정 (별해 단계 기준)</p>
            <div className="space-y-3">
              {solSteps.map(solStep => {
                const seq = solStep.sequence_order;
                const aiFeedback = (grading?.step_feedback || []).find(sf => sf.matched_solution_step_number === seq);
                const aiStatus = aiFeedback?.status || 'missing';
                const aiToolId = aiFeedback?.tool_id || solStep.tool_id;
                const judgment = stepJudgments[seq] || { status: aiStatus, tool_id: aiToolId };
                const aiToolName = aiToolId ? (toolMap.get(aiToolId)?.name || aiToolId) : '없음';

                return (
                  <div key={seq} className="p-3 border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">정해 Step {seq}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      도구: {toolMap.get(solStep.tool_id)?.name || solStep.tool_id}
                      {solStep.application && ` · ${solStep.application}`}
                    </p>

                    {aiFeedback?.student_step ? (
                      <div className="bg-muted/40 rounded p-2 mb-2">
                        <p className="text-xs text-muted-foreground mb-1">학생 풀이</p>
                        <p className="text-sm">{aiFeedback.student_step}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic mb-2">학생 풀이에 매핑된 단계 없음</p>
                    )}

                    <div className="text-xs text-muted-foreground mb-2 p-2 bg-blue-50/50 rounded">
                      🤖 AI 판정: <span className="font-medium">{statusLabel(aiStatus)}</span> · 도구 {aiToolName}
                      {aiFeedback?.comment && <p className="mt-1">코멘트: {aiFeedback.comment}</p>}
                    </div>

                    <div className="flex gap-2">
                      <span className="text-xs self-center">✏️ 강사:</span>
                      <Select value={judgment.status} onValueChange={(v) =>
                        setStepJudgments(prev => ({ ...prev, [seq]: { ...prev[seq], status: v, tool_id: prev[seq]?.tool_id ?? aiToolId } }))}>
                        <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="correct">정답</SelectItem>
                          <SelectItem value="partial">부분</SelectItem>
                          <SelectItem value="missing">누락</SelectItem>
                          <SelectItem value="wrong">오답</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={judgment.tool_id || 'null'} onValueChange={(v) =>
                        setStepJudgments(prev => ({ ...prev, [seq]: { ...prev[seq], tool_id: v === 'null' ? null : v, status: prev[seq]?.status ?? aiStatus } }))}>
                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="도구" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">도구 없음</SelectItem>
                          {tools.map(t => (
                            <SelectItem key={t.tool_id} value={t.tool_id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>

            {unmapped.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-amber-700 mb-2">매핑 안 된 학생 풀이 (참고용)</p>
                {unmapped.map((sf, i) => (
                  <div key={i} className="p-2 bg-amber-50/50 rounded mb-2 text-xs">
                    <p>단계 {sf.step_number}: {sf.student_step}</p>
                    <p className="text-muted-foreground mt-1">🤖 AI: {statusLabel(sf.status)}{sf.comment && ` · ${sf.comment}`}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* 점수 보정 */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-2">점수 보정</p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">AI 점수: {attempt.score}점</span>
          <input
            type="number" min="0" max="100" step="5"
            value={finalScore}
            onChange={(e) => setFinalScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="w-24 h-9 px-3 rounded-md border border-input bg-background text-sm"
          />
          <span className="text-sm">점</span>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium mb-2">학생에게 보낼 코멘트 (선택)</p>
        <Textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="예: 풀이 자체는 잘 하셨어요. 점수 보정해 드릴게요."
          className="min-h-24" />
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background pt-3 pb-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate(backPath)}>
          취소
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장 — 학생 결과에 반영'}
        </Button>
      </div>
    </div>
  );
}