import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MathRenderer from '@/components/MathRenderer';
import { Star, ChevronRight, TrendingUp, Target, BookOpen } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayProblem, setTodayProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [domainStats, setDomainStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentStats, setRecentStats] = useState({ total: 0, avgScore: 0, correct: 0 });

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
    if (user.role === 'teacher' || user.role === 'owner') { navigate('/teacher', { replace: true }); return; }
    loadData();
    loadStats();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const problems = await base44.entities.Problem.list('-created_date', 1000, 0);
      if (problems.length > 0) {
        const idx = Math.floor(Math.random() * problems.length);
        setTodayProblem(problems[idx]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const [attempts, domains] = await Promise.all([
        base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200),
        base44.entities.Domain.list('name', 50),
      ]);

      // Recent stats (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recent = attempts.filter(a => a.submitted_at && new Date(a.submitted_at) > thirtyDaysAgo);
      if (recent.length > 0) {
        const avgScore = Math.round(recent.reduce((s, a) => s + (a.score || 0), 0) / recent.length);
        const correct = recent.filter(a => a.correctness === 'correct').length;
        setRecentStats({ total: recent.length, avgScore, correct });
      }

      // Domain mastery: group attempts by domain
      const domainMap = new Map(domains.map(d => [d.domain_id, d.name]));
      const domainScores = {};
      attempts.forEach(a => {
        if (!a.problem_domain) return;
        if (!domainScores[a.problem_domain]) domainScores[a.problem_domain] = [];
        domainScores[a.problem_domain].push(a.score || 0);
      });

      const stats = Object.entries(domainScores)
        .map(([name, scores]) => ({
          name,
          avg: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
          count: scores.length,
        }))
        .filter(d => d.count >= 1)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 6);

      setDomainStats(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
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

  const greeting = user?.full_name ? `안녕하세요, ${user.full_name}님!` : '안녕하세요!';

  const getMasteryColor = (avg) => {
    if (avg >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600', label: '우수' };
    if (avg >= 60) return { bar: 'bg-amber-500', text: 'text-amber-600', label: '보통' };
    return { bar: 'bg-red-400', text: 'text-red-500', label: '부족' };
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="text-muted-foreground mt-1">오늘도 열심히 해볼까요? 💪</p>
        </div>

        {/* 최근 30일 통계 */}
        {recentStats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { IconComp: Target, label: '푼 문제', value: `${recentStats.total}개`, color: 'text-blue-500' },
              { IconComp: TrendingUp, label: '평균 점수', value: `${recentStats.avgScore}점`, color: 'text-emerald-500' },
              { IconComp: Star, label: '정답', value: `${recentStats.correct}개`, color: 'text-amber-500' },
            ].map(({ IconComp, label, value, color }) => (
              <Card key={label} className="p-3 text-center">
                <IconComp className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-sm mt-0.5">{value}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Today's problem */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            오늘의 문제
          </h2>
          {loading ? (
            <InlineLoader message="문제 불러오는 중..." />
          ) : todayProblem ? (
            <Card className="p-5 card-hover cursor-pointer" onClick={() => navigate(`/problem/${todayProblem.id}`)}>
              {todayProblem.domain_name && (
                <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-3">
                  {todayProblem.domain_name}
                </span>
              )}
              <div className="text-sm line-clamp-4 text-foreground">
                <MathRenderer content={parseProblemText(todayProblem.content).slice(0, 200)} />
              </div>
              <Button className="mt-4 w-full" size="lg">
                풀기 시작
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          ) : (
            <Card className="p-6 text-center text-muted-foreground">
              <p>문제를 불러올 수 없어요.</p>
              <p className="text-sm mt-1">관리자에게 문제를 추가해달라고 요청해 주세요.</p>
            </Card>
          )}
        </div>

        {/* 단원별 숙련도 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              단원별 숙련도
            </h2>
            <Link to="/history" className="text-xs text-primary hover:underline">전체 보기</Link>
          </div>
          {statsLoading ? (
            <InlineLoader message="통계 불러오는 중..." />
          ) : domainStats.length === 0 ? (
            <Card className="p-5 text-center text-muted-foreground text-sm">
              <p>아직 풀이 기록이 없어요.</p>
              <p className="text-xs mt-1">문제를 풀면 단원별 숙련도가 표시돼요.</p>
            </Card>
          ) : (
            <Card className="p-4 space-y-3">
              {domainStats.map(d => {
                const { bar, text, label } = getMasteryColor(d.avg);
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{d.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${text}`}>{label}</span>
                        <span className="text-xs text-muted-foreground">{d.avg}점</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${d.avg}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.count}문제 풀이</p>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}