import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import MathRenderer from '@/components/MathRenderer';
import { InlineLoader } from '@/components/LoadingOverlay';
import LoadingOverlay from '@/components/LoadingOverlay';
import ScoreBadge, { ScoreSummaryText, StepStatusBadge } from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, RotateCcw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const REGRADE_PROMPT_TEMPLATE = (problemContent, correctedText) => `당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생이 OCR 결과를 직접 수정한 버전으로 재채점합니다.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. "틀렸어요" 같은 부정적 표현 금지. "이 부분 다시 살펴볼까요?" 형태로
3. 별해 인정 — 다른 경로여도 정답 도달 시 정합으로 인정
4. 오류 분류: calculation / conceptual / notation
5. 할루시 방지 — 학생이 쓰지 않은 내용 추측 금지
6. Actionable feedback — 어느 자리/왜를 명시

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

<student_ocr_solution>
${correctedText}
</student_ocr_solution>

위 학생 풀이를 GradingOutput JSON 스키마 양식으로 채점해 주세요.`;

function StepCard({ step }) {
  const [open, setOpen] = useState(step.status !== 'correct');
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
          <StepStatusBadge status={step.status} />
          {step.student_step && (
            <span className="text-sm text-foreground truncate">{step.student_step.slice(0, 50)}</span>
          )}
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
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(null);
  const [showOCR, setShowOCR] = useState(false);
  const [editingOCR, setEditingOCR] = useState(false);
  const [correctedText, setCorrectedText] = useState('');
  const [regrading, setRegrading] = useState(false);
  const [showAlt, setShowAlt] = useState(false);

  useEffect(() => {
    loadAttempt();
  }, [id]);

  const loadAttempt = async () => {
    setLoading(true);
    try {
      const attempts = await base44.entities.StudentAttempt.filter({ id }, '-created_date', 1);
      if (attempts.length > 0) {
        const a = attempts[0];
        setAttempt(a);
        if (a.claude_grade_json) {
          try {
            setGrading(JSON.parse(a.claude_grade_json));
          } catch {}
        }
        setCorrectedText(a.ocr_corrected_text || a.ocr_text || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegrade = async () => {
    if (!attempt || !correctedText.trim()) return;
    setRegrading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: REGRADE_PROMPT_TEMPLATE(attempt.problem_content, correctedText),
        model: 'claude_sonnet_4_6',
        response_json_schema: {
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
                  correction: { type: 'string' }
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
                  expected_step: { type: 'string' }
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
                  error_type: { type: 'string', enum: ['calculation', 'conceptual', 'notation'] }
                },
                required: ['description', 'student_wrote', 'correct_form', 'error_type']
              }
            },
            alternative_solution: { type: 'string' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            ocr_quality_concern: { type: 'string' }
          },
          required: ['schema_version', 'score', 'correctness', 'summary', 'step_feedback', 'gap_locations', 'error_locations', 'confidence']
        }
      });

      // Update attempt
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
    const problems = await base44.entities.Problem.list('-created_date', 100);
    if (problems.length > 0) {
      const idx = Math.floor(Math.random() * problems.length);
      navigate(`/problem/${problems[idx].id}`);
    }
  };

  if (loading) return <AppLayout><InlineLoader message="결과 불러오는 중..." /></AppLayout>;
  if (!attempt) return <AppLayout><div className="text-center py-12 text-muted-foreground">결과를 찾을 수 없어요.</div></AppLayout>;

  const score = attempt.score || 0;
  const scoreColor = score >= 80 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' :
                     score >= 40 ? 'from-amber-50 to-amber-100/50 border-amber-200' :
                     'from-red-50 to-red-100/50 border-red-200';

  const steps = grading?.step_feedback || [];
  const gaps = grading?.gap_locations || [];
  const errors = grading?.error_locations || [];

  return (
    <AppLayout>
      {regrading && <LoadingOverlay stage="grading" />}
      <div className="space-y-5 pb-8">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> 홈으로
        </Button>

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
              {steps.map((step, i) => <StepCard key={i} step={step} />)}
            </div>
          </div>
        )}

        {/* Gap locations */}
        {gaps.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2 text-amber-700">빠진 단계</h2>
            <div className="space-y-2">
              {gaps.map((gap, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs text-amber-600 font-medium mb-1">여기에 단계가 빠졌어요</p>
                  <p className="text-sm text-amber-800">{gap.description}</p>
                  {gap.expected_step && (
                    <div className="mt-2 bg-white/60 rounded-lg p-2">
                      <MathRenderer content={gap.expected_step} className="text-sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error locations */}
        {errors.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-2 text-red-700">오류 위치</h2>
            <div className="space-y-2">
              {errors.map((err, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs text-red-600 font-medium mb-1">
                    {err.error_type === 'calculation' ? '계산 오류' :
                     err.error_type === 'conceptual' ? '개념 오류' : '표기 오류'}
                  </p>
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
              ))}
            </div>
          </div>
        )}

        {/* Alternative solution */}
        {grading?.alternative_solution && (
          <div>
            <button
              className="w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl"
              onClick={() => setShowAlt(o => !o)}>
              <span className="font-medium text-blue-800">이런 방법도 있어요! 💡</span>
              {showAlt ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
            </button>
            {showAlt && (
              <div className="bg-blue-50/50 border border-blue-100 border-t-0 rounded-b-xl p-4">
                <MathRenderer content={grading.alternative_solution} className="text-sm" />
              </div>
            )}
          </div>
        )}

        {/* OCR section */}
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

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button variant="outline" size="sm" className="btn-touch" onClick={() => navigate('/')}>
            메인으로
          </Button>
          <Button variant="outline" size="sm" className="btn-touch"
                  onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
            <RotateCcw className="w-4 h-4 mr-1" /> 다시 풀기
          </Button>
          <Button size="sm" className="btn-touch" onClick={handleNextProblem}>
            다음 문제 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}