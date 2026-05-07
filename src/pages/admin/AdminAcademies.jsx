import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Plus, Building2, Users, ChevronRight, Pencil, Trash2, X } from 'lucide-react';

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── AcademyModal ───────────────────────────────────────────────────────────
function AcademyModal({ academy, allUsers, onSave, onClose }) {
  const [name, setName] = useState(academy?.name || '');
  const [ownerId, setOwnerId] = useState(academy?.owner_id || '');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const eligibleOwners = allUsers.filter(u => u.role === 'admin' || u.role === 'teacher');
  const filtered = ownerSearch
    ? eligibleOwners.filter(u => (u.full_name + u.email).toLowerCase().includes(ownerSearch.toLowerCase()))
    : eligibleOwners;
  const selectedOwner = allUsers.find(u => u.id === ownerId);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), owner_id: ownerId || null });
    setSaving(false);
  };

  return (
    <Modal title={academy ? '학원 수정' : '학원 추가'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium block mb-1">학원명 *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 수학의 정석 학원" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">학원장 (admin/teacher 중 선택)</label>
          {selectedOwner && (
            <div className="flex items-center gap-2 mb-1 px-3 py-2 bg-primary/10 rounded-lg text-sm">
              <span className="font-medium">{selectedOwner.full_name}</span>
              <span className="text-muted-foreground text-xs">{selectedOwner.email}</span>
              <button onClick={() => setOwnerId('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}
          <Input
            value={ownerSearch}
            onChange={e => setOwnerSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
          />
          {ownerSearch && (
            <div className="mt-1 bg-card border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">결과 없음</p>}
              {filtered.map(u => (
                <button key={u.id}
                  onClick={() => { setOwnerId(u.id); setOwnerSearch(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex gap-2">
                  <span className="font-medium">{u.full_name}</span>
                  <span className="text-muted-foreground text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? '저장 중...' : '저장'}
        </Button>
        <Button variant="outline" onClick={onClose}>취소</Button>
      </div>
    </Modal>
  );
}

// ── ClassModal ─────────────────────────────────────────────────────────────
function ClassModal({ cls, academyId, teachers, onSave, onClose }) {
  const [name, setName] = useState(cls?.name || '');
  const [teacherId, setTeacherId] = useState(cls?.teacher_id || '');
  const [gradeRange, setGradeRange] = useState(cls?.grade_range || '');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = teacherSearch
    ? teachers.filter(u => (u.full_name + u.email).toLowerCase().includes(teacherSearch.toLowerCase()))
    : teachers;
  const selectedTeacher = teachers.find(u => u.id === teacherId);

  const handleSave = async () => {
    if (!name.trim() || !teacherId) return;
    setSaving(true);
    await onSave({ name: name.trim(), academy_id: academyId, teacher_id: teacherId, grade_range: gradeRange });
    setSaving(false);
  };

  return (
    <Modal title={cls ? '학급 수정' : '학급 추가'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium block mb-1">학급명 *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 중3-A반" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">학년</label>
          <Input value={gradeRange} onChange={e => setGradeRange(e.target.value)} placeholder="예: 중3" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">담당 강사 (teacher) *</label>
          {selectedTeacher && (
            <div className="flex items-center gap-2 mb-1 px-3 py-2 bg-primary/10 rounded-lg text-sm">
              <span className="font-medium">{selectedTeacher.full_name}</span>
              <button onClick={() => setTeacherId('')} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}
          <Input
            value={teacherSearch}
            onChange={e => setTeacherSearch(e.target.value)}
            placeholder="강사 이름 검색..."
          />
          {teacherSearch && (
            <div className="mt-1 bg-card border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">강사(teacher) 없음</p>}
              {filtered.map(u => (
                <button key={u.id}
                  onClick={() => { setTeacherId(u.id); setTeacherSearch(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex gap-2">
                  <span className="font-medium">{u.full_name}</span>
                  <span className="text-muted-foreground text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim() || !teacherId}>
          {saving ? '저장 중...' : '저장'}
        </Button>
        <Button variant="outline" onClick={onClose}>취소</Button>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminAcademies() {
  const [loading, setLoading] = useState(true);
  const [academies, setAcademies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const [academyModal, setAcademyModal] = useState(null); // null | 'new' | academy object
  const [classModal, setClassModal] = useState(null);     // null | 'new' | class object

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [a, c, u] = await Promise.all([
      base44.entities.Academy.list('name', 200),
      base44.entities.Class.list('name', 500),
      base44.entities.User.list('-created_date', 1000),
    ]);
    setAcademies(a);
    setClasses(c);
    setUsers(u);
    setLoading(false);
  };

  const academyClasses = selectedAcademy
    ? classes.filter(c => c.academy_id === selectedAcademy.id)
    : [];

  const teachers = users.filter(u => u.role === 'teacher');

  const getUserName = (id) => {
    const u = users.find(u => u.id === id);
    return u ? (u.full_name || u.email) : '—';
  };

  const getClassStudentCount = (classId) => users.filter(u => u.class_id === classId).length;
  const getClassStudents = (classId) => users.filter(u => u.class_id === classId);
  const getAcademyClassCount = (academyId) => classes.filter(c => c.academy_id === academyId).length;

  // CRUD
  const saveAcademy = async (data) => {
    if (academyModal && academyModal !== 'new') {
      await base44.entities.Academy.update(academyModal.id, data);
    } else {
      await base44.entities.Academy.create(data);
    }
    setAcademyModal(null);
    await loadAll();
  };

  const deleteAcademy = async (academy) => {
    if (!confirm(`"${academy.name}" 학원을 삭제할까요? 소속 학급도 모두 삭제돼요.`)) return;
    const related = classes.filter(c => c.academy_id === academy.id);
    await Promise.all(related.map(c => base44.entities.Class.delete(c.id)));
    await base44.entities.Academy.delete(academy.id);
    if (selectedAcademy?.id === academy.id) setSelectedAcademy(null);
    await loadAll();
  };

  const saveClass = async (data) => {
    if (classModal && classModal !== 'new') {
      await base44.entities.Class.update(classModal.id, data);
    } else {
      await base44.entities.Class.create(data);
    }
    setClassModal(null);
    await loadAll();
  };

  const deleteClass = async (cls) => {
    if (!confirm(`"${cls.name}" 학급을 삭제할까요?`)) return;
    await base44.entities.Class.delete(cls.id);
    await loadAll();
  };

  if (loading) return <InlineLoader message="불러오는 중..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">학원 / 학급 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">학원과 학급을 생성하고 강사를 배정해요</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── 학원 리스트 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">학원 목록 ({academies.length})</h2>
            <Button size="sm" onClick={() => setAcademyModal('new')}>
              <Plus className="w-4 h-4 mr-1" /> 학원 추가
            </Button>
          </div>

          {academies.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>등록된 학원이 없어요</p>
            </Card>
          )}

          {academies.map(a => (
            <Card
              key={a.id}
              onClick={() => setSelectedAcademy(prev => prev?.id === a.id ? null : a)}
              className={`p-4 cursor-pointer transition-all ${
                selectedAcademy?.id === a.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.owner_id ? `학원장: ${getUserName(a.owner_id)}` : '학원장 미지정'}</p>
                    <p className="text-xs text-muted-foreground">학급 {getAcademyClassCount(a.id)}개</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setAcademyModal(a)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteAcademy(a)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground self-center transition-transform ${selectedAcademy?.id === a.id ? 'rotate-90' : ''}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── 학급 리스트 ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {selectedAcademy ? `${selectedAcademy.name}의 학급 (${academyClasses.length})` : '학급 목록'}
            </h2>
            {selectedAcademy && (
              <Button size="sm" onClick={() => setClassModal('new')}>
                <Plus className="w-4 h-4 mr-1" /> 학급 추가
              </Button>
            )}
          </div>

          {!selectedAcademy && (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>좌측에서 학원을 선택해 주세요</p>
            </Card>
          )}

          {selectedAcademy && academyClasses.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              <p>등록된 학급이 없어요</p>
            </Card>
          )}

          {academyClasses.map(cls => (
            <Card key={cls.id} className="overflow-hidden">
              <div
                className="p-4 flex items-start justify-between gap-2 cursor-pointer hover:bg-muted/30"
                onClick={() => setExpandedClass(prev => prev === cls.id ? null : cls.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">담당: {getUserName(cls.teacher_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.grade_range && `${cls.grade_range} · `}학생 {getClassStudentCount(cls.id)}명
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setClassModal(cls)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteClass(cls)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground self-center transition-transform ${expandedClass === cls.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {expandedClass === cls.id && (
                <div className="border-t border-border bg-muted/20 p-3">
                  {getClassStudents(cls.id).length === 0
                    ? <p className="text-xs text-muted-foreground text-center py-2">배정된 학생이 없어요</p>
                    : (
                      <div className="space-y-1.5">
                        {getClassStudents(cls.id).map(s => (
                          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 bg-card rounded-lg">
                            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                              {(s.full_name || s.email)?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium">{s.full_name || '(이름 없음)'}</p>
                              <p className="text-xs text-muted-foreground">{s.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Modals */}
      {academyModal && (
        <AcademyModal
          academy={academyModal === 'new' ? null : academyModal}
          allUsers={users}
          onSave={saveAcademy}
          onClose={() => setAcademyModal(null)}
        />
      )}
      {classModal && selectedAcademy && (
        <ClassModal
          cls={classModal === 'new' ? null : classModal}
          academyId={selectedAcademy.id}
          teachers={teachers}
          onSave={saveClass}
          onClose={() => setClassModal(null)}
        />
      )}
    </div>
  );
}