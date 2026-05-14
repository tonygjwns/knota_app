import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import MathRenderer from '@/components/MathRenderer';
import { InlineLoader } from '@/components/LoadingOverlay';
import ScoreBadge, { ScoreSummaryText } from '@/components/ScoreBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight } from 'lucide-react';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join('\n');
    return String(content);
  } catch { return String(content || ''); }
};

export default function RecordDetail() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [matchedSolution, setMatchedSolution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a] = await base44.entities.StudentAttempt.filter({ id: attemptId }, '-created_date', 1);
        if (!a) { navigate('/history'); return; }
        setAttempt(a);

        if (a.problem_id) {
          const [p] = await base44.entities.Problem.filter({ id: a.problem_id }, '-created_date', 1);
          if (p) setProblem(p);
        }

        if (a.claude_grade_json) {
          try {
            const grading = JSON.parse(a.claude_grade_json);
            const g = grading?.response ?? grading;
            if (g?.matched_solution_id) {
              const [sol] = await base44.entities.Solution.filter({ solution_id: g.matched_solution_id }, '-created_date', 1);
              if (sol) setMatchedSolution(sol);
            }
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  if (loading) return <AppLayout><InlineLoader message="기록 불러오는 중..." /></AppLayout>;
  if (!attempt) return null;

  const score = attempt.score || 0;
  const problemText = problem ? parseProblemText(problem.content) : '';
  const scoreColor = score >= 80
    ? 'from-emerald-50 to-emerald-100/50 border-emerald-200'
    : score >= 40
    ? 'from-amber-50 to-amber-100/50 border-amber-200'
    : 'from-red-50 to-red-100/50 border-red-200';
  const scoreTextColor = score >= 80 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626';

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* 헤더 */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> 내 기록
        </Button>

        {/* 점수 카드 */}
        <Card className={`p-6 bg-gradient-to-br ${scoreColor} border text-center`}>
          <div className="text-6xl font-bold mb-2" style={{ color: scoreTextColor }}>
            {score}점
          </div>
          <div className="text-xl font-semibold mt-2"><ScoreSummaryText score={score} /></div>

          <div className="flex gap-2 text-xs text-muted-foreground justify-center mt-3 flex-wrap">
            {problem?.domain_name && <span>{problem.domain_name}</span>}
            {attempt.submitted_at && (
              <>
                <span>·</span>
                <span>{new Date(attempt.submitted_at).toLocaleDateString('ko-KR', {
                  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}</span>
              </>
            )}
            {attempt.duration_sec > 0 && (
              <>
                <span>·</span>
                <span>{Math.floor(attempt.duration_sec / 60)}분 {attempt.duration_sec % 60}초</span>
              </>
            )}
          </div>

          {matchedSolution && (
            <div className="mt-3">
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                🎯 풀이 #{matchedSolution.priority} 방식
                {matchedSolution.priority === 1 && ' (대표)'}
              </span>
            </div>
          )}

          {attempt.review_resolved_at && (
            <div className="mt-2">
              <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                📝 선생님 검토 완료
              </span>
            </div>
          )}
        </Card>

        {/* 문제 + 학생답/정답/상세버튼 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 좌측: 문제 */}
          <Card className="lg:col-span-2 p-4 bg-blue-50/50 border-blue-100">
            <p className="text-xs text-muted-foreground mb-2 font-medium">문제</p>
            {problem ? (
              <MathRenderer content={problemText} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">문제를 불러올 수 없어요.</p>
            )}
          </Card>

          {/* 우측: 학생답 / 정답 / 상세버튼 */}
          <div className="space-y-2">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">학생 답</p>
              {attempt.student_answer ? (
                <MathRenderer
                  content={attempt.student_answer.includes('$')
                    ? attempt.student_answer
                    : `$${attempt.student_answer}$`}
                  className="text-base"
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">(답을 적지 않음)</p>
              )}
            </Card>

            {problem?.verified_answer && (
              <Card className="p-3 bg-emerald-50 border-emerald-200">
                <p className="text-xs text-emerald-700 mb-1 font-medium">실제 정답</p>
                <MathRenderer
                  content={problem.verified_answer.includes('$')
                    ? problem.verified_answer
                    : `$${problem.verified_answer}$`}
                  className="text-base"
                />
              </Card>
            )}

            <Button className="w-full" onClick={() => navigate(`/result/${attempt.id}`)}>
              내 풀이 상세 보기 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}