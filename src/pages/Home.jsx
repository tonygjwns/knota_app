import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MathRenderer from '@/components/MathRenderer';
import ScoreBadge, { getScoreColor } from '@/components/ScoreBadge';
import { Shuffle, BookOpen, Wrench, AlertCircle, ChevronRight, Star } from 'lucide-react';

const MODES = [
  { id: 'random', icon: Shuffle, label: '랜덤', desc: '랜덤 문제', color: 'text-blue-500 bg-blue-50' },
  { id: 'domain', icon: BookOpen, label: '단원별', desc: '단원 선택', color: 'text-purple-500 bg-purple-50' },
  { id: 'tool', icon: Wrench, label: '도구별', desc: '도구 선택', color: 'text-amber-500 bg-amber-50' },
  { id: 'wrong', icon: AlertCircle, label: '틀렸던 문제', desc: '복습', color: 'text-red-500 bg-red-50' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayProblem, setTodayProblem] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, correct: 0, avg: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [problems, attempts] = await Promise.all([
        base44.entities.Problem.list('-created_date', 100),
        user ? base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 5) : [],
      ]);

      if (problems.length > 0) {
        const idx = Math.floor(Math.random() * problems.length);
        setTodayProblem(problems[idx]);
      }

      if (attempts.length > 0) {
        setRecentAttempts(attempts);
        const total = attempts.length;
        const correct = attempts.filter(a => a.correctness === 'correct').length;
        const avg = Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / total);
        setStats({ total, correct, avg });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleRandomProblem = () => {
    if (todayProblem) {
      navigate(`/problem/${todayProblem.id}`);
    }
  };

  const isNewUser = recentAttempts.length === 0;
  const greeting = user?.full_name ? `안녕하세요, ${user.full_name}님!` : '안녕하세요!';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="text-muted-foreground mt-1">
            {isNewUser ? '첫 문제를 풀어볼까요? 🌟' : '오늘도 열심히 해볼까요? 💪'}
          </p>
        </div>

        {/* Stats (for existing users) */}
        {!isNewUser && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '총 풀이', value: stats.total + '개' },
              { label: '정답', value: stats.correct + '개' },
              { label: '평균 점수', value: stats.avg + '점' },
            ].map(s => (
              <Card key={s.label} className="p-3 text-center">
                <p className="text-xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
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
            <Card className="p-5 card-hover cursor-pointer" onClick={handleRandomProblem}>
              {todayProblem.domain_name && (
                <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-3">
                  {todayProblem.domain_name}
                </span>
              )}
              <div className="text-sm line-clamp-4 text-foreground">
                <MathRenderer content={parseProblemText(todayProblem.content).slice(0, 200)} />
              </div>
              <Button className="mt-4 w-full" size="lg">
                {isNewUser ? '첫 문제 풀기 🚀' : '풀기 시작'}
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

        {/* Problem selection modes */}
        <div>
          <h2 className="text-lg font-semibold mb-3">문제 선택</h2>
          <div className="grid grid-cols-2 gap-3">
            {MODES.map(mode => (
              <Link key={mode.id} to={`/problems?mode=${mode.id}`}>
                <Card className="p-4 card-hover cursor-pointer h-full">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${mode.color}`}>
                    <mode.icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{mode.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent attempts */}
        {recentAttempts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">최근 풀이</h2>
              <Link to="/history" className="text-sm text-primary hover:underline">모두 보기</Link>
            </div>
            <div className="space-y-2">
              {recentAttempts.slice(0, 3).map(attempt => {
                const color = getScoreColor(attempt.score || 0);
                const colorMap = {
                  correct: 'border-l-emerald-400',
                  partial: 'border-l-amber-400',
                  wrong: 'border-l-red-400'
                };
                return (
                  <Link key={attempt.id} to={`/result/${attempt.id}`}>
                    <Card className={`p-3 card-hover flex items-center justify-between border-l-4 ${colorMap[color]}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {attempt.problem_content ? parseProblemText(attempt.problem_content).slice(0, 50) + '...' : `문제 #${attempt.problem_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('ko-KR') : ''}
                        </p>
                      </div>
                      <ScoreBadge score={attempt.score || 0} size="sm" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}