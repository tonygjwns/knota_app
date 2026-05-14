import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import ScoreBadge, { getScoreColor } from '@/components/ScoreBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Search, ChevronRight, BookOpen, TrendingDown, TrendingUp, ClipboardList } from 'lucide-react';
import { aggregateToolMastery, topWeakTools, topStrongTools } from '@/lib/toolMastery';

const PAGE_SIZE = 20;

function ToolMasteryCard({ tool, variant }) {
  const isWeak = variant === 'weak';
  const barColor = isWeak ? 'bg-red-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${tool.avg_score}%` }} />
          </div>
          <span className={`text-xs font-semibold flex-shrink-0 ${isWeak ? 'text-red-500' : 'text-emerald-600'}`}>
            {tool.avg_score}점
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0">{tool.attempts}회</span>
    </div>
  );
}

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
    if (user.role === 'teacher') { navigate('/teacher', { replace: true }); }
  }, [user?.role]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({ 
    sort: 'recent', 
    correctness: 'all', 
    search: '',
    tab: 'all', // all | homework | practice
    scoreRange: [0, 100],
    domain: 'all'
  });
  const [stats, setStats] = useState(null);
  const [weakTools, setWeakTools] = useState([]);
  const [strongTools, setStrongTools] = useState([]);
  const [masteryLoading, setMasteryLoading] = useState(true);
  const [domains, setDomains] = useState([]);
  const [expandedDates, setExpandedDates] = useState({ today: true, yesterday: true });

  // Load overall stats + mastery once on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      setMasteryLoading(true);
      try {
        const [allAttempts, allProblems, allTools, allDomains] = await Promise.all([
          base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 1000, 0),
          base44.entities.Problem.list('-created_date', 1000, 0),
          base44.entities.MathTool.list('name', 100),
          base44.entities.Domain.list('name', 50),
        ]);

        if (allAttempts.length === 0) {
          setStats({ total: 0, correct: 0, avg: 0 });
          setMasteryLoading(false);
          return;
        }

        const total = allAttempts.length;
        const correct = allAttempts.filter(a => a.correctness === 'correct').length;
        const avg = Math.round(allAttempts.reduce((s, a) => s + (a.score || 0), 0) / total);
        setStats({ total, correct, avg, capped: total >= 1000 });

        // Build maps
        const problemMap = new Map(allProblems.map(p => [p.id, p]));
        const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));
        setDomains(allDomains);

        const masteryMap = aggregateToolMastery(allAttempts, problemMap);
        setWeakTools(topWeakTools(masteryMap, toolNameMap, 5, 3));
        setStrongTools(topStrongTools(masteryMap, toolNameMap, 5, 70, 3));
      } finally {
        setMasteryLoading(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    loadAttempts(0, true);
  }, [filters.sort, filters.correctness, filters.tab, filters.scoreRange, filters.domain]);

  const loadAttempts = async (pageNum = 0, reset = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const query = { student_id: user.id };
      if (filters.correctness !== 'all') query.correctness = filters.correctness;
      const sortField = filters.sort === 'score' ? '-score' : '-submitted_at';
      const data = await base44.entities.StudentAttempt.filter(
        query, sortField, PAGE_SIZE, pageNum * PAGE_SIZE
      );
      if (reset) setAttempts(data);
      else setAttempts(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) loadAttempts(page + 1, false);
  };

  // Tab + score + domain filter
  const filtered = attempts.filter(a => {
    if (filters.tab === 'homework' && !a.assignment_id) return false;
    if (filters.tab === 'practice' && a.assignment_id) return false;
    if ((a.score || 0) < filters.scoreRange[0] || (a.score || 0) > filters.scoreRange[1]) return false;
    if (filters.domain !== 'all' && a.problem_domain !== filters.domain) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (a.problem_content || '').toLowerCase().includes(q) ||
             (a.problem_domain || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Date grouping
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const grouped = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: []
  };

  filtered.forEach(a => {
    const d = new Date(a.submitted_at);
    if (d >= today) grouped.today.push(a);
    else if (d >= yesterday) grouped.yesterday.push(a);
    else if (d >= weekAgo) grouped.thisWeek.push(a);
    else if (d >= monthAgo) grouped.thisMonth.push(a);
    else grouped.older.push(a);
  });

  const toggleDateGroup = (group) => {
    setExpandedDates(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const parseProblemText = (content) => {
    try {
      const arr = typeof content === 'string' ? JSON.parse(content) : content;
      if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
      return String(content);
    } catch { return String(content || ''); }
  };

  const fmt = (n, capped) => capped && n >= 1000 ? '1000+' : String(n);
  const showMastery = !masteryLoading && (weakTools.length > 0 || strongTools.length > 0);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">내 풀이 기록</h1>
          <p className="text-muted-foreground text-sm mt-1">지금까지 푼 문제들을 볼 수 있어요</p>
        </div>

        {/* Stats cards */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '총 풀이', value: fmt(stats.total, stats.capped) + '개' },
              { label: '정답', value: fmt(stats.correct, stats.capped) + '개' },
              { label: '평균 점수', value: stats.avg + '점' },
            ].map(s => (
              <Card key={s.label} className="p-3 text-center">
                <p className="text-xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Tool mastery */}
        {masteryLoading && stats === null && (
          <InlineLoader message="성취도 분석 중..." />
        )}
        {showMastery && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weakTools.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-foreground">약점 도구 Top {weakTools.length}</h3>
                </div>
                <div className="divide-y divide-border">
                  {weakTools.map(tool => (
                    <ToolMasteryCard key={tool.tool_id} tool={tool} variant="weak" />
                  ))}
                </div>
              </Card>
            )}
            {strongTools.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground">강점 도구 Top {strongTools.length}</h3>
                </div>
                <div className="divide-y divide-border">
                  {strongTools.map(tool => (
                    <ToolMasteryCard key={tool.tool_id} tool={tool} variant="strong" />
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={filters.tab} onValueChange={v => setFilters(f => ({ ...f, tab: v }))}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="all">모든 풀이</TabsTrigger>
            <TabsTrigger value="homework">숙제 풀이</TabsTrigger>
            <TabsTrigger value="practice">자유 풀이</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="문제 검색..."
              className="pl-10"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
              <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">최근 순</SelectItem>
                <SelectItem value="score">점수 순</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.correctness} onValueChange={v => setFilters(f => ({ ...f, correctness: v }))}>
              <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="correct">정답</SelectItem>
                <SelectItem value="partial">부분 정답</SelectItem>
                <SelectItem value="wrong">오답</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.domain} onValueChange={v => setFilters(f => ({ ...f, domain: v }))}>
              <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="도메인" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 도메인</SelectItem>
                {domains.map(d => (
                  <SelectItem key={d.domain_id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>점수 범위</span>
              <span>{filters.scoreRange[0]} - {filters.scoreRange[1]}</span>
            </div>
            <div className="px-2">
              <Slider
                value={filters.scoreRange}
                onValueChange={(val) => setFilters(f => ({ ...f, scoreRange: val }))}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* List */}
        {loading && attempts.length === 0 ? (
          <InlineLoader message="기록 불러오는 중..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg text-foreground">아직 푼 문제가 없어요</p>
            <p className="text-muted-foreground mt-2">첫 문제를 풀어볼까요?</p>
            <Button className="mt-4" onClick={() => navigate('/problems')}>문제 풀러 가기</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([groupKey, items]) => {
              if (items.length === 0) return null;
              const isExpanded = expandedDates[groupKey];
              const labels = {
                today: '오늘',
                yesterday: '어제',
                thisWeek: '이번 주',
                thisMonth: '이번 달',
                older: '그 이전'
              };
              return (
                <div key={groupKey}>
                  <button
                    onClick={() => toggleDateGroup(groupKey)}
                    className="flex items-center justify-between w-full mb-2 text-sm font-semibold text-foreground"
                  >
                    <span>{labels[groupKey]} ({items.length})</span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="space-y-2">
                      {items.map(attempt => {
                        const color = getScoreColor(attempt.score || 0);
                        const colorMap = { correct: 'border-l-emerald-400', partial: 'border-l-amber-400', wrong: 'border-l-red-400' };
                        const text = parseProblemText(attempt.problem_content || '');
                        return (
                          <Link key={attempt.id} to={`/result/${attempt.id}`}>
                            <Card className={`p-4 card-hover border-l-4 ${colorMap[color]} flex items-center gap-3`}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-2">
                                  {text.slice(0, 80) || `문제 #${attempt.problem_id}`}
                                  {text.length > 80 ? '...' : ''}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {attempt.assignment_id && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <ClipboardList className="w-3 h-3" />
                                      숙제
                                    </span>
                                  )}
                                  {attempt.problem_domain && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                      {attempt.problem_domain}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                   {attempt.submitted_at
                                     ? new Date(attempt.submitted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                     : ''}
                                  </span>
                                  {attempt.tool_mapping_status === 'pending' && (
                                   <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                                     ⟳ 분석 중
                                   </span>
                                  )}
                                  {attempt.tool_mapping_status === 'failed' && (
                                   <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                                     ✗ 분석 실패
                                   </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <ScoreBadge score={attempt.score || 0} size="sm" />
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
                {loading ? '불러오는 중...' : '더 보기'}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}