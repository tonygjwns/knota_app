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
import { ArrowLeft, Upload, Image, Send, AlertCircle, Star } from 'lucide-react';
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

const parseContents = (c) => {
  try {
    const arr = JSON.parse(c || '[]');
    return arr.map(b => b.text || '').join('\n\n');
  } catch { return c || ''; }
};

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
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState(null);
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
        // Check bookmark status
        if (user) {
          const existing = await base44.entities.BookmarkedProblem.filter({ user_id: user.id, problem_id: p[0].id }, '-created_date', 1);
          if (existing.length > 0) {
            setIsBookmarked(true);
            setBookmarkId(existing[0].id);
          }
        }
      } else {
        setError('문제를 찾을 수 없어요.');
      }
    } catch {
      setError('문제를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = async () => {
    if (!user || !problem) return;
    if (isBookmarked) {
      await base44.entities.BookmarkedProblem.delete(bookmarkId);
      setIsBookmarked(false);
      setBookmarkId(null);
      toast.success('즐겨찾기에서 제거했어요');
    } else {
      const problemText = parseProblemText(problem.content);
      const created = await base44.entities.BookmarkedProblem.create({
        user_id: user.id,
        problem_id: problem.id,
        problem_content_preview: problemText.slice(0, 100),
        problem_domain: problem.domain_name || '',
      });
      setIsBookmarked(true);
      setBookmarkId(created.id);
      toast.success('즐겨찾기에 추가했어요');
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

      // Fetch tools + solutions in parallel
      const toolIds = (() => { try { return JSON.parse(problem.tool_ids || '[]'); } catch { return []; } })();
      const [allTools, allSolutions] = await Promise.all([
        toolIds.length > 0 ? base44.entities.MathTool.list('name', 100) : Promise.resolve([]),
        base44.entities.Solution.filter({ problem_id: problem.problem_id }, 'priority', 20),
      ]);

      let relevantTools = [];
      let toolsBlock = '(이 문제에 매핑된 도구 없음)';
      if (toolIds.length > 0) {
        relevantTools = allTools.filter(t => toolIds.includes(t.tool_id));
        if (relevantTools.length > 0) {
          toolsBlock = relevantTools.map(t =>
            `- tool_id: "${t.tool_id}"\n  name: "${t.name}"\n  goal: "${t.goal || ''}"`
          ).join('\n');
        }
      }
      window.__relevantToolIds = new Set(relevantTools.map(t => t.tool_id));

      // Fetch solution steps (up to 5 solutions)
      const solutions = allSolutions.slice(0, 5);
      const solutionIds = solutions.map(s => s.solution_id);
      const stepsBySol = new Map();
      if (solutionIds.length > 0) {
        const stepArrays = await Promise.all(
          solutionIds.map(sid =>
            base44.entities.SolutionStep.filter({ solution_id: sid }, 'sequence_order', 50)
          )
        );
        solutionIds.forEach((sid, i) => stepsBySol.set(sid, stepArrays[i]));
      }

      // Build solutions block for prompt
      const solutionsBlock = solutions.length === 0
        ? '(별해 데이터 없음)'
        : solutions.map(sol => {
            const body = parseContents(sol.contents);
            const steps = (stepsBySol.get(sol.solution_id) || [])
              .sort((a, b) => a.sequence_order - b.sequence_order);
            const pathText = steps.map(s => {
              const toolName = relevantTools.find(t => t.tool_id === s.tool_id)?.name || s.tool_id;
              return `  Step ${s.sequence_order}: 도구="${s.tool_id}" (${toolName})
    선택사유: ${s.reason || ''}
    적용: ${s.application || ''}
    결과: ${s.appended_info || ''}`;
            }).join('\n');
            return `<solution priority="${sol.priority}" id="${sol.solution_id}">
<body>
${body}
</body>
<path>
${pathText}
</path>
</solution>`;
          }).join('\n\n');

      const gradingPrompt = `당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생의 손글씨 풀이(OCR)를 받아, problem + verified_answer + 큐레이션된 별해 N개와
비교해 채점합니다. 출력은 GradingOutput JSON.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. 부정 표현 금지 ("틀렸어요" X)
3. 별해 매칭 — 학생 풀이가 <solutions> 안의 어느 별해와 가장 비슷한지 판정해
   matched_solution_id에 그 별해의 solution_id를 채워주세요. 어느 것과도 비슷하지 않으면 null.
   별해가 0개면 항상 null.
4. 정답 처리 — 학생이 매칭 별해의 path와 일치하면서 verified_answer에 도달하면 score 80+ (correct).
   사소한 계산/표기 오류는 허용. 개념적 오류만 score 크게 차감.
5. 오류 분류:
   - calculation = 산수/부호 오류 (소소)
   - conceptual = 개념/공식 오류 (큼)
   - notation = 표기 오류 (작음)
6. 할루시 방지 — 학생이 안 쓴 내용 추측 금지. 확신 없으면 confidence ↓
7. OCR 검증 — 의심스러우면 ocr_quality_concern에 명시
8. Actionable feedback — 모호한 표현 금지. 어느 자리/왜를 명시.
9. 매듭 매핑 — step_feedback/error_locations/gap_locations 의 tool_id는 반드시
   <available_tools> 안 ID만 사용. 매칭된 별해의 path 도구를 우선 매핑.
   불명확하면 null.

## 점수 기준
- 100 = 정답 + 풀이 완전
- 80-99 = 정답 + 사소 오류
- 60-79 = 정답 + 일부 누락
- 40-59 = 풀이 일부 + 정답 미도달
- 20-39 = 풀이 일부 + 다수 오류
- 1-19 = 형식만
- 0 = 풀이 없음

## 톤
정합: "잘 풀었어요!", "이 부분 다시 살펴볼까요?", "다른 방법도 시도해보세요"
금지: "틀렸어요", "X", "잘못했어요"

<problem>
${problemText}
</problem>

<verified_answer>
${problem.verified_answer || '(검증된 정답 없음)'}
</verified_answer>

<solutions>
${solutionsBlock}
</solutions>

<available_tools>
${toolsBlock}
</available_tools>

학생 풀이가 어느 별해 path와 가장 가까운지 판정해 matched_solution_id에 채우고,
step_feedback[].tool_id 는 그 별해의 도구로 매핑하세요.

<student_ocr_solution>
${ocrText}
</student_ocr_solution>

위 학생 풀이를 GradingOutput 양식으로 채점해 주세요.`;

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
                  tool_id: { type: 'string', description: '매칭된 별해의 path에서 매핑된 도구 ID. 불명확하면 null.' }
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
                  tool_id: { type: 'string', description: '매칭된 별해의 path에서 매핑된 도구 ID. 불명확하면 null.' }
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
        }
      });

      const gradeResult = gradeRaw?.response ?? gradeRaw;

      // Sanitize tool_ids against registry (defense-in-depth)
      const validIds = window.__relevantToolIds || new Set();
      const sanitize = (arr) => (arr || []).map(item => ({
        ...item,
        tool_id: validIds.has(item.tool_id) ? item.tool_id : null
      }));
      gradeResult.step_feedback = sanitize(gradeResult.step_feedback);
      gradeResult.error_locations = sanitize(gradeResult.error_locations);
      gradeResult.gap_locations = sanitize(gradeResult.gap_locations);

      // Sanitize matched_solution_id
      const validSolIds = new Set(solutionIds);
      if (!validSolIds.has(gradeResult.matched_solution_id)) {
        gradeResult.matched_solution_id = null;
        gradeResult.matched_solution_priority = null;
      }

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
    <AppLayout fullWidth>
      {stage && <LoadingOverlay stage={stage} />}

      {/* 가로 레이아웃: 좌 = 문제, 우 = 풀이 */}
      <div className="flex flex-col lg:flex-row lg:gap-0 lg:h-full">

        {/* ── 좌측: 문제 영역 ── */}
        <div className="lg:w-2/5 lg:border-r border-border flex flex-col lg:overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="btn-touch">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              {problem?.domain_name && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {problem.domain_name}
                </span>
              )}
              <h1 className="text-base font-bold mt-0.5">문제</h1>
            </div>
            {user && problem && (
              <button
                onClick={toggleBookmark}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="즐겨찾기"
              >
                <Star className={`w-5 h-5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
              </button>
            )}
          </div>

          {/* Problem text — 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto p-4">
            {problem && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                <MathRenderer content={problemText} className="text-base" />
              </div>
            )}
          </div>

        </div>

        {/* ── 우측: 풀이 작성 영역 ── */}
        <div className="lg:flex-1 flex flex-col lg:overflow-hidden">
          <div className="p-4 border-b border-border">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="canvas">✍️ 필기로 풀기</TabsTrigger>
                <TabsTrigger value="photo">📷 사진으로 올리기</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 풀이 영역 — 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'canvas' && (
              <DrawingCanvas onImageReady={setCanvasBlob} height={600} />
            )}
            {activeTab === 'photo' && (
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="미리보기" className="max-h-96 rounded-lg object-contain" />
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-foreground" />
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
            )}
          </div>

          {/* 제출 버튼 — 풀이 영역 하단 고정 */}
          <div className="p-4 border-t border-border">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 text-sm font-medium">{error}</p>
                  <Button variant="link" className="text-red-600 p-0 h-auto text-xs mt-0.5" onClick={handleSubmit}>
                    다시 시도
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 btn-touch" onClick={() => navigate('/home')}>
                메인으로
              </Button>
              <Button className="flex-[2] btn-touch" size="lg" onClick={handleSubmit}>
                <Send className="w-4 h-4 mr-2" />
                제출
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}