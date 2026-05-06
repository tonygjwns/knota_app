import React, { useState, useEffect, useCallback } from 'react';
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
import { Filter, Search, ChevronRight, BookOpen } from 'lucide-react';

const PAGE_SIZE = 20;

export default function History() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({ sort: 'recent', correctness: 'all', search: '' });

  useEffect(() => {
    loadAttempts(0, true);
  }, [filters.sort, filters.correctness]);

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

      if (reset) {
        setAttempts(data);
      } else {
        setAttempts(prev => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) loadAttempts(page + 1, false);
  };

  const filtered = filters.search
    ? attempts.filter(a => {
        const q = filters.search.toLowerCase();
        return (a.problem_content || '').toLowerCase().includes(q) ||
               (a.problem_domain || '').toLowerCase().includes(q);
      })
    : attempts;

  const parseProblemText = (content) => {
    try {
      const arr = typeof content === 'string' ? JSON.parse(content) : content;
      if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
      return String(content);
    } catch {
      return String(content || '');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">내 풀이 기록</h1>
          <p className="text-muted-foreground text-sm mt-1">지금까지 푼 문제들을 볼 수 있어요</p>
        </div>

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
          <div className="flex gap-2">
            <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">최근 순</SelectItem>
                <SelectItem value="score">점수 순</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.correctness} onValueChange={v => setFilters(f => ({ ...f, correctness: v }))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="correct">정답</SelectItem>
                <SelectItem value="partial">부분 정답</SelectItem>
                <SelectItem value="wrong">오답</SelectItem>
              </SelectContent>
            </Select>
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
            <Button className="mt-4" onClick={() => navigate('/')}>
              문제 풀러 가기
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(attempt => {
              const color = getScoreColor(attempt.score || 0);
              const colorMap = {
                correct: 'border-l-emerald-400',
                partial: 'border-l-amber-400',
                wrong: 'border-l-red-400'
              };
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
                        {attempt.problem_domain && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {attempt.problem_domain}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {attempt.submitted_at
                            ? new Date(attempt.submitted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                            : ''}
                        </span>
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

            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={loadMore}
                disabled={loading}>
                {loading ? '불러오는 중...' : '더 보기'}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}