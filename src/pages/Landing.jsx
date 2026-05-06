import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    emoji: '✍️',
    title: '손으로 풀기',
    desc: '필기 또는 사진 업로드로 풀이를 제출해 보세요',
  },
  {
    emoji: '🤖',
    title: 'AI 단계별 피드백',
    desc: '어디가 맞고 어디서 막혔는지 단계별로 알려드려요',
  },
  {
    emoji: '📊',
    title: '내 풀이 기록',
    desc: '단원별·도구별 약점을 추적하고 다시 풀어볼 수 있어요',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.isAuthenticated().then(authed => {
      if (authed) navigate('/home', { replace: true });
    });
  }, [navigate]);

  const handleStart = () => {
    base44.auth.redirectToLogin('/home');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-korean">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base">수</span>
          </div>
          <span className="font-bold text-foreground text-lg">KNOTA</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleStart}>
          로그인
        </Button>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 gap-6">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-2">
          <span className="text-5xl">🧮</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
          수학을 손으로 풀고,<br />
          <span className="text-primary">AI가 채점해 드려요</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed">
          K-12 수학 문제를 필기로 풀고 AI에게 단계별 피드백을 받아보세요.
          틀린 곳, 빠진 곳, 오류 유형까지 정확하게 알려드려요.
        </p>
        <Button size="lg" className="mt-2 px-10 py-6 text-lg rounded-2xl shadow-lg" onClick={handleStart}>
          시작하기 →
        </Button>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-16 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="font-bold text-foreground text-base">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-muted-foreground text-sm">
        © 2026 KNOTA
      </footer>
    </div>
  );
}