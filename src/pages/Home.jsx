import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MathRenderer from '@/components/MathRenderer';
import { Star, ChevronRight, TrendingUp, Target, BarChart3 } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayProblem, setTodayProblem] = useState(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const attempts = await base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recent = attempts.filter(a => a.submitted_at && new Date(a.submitted_at) > thirtyDaysAgo);
      if (recent.length > 0) {
        const avgScore = Math.round(recent.reduce((s, a) => s + (a.score || 0), 0) / recent.length);
        const correct = recent.filter(a => a.correctness === 'correct').length;
        setRecentStats({ total: recent.length, avgScore, correct });
      }
    } catch (err) {
      console.error(err);
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

        {/* 내 진단 */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            내 진단
          </h2>
          <Link to="/diagnosis">
            <Card className="p-4 card-hover cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-500 bg-emerald-50">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">내 진단 보기</p>
                  <p className="text-xs text-muted-foreground mt-0.5">약점 도구와 영역별 숙련도</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}