import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, User, Clock, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

const STATUS_CONFIG = {
  pending:  { label: '승인 대기', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: '승인됨',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: '거절됨',   color: 'bg-red-100 text-red-700 border-red-200' },
  admin:    { label: '관리자',   color: 'bg-slate-200 text-slate-600 border-slate-300' },
};

const FILTERS = ['전체', '승인 대기', '승인됨', '거절됨'];
const FILTER_STATUS = { '승인 대기': 'pending', '승인됨': 'approved', '거절됨': 'rejected' };

const PAGE_SIZE = 50;

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('전체');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const topRef = useRef(null);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [firstPage, allUsers, a] = await Promise.all([
        base44.entities.User.list('-created_date', PAGE_SIZE, 0),
        base44.entities.User.list('-created_date', 1000, 0), // for total + pending count
        base44.entities.StudentAttempt.list('-submitted_at', 500),
      ]);
      setUsers(firstPage);
      setTotalCount(allUsers.length);
      setPendingCount(allUsers.filter(u => u.approval_status === 'pending').length);
      setAttempts(a);
      setPage(0);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (newPage, currentFilter) => {
    setPageLoading(true);
    try {
      const statusKey = FILTER_STATUS[currentFilter];
      const data = statusKey
        ? await base44.entities.User.filter({ approval_status: statusKey }, '-created_date', PAGE_SIZE, newPage * PAGE_SIZE)
        : await base44.entities.User.list('-created_date', PAGE_SIZE, newPage * PAGE_SIZE);
      setUsers(data);
      setPage(newPage);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setPageLoading(false);
    }
  };

  const handleFilterChange = async (newFilter) => {
    setFilter(newFilter);
    setPage(0);
    setPageLoading(true);
    try {
      const statusKey = FILTER_STATUS[newFilter];
      if (statusKey) {
        const all = await base44.entities.User.filter({ approval_status: statusKey }, '-created_date', 1000, 0);
        setTotalCount(all.length);
        setUsers(all.slice(0, PAGE_SIZE));
      } else {
        // 전체
        const [firstPage, allUsers] = await Promise.all([
          base44.entities.User.list('-created_date', PAGE_SIZE, 0),
          base44.entities.User.list('-created_date', 1000, 0),
        ]);
        setUsers(firstPage);
        setTotalCount(allUsers.length);
        setPendingCount(allUsers.filter(u => u.approval_status === 'pending').length);
      }
    } finally {
      setPageLoading(false);
    }
  };

  const getUserStats = (userId) => {
    const ua = attempts.filter(a => a.student_id === userId);
    if (!ua.length) return { count: 0, avg: 0 };
    const avg = Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length);
    return { count: ua.length, avg };
  };

  const handleApprove = async (u) => {
    if (!confirm(`"${u.full_name || u.email}"을(를) 승인하시겠어요?`)) return;
    await base44.entities.User.update(u.id, {
      approval_status: 'approved',
      approved_by: me?.id,
      approved_at: new Date().toISOString(),
      rejected_reason: '',
    });
    loadInitial();
  };

  const handleReject = async (u) => {
    const reason = prompt(`거절 사유를 입력하세요 (${u.full_name || u.email})`);
    if (reason === null) return;
    await base44.entities.User.update(u.id, {
      approval_status: 'rejected',
      approved_by: me?.id,
      approved_at: new Date().toISOString(),
      rejected_reason: reason,
    });
    loadInitial();
  };

  // Search is client-side within current page
  const sorted = [...users].sort((a, b) => {
    const ap = a.approval_status === 'pending' ? 0 : 1;
    const bp = b.approval_status === 'pending' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const filtered = search
    ? sorted.filter(u => {
        const q = search.toLowerCase();
        return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      })
    : sorted;

  if (loading) return <InlineLoader message="사용자 목록 불러오는 중..." />;

  return (
    <div className="space-y-5" ref={topRef}>
      <div>
        <h1 className="text-2xl font-bold">사용자 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">총 {totalCount.toLocaleString()}명의 사용자</p>
      </div>

      {pendingCount > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-700">
            승인 대기 중 <span className="font-bold">{pendingCount}명</span> — 검토가 필요해요
          </p>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="현재 페이지에서 검색..."
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {search && (
        <p className="text-xs text-muted-foreground -mt-3">현재 페이지({users.length}명)에서만 검색됩니다.</p>
      )}

      <div className="space-y-2" style={{ opacity: pageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {filtered.map(u => {
          const stats = getUserStats(u.id);
          const isAdmin = u.role === 'admin';
          const status = isAdmin ? 'admin' : (u.approval_status || 'pending');
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

          return (
            <Card key={u.id} className="p-4 gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {isAdmin
                      ? <ShieldCheck className="w-5 h-5 text-primary" />
                      : <User className="w-5 h-5 text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{u.full_name || '(이름 없음)'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.approval_status === 'rejected' && u.rejected_reason && (
                      <p className="text-xs text-red-500 mt-0.5">사유: {u.rejected_reason}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{stats.count}회</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.avg > 0 ? `평균 ${stats.avg}점` : '시도 없음'}
                  </p>
                </div>
              </div>

              {!isAdmin && u.id !== me?.id && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                  {u.approval_status !== 'approved' && (
                    <Button size="sm" className="gap-1 flex-1" onClick={() => handleApprove(u)}>
                      <CheckCircle className="w-3.5 h-3.5" /> 승인
                    </Button>
                  )}
                  {u.approval_status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="gap-1 flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(u)}>
                      <XCircle className="w-3.5 h-3.5" /> 거절
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">해당하는 사용자가 없어요</div>
        )}
      </div>

      {!search && (
        <PaginationBar
          page={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPage={(p) => loadPage(p, filter)}
          loading={pageLoading}
        />
      )}
    </div>
  );
}