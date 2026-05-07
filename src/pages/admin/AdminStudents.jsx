import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, User, X, Clock, CheckCircle, XCircle } from 'lucide-react';

const PAGE_SIZE = 50;

const STATUS_CONFIG = {
  pending:  { label: '승인 대기', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: '승인됨',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: '거절됨',   color: 'bg-red-100 text-red-700 border-red-200' },
};

function StudentManageModal({ target, allAcademies, allClasses, onSave, onClose }) {
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
          <h3 className="font-bold text-lg">학생 관리</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 space-y-1">
          <p className="font-semibold">{target.full_name || '(이름 없음)'}</p>
          <p className="text-sm text-muted-foreground">{target.email}</p>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">역할</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
            <option value="student">student (학생)</option>
            <option value="teacher">teacher (강사)</option>
            <option value="admin">admin (관리자)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">소속 학원</label>
          <select value={academyId} onChange={e => { setAcademyId(e.target.value); setClassId(''); }}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">— 선택 안 함 —</option>
            {allAcademies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">소속 학급</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} disabled={!academyId}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50">
            <option value="">— 선택 안 함 —</option>
            {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          <Button variant="outline" onClick={onClose}>취소</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [manageTarget, setManageTarget] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [allUsers, att, acad, cls] = await Promise.all([
      base44.entities.User.list('-created_date', 1000),
      base44.entities.StudentAttempt.list('-submitted_at', 500),
      base44.entities.Academy.list('name', 200),
      base44.entities.Class.list('name', 500),
    ]);
    const stud = allUsers.filter(u => u.role === 'student');
    setStudents(stud);
    setPendingCount(stud.filter(u => u.approval_status === 'pending').length);
    setAttempts(att);
    setAcademies(acad);
    setClasses(cls);
    setLoading(false);
  };

  const getAcademyName = (id) => academies.find(a => a.id === id)?.name || null;
  const getClassName = (id) => classes.find(c => c.id === id)?.name || null;
  const getStats = (userId) => {
    const ua = attempts.filter(a => a.student_id === userId);
    if (!ua.length) return { count: 0, avg: 0 };
    return { count: ua.length, avg: Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length) };
  };

  const handleApprove = async (u) => {
    if (!confirm(`"${u.full_name || u.email}"을(를) 승인하시겠어요?`)) return;
    await base44.entities.User.update(u.id, { approval_status: 'approved', approved_at: new Date().toISOString(), rejected_reason: '' });
    loadAll();
  };

  const handleReject = async (u) => {
    const reason = prompt(`거절 사유를 입력하세요 (${u.full_name || u.email})`);
    if (reason === null) return;
    await base44.entities.User.update(u.id, { approval_status: 'rejected', approved_at: new Date().toISOString(), rejected_reason: reason });
    loadAll();
  };

  const handleSave = async (userId, data) => {
    await base44.entities.User.update(userId, data);
    setManageTarget(null);
    await loadAll();
  };

  const filtered = students
    .filter(u => classFilter === 'all' || u.class_id === classFilter)
    .filter(u => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <InlineLoader message="학생 목록 불러오는 중..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">학생 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">총 {students.length}명의 학생</p>
      </div>

      {pendingCount > 0 && (
        <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-700">승인 대기 중 <span className="font-bold">{pendingCount}명</span> — 검토가 필요해요</p>
        </div>
      )}

      {/* Class filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setClassFilter('all'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${classFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
          전체 학급
        </button>
        {classes.map(c => (
          <button key={c.id} onClick={() => { setClassFilter(c.id); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${classFilter === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="이름 또는 이메일 검색..." className="pl-10" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      <div className="space-y-2">
        {paginated.map(u => {
          const stats = getStats(u.id);
          const status = u.approval_status || 'pending';
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
          const academyName = getAcademyName(u.academy_id);
          const className = getClassName(u.class_id);
          return (
            <Card key={u.id} className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/admin/students/${u.id}`)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{u.full_name || '(이름 없음)'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {(academyName || className) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{[academyName, className].filter(Boolean).join(' › ')}</p>
                    )}
                    {u.approval_status === 'rejected' && u.rejected_reason && (
                      <p className="text-xs text-red-500 mt-0.5">사유: {u.rejected_reason}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{stats.count}회</p>
                  <p className="text-xs text-muted-foreground">{stats.avg > 0 ? `평균 ${stats.avg}점` : '시도 없음'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border">
                <Button size="sm" className="gap-1 w-full" disabled={u.approval_status === 'approved'} onClick={(e) => { e.stopPropagation(); handleApprove(u); }}>
                  <CheckCircle className="w-3.5 h-3.5" /> 승인
                </Button>
                <Button size="sm" variant="outline" className="gap-1 w-full text-red-600 border-red-200 hover:bg-red-50"
                  disabled={u.approval_status === 'rejected'} onClick={(e) => { e.stopPropagation(); handleReject(u); }}>
                  <XCircle className="w-3.5 h-3.5" /> 거절
                </Button>
                <Button size="sm" variant="outline" className="gap-1 w-full" onClick={(e) => { e.stopPropagation(); setManageTarget(u); }}>관리</Button>
              </div>
            </Card>
          );
        })}
        {paginated.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">해당하는 학생이 없어요</div>
        )}
      </div>

      <PaginationBar page={page} totalCount={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />

      {manageTarget && (
        <StudentManageModal
          target={manageTarget}
          allAcademies={academies}
          allClasses={classes}
          onSave={handleSave}
          onClose={() => setManageTarget(null)}
        />
      )}
    </div>
  );
}