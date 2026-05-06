import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AdminProblems() {
  const [problems, setProblems] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const topRef = useRef(null);

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    setLoading(true);
    try {
      // Fetch first page + total count (via max-limit fetch for IDs) + supporting data in parallel
      const [firstPage, allIds, a, d] = await Promise.all([
        base44.entities.Problem.list('-created_date', PAGE_SIZE, 0),
        base44.entities.Problem.list('-created_date', 1000, 0), // for total count
        base44.entities.StudentAttempt.list('-submitted_at', 500),
        base44.entities.Domain.list('name', 30),
      ]);
      setProblems(firstPage);
      setTotalCount(allIds.length);
      setAttempts(a);
      setDomains(d);
      setPage(0);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (newPage, domainId) => {
    setPageLoading(true);
    setExpanded(null);
    try {
      const filter = domainId && domainId !== 'all' ? { domain_id: domainId } : null;
      const data = filter
        ? await base44.entities.Problem.filter(filter, '-created_date', PAGE_SIZE, newPage * PAGE_SIZE)
        : await base44.entities.Problem.list('-created_date', PAGE_SIZE, newPage * PAGE_SIZE);
      setProblems(data);
      setPage(newPage);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setPageLoading(false);
    }
  };

  const handleDomainFilter = async (val) => {
    setDomainFilter(val);
    setPage(0);
    setPageLoading(true);
    setExpanded(null);
    try {
      if (val === 'all') {
        // Reuse cached total from initial load — refetch page 0
        const data = await base44.entities.Problem.list('-created_date', PAGE_SIZE, 0);
        setProblems(data);
        // Restore total from full fetch
        const allIds = await base44.entities.Problem.list('-created_date', 1000, 0);
        setTotalCount(allIds.length);
      } else {
        // Count by fetching all IDs for this domain
        const all = await base44.entities.Problem.filter({ domain_id: val }, '-created_date', 1000, 0);
        setTotalCount(all.length);
        setProblems(all.slice(0, PAGE_SIZE));
      }
    } finally {
      setPageLoading(false);
    }
  };

  const getProblemStats = (problemId) => {
    const pa = attempts.filter(a => a.problem_id === problemId);
    if (pa.length === 0) return { count: 0, avg: 0 };
    const avg = Math.round(pa.reduce((s, a) => s + (a.score || 0), 0) / pa.length);
    return { count: pa.length, avg };
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

  // Search is client-side within current page
  const filtered = search
    ? problems.filter(p => {
        const q = search.toLowerCase();
        const text = parseProblemText(p.content).toLowerCase();
        return text.includes(q) || (p.domain_name || '').toLowerCase().includes(q);
      })
    : problems;

  if (loading) return <InlineLoader message="문제 목록 불러오는 중..." />;

  return (
    <div className="space-y-5" ref={topRef}>
      <div>
        <h1 className="text-2xl font-bold">문제 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">총 {totalCount.toLocaleString()}개의 문제</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="현재 페이지에서 검색..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={domainFilter} onValueChange={handleDomainFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 단원</SelectItem>
            {domains.map(d => <SelectItem key={d.id} value={d.domain_id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {search && (
        <p className="text-xs text-muted-foreground -mt-3">
          현재 페이지({problems.length}개)에서만 검색됩니다. 전체 검색은 페이지를 이동하세요.
        </p>
      )}

      <div className="space-y-2" style={{ opacity: pageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {filtered.map(p => {
          const stats = getProblemStats(p.id);
          const text = parseProblemText(p.content);
          const isExpanded = expanded === p.id;
          return (
            <Card key={p.id} className="overflow-hidden">
              <button
                className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : p.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.domain_name && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {p.domain_name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">#{p.problem_id || p.id?.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{text.slice(0, 100)}...</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{stats.count}회</p>
                  {stats.avg > 0 && (
                    <p className={`text-xs font-medium ${
                      stats.avg >= 70 ? 'text-emerald-500' : stats.avg >= 40 ? 'text-amber-500' : 'text-red-500'
                    }`}>{stats.avg}점</p>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 mt-1 ml-auto text-muted-foreground" /> :
                               <ChevronDown className="w-4 h-4 mt-1 ml-auto text-muted-foreground" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">
                  <div className="mt-3 bg-blue-50/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">문제 내용</p>
                    <MathRenderer content={text} className="text-sm" />
                  </div>
                  {p.verified_answer && (
                    <div className="mt-3 bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-600 mb-1">검증된 정답</p>
                      <MathRenderer content={p.verified_answer} className="text-sm" />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">검색 결과가 없어요</div>
        )}
      </div>

      {!search && (
        <PaginationBar
          page={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPage={(p) => loadPage(p, domainFilter)}
          loading={pageLoading}
        />
      )}
    </div>
  );
}