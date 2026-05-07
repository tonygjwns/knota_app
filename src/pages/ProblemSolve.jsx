import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import MathRenderer from '@/components/MathRenderer';
import DrawingCanvas from '@/components/DrawingCanvas';
import LoadingOverlay, { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Upload, Image, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const OCR_SYSTEM_PROMPT = `당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.

학생의 손글씨 수학 풀이 이미지를 받아, 구조화된 markdown + LaTeX 양식으로 추출합니다.

## 추출 원칙
1. 양식 보존 — 학생이 쓴 그대로. 임의로 추가/변경하지 않음
2. 수식은 LaTeX — $...$ (inline) 또는 $$...$$ (block)
3. 행/단계 양식 보존 — \n으로 구분. enum marker (①②③) 그대로 보존
4. 할루시 방지 — 학생이 쓰지 않은 내용 추측 X. 명확하지 않으면 unclear_regions에 기록 + confidence 낮춤

## 수식 표기
정확한 표기: 분수 \frac{a}{b}, 제곱 a^{2}, 제곱근 \sqrt{x}, 등호/부등호 =, \neq, \leq, \geq

## 출력 양식
다음 JSON 형식으로 응답해 주세요:
{
  "markdown_text": "학생의 풀이 전체 (markdown + LaTeX)",
  "confidence": 85,
  "notes": "특이사항 (있을 경우)"
}`;

function formatSolutionPath(solutionPath) {
  if (!solutionPath || (Array.isArray(solutionPath) && solutionPath.length === 0)) {
    return '(정답 풀이 path 없음)';
  }
  if (typeof solutionPath === 'string') {
    try {
      const parsed = JSON.parse(solutionPath);
      if (Array.isArray(parsed)) return formatSolutionPath(parsed);
    } catch {}
    return solutionPath;
  }
  const sorted = [...solutionPath].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
  return sorted.map((step, i) => {
    const n = step.sequence_order ?? (i + 1);
    const toolName = step.tool_name || step.tool_id || '(도구 미상)';
    return `Step ${n}: 도구 = "${toolName}"
  - 사유: ${step.reason || ''}
  - 적용: ${step.application || ''}
  - 결과: ${step.appended_info || ''}`;
  }).join('\n\n');
}

export default function ProblemSolve() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment_id');
  const remediationFor = searchParams.get('remediation_for');

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(null); // null | 'ocr' | 'grading'
  const [error, setError] = useState(null);
  const [canvasBlob, setCanvasBlob] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('canvas');
  const startedAt = useRef(new Date().toISOString());
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProblem();
    startedAt.current = new Date().toISOString();
  }, [id]);

  const loadProblem = async () => {
    setLoading(true);
    try {
      const p = await base44.entities.Problem.filter({ id }, '-created_date', 1);
      if (p.length > 0) {
        setProblem(p[0]);
      } else {
        setError('문제를 찾을 수 없어요.');
      }
    } catch {
      setError('문제를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const parseProblemText = (content) => {
    try {
      const arr = typeof content === 'string' ? JSON.parse(content) : content;
      if (Array.isArray(arr)) return arr.map(b => b.text).join('\n');
      return String(content);
    } catch {
      return String(content || '');
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 해요.');
      return;
    }
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const compressImage = (blob) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1280;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((resultBlob) => {
          const file = new File([resultBlob], 'solution.jpg', { type: 'image/jpeg' });
          resolve(file);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // 압축 실패 시 원본을 File로 변환
        const file = new File([blob], 'solution.jpg', { type: blob.type || 'image/jpeg' });
        resolve(file);
      };
      img.src = url;
    });
  };

  const handleSubmit = async () => {
    const imageSource = activeTab === 'canvas' ? canvasBlob : photoFile;
    if (!imageSource) {
      toast.error('풀이를 작성해 주세요');
      return;
    }
    if (!problem || !user) return;

    setError(null);
    const submittedAt = new Date().toISOString();
    const durationSec = Math.round(
      (new Date(submittedAt) - new Date(startedAt.current)) / 1000
    );

    try {
      // Compress image
      setStage('ocr');
      const compressed = await compressImage(imageSource);
      
      // Upload image
      const { file_url: imageUrl } = await base44.integrations.Core.UploadFile({ file: compressed });

      // OCR via Gemini using InvokeLLM with vision
      const ocrPrompt = `다음 이미지는 학생의 손글씨 수학 풀이입니다. OCR해서 JSON으로 응답해 주세요.
      
형식: {"markdown_text": "풀이 텍스트 (LaTeX 포함)", "confidence": 85, "notes": null}

${OCR_SYSTEM_PROMPT}`;

      const ocrRaw = await base44.integrations.Core.InvokeLLM({
        prompt: ocrPrompt,
        file_urls: [imageUrl],
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            markdown_text: { type: 'string' },
            confidence: { type: 'number' },
            notes: { type: 'string' }
          }
        }
      });

      const ocrResult = ocrRaw?.response ?? ocrRaw;
      const ocrText = ocrResult?.markdown_text || '';
      if (!ocrText) throw new Error('OCR 결과가 없어요');

      // Build grading prompt
      setStage('grading');
      const problemText = parseProblemText(problem.content);

      const gradingPrompt = `당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생의 손글씨 풀이(OCR 추출 결과)를 받아, problem + verified_answer + agent_solution + 정답 풀이 path와 비교해 채점합니다. 출력은 GradingOutput 스키마 JSON.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. "틀렸어요" 같은 부정적 표현 금지. "이 부분 다시 살펴볼까요?" 형태로
3. 별해 인정 — 학생 풀이가 verified_answer와 다른 경로여도 정답 도달 시 정합으로 인정
4. 오류 분류:
   - calculation = 산수/부호/정리 오류 (소소함 — 점수 약간 ↓)
   - conceptual = 개념/공식 오류 (큼 — 점수 많이 ↓)
   - notation = 표기 오류 (작음 — 점수 약간 ↓)
5. 할루시 방지 — 학생이 쓰지 않은 내용 추측 금지. 확신 없으면 confidence ↓
6. OCR 검증 — OCR 결과가 의심스러우면 ocr_quality_concern에 구체적 우려 텍스트 명시
7. Actionable feedback — "다시 살펴봐요" 같은 모호한 말 금지. 어느 자리/왜를 step_feedback, gap_locations, error_locations에 명시
8. 매듭(도구) 매핑 — error_locations 와 gap_locations 의 각 항목에서 오류/공백이 correct_solution_path 의 어느 도구에 해당하는지 식별 가능하면 tool_id 필드에 그 도구 ID를 적어주세요. correct_solution_path의 'Step N: 도구 = "X"' 양식을 참고하세요. 식별 불가시 null.

## 점수 기준
- 100 = 정답 + 풀이 완전 + 표기 정합
- 80-99 = 정답 + 풀이 정합 + 사소한 오류 (산수/표기)
- 60-79 = 정답 도달 + 풀이 일부 누락 (공백)
- 40-59 = 풀이 일부 정합 + 정답 미도달
- 20-39 = 풀이 일부 정합 + 다수 오류
- 1-19 = 풀이 형식만 일부 정합
- 0 = 풀이 없음 / 완전 오답

## 톤
정합 표현: "잘 풀었어요!", "여기까지 정합!", "이 부분 다시 살펴볼까요?", "별해도 가능해요"
금지 표현: "틀렸어요", "X", "잘못했어요"

<problem>
${problemText}
</problem>

<verified_answer>
${problem.verified_answer || '(검증된 정답 없음)'}
</verified_answer>

<agent_solution>
${problem.agent_solution || '(agent 풀이 없음)'}
</agent_solution>

<correct_solution_path>
${formatSolutionPath(problem.solution_path)}
</correct_solution_path>

<student_ocr_solution>
${ocrText}
</student_ocr_solution>

위 학생 풀이를 GradingOutput JSON 스키마 양식으로 채점해 주세요.`;

      const gradeRaw = await base44.integrations.Core.InvokeLLM({
        prompt: gradingPrompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            schema_version: { type: 'string', enum: ['v1'] },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            correctness: { type: 'string', enum: ['correct', 'partial', 'wrong'] },
            summary: { type: 'string', description: '1-2 문장 한국어 격려+정정 요약. 해요체.' },
            step_feedback: {
              type: 'array',
              description: '학생 풀이의 매 step별 피드백',
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
                  expected_step: { type: 'string' },
                  tool_id: { type: 'string', description: 'correct_solution_path 에서 매핑된 도구 ID. 불명확하면 null.' }
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
                  tool_id: { type: 'string', description: 'correct_solution_path 에서 매핑된 도구 ID. 불명확하면 null.' }
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

      const gradeResult = gradeRaw?.response ?? gradeRaw;

      // Save attempt — ocr_corrected_text는 학생이 직접 수정할 때만 저장 (기본 흐름은 null)
      const attempt = await base44.entities.StudentAttempt.create({
        student_id: user.id,
        student_email: user.email,
        problem_id: problem.id,
        problem_content: problemText.slice(0, 500),
        problem_domain: problem.domain_name || '',
        [activeTab === 'canvas' ? 'canvas_image_url' : 'photo_url']: imageUrl,
        ocr_text: ocrText,
        ocr_corrected_text: null,
        claude_grade_json: JSON.stringify(gradeResult),
        score: gradeResult?.score || 0,
        correctness: gradeResult?.correctness || 'wrong',
        started_at: startedAt.current,
        submitted_at: submittedAt,
        duration_sec: durationSec,
        assignment_id: assignmentId || null,
      });

      setStage(null);
      navigate(`/result/${attempt.id}`);
    } catch (err) {
      setStage(null);
      console.error(err);
      setError('잠시 문제가 생겼어요. 다시 시도해 주세요');
    }
  };

  if (loading) return <AppLayout><InlineLoader message="문제 불러오는 중..." /></AppLayout>;

  const problemText = problem ? parseProblemText(problem.content) : '';

  return (
    <AppLayout>
      {stage && <LoadingOverlay stage={stage} />}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            {problem?.domain_name && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {problem.domain_name}
              </span>
            )}
            <h1 className="text-lg font-bold mt-1">문제</h1>
          </div>
        </div>

        {/* Problem text */}
        {problem && (
          <Card className="p-5 bg-blue-50/50 border-blue-100">
            <MathRenderer content={problemText} className="text-base" />
          </Card>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">{error}</p>
              <Button variant="link" className="text-red-600 p-0 h-auto mt-1" onClick={handleSubmit}>
                다시 시도
              </Button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="canvas">✍️ 필기로 풀기</TabsTrigger>
              <TabsTrigger value="photo">📷 사진으로 올리기</TabsTrigger>
            </TabsList>
            <TabsContent value="canvas" className="mt-4">
              <DrawingCanvas onImageReady={setCanvasBlob} />
            </TabsContent>
            <TabsContent value="photo" className="mt-4">
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="미리보기" className="max-h-64 rounded-lg object-contain" />
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center">
                        <Image className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-sm text-center">
                        사진을 탭해서 업로드하세요<br />
                        <span className="text-xs">JPEG, PNG, HEIC (최대 10MB)</span>
                      </p>
                    </>
                  )}
                </div>
                {photoPreview && (
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> 다른 사진 선택
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 btn-touch" onClick={() => navigate('/home')}>
            메인으로
          </Button>
          <Button className="flex-2 btn-touch flex-[2]" size="lg" onClick={handleSubmit}>
            <Send className="w-4 h-4 mr-2" />
            제출
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}