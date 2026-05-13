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
import { gradeLabel, gradeLabelShort, extractGradeOptions } from '@/lib/grade-labels.js';
import {
  Shuffle, BookOpen, Wrench, AlertCircle, ChevronRight, ArrowLeft,
  Clock, ClipboardList, Star, Sparkles
} from 'lucide-react';
import { buildMasteryMap, computeWeakness, getMasteryColor } from '@/lib/mastery';

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
// Closed assignment card
// ──────────────────────────────────────────────
function ClosedAssignmentCard({ assignment, user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    (async () => {
      try {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const attempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: assignment.id }, '-submitted_at', 100
        );
        const uniqueDone = new Set(attempts.map(a => a.problem_id)).size;
        setProgress({ done: uniqueDone, total: problemIds.length });
      } catch {}
    })();
  }, [assignment, user.id]);

  return (
    <Card className="p-4 cursor-pointer border-2 border-gray-200 bg-gray-50/50"
          onClick={() => navigate(`/assignment/${assignment.id}`)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold truncate text-gray-500">{assignment.title}</p>
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
          <div className="bg-gray-400 h-full transition-all"
               style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Assignment card
// ──────────────────────────────────────────────
function AssignmentCard({ assignment, user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    (async () => {
      try {
        const problemIds = JSON.parse(assignment.problem_ids || '[]');
        const attempts = await base44.entities.StudentAttempt.filter(
          { student_id: user.id, assignment_id: assignment.id }, '-submitted_at', 100
        );
        const uniqueDone = new Set(attempts.map(a => a.problem_id)).size;
        setProgress({ done: uniqueDone, total: problemIds.length });
      } catch {}
    })();
  }, [assignment, user.id]);

  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  const now = new Date();
  const isUrgent = deadline && deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Card className="p-4 card-hover cursor-pointer" onClick={() => navigate(`/assignment/${assignment.id}`)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-foreground truncate">{assignment.title}</p>
            {isUrgent && <Badge className="bg-red-500 text-white text-xs">마감 임박</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {deadline
              ? `마감: ${deadline.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${daysLeft > 0 ? `D-${daysLeft}` : '오늘'})`
              : '마감 없음'}
          </p>
        </div>
        <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>진행률</span>
          <span>{progress.done}/{progress.total} 문제</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div className="bg-primary h-full transition-all"
               style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
        </div>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Hub main
// ──────────────────────────────────────────────
function ProblemHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState({ active: [], closed: [] });
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [goingRandom, setGoingRandom] = useState(false);

  const handleGoRandom = async () => {
    if (goingRandom) return;
    setGoingRandom(true);
    try {
      const all = await base44.entities.Problem.list('-created_date', 1000, 0);
      if (all.length === 0) return;
      navigate(`/problem/${all[Math.floor(Math.random() * all.length)].id}`);
    } finally {
      setGoingRandom(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (user?.class_id) {
        try {
          const all = await base44.entities.Assignment.filter({ class_id: user.class_id }, '-created_date', 100);
          const now = new Date();
          const isClosed = (a) => a.status === 'closed' || (a.deadline && new Date(a.deadline) <= now);
          setAssignments({ active: all.filter(a => !isClosed(a)), closed: all.filter(isClosed) });
        } catch {}
      }
      setLoading(false);
    })();
  }, [user]);

  const FREE_PRACTICE_ITEMS = [
    { id: 'recommended', icon: Sparkles, label: '추천', desc: '내가 틀릴 확률이 높은 문제', color: 'text-primary bg-primary/10', action: 'navigate-mode' },
    { id: 'random', icon: Shuffle, label: '랜덤', desc: '무작위 문제', color: 'text-blue-500 bg-blue-50', action: 'go-random' },
    { id: 'domain', icon: BookOpen, label: '단원별', desc: '영역/단원을 골라서 연습', color: 'text-purple-500 bg-purple-50', action: 'navigate-mode' },
    { id: 'tool', icon: Wrench, label: '도구별', desc: '약점 도구부터 연습', color: 'text-amber-500 bg-amber-50', action: 'navigate-mode' },
    { id: 'wrong', icon: AlertCircle, label: '틀렸던 문제', desc: '틀렸던 문제만 골라서 연습', color: 'text-red-500 bg-red-50', action: 'navigate-mode' },
  ];

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
            <InlineLoader message="숙제 불러오는 중..." />
          ) : (
            <div className="space-y-3">
              {/* 진행 중 */}
              {assignments.active.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">📋 진행 중 ({assignments.active.length})</h3>
                  <div className="space-y-2">
                    {assignments.active.map(a => <AssignmentCard key={a.id} assignment={a} user={user} />)}
                  </div>
                </div>
              )}
              {assignments.active.length === 0 && (
                <ComingSoonCard title="받은 숙제가 없어요" desc="강사님이 숙제를 출제하면 여기에 표시돼요" />
              )}

              {/* 진단 평가 */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">📝 진단 평가</h3>
                <ComingSoonCard title="진단 평가 준비 중" desc="곧 진단 평가가 추가돼요" />
              </div>

              {/* 마감된 숙제 */}
              {assignments.closed.length > 0 && (
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
                      {assignments.closed.map(a => <ClosedAssignmentCard key={a.id} assignment={a} user={user} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 자유 연습 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">자유 연습</h2>
          <div className="grid grid-cols-1 gap-2">
            {FREE_PRACTICE_ITEMS.map(item => {
              const cardContent = (
                <Card className="p-4 card-hover cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {goingRandom && item.action === 'go-random' ? '불러오는 중...' : item.desc}
                      </p>
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
      </div>
    </AppLayout>
  );
}

// ──────────────────────────────────────────────
// Mode view
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

  if (!mode) return <ProblemHub />;
  return <ProblemModeView mode={mode} user={user} navigate={navigate} />;
}

// ──────────────────────────────────────────────
// ProblemModeView
// ──────────────────────────────────────────────
function ProblemModeView({ mode, user, navigate }) {
  const [domains, setDomains] = useState([]);
  const [tools, setTools] = useState([]);
  const [problems, setProblems] = useState([]);
  const [types, setTypes] = useState([]);
  const [problemTypes, setProblemTypes] = useState([]);
  const [wrongAttempts, setWrongAttempts] = useState([]);
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // domain drill-down: null = 영역 목록, Domain객체 = 그 영역의 단원 목록
  const [selectedDomain, setSelectedDomain] = useState(null);

  // tool filters
  const [toolFilterGrade, setToolFilterGrade] = useState('');
  const [toolFilterDomain, setToolFilterDomain] = useState('');
  const [toolFilterType, setToolFilterType] = useState(null);
  const [typeToolMap, setTypeToolMap] = useState(new Map());

  // wrong filters
  const [wrongFilterGrade, setWrongFilterGrade] = useState('');
  const [wrongFilterDomain, setWrongFilterDomain] = useState('');
  const [wrongSort, setWrongSort] = useState('recent');

  // tool section collapse
  const [expandedToolSections, setExpandedToolSections] = useState({ new: true, practiced: true });
  // wrong date group collapse
  const [expandedWrongDates, setExpandedWrongDates] = useState({
    today: true, yesterday: true, thisWeek: true, thisMonth: false, older: false,
  });

  useEffect(() => {
    setLoading(true);
    setSelectedDomain(null);
    loadData();
  }, [mode]);

  const loadData = async () => {
    try {
      if (mode === 'recommended' && user) {
        const [attempts, allProblems, allTools, allDomains] = await Promise.all([
          base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 500),
          base44.entities.Problem.list('-created_date', 1000, 0),
          base44.entities.MathTool.list('name', 200),
          base44.entities.Domain.list('grade_range', 100),
        ]);

        const problemMap = new Map(allProblems.map(p => [p.id, p]));
        const toolMap = new Map(allTools.map(t => [t.tool_id, t]));
        const masteryMap = buildMasteryMap(attempts, problemMap);

        const candidates = [];
        for (const [tid, m] of masteryMap) {
          const weakness = computeWeakness(m);
          if (weakness === null) continue;
          const tool = toolMap.get(tid);
          if (!tool) continue;
          const avg = Math.round(m.weightedScore / m.weight);
          candidates.push({ tool_id: tid, tool, weakness, avg });
        }
        candidates.sort((a, b) => b.weakness - a.weakness);

        const pickProblem = (toolId) => {
          const probs = allProblems.filter(p => {
            try { return JSON.parse(p.tool_ids || '[]').includes(toolId); } catch { return false; }
          });
          return probs.length > 0 ? probs[Math.floor(Math.random() * probs.length)] : null;
        };

        const strengthOf = (w) => {
          if (w >= 80) return 5;
          if (w >= 60) return 4;
          if (w >= 40) return 3;
          if (w >= 20) return 2;
          return 1;
        };

        const recs = [];
        const usedToolIds = new Set();
        for (const c of candidates) {
          if (recs.length >= 5) break;
          if (usedToolIds.has(c.tool_id)) continue;
          const prob = pickProblem(c.tool_id);
          if (!prob) continue;
          recs.push({
            problem: prob,
            reason: {
              type: 'weak',
              detail: `${c.tool.name} · 평균 ${c.avg}점`,
              strength: strengthOf(c.weakness),
            },
          });
          usedToolIds.add(c.tool_id);
        }

        setRecommendedItems(recs);
        setDomains(allDomains);
        setProblems(allProblems);

      } else if (mode === 'domain') {
        const [d, allP, allTypes, allPTs] = await Promise.all([
          base44.entities.Domain.list('name', 200),
          base44.entities.Problem.list('domain_id', 5000),
          base44.entities.Type.list('name', 100),
          base44.entities.ProblemType.list('-created_date', 500),
        ]);
        const countMap = {};
        allP.forEach(p => { if (p.domain_id) countMap[p.domain_id] = (countMap[p.domain_id] || 0) + 1; });
        setDomains(d.map(dom => ({ ...dom, problem_count: countMap[dom.domain_id] || 0 })));
        setProblems(allP);
        setTypes(allTypes);
        setProblemTypes(allPTs);

      } else if (mode === 'tool') {
        const [t, allP, allD, allTypes, allTypeToolMap, allPTs, allAttempts] = await Promise.all([
          base44.entities.MathTool.list('name', 200),
          base44.entities.Problem.list('tool_ids', 5000),
          base44.entities.Domain.list('grade_range', 100),
          base44.entities.Type.list('name', 500),
          base44.entities.TypeToolMap.list('-updated_at', 1000),
          base44.entities.ProblemType.list('-created_date', 10000),
          user ? base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 500) : Promise.resolve([]),
        ]);
        setProblemTypes(allPTs);
        const problemMap = new Map(allP.map(p => [p.id, p]));
        const masteryMap = buildMasteryMap(allAttempts, problemMap);
        const toolCountMap = {};
        allP.forEach(p => {
          try { JSON.parse(p.tool_ids || '[]').forEach(tid => { toolCountMap[tid] = (toolCountMap[tid] || 0) + 1; }); } catch {}
        });
        const toolsWithMastery = t.map(tool => {
          const m = masteryMap.get(tool.tool_id);
          const isNew = !m || m.weight < 0.5;
          const avg = isNew ? null : Math.round(m.weightedScore / m.weight);
          return { ...tool, problem_count: toolCountMap[tool.tool_id] || 0, isNew, avg, weight: m?.weight || 0 };
        });
        toolsWithMastery.sort((a, b) => {
          if (a.isNew && !b.isNew) return -1;
          if (!a.isNew && b.isNew) return 1;
          if (a.isNew && b.isNew) return 0;
          return (a.avg ?? 100) - (b.avg ?? 100);
        });
        // TypeToolMap
        const ttmMap = new Map();
        allTypeToolMap.forEach(ttm => {
          try {
            ttmMap.set(ttm.type_id, {
              tool_ids: JSON.parse(ttm.tool_ids || '[]'),
              tool_problem_counts: JSON.parse(ttm.tool_problem_counts || '{}'),
            });
          } catch {}
        });
        setTypeToolMap(ttmMap);
        setTypes(allTypes);
        setTools(toolsWithMastery);
        setProblems(allP);
        setDomains(allD);

      } else if (mode === 'wrong') {
        const [attempts, allD, allP] = await Promise.all([
          user ? base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 100) : Promise.resolve([]),
          base44.entities.Domain.list('grade_range', 100),
          base44.entities.Problem.list('domain_id', 5000),
        ]);
        const wrong = attempts.filter(a => (a.score || 0) < 60 || a.correctness === 'wrong');
        setWrongAttempts(wrong);
        setDomains(allD);
        setProblems(allP);

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

  const handleTypeSelect = (type, domainProblemIds) => {
    const typePIds = problemTypes
      .filter(pt => pt.type_id === type.type_id && domainProblemIds.has(pt.problem_id))
      .map(pt => pt.problem_id);
    const matchedProblems = problems.filter(p => typePIds.includes(p.problem_id));
    if (matchedProblems.length === 0) {
      const pool = problems.filter(p => domainProblemIds.has(p.problem_id));
      if (pool.length > 0) navigate(`/problem/${pool[Math.floor(Math.random() * pool.length)].id}`);
      return;
    }
    navigate(`/problem/${matchedProblems[Math.floor(Math.random() * matchedProblems.length)].id}`);
  };

  const handleToolSelect = async (tool) => {
    setLoading(true);
    try {
      const filtered = problems.filter(p => {
        try { return JSON.parse(p.tool_ids || '[]').includes(tool.tool_id); } catch { return false; }
      });
      const pool = filtered.length > 0 ? filtered : problems;
      if (pool.length > 0) navigate(`/problem/${pool[Math.floor(Math.random() * pool.length)].id}`);
    } finally {
      setLoading(false);
    }
  };

  const modeConfig = {
    recommended: { icon: Sparkles, title: '추천 문제', color: 'text-primary' },
    random: { icon: Shuffle, title: '랜덤 문제', color: 'text-blue-500' },
    domain: { icon: BookOpen, title: '단원별 문제', color: 'text-purple-500' },
    tool: { icon: Wrench, title: '도구별 문제', color: 'text-amber-500' },
    wrong: { icon: AlertCircle, title: '틀렸던 문제', color: 'text-red-500' },
  };
  const cfg = modeConfig[mode] || modeConfig.random;

  const gradeOptions = extractGradeOptions(domains);

  // filtered tools
  const filteredTools = tools.filter(tool => {
    if (toolFilterGrade) {
      try {
        const dids = JSON.parse(tool.domain_ids || '[]');
        const matchesGrade = dids.some(did => {
          const dom = domains.find(d => d.domain_id === did);
          return dom?.grade_range === toolFilterGrade;
        });
        if (!matchesGrade) return false;
      } catch { return false; }
    }
    if (toolFilterDomain) {
      try {
        const dids = JSON.parse(tool.domain_ids || '[]');
        if (!dids.includes(toolFilterDomain)) return false;
      } catch { return false; }
    }
    if (toolFilterType) {
      const ttm = typeToolMap.get(toolFilterType);
      if (!ttm || !ttm.tool_ids.includes(tool.tool_id)) return false;
    }
    return true;
  });

  const domainsForGrade = (grade) => domains.filter(d => !grade || d.grade_range === grade);

  // filtered + sorted wrong attempts
  const problemMap = new Map(problems.map(p => [p.id, p]));
  const filteredWrong = wrongAttempts.filter(a => {
    const prob = problemMap.get(a.problem_id);
    if (wrongFilterGrade || wrongFilterDomain) {
      if (!prob) return false;
      const dom = domains.find(d => d.domain_id === prob.domain_id);
      if (wrongFilterGrade && dom?.grade_range !== wrongFilterGrade) return false;
      if (wrongFilterDomain && prob.domain_id !== wrongFilterDomain) return false;
    }
    return true;
  }).sort((a, b) => {
    if (wrongSort === 'recent') return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    if (wrongSort === 'oldest') return new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0);
    if (wrongSort === 'score_asc') return (a.score || 0) - (b.score || 0);
    if (wrongSort === 'score_desc') return (b.score || 0) - (a.score || 0);
    return 0;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/problems')} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
            {cfg.title}
          </h1>
        </div>

        {loading ? (
          <InlineLoader message="불러오는 중..." />
        ) : (
          <>
            {/* ── 추천 ── */}
            {mode === 'recommended' && (
              <div className="space-y-3">
                {recommendedItems.length === 0 ? (
                  <Card className="p-4 bg-muted/40">
                    <p className="text-sm font-semibold mb-1">아직 추천이 준비되지 않았어요</p>
                    <p className="text-xs text-muted-foreground">
                      5문제 이상 풀면 약점 도구를 분석해 맞춤 추천을 시작해요. 먼저 다양한 도구를 경험해 봐요.
                    </p>
                    <Button size="sm" variant="outline" className="mt-3"
                            onClick={() => navigate('/problems?mode=tool')}>
                      도구별로 시작하기
                    </Button>
                  </Card>
                ) : (
                  <>
                    {recommendedItems.map((rec, idx) => {
                      const r = rec.reason;
                      return (
                        <Card key={idx}
                              className="p-4 card-hover cursor-pointer border-l-4 bg-red-50 border-l-red-400"
                              onClick={() => navigate(`/problem/${rec.problem.id}?from=recommend&reason=${r.type}`)}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                {r.strength && (
                                  <span className="text-xs text-muted-foreground">
                                    {'★'.repeat(r.strength)}{'☆'.repeat(5 - r.strength)}
                                  </span>
                                )}
                              </div>
                              {r.detail && <p className="text-xs text-foreground mb-1 font-medium">{r.detail}</p>}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {(() => {
                                  try {
                                    const blocks = JSON.parse(rec.problem.content || '[]');
                                    return blocks.map(b => b.text || '').join(' ').slice(0, 80);
                                  } catch { return ''; }
                                })()}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </Card>
                      );
                    })}
                    {recommendedItems.length < 3 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        더 많은 문제를 풀수록 추천이 정교해져요
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── 단원별 (영역 → 단원 drill-down) ── */}
            {mode === 'domain' && (
              <div>
                {selectedDomain === null ? (
                  <>
                    <p className="text-muted-foreground mb-4 text-sm">어떤 영역으로 연습할까요?</p>
                    {domains.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">영역 정보가 없어요.</p>
                    ) : (
                      <div className="space-y-2">
                        {[...domains].sort((a, b) => parseInt(a.grade_range || 0) - parseInt(b.grade_range || 0)).map(domain => (
                          <Card key={domain.id} className="p-4 card-hover cursor-pointer"
                                onClick={() => setSelectedDomain(domain)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-semibold text-foreground">{domain.name}</p>
                                {domain.grade_range && (
                                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                                    {gradeLabelShort(domain.grade_range)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {domain.problem_count > 0 && (
                                  <span className="text-xs text-muted-foreground">{domain.problem_count}문제</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                ) : (() => {
                  const domainProblems = problems.filter(p => p.domain_id === selectedDomain.domain_id);
                  const domainProblemIds = new Set(domainProblems.map(p => p.problem_id));
                  const typeIdsInDomain = new Set(
                    problemTypes.filter(pt => domainProblemIds.has(pt.problem_id)).map(pt => pt.type_id)
                  );
                  const typesInDomain = types
                    .filter(t => typeIdsInDomain.has(t.type_id))
                    .map(t => {
                      const typePIds = new Set(
                        problemTypes.filter(pt => pt.type_id === t.type_id && domainProblemIds.has(pt.problem_id))
                                    .map(pt => pt.problem_id)
                      );
                      return { ...t, problem_count: typePIds.size };
                    });
                  return (
                    <>
                      <button
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
                        onClick={() => setSelectedDomain(null)}
                      >
                        <ArrowLeft className="w-4 h-4" /> {selectedDomain.name}
                      </button>
                      <p className="text-muted-foreground mb-4 text-sm">어떤 단원으로 연습할까요?</p>
                      {typesInDomain.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">해당 영역의 단원 정보가 없어요.</p>
                      ) : (
                        <div className="space-y-2">
                          {typesInDomain.map(t => (
                            <Card key={t.id} className="p-4 card-hover cursor-pointer"
                                  onClick={() => handleTypeSelect(t, domainProblemIds)}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-foreground">{t.name}</p>
                                  {t.problem_count > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{t.problem_count}문제</p>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── 도구별 ── */}
            {mode === 'tool' && (
              <div>
                {/* 필터 */}
                <div className="flex gap-2 mb-3 flex-wrap">
                 <select
                   value={toolFilterGrade}
                   onChange={e => { setToolFilterGrade(e.target.value); setToolFilterDomain(''); setToolFilterType(null); }}
                   className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                 >
                   <option value="">전체 학년</option>
                   {gradeOptions.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                 </select>
                 <select
                   value={toolFilterDomain}
                   onChange={e => { setToolFilterDomain(e.target.value); setToolFilterType(null); }}
                   disabled={!toolFilterGrade}
                   className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                 >
                   <option value="">전체 영역</option>
                   {domainsForGrade(toolFilterGrade).map(d => <option key={d.id} value={d.domain_id}>{d.name}</option>)}
                 </select>
                </div>

                {/* 단원(Type) chip */}
                {toolFilterDomain && (() => {
                 const domainProblems = problems.filter(p => p.domain_id === toolFilterDomain);
                 const domainProblemIds = new Set(domainProblems.map(p => p.problem_id));
                 const typeIdsInDomain = new Set(
                   problemTypes.filter(pt => domainProblemIds.has(pt.problem_id)).map(pt => pt.type_id)
                 );
                 const typesInDomain = types.filter(t => typeIdsInDomain.has(t.type_id));
                 return typesInDomain.length > 0 && (
                   <div className="flex gap-2 flex-wrap mb-4">
                     <button
                       onClick={() => setToolFilterType(null)}
                       className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                         !toolFilterType ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'
                       }`}
                     >전체</button>
                     {typesInDomain.map(t => (
                       <button
                         key={t.type_id}
                         onClick={() => setToolFilterType(toolFilterType === t.type_id ? null : t.type_id)}
                         className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                           toolFilterType === t.type_id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'
                         }`}
                       >{t.name}</button>
                     ))}
                   </div>
                 );
                })()}

                {filteredTools.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">도구 정보가 없어요.</p>
                ) : (
                  <>
                    {/* 미경험 섹션 */}
                    {filteredTools.some(t => t.isNew) && (
                      <div className="mb-4">
                        <button
                          onClick={() => setExpandedToolSections(p => ({ ...p, new: !p.new }))}
                          className="flex items-center justify-between w-full mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                        >
                          <span>미경험 도구 ({filteredTools.filter(t => t.isNew).length})</span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedToolSections.new ? 'rotate-90' : ''}`} />
                        </button>
                        {expandedToolSections.new && (
                          <div className="space-y-2">
                            {filteredTools.filter(t => t.isNew).map(tool => (
                              <ToolCard key={tool.id} tool={tool} onClick={() => handleToolSelect(tool)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* 숙련도별 */}
                    {filteredTools.some(t => !t.isNew) && (
                      <div>
                        <button
                          onClick={() => setExpandedToolSections(p => ({ ...p, practiced: !p.practiced }))}
                          className="flex items-center justify-between w-full mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                        >
                          <span>숙련도 낮은 순 ({filteredTools.filter(t => !t.isNew).length})</span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedToolSections.practiced ? 'rotate-90' : ''}`} />
                        </button>
                        {expandedToolSections.practiced && (
                          <div className="space-y-2">
                            {filteredTools.filter(t => !t.isNew).map(tool => (
                              <ToolCard key={tool.id} tool={tool} onClick={() => handleToolSelect(tool)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── 틀렸던 문제 ── */}
            {mode === 'wrong' && (
              <div>
                {/* 필터 + 정렬 */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <select
                    value={wrongFilterGrade}
                    onChange={e => { setWrongFilterGrade(e.target.value); setWrongFilterDomain(''); }}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">전체 학년</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                  </select>
                  <select
                    value={wrongFilterDomain}
                    onChange={e => setWrongFilterDomain(e.target.value)}
                    disabled={!wrongFilterGrade}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                  >
                    <option value="">전체 단원</option>
                    {domainsForGrade(wrongFilterGrade).map(d => <option key={d.id} value={d.domain_id}>{d.name}</option>)}
                  </select>
                  <select
                    value={wrongSort}
                    onChange={e => setWrongSort(e.target.value)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="recent">최근순</option>
                    <option value="oldest">오래된 순</option>
                    <option value="score_asc">점수 낮은 순</option>
                    <option value="score_desc">점수 높은 순</option>
                  </select>
                </div>

                {filteredWrong.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">🎉</span>
                    </div>
                    <p className="font-semibold text-lg text-foreground">아직 틀린 문제가 없어요!</p>
                    <p className="text-muted-foreground mt-2">다른 모드로 연습해 볼까요?</p>
                    <Button className="mt-4" onClick={() => navigate('/problems?mode=domain')}>
                      단원별로 풀기
                    </Button>
                  </div>
                ) : (() => {
                  const now2 = new Date();
                  const today2 = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
                  const yesterday2 = new Date(today2.getTime() - 24 * 60 * 60 * 1000);
                  const weekAgo2 = new Date(today2.getTime() - 7 * 24 * 60 * 60 * 1000);
                  const monthAgo2 = new Date(today2.getTime() - 30 * 24 * 60 * 60 * 1000);
                  const wrongGrouped = { today: [], yesterday: [], thisWeek: [], thisMonth: [], older: [] };
                  filteredWrong.forEach(a => {
                    const d = new Date(a.submitted_at);
                    if (d >= today2) wrongGrouped.today.push(a);
                    else if (d >= yesterday2) wrongGrouped.yesterday.push(a);
                    else if (d >= weekAgo2) wrongGrouped.thisWeek.push(a);
                    else if (d >= monthAgo2) wrongGrouped.thisMonth.push(a);
                    else wrongGrouped.older.push(a);
                  });
                  const dateLabels = { today: '오늘', yesterday: '어제', thisWeek: '이번 주', thisMonth: '이번 달', older: '그 이전' };
                  return (
                    <div className="space-y-4">
                      {Object.entries(wrongGrouped).map(([groupKey, items]) => {
                        if (items.length === 0) return null;
                        const isExpanded = expandedWrongDates[groupKey];
                        return (
                          <div key={groupKey}>
                            <button
                              onClick={() => setExpandedWrongDates(p => ({ ...p, [groupKey]: !p[groupKey] }))}
                              className="flex items-center justify-between w-full mb-2 text-sm font-semibold text-foreground"
                            >
                              <span>{dateLabels[groupKey]} ({items.length})</span>
                              <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="space-y-2">
                                {items.map(attempt => (
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
                                          {attempt.problem_domain && <span className="mr-2">{attempt.problem_domain}</span>}
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
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ── ToolCard sub-component ──
function ToolCard({ tool, onClick }) {
  const isNew = tool.isNew;
  const avg = tool.avg;
  const colorClass = getMasteryColor(avg, isNew);

  return (
    <Card className="p-4 card-hover cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{tool.name}</p>
          {tool.goal && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tool.goal}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${colorClass}`}>
            {isNew ? '미경험' : `평균 ${avg}점`}
          </span>
          {tool.problem_count > 0 && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {tool.problem_count}문제
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}