import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ChevronRight, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { summarizeMastery, getMasteryColor } from '@/lib/mastery.js';

export default function Diagnosis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [domains, setDomains] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const [attempts, tools, domainsData] = await Promise.all([
        base44.entities.StudentAttempt.filter({ student_id: me.id }, '-submitted_at', 200),
        base44.entities.MathTool.list('name', 500),
        base44.entities.Domain.list('name', 100),
      ]);
      setDomains(domainsData);
      setSummary(summarizeMastery(attempts, tools));
      setLoading(false);
    })();
  }, []);

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

  const { overallScore, trend, weakTools, domainMap, totalAttempts } = summary;
  const overallColor = getMasteryColor(overallScore);

  const TrendIcon = trend > 3 ? TrendingUp : trend < -3 ? TrendingDown : Minus;
  const trendColor = trend > 3 ? 'text-emerald-600' : trend < -3 ? 'text-red-500' : 'text-muted-foreground';
  const trendLabel = trend > 3 ? `+${Math.round(trend)}점 향상 중` : trend < -3 ? `${Math.round(trend)}점 하락 중` : '유지 중';

  // Map domain_id -> domain name
  const domainNameMap = {};
  for (const d of domains) domainNameMap[d.domain_id] = d.name;

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
            <p className={`text-3xl font-bold ${overallColor.text}`}>{overallScore}</p>
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
            <h2 className="text-base font-semibold">집중 보완 필요 매듭 (TOP {weakTools.length})</h2>
            <div className="space-y-2">
              {weakTools.map(({ toolId, score, tool }) => {
                const c = getMasteryColor(score);
                return (
                  <Card key={toolId} className="p-3 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                      <span className={`text-sm font-bold ${c.text}`}>{score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tool?.name || toolId}</p>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${c.bar}`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                    <Link to={`/problems?tool=${toolId}`}>
                      <Button size="sm" variant="outline" className="text-xs flex-shrink-0">
                        더 풀기 <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
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
                .map(([domainId, data]) => {
                  const c = getMasteryColor(data.avgScore);
                  const name = domainNameMap[domainId] || domainId;
                  return (
                    <Card key={domainId} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{name}</p>
                        <span className={`text-sm font-bold ${c.text}`}>{data.avgScore}점</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${c.bar}`} style={{ width: `${data.avgScore}%` }} />
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