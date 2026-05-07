import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';

export default function StudentDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [weakTools, setWeakTools] = useState([]);
  const [strongTools, setStrongTools] = useState([]);
  const [remediationHistory, setRemediationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('submitted_at');
  const [pageIdx, setPageIdx] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.functions.invoke('studentDetailSummary', { userId });
        const data = res.data;
        if (!data || data.error) {
          toast.error(data?.error || '데이터를 불러오지 못해요');
          navigate(-1);
          return;
        }
        setStudent(data.student);
        setAttempts(data.attempts || []);
        setWeakTools(data.weak_tools || []);
        setStrongTools(data.strong_tools || []);
        setRemediationHistory(data.remediation_history || []);
      } catch (e) {
        console.error('StudentDetail load error:', e);
        toast.error(e.message || '데이터를 불러오지 못해요');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, navigate]);

  if (loading) return <InlineLoader message="학생 정보 불러오는 중..." />;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!student) return null;

  // 정렬
  const sorted = [...attempts].sort((a, b) => {
    if (sortKey === 'submitted_at') return new Date(b.submitted_at) - new Date(a.submitted_at);
    if (sortKey === 'score_high') return b.score - a.score;
    if (sortKey === 'score_low') return a.score - b.score;
    return 0;
  });
  const paged = sorted.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  const maxPage = Math.ceil(sorted.length / PAGE_SIZE);

  const stats = {
    total: attempts.length,
    correct: attempts.filter(a => a.correctness === 'correct').length,
    correct_rate: attempts.length > 0 ? Math.round((attempts.filter(a => a.correctness === 'correct').length / attempts.length) * 100) : 0,
    avg_score: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0
  };

  return (
    <div className="space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{student.full_name || '(이름 없음)'}</h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '총 시도', value: stats.total, unit: '회' },
          { label: '정답률', value: `${stats.correct_rate}%`, unit: '' },
          { label: '평균 점수', value: stats.avg_score, unit: '점' }
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}<span className="text-xs ml-1">{s.unit}</span></p>
          </Card>
        ))}
      </div>

      {/* 약점 매듭 */}
      {weakTools.length > 0 && (
        <Card className="p-4 border-red-200">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            약점 매듭 (평균 점수 낮은 순)
          </h2>
          <div className="space-y-2">
            {weakTools.map(tool => (
              <div key={tool.tool_id} className="bg-red-50 rounded-lg p-3 border border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{tool.name}</p>
                  <span className="text-sm font-bold text-red-600">{tool.avg_score}점</span>
                </div>
                <div className="flex gap-1 text-xs text-muted-foreground">
                  <span>시도 {tool.attempts}회</span>
                  <span>•</span>
                  <span>정답 {tool.correct_count}회</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 강점 매듭 */}
      {strongTools.length > 0 && (
        <Card className="p-4 border-emerald-200">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            강점 매듭 (Top 5)
          </h2>
          <div className="space-y-2">
            {strongTools.map(tool => (
              <div key={tool.tool_id} className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{tool.name}</p>
                  <span className="text-sm font-bold text-emerald-600">{tool.avg_score}점</span>
                </div>
                <div className="flex gap-1 text-xs text-muted-foreground">
                  <span>시도 {tool.attempts}회</span>
                  <span>•</span>
                  <span>정답 {tool.correct_count}회</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 보강 이력 */}
      {remediationHistory.length > 0 && (
        <Card className="p-4 border-primary/30">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            🎯 매듭 보강 이력
          </h2>
          <div className="space-y-2">
            {remediationHistory.map(rec => (
              <div key={rec.tool_id} className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{rec.tool_name}</p>
                  <span className={`text-sm font-bold ${rec.improvement > 0 ? 'text-emerald-600' : rec.improvement < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {rec.improvement > 0 ? '+' : ''}{rec.improvement}점
                  </span>
                </div>
                <div className="flex gap-1 text-xs text-muted-foreground mb-1">
                  <span>보강 {rec.retry_count + rec.practice_count}회</span>
                  <span>•</span>
                  <span>재풀이 {rec.retry_count}회</span>
                  <span>•</span>
                  <span>유사 문제 {rec.practice_count * 3}개</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  보강 전 {rec.before_avg}점 → 후 {rec.after_avg}점
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 시도 Timeline */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <span>시도 기록</span>
            <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{sorted.length}건</span>
          </h2>
          <select
            value={sortKey}
            onChange={e => { setSortKey(e.target.value); setPageIdx(0); }}
            className="text-xs border border-input rounded px-2 py-1 bg-background"
          >
            <option value="submitted_at">최근순</option>
            <option value="score_high">점수 높은순</option>
            <option value="score_low">점수 낮은순</option>
          </select>
        </div>

        <div className="space-y-2">
          {paged.map(attempt => (
            <button
              key={attempt.id}
              onClick={() => navigate(`/result/${attempt.id}`)}
              className={`w-full p-3 rounded-lg border transition-colors text-left ${
                attempt.correctness === 'correct'
                  ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  : attempt.correctness === 'partial'
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                    : 'border-red-200 bg-red-50 hover:bg-red-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attempt.problem_content?.substring(0, 50) || '(문제 없음)'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(attempt.submitted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${
                    attempt.correctness === 'correct' ? 'text-emerald-600' : attempt.correctness === 'partial' ? 'text-amber-600' : 'text-red-600'
                  }`}>{attempt.score}점</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {sorted.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">시도 기록이 없어요</p>}

        {maxPage > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <button
              onClick={() => setPageIdx(Math.max(0, pageIdx - 1))}
              disabled={pageIdx === 0}
              className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted"
            >이전</button>
            <span className="text-xs text-muted-foreground">{pageIdx + 1} / {maxPage}</span>
            <button
              onClick={() => setPageIdx(Math.min(maxPage - 1, pageIdx + 1))}
              disabled={pageIdx >= maxPage - 1}
              className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted"
            >다음</button>
          </div>
        )}
      </Card>
    </div>
  );
}