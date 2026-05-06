import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import ScoreBadge from '@/components/ScoreBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, AlertCircle, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminReview() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      // Load attempts without review status
      const all = await base44.entities.StudentAttempt.list('-submitted_at', 50);
      const pending = all.filter(a => !a.admin_review_status && a.score !== undefined);
      setQueue(pending);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status) => {
    const attempt = queue[current];
    if (!attempt) return;
    setProcessing(true);
    try {
      await base44.entities.StudentAttempt.update(attempt.id, {
        admin_review_status: status,
        admin_review_note: note || undefined,
      });
      toast.success(
        status === 'ok' ? '확인됐어요' :
        status === 'needs_correction' ? '수정 필요로 표시됐어요' : '건너뛰었어요'
      );
      setNote('');
      setCurrent(c => Math.min(c, queue.length - 2));
      setQueue(prev => prev.filter(a => a.id !== attempt.id));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <InlineLoader message="검토 대기 목록 불러오는 중..." />;

  const attempt = queue[current];

  if (!attempt) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">채점 검토</h1>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-xl font-semibold text-foreground">모두 검토했어요! 🎉</p>
          <p className="text-muted-foreground mt-2">검토할 항목이 없어요</p>
          <Button className="mt-4" onClick={loadQueue}>새로고침</Button>
        </div>
      </div>
    );
  }

  let grading = null;
  try { grading = JSON.parse(attempt.claude_grade_json || '{}'); } catch {}

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">채점 검토</h1>
        <span className="text-sm text-muted-foreground">{current + 1} / {queue.length}</span>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.min(queue.length - 1, c + 1))}
                disabled={current >= queue.length - 1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Attempt details */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{attempt.student_email}</p>
            <p className="text-xs text-muted-foreground">
              {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('ko-KR') : ''}
            </p>
          </div>
          <ScoreBadge score={attempt.score || 0} size="md" />
        </div>

        {/* Problem */}
        {attempt.problem_content && (
          <div className="bg-blue-50/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2">문제</p>
            <MathRenderer content={attempt.problem_content} className="text-sm" />
          </div>
        )}

        {/* Student image */}
        {(attempt.canvas_image_url || attempt.photo_url) && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">학생 풀이 이미지</p>
            <img
              src={attempt.canvas_image_url || attempt.photo_url}
              alt="학생 풀이"
              className="w-full rounded-xl border object-contain max-h-64"
            />
          </div>
        )}

        {/* OCR */}
        {attempt.ocr_text && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">OCR 인식 결과</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{attempt.ocr_text}</pre>
          </div>
        )}

        {/* Grading summary */}
        {grading?.summary && (
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">AI 채점 요약</p>
            <p className="text-sm">{grading.summary}</p>
          </div>
        )}
      </Card>

      {/* Note */}
      <div>
        <p className="text-sm font-medium mb-2">관리자 메모 (선택사항)</p>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="메모를 남겨 주세요..."
          className="h-20"
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white btn-touch"
          onClick={() => handleAction('ok')}
          disabled={processing}>
          <CheckCircle className="w-4 h-4 mr-1" /> OK
        </Button>
        <Button
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-50 btn-touch"
          onClick={() => handleAction('needs_correction')}
          disabled={processing}>
          <AlertCircle className="w-4 h-4 mr-1" /> 수정 필요
        </Button>
        <Button
          variant="outline"
          className="btn-touch"
          onClick={() => handleAction('skipped')}
          disabled={processing}>
          <SkipForward className="w-4 h-4 mr-1" /> 건너뛰기
        </Button>
      </div>
    </div>
  );
}