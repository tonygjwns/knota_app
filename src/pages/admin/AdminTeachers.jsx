import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PaginationBar from '@/components/ui/PaginationBar';
import { Search, User, X, GraduationCap } from 'lucide-react';

const PAGE_SIZE = 50;

function TeacherManageModal({ target, allAcademies, onSave, onClose }) {
  const [role, setRole] = useState(target.role || 'teacher');
  const [academyId, setAcademyId] = useState(target.academy_id || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(target.id, { role, academy_id: academyId || null, class_id: null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">강사 관리</h3>
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
            <option value="teacher">teacher (강사)</option>
            <option value="admin">admin (관리자)</option>
            <option value="student">student (학생)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">소속 학원</label>
          <select value={academyId} onChange={e => setAcademyId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">— 선택 안 함 —</option>
            {allAcademies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [manageTarget, setManageTarget] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [allUsers, cls, acad] = await Promise.all([
      base44.entities.User.list('-created_date', 1000),
      base44.entities.Class.list('name', 500),
      base44.entities.Academy.list('name', 200),
    ]);
    setTeachers(allUsers.filter(u => u.role === 'teacher'));
    setClasses(cls);
    setAcademies(acad);
    setLoading(false);
  };

  const getAcademyName = (id) => academies.find(a => a.id === id)?.name || null;
  const getClassCount = (userId) => classes.filter(c => c.main_teacher_id === userId).length;

  const handleSave = async (userId, data) => {
    await base44.entities.User.update(userId, data);
    setManageTarget(null);
    await loadAll();
  };

  const filtered = teachers.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <InlineLoader message="강사 목록 불러오는 중..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">강사 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">총 {teachers.length}명의 강사</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="이름 또는 이메일 검색..." className="pl-10" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
      </div>

      <div className="space-y-2">
        {paginated.map(u => {
          const classCount = getClassCount(u.id);
          const academyName = getAcademyName(u.academy_id);
          return (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{u.full_name || '(이름 없음)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {academyName && <span className="text-xs text-muted-foreground">{academyName}</span>}
                      <span className="text-xs text-muted-foreground">담당 학급 {classCount}개</span>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setManageTarget(u)}>관리</Button>
              </div>
            </Card>
          );
        })}
        {paginated.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {search ? '검색 결과가 없어요' : '등록된 강사가 없어요'}
          </div>
        )}
      </div>

      <PaginationBar page={page} totalCount={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />

      {manageTarget && (
        <TeacherManageModal
          target={manageTarget}
          allAcademies={academies}
          onSave={handleSave}
          onClose={() => setManageTarget(null)}
        />
      )}
    </div>
  );
}