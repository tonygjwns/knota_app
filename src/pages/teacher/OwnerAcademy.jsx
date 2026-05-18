import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { gradeLabel } from '@/lib/grade-labels';
import { toast } from 'sonner';
import ClassFormModal from '@/components/ClassFormModal';

export default function OwnerAcademy() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [academy, setAcademy] = useState(null);
  const [classes, setClasses] = useState([]);
  const [academyTeachers, setAcademyTeachers] = useState([]);
  const [classModal, setClassModal] = useState(null);

  const loadAll = async () => {
    console.log('[OwnerAcademy] loadAll start, user:', user);
    if (!user?.id) { console.log('[OwnerAcademy] abort: no user.id'); setLoading(false); return; }
    setLoading(true);
    try {
      let acad = null;
      if (user.academy_id) {
        console.log('[OwnerAcademy] fetching by user.academy_id:', user.academy_id);
        const [a] = await base44.entities.Academy.filter({ id: user.academy_id });
        console.log('[OwnerAcademy] result by id:', a);
        acad = a || null;
      } else {
        console.log('[OwnerAcademy] user.academy_id is empty');
      }
      if (!acad) {
        console.log('[OwnerAcademy] trying owner_id fallback:', user.id);
        const owned = await base44.entities.Academy.filter({ owner_id: user.id }, '-created_date', 1);
        console.log('[OwnerAcademy] result by owner_id:', owned);
        acad = owned[0] || null;
      }
      if (!acad) { console.log('[OwnerAcademy] abort: no academy found'); setLoading(false); return; }

      const isAuthorized = user.role === 'owner' || acad.owner_id === user.id;
      console.log('[OwnerAcademy] isAuthorized:', isAuthorized, '| user.role:', user.role, '| acad.owner_id:', acad.owner_id, '| user.id:', user.id);
      if (!isAuthorized) {
        toast.error('학원 관리 권한이 없어요');
        navigate('/teacher');
        return;
      }

      const academyId = acad.id;
      const [allClasses, allUsers] = await Promise.all([
        base44.entities.Class.filter({ academy_id: academyId }, 'name', 200),
        base44.entities.User.filter({ academy_id: academyId }, '-created_date', 500),
      ]);
      console.log('[OwnerAcademy] setting academy:', acad, '| classes:', allClasses.length, '| users:', allUsers.length);
      setAcademy(acad);
      setClasses(allClasses);
      setAcademyTeachers(allUsers.filter(u => u.role === 'teacher'));
    } catch (e) {
      console.error('[OwnerAcademy] error:', e);
      toast.error('데이터를 불러오지 못했어요: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [user?.id, user?.academy_id]);

  const saveClass = async (data) => {
    try {
      if (classModal && classModal !== 'new') {
        await base44.entities.Class.update(classModal.id, data);
        toast.success('학급을 수정했어요');
      } else {
        await base44.entities.Class.create(data);
        toast.success('학급을 추가했어요');
      }
      setClassModal(null);
      await loadAll();
    } catch (e) {
      toast.error('저장 실패: ' + (e.message || ''));
    }
  };

  const deleteClass = async (cls) => {
    if (!confirm(`"${cls.name}" 학급을 삭제할까요? 소속 학생들의 학급 정보가 빠집니다.`)) return;
    try {
      await base44.entities.Class.delete(cls.id);
      toast.success('학급을 삭제했어요');
      await loadAll();
    } catch (e) {
      toast.error('삭제 실패: ' + (e.message || ''));
    }
  };

  if (loading) return <InlineLoader message="학원 정보 불러오는 중..." />;
  if (!academy) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        소속된 학원이 없어요
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold">{academy.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">내 학원 관리</p>
      </div>

      {/* 학급 목록 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">학급 ({classes.length}개)</h2>
          <Button size="sm" onClick={() => setClassModal('new')}>
            <Plus className="w-4 h-4 mr-1" />학급 추가
          </Button>
        </div>
        <div className="space-y-2">
          {classes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">아직 학급이 없어요</p>
          )}
          {classes.map(cls => {
            const mainTeacher = academyTeachers.find(t => t.id === cls.main_teacher_id);
            return (
              <Card key={cls.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{cls.name}</p>
                  <p className="text-xs text-muted-foreground">{gradeLabel(cls.grade_range)}</p>
                  <p className="text-xs text-muted-foreground">
                    담당: {mainTeacher ? (mainTeacher.full_name || mainTeacher.email) : '미배정'}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setClassModal(cls)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteClass(cls)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {classModal && (
        <ClassFormModal
          cls={classModal === 'new' ? null : classModal}
          academyId={academy.id}
          teachers={academyTeachers}
          onSave={saveClass}
          onClose={() => setClassModal(null)}
        />
      )}
    </div>
  );
}