import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ChevronRight, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { summarizeMastery, getMasteryColor } from '@/lib/mastery.js';
import { toast } from 'sonner';

export default function Diagnosis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const [attempts, tools, allProblems] = await Promise.all([
        base44.entities.StudentAttempt.filter({ student_id: me.id }, '-submitted_at', 200),
        base44.entities.MathTool.list('name', 500),
        base44.entities.Problem.list('-created_date', 1000),
      ]);
      const problemMap = new Map(allProblems.map(p => [p.id, p]));
      setSummary(summarizeMastery(attempts, problemMap, tools));
      setLoading(false);
    })();
  }, []);

  const handlePracticeWithTool = async (toolId) => {
    try {
      const allProblems = await base44.entities.Problem.list('-created_date', 1000);
      const matching = allProblems.filter(p => {
        try { return JSON.parse(p.tool_ids || '[]').includes(toolId); }
        catch { return false; }
      });
      if (matching.length === 0) {
        toast.error('이 도구의 문제가 아직 없어요');
        return;
      }
      const pick = matching[Math.floor(Math.random() * matching.length)];
      navigate(`/problem/${pick.id}`);
    } catch {
      toast.error('문제를 불러오지 못했어요');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <InlineLoader message="진단 데이터를 불러오는 중..." />
      </AppLayout>
    );
  }

  if (!summary) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-12 text-center space-y-4">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">아직 진단 데이터가 부족해요</h2>
          <p className="text-sm text-muted-foreground">문제를 5개 이상 풀면 나만의 학습 진단을 볼 수 있어요.</p>
          <Button onClick={() => navigate('/problems')}>문제 풀러 가기</Button>
        </div>
      </AppLayout>
    );
  }

  const { overallAvg, recentTrend, weakTools, domainMap, totalAttempts } = summary;

  const TrendIcon = recentTrend === null ? Minus : recentTrend > 3 ? TrendingUp : recentTrend < -3 ? TrendingDown : Minus;
  const trendColor = recentTrend === null ? 'text-muted-foreground' : recentTrend > 3 ? 'text-emerald-600' : recentTrend < -3 ? 'text-red-500' : 'text-muted-foreground';
  const trendLabel = recentTrend === null ? '데이터 더 필요' : recentTrend > 3 ? `+${Math.round(recentTrend)}점 향상 중` : recentTrend < -3 ? `${Math.round(recentTrend)}점 하락 중` : '유지 중';

  const overallColorClass = overallAvg != null ? getMasteryColor(overallAvg, false) : 'text-muted-foreground';

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-6 py-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">내 진단</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className={`text-3xl font-bold ${overallColorClass}`}>
              {overallAvg != null ? overallAvg : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">평균 숙련도</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{totalAttempts}</p>
            <p className="text-xs text-muted-foreground mt-1">총 풀이 수</p>
          </Card>
          <Card className="p-4 text-center flex flex-col items-center justify-center gap-1">
            <TrendIcon className={`w-7 h-7 ${trendColor}`} />
            <p className={`text-xs font-medium ${trendColor}`}>{trendLabel}</p>
          </Card>
        </div>

        {/* Weak tools */}
        {weakTools.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">집중 보완 필요 도구 (TOP {weakTools.length})</h2>
            <div className="space-y-2">
              {weakTools.map(({ tool, avg }) => {
                const barColor = avg >= 90 ? 'bg-emerald-500' : avg >= 70 ? 'bg-amber-400' : 'bg-red-400';
                const bgColor  = avg >= 90 ? 'bg-emerald-100' : avg >= 70 ? 'bg-amber-100' : 'bg-red-100';
                const textColor = getMasteryColor(avg, false);
                return (
                  <Card key={tool.tool_id} className="p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bgColor}`}>
                      <span className={`text-sm font-bold ${textColor}`}>{avg}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tool.name}</p>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${avg}%` }} />
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs flex-shrink-0"
                      onClick={() => handlePracticeWithTool(tool.tool_id)}>
                      더 풀기 <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Domain breakdown */}
        {Object.keys(domainMap).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">영역별 숙련도</h2>
            <div className="space-y-3">
              {Object.entries(domainMap)
                .sort(([, a], [, b]) => a.avgScore - b.avgScore)
                .map(([name, data]) => {
                  const barColor = data.avgScore >= 90 ? 'bg-emerald-500' : data.avgScore >= 70 ? 'bg-amber-400' : 'bg-red-400';
                  const textColor = getMasteryColor(data.avgScore, false);
                  return (
                    <Card key={name} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{name}</p>
                        <span className={`text-sm font-bold ${textColor}`}>{data.avgScore}점</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${data.avgScore}%` }} />
                      </div>
                    </Card>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}