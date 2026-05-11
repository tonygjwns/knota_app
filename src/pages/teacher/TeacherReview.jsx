import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import ScoreBadge from '@/components/ScoreBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherReview() {
  const { data: teacherData } = useTeacher();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [teacherData]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const studentIds = teacherData?.my_students?.map(s => s.id) || [];
      if (studentIds.length === 0) {
        setQueue([]);
        return;
      }
      // Load recent unreviewed attempts for my students
      const BATCH = 20;
      const batches = [];
      for (let i = 0; i < studentIds.length; i += BATCH) batches.push(studentIds.slice(i, i + BATCH));
      const arrays = await Promise.all(
        batches.map(batch =>
          Promise.all(batch.map(sid =>
            base44.entities.StudentAttempt.filter({ student_id: sid }, '-submitted_at', 30)
          ))
        )
      );
      const all = arrays.flat(2).filter(a => !a.admin_review_status && a.score !== undefined);
      // Sort by newest first
      all.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      setQueue(all);
      setCurrent(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    const attempt = queue[current];
    if (!attempt) return;
    setProcessing(true);
    await base44.entities.StudentAttempt.update(attempt.id, { admin_review_status: 'skipped' });
    setQueue(prev => prev.filter(a => a.id !== attempt.id));
    setCurrent(c => Math.min(c, queue.length - 2));
    setProcessing(false);
    toast.success('건너뛰었어요');
  };

  const handleOk = async () => {
    const attempt = queue[current];
    if (!attempt) return;
    setProcessing(true);
    await base44.entities.StudentAttempt.update(attempt.id, { admin_review_status: 'ok' });
    setQueue(prev => prev.filter(a => a.id !== attempt.id));
    setCurrent(c => Math.min(c, queue.length - 2));
    setProcessing(false);
    toast.success('확인됐어요');
  };

  if (loading) return <InlineLoader message="검토 목록 불러오는 중..." />;

  const attempt = queue[current];

  let grading = null;
  let gradingObj = null;
  try {
    gradingObj = JSON.parse(attempt?.claude_grade_json || '{}');
    grading = gradingObj?.response ?? gradingObj;
  } catch {}

  const studentName = teacherData?.my_students?.find(s => s.id === attempt?.student_id)?.full_name || attempt?.student_email || '';

  if (!attempt) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">채점 검토</h1>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xl font-semibold">모두 검토했어요! 🎉</p>
          <p className="text-muted-foreground mt-2 text-sm">검토할 항목이 없어요</p>
          <Button className="mt-4" onClick={loadQueue}>새로고침</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">채점 검토</h1>
        <span className="text-sm text-muted-foreground">{current + 1} / {queue.length}</span>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.min(queue.length - 1, c + 1))} disabled={current >= queue.length - 1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        {/* 학생 정보 + 점수 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold">{studentName}</p>
            <p className="text-xs text-muted-foreground">
              {attempt.problem_domain && <span className="mr-2">📚 {attempt.problem_domain}</span>}
              {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('ko-KR') : ''}
            </p>
          </div>
          <ScoreBadge score={attempt.score || 0} size="md" />
        </div>

        {/* 문제 */}
        {attempt.problem_content && (
          <div className="bg-blue-50/60 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2">📝 문제</p>
            <MathRenderer content={attempt.problem_content} className="text-sm" />
          </div>
        )}

        {/* 학생 풀이 이미지 */}
        {(attempt.canvas_image_url || attempt.photo_url) && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">🖊️ 학생 풀이 이미지</p>
            <img src={attempt.canvas_image_url || attempt.photo_url} alt="학생 풀이"
              className="w-full rounded-xl border object-contain max-h-72" />
          </div>
        )}

        {/* OCR 결과 */}
        {attempt.ocr_text && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">🔍 OCR 인식 결과</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{attempt.ocr_text}</pre>
          </div>
        )}

        {/* LLM 채점 결과 상세 */}
        {grading && (
          <div className="space-y-3">
            {grading.summary && (
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">🤖 AI 채점 요약</p>
                <p className="text-sm">{grading.summary}</p>
              </div>
            )}

            {/* 단계별 피드백 */}
            {grading.steps?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">단계별 채점</p>
                {grading.steps.map((step, i) => (
                  <div key={i} className={`rounded-lg p-3 border text-sm ${
                    step.status === 'correct' ? 'bg-emerald-50 border-emerald-200'
                    : step.status === 'partial' ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-xs">Step {i + 1}</span>
                      <span className="text-xs font-bold">{step.score ?? '—'}점</span>
                    </div>
                    {step.feedback && <p className="text-xs text-muted-foreground">{step.feedback}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* 오류 위치 (도구 단위) */}
            {grading.error_locations?.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs font-semibold text-red-700 mb-2">🔧 오류 발생 매듭</p>
                <div className="space-y-1.5">
                  {grading.error_locations.map((err, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium text-red-800">{err.tool_id}</span>
                      {err.error_type && <span className="ml-2 text-red-600">({err.error_type})</span>}
                      {err.description && <p className="text-red-600 mt-0.5">{err.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 갭 분석 */}
            {grading.gaps?.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-2">📌 개념 격차</p>
                <div className="space-y-1">
                  {grading.gaps.map((gap, i) => (
                    <p key={i} className="text-xs text-amber-700">• {typeof gap === 'string' ? gap : gap.description || JSON.stringify(gap)}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 액션 */}
      <div className="flex gap-3">
        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleOk} disabled={processing}>
          <CheckCircle className="w-4 h-4 mr-1" /> 확인
        </Button>
        <Button variant="outline" onClick={handleSkip} disabled={processing}>
          <SkipForward className="w-4 h-4 mr-1" /> 건너뛰기
        </Button>
      </div>
    </div>
  );
}