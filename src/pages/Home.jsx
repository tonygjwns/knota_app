import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MathRenderer from '@/components/MathRenderer';
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
  const [loading, setLoading] = useState(true);
  const [orgLabel, setOrgLabel] = useState([]);

  useEffect(() => {
    if (!user) return;
    // E-1: redirect non-students
    if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
    if (user.role === 'teacher') { navigate('/teacher', { replace: true }); return; }
    loadData();
    loadOrgInfo();
  }, [user]);

  const loadOrgInfo = async () => {
    if (!user?.academy_id && !user?.class_id) return;
    try {
      const [academies, classesAll] = await Promise.all([
        user.academy_id ? base44.entities.Academy.list('name', 200) : Promise.resolve([]),
        user.class_id ? base44.entities.Class.list('name', 500) : Promise.resolve([]),
      ]);
      const academy = academies.find(a => a.id === user.academy_id);
      const cls = classesAll.find(c => c.id === user.class_id);
      // Store separately for two-line display
      const parts = [academy?.name, cls?.name].filter(Boolean);
      if (parts.length > 0) setOrgLabel(parts);
    } catch { /* silent */ }
  };

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
      </div>
    </AppLayout>
  );
}