import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AdminProblems() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [problems, setProblems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  // 최초 도메인 목록만 로드
  useEffect(() => {
    base44.entities.Domain.list('name', 100)
      .then(d => setDomains(d))
      .finally(() => setDomainsLoading(false));
  }, []);

  // 단원 선택 시 문제 로딩
  const handleDomainSelect = async (domainId) => {
    setSelectedDomain(domainId);
    setPage(0);
    setSearch('');
    setExpanded(null);
    setLoading(true);
    try {
      const all = await base44.entities.Problem.filter({ domain_id: domainId }, '-created_date', 1000, 0);
      setTotalCount(all.length);
      setProblems(all.slice(0, PAGE_SIZE));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (newPage) => {
    setPageLoading(true);
    setExpanded(null);
    try {
      const data = await base44.entities.Problem.filter(
        { domain_id: selectedDomain }, '-created_date', PAGE_SIZE, newPage * PAGE_SIZE
      );
      setProblems(data);
      setPage(newPage);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setPageLoading(false);
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

  const filtered = search
    ? problems.filter(p => {
        const q = search.toLowerCase();
        return parseProblemText(p.content).toLowerCase().includes(q) ||
               (p.domain_name || '').toLowerCase().includes(q);
      })
    : problems;

  if (domainsLoading) return <InlineLoader message="단원 목록 불러오는 중..." />;

  return (
    <div className="space-y-5" ref={topRef}>
      <div>
        <h1 className="text-2xl font-bold">문제 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">단원을 선택하면 문제를 불러옵니다</p>
      </div>

      {/* 단원 선택 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {domains.map(d => (
          <button
            key={d.id}
            onClick={() => handleDomainSelect(d.domain_id)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              selectedDomain === d.domain_id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card hover:bg-muted border-border'
            }`}
          >
            <p className="text-sm font-medium">{d.name}</p>
            {d.problem_count != null && (
              <p className={`text-xs mt-0.5 ${selectedDomain === d.domain_id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {d.problem_count.toLocaleString()}문제
              </p>
            )}
          </button>
        ))}
      </div>

      {/* 문제 목록 */}
      {!selectedDomain && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <BookOpen className="w-10 h-10 opacity-30" />
          <p className="text-sm">단원을 선택해 주세요</p>
        </div>
      )}

      {selectedDomain && loading && <InlineLoader message="문제 불러오는 중..." />}

      {selectedDomain && !loading && (
        <>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="현재 페이지에서 검색..." className="pl-10" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{totalCount.toLocaleString()}문제</span>
          </div>

          <div className="space-y-2" style={{ opacity: pageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            {filtered.map(p => {
              const text = parseProblemText(p.content);
              const isExpanded = expanded === p.id;
              return (
                <Card key={p.id} className="overflow-hidden">
                  <button className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : p.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">#{p.problem_id || p.id?.slice(0, 8)}</p>
                      <p className="text-sm text-foreground line-clamp-2">{text.slice(0, 120)}</p>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> :
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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
                      <Button size="sm" variant="outline" className="mt-3 w-full gap-1"
                        onClick={() => navigate(`/admin/problems/${p.id}`)}>
                        이 문제 학생 풀이 보기 →
                      </Button>
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
            <PaginationBar page={page} totalCount={totalCount} pageSize={PAGE_SIZE}
              onPage={handlePageChange} loading={pageLoading} />
          )}
        </>
      )}
    </div>
  );
}