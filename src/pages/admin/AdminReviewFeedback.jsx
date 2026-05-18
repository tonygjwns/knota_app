import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { InlineLoader } from '@/components/LoadingOverlay';
import { ChevronRight } from 'lucide-react';

const statusLabel = (s) => ({ correct: '정답', partial: '부분', missing: '누락', wrong: '오답' }[s] || s);

const hasMeaningfulFeedback = (tr, aiGrading) => {
  if (!tr || !aiGrading) return false;
  if (tr.selected_solution_id && tr.selected_solution_id !== aiGrading.matched_solution_id) return true;
  if (tr.step_judgments) {
    for (const [seq, j] of Object.entries(tr.step_judgments)) {
      const aiSf = aiGrading.step_feedback?.find(sf => sf.matched_solution_step_number === Number(seq));
      if (!aiSf) return true;
      if (aiSf.status !== j.status) return true;
      if ((aiSf.tool_id || null) !== (j.tool_id || null)) return true;
    }
  }
  return false;
};

export default function AdminReviewFeedback() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all = await base44.entities.StudentAttempt.list('-review_resolved_at', 200);
        const reviewed = all.filter(a => a.teacher_review_json && a.review_resolved_at);

        const enriched = reviewed.map(a => {
          let tr = null;
          try { tr = JSON.parse(a.teacher_review_json); } catch {}
          let aiGrading = null;
          try {
            const g = JSON.parse(a.claude_grade_json || '{}');
            aiGrading = g?.response ?? g;
          } catch {}

          const diffs = [];
          if (tr?.step_judgments && aiGrading?.step_feedback) {
            Object.entries(tr.step_judgments).forEach(([seq, j]) => {
              const aiSf = aiGrading.step_feedback.find(sf => sf.matched_solution_step_number === Number(seq));
              if (aiSf) {
                if (aiSf.status !== j.status) diffs.push({ seq, kind: 'status', ai: aiSf.status, teacher: j.status });
                if ((aiSf.tool_id || null) !== (j.tool_id || null)) diffs.push({ seq, kind: 'tool', ai: aiSf.tool_id, teacher: j.tool_id });
              }
            });
          }
          const aiScore = aiGrading?.score ?? null;
          const teacherScore = tr?.final_score ?? a.score ?? null;
          const scoreDiff = (aiScore !== null && teacherScore !== null) ? teacherScore - aiScore : null;

          return { attempt: a, tr, aiGrading, diffs, aiScore, teacherScore, scoreDiff };
        });

        const filtered = enriched.filter(({ tr, aiGrading }) => hasMeaningfulFeedback(tr, aiGrading));
        setItems(filtered);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <InlineLoader message="검토 피드백 로딩 중..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">강사 검토 피드백</h1>
        <p className="text-sm text-muted-foreground mt-1">강사가 별해 매칭이나 step 판정을 보정한 케이스만 표시 — AI 채점 품질 모니터링용</p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">보정된 검토가 없어요 (점수만 변경된 케이스는 제외됩니다)</p>
      )}

      <div className="space-y-2">
        {items.map(({ attempt, tr, diffs, aiScore, teacherScore, scoreDiff }) => (
          <Card key={attempt.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/result/${attempt.id}`)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attempt.problem_content?.slice(0, 60)}...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  학생: {attempt.student_email}
                  {attempt.review_resolved_at && ` · ${new Date(attempt.review_resolved_at).toLocaleDateString('ko-KR')}`}
                </p>
                <div className="flex gap-2 mt-2 text-xs flex-wrap">
                  <span className="bg-muted px-2 py-0.5 rounded">
                    AI {aiScore ?? '?'}점 → 강사 {teacherScore ?? '?'}점
                    {scoreDiff !== null && scoreDiff !== 0 && (
                      <span className={scoreDiff > 0 ? 'text-emerald-600 ml-1' : 'text-red-600 ml-1'}>
                        ({scoreDiff > 0 ? '+' : ''}{scoreDiff})
                      </span>
                    )}
                  </span>
                  {diffs.length > 0 && (
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      step diff {diffs.length}건
                    </span>
                  )}
                  {tr?.comment && (
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">코멘트 있음</span>
                  )}
                </div>
                {diffs.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {diffs.slice(0, 3).map((d, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        Step {d.seq} {d.kind}: AI {statusLabel(d.ai) || '없음'} → 강사 {statusLabel(d.teacher) || '없음'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}