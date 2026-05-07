import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ScoreBadge from '@/components/ScoreBadge';
import { Shuffle, BookOpen, Wrench, AlertCircle, ChevronRight, ArrowLeft, Clock } from 'lucide-react';

// ──────────────────────────────────────────────
// Hub placeholder card
// ──────────────────────────────────────────────
function ComingSoonCard({ title, desc }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 opacity-60 cursor-not-allowed select-none">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm text-foreground">{title}</p>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              곧 추가될 기능
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Hub main (no mode param)
// ──────────────────────────────────────────────
function ProblemHub() {
  return (
    <AppLayout>
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold">학습 경로</h1>
          <p className="text-muted-foreground text-sm mt-1">어떻게 공부할까요?</p>
        </div>

        {/* 받은 숙제 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">받은 숙제</h2>
          <ComingSoonCard
            title="숙제가 없어요"
            desc="곧 강사 숙제 출제 기능이 추가돼요"
          />
        </section>

        {/* 오늘의 추천 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">오늘의 추천</h2>
          <ComingSoonCard
            title="추천 문제 준비 중"
            desc="곧 매듭별 약점 보강 추천이 추가돼요"
          />
        </section>

        {/* 진단 평가 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">진단 평가</h2>
          <ComingSoonCard
            title="진단 평가 준비 중"
            desc="곧 진단 평가가 추가돼요"
          />
        </section>

        {/* 자유 연습 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">자유 연습</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'random', icon: Shuffle, label: '랜덤', desc: '무작위 문제', color: 'text-blue-500 bg-blue-50' },
              { id: 'domain', icon: BookOpen, label: '단원별', desc: '단원을 골라서 연습', color: 'text-purple-500 bg-purple-50' },
              { id: 'tool', icon: Wrench, label: '도구별', desc: '수학 도구를 골라서 연습', color: 'text-amber-500 bg-amber-50' },
            ].map(mode => (
              <Link key={mode.id} to={`/problems?mode=${mode.id}`}>
                <Card className="p-4 card-hover cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${mode.color}`}>
                      <mode.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{mode.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* 복습 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">복습</h2>
          <Link to="/problems?mode=wrong">
            <Card className="p-4 card-hover cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-red-500 bg-red-50">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">틀렸던 문제</p>
                  <p className="text-xs text-muted-foreground mt-0.5">틀렸던 문제만 골라서 복습</p>
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

// ──────────────────────────────────────────────
// Mode screens (existing behaviour)
// ──────────────────────────────────────────────
export default function ProblemSelect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  // No mode → hub
  if (!mode) return <ProblemHub />;

  return <ProblemModeView mode={mode} user={user} navigate={navigate} />;
}

function ProblemModeView({ mode, user, navigate }) {
  const [domains, setDomains] = useState([]);
  const [tools, setTools] = useState([]);
  const [wrongAttempts, setWrongAttempts] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [mode]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (mode === 'domain') {
        const d = await base44.entities.Domain.list('name', 50);
        setDomains(d);
      } else if (mode === 'tool') {
        const t = await base44.entities.MathTool.list('name', 50);
        setTools(t);
      } else if (mode === 'wrong') {
        if (user) {
          const attempts = await base44.entities.StudentAttempt.filter(
            { student_id: user.id }, '-submitted_at', 50
          );
          const wrong = attempts.filter(a => (a.score || 0) < 60 || a.correctness === 'wrong');
          setWrongAttempts(wrong);
        }
      } else {
        const p = await base44.entities.Problem.list('-created_date', 1000, 0);
        setProblems(p);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRandom = () => {
    if (problems.length === 0) return;
    const idx = Math.floor(Math.random() * problems.length);
    navigate(`/problem/${problems[idx].id}`);
  };

  const handleDomainSelect = async (domain) => {
    setLoading(true);
    try {
      const all = await base44.entities.Problem.filter({ domain_id: domain.domain_id }, '-created_date', 1000, 0);
      if (all.length === 0) {
        const allP = await base44.entities.Problem.list('-created_date', 1000, 0);
        if (allP.length > 0) navigate(`/problem/${allP[Math.floor(Math.random() * allP.length)].id}`);
        return;
      }
      navigate(`/problem/${all[Math.floor(Math.random() * all.length)].id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToolSelect = async (tool) => {
    setLoading(true);
    try {
      const all = await base44.entities.Problem.list('-created_date', 1000, 0);
      const filtered = all.filter(p => {
        try {
          const ids = JSON.parse(p.tool_ids || '[]');
          return ids.includes(tool.tool_id);
        } catch { return false; }
      });
      const pool = filtered.length > 0 ? filtered : all;
      if (pool.length === 0) return;
      navigate(`/problem/${pool[Math.floor(Math.random() * pool.length)].id}`);
    } finally {
      setLoading(false);
    }
  };

  const modeConfig = {
    random: { icon: Shuffle, title: '랜덤 문제', color: 'text-blue-500' },
    domain: { icon: BookOpen, title: '단원별 문제', color: 'text-purple-500' },
    tool: { icon: Wrench, title: '도구별 문제', color: 'text-amber-500' },
    wrong: { icon: AlertCircle, title: '틀렸던 문제', color: 'text-red-500' },
  };
  const cfg = modeConfig[mode] || modeConfig.random;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/problems')} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
              {cfg.title}
            </h1>
          </div>
        </div>

        {loading ? (
          <InlineLoader message="불러오는 중..." />
        ) : (
          <>
            {mode === 'random' && (
              <div className="flex flex-col items-center gap-6 py-8">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center">
                  <Shuffle className="w-10 h-10 text-blue-500" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold">랜덤 문제</h2>
                  <p className="text-muted-foreground mt-2">무작위로 문제를 골라볼게요!</p>
                </div>
                <Button size="lg" className="w-full max-w-xs" onClick={handleRandom} disabled={problems.length === 0}>
                  <Shuffle className="w-5 h-5 mr-2" />
                  랜덤으로 풀기
                </Button>
                {problems.length === 0 && (
                  <p className="text-sm text-muted-foreground">문제가 없어요. 관리자에게 문의해 주세요.</p>
                )}
              </div>
            )}

            {mode === 'domain' && (
              <div>
                <p className="text-muted-foreground mb-4">어떤 단원으로 연습할까요?</p>
                {domains.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">단원 정보가 없어요.</p>
                ) : (
                  <div className="space-y-2">
                    {domains.map(domain => (
                      <Card key={domain.id} className="p-4 card-hover cursor-pointer"
                            onClick={() => handleDomainSelect(domain)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{domain.name}</p>
                            {domain.grade_range && (
                              <p className="text-xs text-muted-foreground mt-0.5">{domain.grade_range}학년</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {domain.problem_count && (
                              <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                                {domain.problem_count}문제
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'tool' && (
              <div>
                <p className="text-muted-foreground mb-4">어떤 도구로 연습할까요?</p>
                {tools.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">도구 정보가 없어요.</p>
                ) : (
                  <div className="space-y-2">
                    {tools.map(tool => (
                      <Card key={tool.id} className="p-4 card-hover cursor-pointer"
                            onClick={() => handleToolSelect(tool)}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground">{tool.name}</p>
                            {tool.goal && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{tool.goal}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {tool.problem_count && (
                              <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                                {tool.problem_count}문제
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'wrong' && (
              <div>
                {wrongAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">🎉</span>
                    </div>
                    <p className="font-semibold text-lg text-foreground">아직 틀린 문제가 없어요!</p>
                    <p className="text-muted-foreground mt-2">다른 모드로 연습해 볼까요?</p>
                    <Button className="mt-4" onClick={() => navigate('/problems?mode=random')}>
                      랜덤으로 풀기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground mb-4">다시 풀어볼 문제들이에요</p>
                    {wrongAttempts.map(attempt => (
                      <Card key={attempt.id}
                            className="p-4 card-hover cursor-pointer border-l-4 border-l-red-300"
                            onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {attempt.problem_content
                                ? attempt.problem_content.slice(0, 60) + '...'
                                : `문제 #${attempt.problem_id}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString('ko-KR') : ''}
                            </p>
                          </div>
                          <ScoreBadge score={attempt.score || 0} size="sm" />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}