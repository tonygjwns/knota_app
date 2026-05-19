import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import DrawingCanvas from '@/components/DrawingCanvas';
import MathRenderer from '@/components/MathRenderer';
import LoadingOverlay, { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Upload, Image, Send, AlertCircle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { GRADING_SCHEMA, buildToolsBlock, buildSolutionsBlock, buildGradingPrompt, sanitizeGradingResult, checkAnswerFast, checkSolutionReachesAnswer } from '@/lib/grading';

const OCR_SYSTEM_PROMPT = `당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.

이미지에 학생의 손글씨 풀이가 있어요. 풀이를 텍스트로 추출해 주세요.

OCR 원칙:
1. 양식 보존 — 학생이 쓴 그대로
2. 학생이 안 쓴 내용 추측·추가 금지
3. 인식 명확하지 않으면 confidence 낮춤
4. 수식은 LaTeX — 분수 \\frac{a}{b}, 거듭제곱 a^{}, 제곱근 \\sqrt{x}

JSON:
- markdown_text: 풀이 전체 텍스트를 LaTeX 표기로
- confidence: 0-100
- notes: 특이사항`;

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
  const targetToolId = searchParams.get('target_tool');
  const fromRecommend = searchParams.get('from') === 'recommend';
  const recommendReason = searchParams.get('reason');

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(null); // null | 'ocr' | 'grading'
  const [error, setError] = useState(null);
  const [canvasBlob, setCanvasBlob] = useState(null);
  const [answerCanvasBlob, setAnswerCanvasBlob] = useState(null);
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
      let p = await base44.entities.Problem.filter({ id }, '-created_date', 1);
      if (p.length === 0) {
        p = await base44.entities.Problem.filter({ problem_id: id }, '-created_date', 1);
      }
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

  const doDeepGrading = async (problemText, verifiedAnswer, studentAnswerText, ocrText) => {
    const toolIds = (() => { try { return JSON.parse(problem.tool_ids || '[]'); } catch { return []; } })();
    const [allTools, allSolutions] = await Promise.all([
      toolIds.length > 0 ? base44.entities.MathTool.list('name', 100) : Promise.resolve([]),
      base44.entities.Solution.filter({ problem_id: problem.problem_id }, 'priority', 20),
    ]);
    const relevantTools = toolIds.length > 0 ? allTools.filter(t => toolIds.includes(t.tool_id)) : [];
    const toolsBlock = buildToolsBlock(relevantTools);
    const solutions = allSolutions.slice(0, 5);
    const solutionIds = solutions.map(s => s.solution_id);
    const stepsBySol = new Map();
    if (solutionIds.length > 0) {
      const stepArrays = await Promise.all(
        solutionIds.map(sid => base44.entities.SolutionStep.filter({ solution_id: sid }, 'sequence_order', 50))
      );
      solutionIds.forEach((sid, i) => stepsBySol.set(sid, stepArrays[i]));
    }
    const solutionsBlock = buildSolutionsBlock(solutions, stepsBySol, relevantTools);
    const gradingPrompt = buildGradingPrompt({
      problemText, verifiedAnswer, solutionsBlock, toolsBlock,
      studentOcrSolution: ocrText, studentAnswer: studentAnswerText || ''
    });
    const gradeRaw = await base44.integrations.Core.InvokeLLM({
      prompt: gradingPrompt,
      model: 'claude_sonnet_4_6',
      response_json_schema: GRADING_SCHEMA,
    });
    const gradeResult = gradeRaw?.response ?? gradeRaw;
    return sanitizeGradingResult(gradeResult, {
      validToolIds: new Set(relevantTools.map(t => t.tool_id)),
      validSolutionIds: new Set(solutionIds),
      stepsBySolutionId: stepsBySol,
    });
  };

  const handleSubmit = async () => {
    const imageSource = activeTab === 'canvas' ? canvasBlob : photoFile;
    if (!imageSource && !answerCanvasBlob) {
      toast.error('풀이 또는 답을 작성해 주세요');
      return;
    }
    if (!problem || !user) return;

    setError(null);
    const submittedAt = new Date().toISOString();
    const durationSec = Math.round((new Date(submittedAt) - new Date(startedAt.current)) / 1000);
    const problemText = parseProblemText(problem.content);
    const verifiedAnswer = problem.verified_answer || '';

    try {
      // ───── Stage 1: Fast Check (답안 캔버스 있을 때만) ─────
      let stage1Result = null;
      let answerImageUrl = null;
      let extractedAnswerText = null;

      if (answerCanvasBlob && verifiedAnswer) {
        setStage('checking');
        const compressed = await compressImage(answerCanvasBlob);
        const upload = await base44.integrations.Core.UploadFile({ file: compressed });
        answerImageUrl = upload.file_url;
        stage1Result = await checkAnswerFast(answerImageUrl, verifiedAnswer, base44.integrations.Core.InvokeLLM);
        // unclear 포함 — student_answer_text 가 있으면 보존 (정보 손실 X)
        extractedAnswerText = stage1Result?.student_answer_text?.trim() || null;
      }

      // ───── Stage 1 정답 → 즉시 처리 ─────
      if (stage1Result?.result === 'match') {
        let solutionImageUrl = null;
        if (imageSource) {
          setStage('ocr');
          const compressed = await compressImage(imageSource);
          const upload = await base44.integrations.Core.UploadFile({ file: compressed });
          solutionImageUrl = upload.file_url;
        }

        const attempt = await base44.entities.StudentAttempt.create({
          student_id: user.id,
          student_email: user.email,
          problem_id: problem.id,
          problem_content: problemText.slice(0, 500),
          problem_domain: problem.domain_name || '',
          ...(imageSource && activeTab === 'canvas' ? { canvas_image_url: solutionImageUrl } : {}),
          ...(imageSource && activeTab === 'photo' ? { photo_url: solutionImageUrl } : {}),
          student_answer: extractedAnswerText || null,
          answer_check_result: 'correct',
          score: 100,
          correctness: 'correct',
          tool_mapping_status: imageSource ? 'pending' : null,
          started_at: startedAt.current,
          submitted_at: submittedAt,
          duration_sec: durationSec,
          assignment_id: assignmentId || null,
          attempt_type: remediationFor ? 'remediation_retry' : (assignmentId ? 'homework' : 'practice'),
          parent_attempt_id: remediationFor || null,
          target_tool_id: targetToolId || null,
        });

        if (imageSource && solutionImageUrl) {
          runBackgroundGrading(attempt.id, solutionImageUrl, problemText, verifiedAnswer, extractedAnswerText || '');
        }

        setStage(null);
        const currentParams1 = new URLSearchParams(window.location.search);
        navigate(`/result/${attempt.id}?${currentParams1.toString()}`);
        return;
      }

      // ───── 풀이 이미지 없이 답안만 적었는데 답이 틀린 경우 ─────
      if (!imageSource) {
        const attempt = await base44.entities.StudentAttempt.create({
          student_id: user.id,
          student_email: user.email,
          problem_id: problem.id,
          problem_content: problemText.slice(0, 500),
          problem_domain: problem.domain_name || '',
          student_answer: extractedAnswerText,
          answer_check_result: 'wrong',
          score: 0,
          correctness: 'wrong',
          started_at: startedAt.current,
          submitted_at: submittedAt,
          duration_sec: durationSec,
          assignment_id: assignmentId || null,
          attempt_type: remediationFor ? 'remediation_retry' : (assignmentId ? 'homework' : 'practice'),
          parent_attempt_id: remediationFor || null,
          target_tool_id: targetToolId || null,
        });
        setStage(null);
        const noImageParams = new URLSearchParams(window.location.search);
        navigate(`/result/${attempt.id}?${noImageParams.toString()}`);
        return;
      }

      // ───── 풀이 OCR ─────
      setStage('ocr');
      const compressed = await compressImage(imageSource);
      const { file_url: imageUrl } = await base44.integrations.Core.UploadFile({ file: compressed });

      const ocrPrompt = OCR_SYSTEM_PROMPT;

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

      // ───── Stage 2: 인식 오류 체크 (Stage 1 = match 아닌 모든 경우) ─────
      let stage2Result = null;
      if (verifiedAnswer && imageSource && stage1Result?.result !== 'match') {
        setStage('checking');
        stage2Result = await checkSolutionReachesAnswer(
          { problemText, ocrText, verifiedAnswer, studentAnswer: extractedAnswerText || '' },
          base44.integrations.Core.InvokeLLM
        );
      }

      // ───── Stage 2 정답 → 즉시 처리 ─────
      if (stage2Result?.result === 'reached') {
        const attempt = await base44.entities.StudentAttempt.create({
          student_id: user.id,
          student_email: user.email,
          problem_id: problem.id,
          problem_content: problemText.slice(0, 500),
          problem_domain: problem.domain_name || '',
          [activeTab === 'canvas' ? 'canvas_image_url' : 'photo_url']: imageUrl,
          ocr_text: ocrText,
          student_answer: extractedAnswerText || stage2Result?.extracted_answer?.trim() || null,
          answer_check_result: 'correct_via_solution',
          score: 100,
          correctness: 'correct',
          tool_mapping_status: 'pending',
          started_at: startedAt.current,
          submitted_at: submittedAt,
          duration_sec: durationSec,
          assignment_id: assignmentId || null,
          attempt_type: remediationFor ? 'remediation_retry' : (assignmentId ? 'homework' : 'practice'),
          parent_attempt_id: remediationFor || null,
          target_tool_id: targetToolId || null,
        });
        runBackgroundGrading(attempt.id, imageUrl, problemText, verifiedAnswer, extractedAnswerText || '', ocrText);
        setStage(null);
        const currentParams2 = new URLSearchParams(window.location.search);
        navigate(`/result/${attempt.id}?${currentParams2.toString()}`);
        return;
      }

      // ───── Stage 3: 깊이 채점 (동기) ─────
      setStage('grading');
      const gradeResult = await doDeepGrading(problemText, verifiedAnswer, extractedAnswerText || '', ocrText);

      const attempt = await base44.entities.StudentAttempt.create({
        student_id: user.id,
        student_email: user.email,
        problem_id: problem.id,
        problem_content: problemText.slice(0, 500),
        problem_domain: problem.domain_name || '',
        [activeTab === 'canvas' ? 'canvas_image_url' : 'photo_url']: imageUrl,
        ocr_text: ocrText,
        student_answer: extractedAnswerText || gradeResult?.student_final_answer?.trim() || null,
        answer_check_result: 'wrong',
        claude_grade_json: JSON.stringify(gradeResult),
        score: gradeResult?.score || 0,
        correctness: gradeResult?.correctness || 'wrong',
        tool_mapping_status: 'done',
        started_at: startedAt.current,
        submitted_at: submittedAt,
        duration_sec: durationSec,
        assignment_id: assignmentId || null,
        attempt_type: remediationFor ? 'remediation_retry' : (assignmentId ? 'homework' : 'practice'),
        parent_attempt_id: remediationFor || null,
        target_tool_id: targetToolId || null,
      });

      setStage(null);
      const currentParams3 = new URLSearchParams(window.location.search);
      navigate(`/result/${attempt.id}?${currentParams3.toString()}`);
    } catch (err) {
      setStage(null);
      console.error(err);
      setError('잠시 문제가 생겼어요. 다시 시도해 주세요');
    }
  };

  const runBackgroundGrading = async (attemptId, imageUrl, problemText, verifiedAnswer, studentAnswerText, prefetchedOcrText = null) => {
    try {
      let ocrText = prefetchedOcrText;
      if (!ocrText) {
        const ocrPrompt = OCR_SYSTEM_PROMPT;
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
        ocrText = (ocrRaw?.response ?? ocrRaw)?.markdown_text || '';
      }
      if (!ocrText) throw new Error('OCR 실패');

      const gradeResult = await doDeepGrading(problemText, verifiedAnswer, studentAnswerText, ocrText);

      await base44.entities.StudentAttempt.update(attemptId, {
        ocr_text: ocrText,
        claude_grade_json: JSON.stringify(gradeResult),
        tool_mapping_status: 'done',
      });
    } catch (err) {
      console.error('Background grading failed:', err);
      try {
        await base44.entities.StudentAttempt.update(attemptId, { tool_mapping_status: 'failed' });
      } catch {}
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
          <div className="flex-1 overflow-y-scroll p-4 custom-scrollbar">
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
          <div className="flex-1 overflow-y-scroll p-4 custom-scrollbar">
            {activeTab === 'canvas' && (
              <>
                <p className="text-xs text-muted-foreground mb-2">답을 캔버스 아래 점선 박스 안에 적으면 채점이 빨라져요</p>
                <DrawingCanvas
                  onImageReady={({ fullBlob, answerRegionBlob }) => {
                    setCanvasBlob(fullBlob);
                    setAnswerCanvasBlob(answerRegionBlob);
                  }}
                  height={600}
                  answerRegionHeight={100}
                />
              </>
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
            {user?.role !== 'student' && user?.role !== 'admin' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                <p className="text-blue-800 text-xs">강사/관리자는 풀이를 제출할 수 없어요. 학생 계정으로 제출하세요.</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 btn-touch" onClick={() => navigate(-1)}>
                뒤로
              </Button>
              <Button className="flex-[2] btn-touch" size="lg" onClick={handleSubmit} disabled={user?.role === 'teacher'}>
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