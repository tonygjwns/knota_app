import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function TeacherReviewDetail() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]);
  const [grading, setGrading] = useState(null);
  const [stepEdits, setStepEdits] = useState({});
  const [scoreAdjustment, setScoreAdjustment] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [attemptId]);

  const load = async () => {
    setLoading(true);
    try {
      const [a] = await base44.entities.StudentAttempt.filter({ id: attemptId }, '-created_date', 1);
      if (!a) { toast.error('찾을 수 없어요'); navigate('/teacher/review'); return; }
      setAttempt(a);
      
      if (a.claude_grade_json) {
        const parsed = JSON.parse(a.claude_grade_json);
        setGrading(parsed?.response ?? parsed);
      }
      if (a.teacher_review_json) {
        try {
          const tr = JSON.parse(a.teacher_review_json);
          setStepEdits(tr.step_edits || {});
          setScoreAdjustment(tr.score_adjustment || 0);
          setComment(tr.comment || '');
        } catch {}
      }
      
      if (a.problem_id) {
        const [p] = await base44.entities.Problem.filter({ id: a.problem_id }, '-created_date', 1);
        if (p) {
          setProblem(p);
          let toolIds = [];
          try { toolIds = JSON.parse(p.tool_ids || '[]'); } catch {}
          if (toolIds.length > 0) {
            const allTools = await base44.entities.MathTool.list('name', 100);
            setTools(allTools.filter(t => toolIds.includes(t.tool_id)));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newScore = Math.max(0, Math.min(100, (attempt.score || 0) + scoreAdjustment));
      const teacherReview = {
        step_edits: stepEdits,
        score_adjustment: scoreAdjustment,
        comment: comment.trim() || null,
        reviewed_at: new Date().toISOString(),
      };
      await base44.entities.StudentAttempt.update(attempt.id, {
        teacher_review_json: JSON.stringify(teacherReview),
        review_resolved_at: new Date().toISOString(),
        score: newScore,
      });
      toast.success('검토 결과가 저장됐어요');
      navigate('/teacher/review');
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoader message="불러오는 중..." />;
  if (!attempt) return null;

  const steps = grading?.step_feedback || [];
  const toolMap = new Map(tools.map(t => [t.tool_id, t]));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/review')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 검토 큐
        </Button>
        <h1 className="text-xl font-bold">검토 상세</h1>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium">{attempt.student_email}</p>
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

      {steps.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">단계별 보정 (AI 채점 → 강사 수정)</p>
          <div className="space-y-3">
            {steps.map((sf, idx) => {
              const edit = stepEdits[idx] || {};
              const currentStatus = edit.status || sf.status;
              const currentToolId = edit.tool_id !== undefined ? edit.tool_id : sf.tool_id;
              const toolName = currentToolId ? (toolMap.get(currentToolId)?.name || currentToolId) : null;
              return (
                <div key={idx} className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">단계 {sf.step_number}</p>
                  <p className="text-sm mb-2">{sf.student_step}</p>
                  
                  <div className="flex gap-2 mt-2">
                    <Select value={currentStatus}
                      onValueChange={(v) => setStepEdits(prev => ({ ...prev, [idx]: { ...prev[idx], status: v } }))}>
                      <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="correct">정답</SelectItem>
                        <SelectItem value="partial">부분</SelectItem>
                        <SelectItem value="missing">누락</SelectItem>
                        <SelectItem value="wrong">오답</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={currentToolId || 'null'}
                      onValueChange={(v) => setStepEdits(prev => ({ ...prev, [idx]: { ...prev[idx], tool_id: v === 'null' ? null : v } }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="도구 없음" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">도구 없음</SelectItem>
                        {tools.map(t => (
                          <SelectItem key={t.tool_id} value={t.tool_id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {sf.comment && (
                    <p className="text-xs text-muted-foreground mt-2">AI 코멘트: {sf.comment}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm font-medium mb-2">점수 보정</p>
        <div className="flex items-center gap-3">
          <span className="text-sm">현재: {attempt.score}점</span>
          <input
            type="range" min="-50" max="50" step="5"
            value={scoreAdjustment}
            onChange={(e) => setScoreAdjustment(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-semibold w-20 text-right">
            → {Math.max(0, Math.min(100, (attempt.score || 0) + scoreAdjustment))}점
          </span>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium mb-2">학생에게 보낼 코멘트 (선택)</p>
        <Textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="예: 풀이 자체는 잘 하셨어요. 점수 보정해 드릴게요."
          className="min-h-24" />
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background pt-3 pb-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/teacher/review')}>
          취소
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장 — 학생 결과에 반영'}
        </Button>
      </div>
    </div>
  );
}