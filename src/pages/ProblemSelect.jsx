import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ScoreBadge from '@/components/ScoreBadge';
import { Shuffle, BookOpen, Wrench, AlertCircle, ChevronRight, ArrowLeft, Clock, ClipboardList, Star } from 'lucide-react';

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
// Closed assignment card (gray, expired)
// ──────────────────────────────────────────────
function ClosedAssignmentCard({ assignment, user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const attempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: assignment.id },
          '-submitted_at',
          100
        );
        const uniqueDone = new Set(attempts.map(a => a.problem_id)).size;
        setProgress({ done: uniqueDone, total: problemIds.length });
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    };
    loadProgress();
  }, [assignment, user.id]);

  return (
    <Card
      className="p-4 cursor-pointer border-2 border-gray-200 bg-gray-50/50"
      onClick={() => navigate(`/assignment/${assignment.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-foreground truncate text-gray-500">{assignment.title}</p>
            <Badge className="bg-gray-400 text-white text-xs">마감됨</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            마감: {new Date(assignment.deadline || assignment.created_date).toLocaleDateString('ko-KR')}
          </p>
        </div>
        <ClipboardList className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>진행률</span>
          <span>{progress.done}/{progress.total} 문제</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gray-400 h-full transition-all"
            style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Assignment card for student
// ──────────────────────────────────────────────
function AssignmentCard({ assignment, user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const attempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: assignment.id },
          '-submitted_at',
          100
        );
        const uniqueDone = new Set(attempts.map(a => a.problem_id)).size;
        setProgress({ done: uniqueDone, total: problemIds.length });
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    };
    loadProgress();
  }, [assignment, user.id]);

  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  const now = new Date();
  const isUrgent = deadline && deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Card
      className="p-4 card-hover cursor-pointer"
      onClick={() => navigate(`/assignment/${assignment.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-foreground truncate">{assignment.title}</p>
            {isUrgent && (
              <Badge className="bg-red-500 text-white text-xs">마감 임박</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {deadline
              ? `마감: ${deadline.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${daysLeft > 0 ? `D-${daysLeft}` : '오늘'})`
              : '마감 없음'}
          </p>
        </div>
        <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>진행률</span>
          <span>{progress.done}/{progress.total} 문제</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Hub main (no mode param)
// ──────────────────────────────────────────────
function ProblemHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [recommendedProblems, setRecommendedProblems] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [goingRandom, setGoingRandom] = useState(false);

  const handleGoRandom = async () => {
    if (goingRandom) return;
    setGoingRandom(true);
    try {
      const all = await base44.entities.Problem.list('-created_date', 1000, 0);
      if (all.length === 0) return;
      const random = all[Math.floor(Math.random() * all.length)];
      navigate(`/problem/${random.id}`);
    } finally {
      setGoingRandom(false);
    }
  };

  useEffect(() => {
    const loadAssignments = async () => {
      if (!user?.class_id) {
        setLoading(false);
        return;
      }
      try {
        const all = await base44.entities.Assignment.filter({ class_id: user.class_id }, '-created_date', 100);
        const now = new Date();
        const isClosed = (a) => a.status === 'closed' || (a.deadline && new Date(a.deadline) <= now);
        const closed = all.filter(isClosed);
        const active = all.filter(a => !isClosed(a));
        setAssignments({ active, closed });
      } catch (e) {
        console.error('Failed to load assignments:', e);
      } finally {
        setLoading(false);
      }
    };
    loadAssignments();
  }, [user]);

  // Load recommended problems (bookmarked + weak tools)
  useEffect(() => {
    const loadRecs = async () => {
      if (!user) {
        setRecsLoading(false);
        return;
      }
      try {
        const [bookmarks, allAttempts, allProblems, allTools] = await Promise.all([
          base44.entities.BookmarkedTool.filter({ student_id: user.id }, '-created_date', 100),
          base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 500),
          base44.entities.Problem.list('-created_date', 1000, 0),
          base44.entities.MathTool.list('name', 100),
        ]);

        // Build problem map
        const problemMap = new Map(allProblems.map(p => [p.id, p]));
        const toolMap = new Map(allTools.map(t => [t.tool_id, t]));

        // Calculate weak tools
        const masteryMap = new Map();
        allAttempts.forEach(attempt => {
          const problem = problemMap.get(attempt.problem_id);
          if (!problem) return;
          let toolIds = [];
          if (attempt.claude_grade_json) {
            try {
              const g = JSON.parse(attempt.claude_grade_json);
              const grading = g?.response ?? g;
              const errorToolIds = (grading?.error_locations || []).map(e => e.tool_id).filter(Boolean);
              if (errorToolIds.length > 0) toolIds = [...new Set(errorToolIds)];
            } catch {}
          }
          if (toolIds.length === 0 && problem.tool_ids) {
            try {
              const parsed = JSON.parse(problem.tool_ids);
              if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
            } catch {}
          }
          toolIds.forEach(toolId => {
            if (!masteryMap.has(toolId)) masteryMap.set(toolId, { attempts: 0, scores: [] });
            const entry = masteryMap.get(toolId);
            entry.attempts += 1;
            entry.scores.push(attempt.score || 0);
          });
        });

        // Weak tools (avg_score < 70, attempts >= 3)
        const weakToolIds = [];
        masteryMap.forEach((entry, toolId) => {
          if (entry.attempts >= 3) {
            const avg = entry.scores.reduce((s, x) => s + x, 0) / entry.scores.length;
            if (avg < 70) weakToolIds.push(toolId);
          }
        });

        // Combine bookmarked + weak tools (bookmarked first)
        const recommendedToolIds = [
          ...new Set([
            ...bookmarks.map(b => b.tool_id),
            ...weakToolIds.slice(0, 5)
          ])
        ];

        // Pick 1-2 problems per recommended tool
        const recProblems = [];
        recommendedToolIds.slice(0, 3).forEach(toolId => {
          const toolProblems = allProblems.filter(p => {
            try {
              const ids = JSON.parse(p.tool_ids || '[]');
              return ids.includes(toolId);
            } catch { return false; }
          });
          if (toolProblems.length > 0) {
            const shuffled = toolProblems.sort(() => Math.random() - 0.5);
            recProblems.push(...shuffled.slice(0, 2));
          }
        });

        // Fallback: random problems if no recommendations
        const finalRecs = recProblems.length > 0 ? recProblems : allProblems.slice(0, 5);
        setRecommendedProblems(finalRecs);
        setBookmarkCount(bookmarks.length);
      } catch (e) {
        console.error('Failed to load recommendations:', e);
      } finally {
        setRecsLoading(false);
      }
    };
    loadRecs();
  }, [user]);

  return (
    <AppLayout>
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold">어떻게 공부할까요?</h1>
        </div>

        {/* 받은 숙제 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">받은 숙제</h2>
          {loading ? (
            <div className="text-center py-6"><InlineLoader message="숙제 불러오는 중..." /></div>
          ) : !assignments.active || assignments.active.length === 0 ? (
            <ComingSoonCard title="받은 숙제가 없어요" desc="강사님이 숙제를 출제하면 여기에 표시돼요" />
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  📋 진행 중 ({assignments.active.length})
                </h3>
                <div className="space-y-2">
                  {assignments.active.map(assignment => (
                    <AssignmentCard key={assignment.id} assignment={assignment} user={user} />
                  ))}
                </div>
              </div>
              {assignments.closed && assignments.closed.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowClosed(!showClosed)}
                    className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2 mb-2"
                  >
                    📁 마감된 숙제 ({assignments.closed.length})
                    <ChevronRight className={`w-4 h-4 transition-transform ${showClosed ? 'rotate-90' : ''}`} />
                  </button>
                  {showClosed && (
                    <div className="space-y-2">
                      {assignments.closed.map(assignment => (
                        <ClosedAssignmentCard key={assignment.id} assignment={assignment} user={user} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 즐겨찾기 매듭 */}
        {bookmarkCount > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">내 즐겨찾기 매듭</h2>
            <Link to="/bookmarks">
              <Card className="p-4 card-hover cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-amber-500 bg-amber-50">
                    <Star className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">내 즐겨찾기 매듭 ({bookmarkCount})</p>
                    <p className="text-xs text-muted-foreground mt-0.5">나중에 다시 공부하려고 표시한 매듭들</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Card>
            </Link>
          </section>
        )}

        {/* 진단 평가 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">진단 평가</h2>
          <ComingSoonCard
            title="진단 평가 준비 중"
            desc="곧 진단 평가가 추가돼요"
          />
        </section>

        {/* 추천 문제 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">추천 문제</h2>
          {recsLoading ? (
            <div className="text-center py-4"><InlineLoader message="추천 문제 불러오는 중..." /></div>
          ) : recommendedProblems.length === 0 ? (
            <ComingSoonCard
              title="추천 문제 준비 중"
              desc="더 많은 문제를 풀면 추천이 생겨요"
            />
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {recommendedProblems.slice(0, 5).map((problem) => (
                <Link key={problem.id} to={`/problem/${problem.id}`}>
                  <Card className="p-4 card-hover cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-primary bg-primary/10">
                        <Star className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">
                          {problem.domain_name || '추천 문제'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">탭해서 풀기</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 자유 연습 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">자유 연습</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'random', icon: Shuffle, label: '랜덤', desc: '무작위 문제', color: 'text-blue-500 bg-blue-50', action: 'go-random' },
              { id: 'domain', icon: BookOpen, label: '단원별', desc: '단원을 골라서 연습', color: 'text-purple-500 bg-purple-50', action: 'navigate-mode' },
              { id: 'tool', icon: Wrench, label: '도구별', desc: '수학 도구를 골라서 연습', color: 'text-amber-500 bg-amber-50', action: 'navigate-mode' },
            ].map(item => {
              const cardContent = (
                <Card className="p-4 card-hover cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{goingRandom && item.action === 'go-random' ? '불러오는 중...' : item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Card>
              );
              if (item.action === 'go-random') {
                return (
                  <button key={item.id} className="w-full text-left" onClick={handleGoRandom} disabled={goingRandom}>
                    {cardContent}
                  </button>
                );
              }
              return (
                <Link key={item.id} to={`/problems?mode=${item.id}`}>
                  {cardContent}
                </Link>
              );
            })}
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

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
    if (user.role === 'teacher' || user.role === 'owner') { navigate('/teacher', { replace: true }); return; }
  }, [user]);

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

  useEffect(() => {
    if (mode === 'random' && problems.length > 0) {
      const idx = Math.floor(Math.random() * problems.length);
      navigate(`/problem/${problems[idx].id}`, { replace: true });
    }
  }, [mode, problems]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (mode === 'domain') {
        const [d, allP] = await Promise.all([
          base44.entities.Domain.list('name', 50),
          base44.entities.Problem.list('domain_id', 5000),
        ]);
        // Count problems per domain dynamically
        const countMap = {};
        allP.forEach(p => {
          if (p.domain_id) countMap[p.domain_id] = (countMap[p.domain_id] || 0) + 1;
        });
        setDomains(d.map(dom => ({ ...dom, problem_count: countMap[dom.domain_id] || 0 })));
      } else if (mode === 'tool') {
        const [t, allP] = await Promise.all([
          base44.entities.MathTool.list('name', 50),
          base44.entities.Problem.list('tool_ids', 5000),
        ]);
        // Count problems per tool dynamically
        const toolCountMap = {};
        allP.forEach(p => {
          try {
            const ids = JSON.parse(p.tool_ids || '[]');
            ids.forEach(tid => { toolCountMap[tid] = (toolCountMap[tid] || 0) + 1; });
          } catch {}
        });
        setTools(t.map(tool => ({ ...tool, problem_count: toolCountMap[tool.tool_id] || 0 })));
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
              <InlineLoader message="랜덤 문제로 이동하는 중..." />
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
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
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