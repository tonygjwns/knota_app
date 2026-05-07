import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, User, Clock, CheckCircle, XCircle, ShieldCheck, X, Settings } from 'lucide-react';

const STATUS_CONFIG = {
  pending:  { label: '승인 대기', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: '승인됨',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: '거절됨',   color: 'bg-red-100 text-red-700 border-red-200' },
  admin:    { label: '관리자',   color: 'bg-slate-200 text-slate-600 border-slate-300' },
};

const ROLE_CONFIG = {
  admin:   { label: 'admin',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  teacher: { label: 'teacher', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  student: { label: 'student', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  user:    { label: 'user',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const FILTERS = ['전체', '승인 대기', '승인됨', '거절됨'];
const FILTER_STATUS = { '승인 대기': 'pending', '승인됨': 'approved', '거절됨': 'rejected' };
const PAGE_SIZE = 50;

// ── UserManageModal ────────────────────────────────────────────────────────
function UserManageModal({ target, allAcademies, allClasses, onSave, onClose }) {
  const [role, setRole] = useState(target.role || 'student');
  const [academyId, setAcademyId] = useState(target.academy_id || '');
  const [classId, setClassId] = useState(target.class_id || '');
  const [saving, setSaving] = useState(false);

  const filteredClasses = academyId ? allClasses.filter(c => c.academy_id === academyId) : [];

  const handleSave = async () => {
    setSaving(true);
    await onSave(target.id, { role, academy_id: academyId || null, class_id: classId || null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">사용자 관리</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        {/* 사용자 정보 (읽기 전용) */}
        <div className="bg-muted/50 rounded-xl p-4 space-y-1">
          <p className="font-semibold">{target.full_name || '(이름 없음)'}</p>
          <p className="text-sm text-muted-foreground">{target.email}</p>
          <p className="text-xs text-muted-foreground">가입일: {new Date(target.created_date).toLocaleDateString('ko-KR')}</p>
        </div>

        {/* Role */}
        <div>
          <label className="text-xs font-medium block mb-1">역할</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="student">student (학생)</option>
            <option value="teacher">teacher (강사)</option>
            <option value="admin">admin (관리자)</option>
          </select>
        </div>

        {/* Academy */}
        <div>
          <label className="text-xs font-medium block mb-1">소속 학원</label>
          <select
            value={academyId}
            onChange={e => { setAcademyId(e.target.value); setClassId(''); }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">— 선택 안 함 —</option>
            {allAcademies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Class */}
        <div>
          <label className="text-xs font-medium block mb-1">소속 학급</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            disabled={!academyId}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50"
          >
            <option value="">— 선택 안 함 —</option>
            {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {academyId && filteredClasses.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">이 학원에 학급이 없어요</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          <Button variant="outline" onClick={onClose}>취소</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('전체');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [manageTarget, setManageTarget] = useState(null);
  const topRef = useRef(null);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    setLoading(true);
    const [firstPage, allUsers, a, acad, cls] = await Promise.all([
      base44.entities.User.list('-created_date', PAGE_SIZE, 0),
      base44.entities.User.list('-created_date', 1000, 0),
      base44.entities.StudentAttempt.list('-submitted_at', 500),
      base44.entities.Academy.list('name', 200),
      base44.entities.Class.list('name', 500),
    ]);
    setUsers(firstPage);
    setTotalCount(allUsers.length);
    setPendingCount(allUsers.filter(u => u.approval_status === 'pending').length);
    setAttempts(a);
    setAcademies(acad);
    setClasses(cls);
    setPage(0);
    setLoading(false);
  };

  const loadPage = async (newPage, currentFilter) => {
    setPageLoading(true);
    const statusKey = FILTER_STATUS[currentFilter];
    const data = statusKey
      ? await base44.entities.User.filter({ approval_status: statusKey }, '-created_date', PAGE_SIZE, newPage * PAGE_SIZE)
      : await base44.entities.User.list('-created_date', PAGE_SIZE, newPage * PAGE_SIZE);
    setUsers(data);
    setPage(newPage);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPageLoading(false);
  };

  const handleFilterChange = async (newFilter) => {
    setFilter(newFilter);
    setPage(0);
    setPageLoading(true);
    const statusKey = FILTER_STATUS[newFilter];
    if (statusKey) {
      const all = await base44.entities.User.filter({ approval_status: statusKey }, '-created_date', 1000, 0);
      setTotalCount(all.length);
      setUsers(all.slice(0, PAGE_SIZE));
    } else {
      const [firstPage, allUsers] = await Promise.all([
        base44.entities.User.list('-created_date', PAGE_SIZE, 0),
        base44.entities.User.list('-created_date', 1000, 0),
      ]);
      setUsers(firstPage);
      setTotalCount(allUsers.length);
      setPendingCount(allUsers.filter(u => u.approval_status === 'pending').length);
    }
    setPageLoading(false);
  };

  const getUserStats = (userId) => {
    const ua = attempts.filter(a => a.student_id === userId);
    if (!ua.length) return { count: 0, avg: 0 };
    return { count: ua.length, avg: Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length) };
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

  const handleSaveManage = async (userId, data) => {
    await base44.entities.User.update(userId, data);
    setManageTarget(null);
    await loadInitial();
  };

  const getAcademyName = (id) => academies.find(a => a.id === id)?.name || null;
  const getClassName = (id) => classes.find(c => c.id === id)?.name || null;

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

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => handleFilterChange(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="현재 페이지에서 검색..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {search && <p className="text-xs text-muted-foreground -mt-3">현재 페이지({users.length}명)에서만 검색됩니다.</p>}

      <div className="space-y-2" style={{ opacity: pageLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {filtered.map(u => {
          const stats = getUserStats(u.id);
          const isAdmin = u.role === 'admin';
          const status = isAdmin ? 'admin' : (u.approval_status || 'pending');
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
          const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.student;
          const isDummy = u.email?.endsWith('@knota.test');
          const academyName = getAcademyName(u.academy_id);
          const className = getClassName(u.class_id);
          const isSelf = u.id === me?.id;

          return (
            <Card key={u.id} className="p-4 gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {isAdmin ? <ShieldCheck className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{u.full_name || '(이름 없음)'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${roleCfg.color}`}>{roleCfg.label}</span>
                      {isDummy && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-300 font-mono">DUMMY</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {(academyName || className) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[academyName, className].filter(Boolean).join(' › ')}
                      </p>
                    )}
                    {u.approval_status === 'rejected' && u.rejected_reason && (
                      <p className="text-xs text-red-500 mt-0.5">사유: {u.rejected_reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{stats.count}회</p>
                    <p className="text-xs text-muted-foreground">{stats.avg > 0 ? `평균 ${stats.avg}점` : '시도 없음'}</p>
                  </div>
                </div>
              </div>

              {!isAdmin && !isSelf && (
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    className="gap-1 w-full"
                    disabled={u.approval_status === 'approved'}
                    onClick={() => handleApprove(u)}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> 승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 w-full text-red-600 border-red-200 hover:bg-red-50"
                    disabled={u.approval_status === 'rejected'}
                    onClick={() => handleReject(u)}
                  >
                    <XCircle className="w-3.5 h-3.5" /> 거절
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 w-full"
                    onClick={() => setManageTarget(u)}
                  >
                    <Settings className="w-3.5 h-3.5" /> 관리
                  </Button>
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
          page={page} totalCount={totalCount} pageSize={PAGE_SIZE}
          onPage={(p) => loadPage(p, filter)} loading={pageLoading}
        />
      )}

      {manageTarget && (
        <UserManageModal
          target={manageTarget}
          allAcademies={academies}
          allClasses={classes}
          onSave={handleSaveManage}
          onClose={() => setManageTarget(null)}
        />
      )}
    </div>
  );
}