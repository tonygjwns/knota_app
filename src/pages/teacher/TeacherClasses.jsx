import React, { useState, useEffect } from 'react';
import { useTeacher } from '@/lib/TeacherContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Users, ChevronRight, Plus, Key, X, Search, User } from 'lucide-react';
import AssignmentForm from '@/components/AssignmentForm';
import InviteCodeManager from '@/components/InviteCodeManager';
import { base44 } from '@/api/base44Client';
import { gradeLabel } from '@/lib/grade-labels.js';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function TeacherClasses() {
  const { data, loading, refresh } = useTeacher();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';

  // Class management state
  const [showForm, setShowForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [expandedCodeClass, setExpandedCodeClass] = useState(null);
  const [expandedStudentsClass, setExpandedStudentsClass] = useState(null);
  const [classStudents, setClassStudents] = useState({});
  const [loadingStudents, setLoadingStudents] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);

  // Student search state
  const [searchParams] = useSearchParams();
  const [classFilter, setClassFilter] = useState(searchParams.get('class_id') || 'all');
  const [search, setSearch] = useState('');
  const [changingClass, setChangingClass] = useState({});

  useEffect(() => {
    const cid = searchParams.get('class_id');
    if (cid) setClassFilter(cid);
  }, [searchParams]);

  const loadClassStudents = async (classId) => {
    if (classStudents[classId]) return;
    setLoadingStudents(prev => ({ ...prev, [classId]: true }));
    try {
      const students = await base44.entities.User.filter({ class_id: classId }, 'full_name', 200);
      setClassStudents(prev => ({ ...prev, [classId]: students }));
    } finally {
      setLoadingStudents(prev => ({ ...prev, [classId]: false }));
    }
  };

  const handleExpandStudents = (classId) => {
    if (expandedStudentsClass === classId) {
      setExpandedStudentsClass(null);
    } else {
      setExpandedStudentsClass(classId);
      loadClassStudents(classId);
    }
  };

  const handleRemoveStudent = async () => {
    if (!removeTarget) return;
    const { student } = removeTarget;
    await base44.entities.User.update(student.id, { class_id: null });
    toast.success(`${student.full_name || student.email} 학생이 학급에서 제거됐어요`);
    setClassStudents(prev => ({
      ...prev,
      [removeTarget.classId]: (prev[removeTarget.classId] || []).filter(s => s.id !== student.id),
    }));
    setRemoveTarget(null);
    refresh();
  };

  const handleClassChange = async (student, newClassId) => {
    setChangingClass(prev => ({ ...prev, [student.id]: true }));
    try {
      await base44.entities.User.update(student.id, { class_id: newClassId || null });
      const newClass = data?.my_classes?.find(c => c.id === newClassId);
      toast.success(`${student.full_name || student.email}을(를) ${newClass?.name || '미배정'}으로 옮겼어요`);
      refresh();
    } finally {
      setChangingClass(prev => ({ ...prev, [student.id]: false }));
    }
  };

  if (loading) return <InlineLoader message="학급 목록 불러오는 중..." />;
  if (!data) return <InlineLoader message="초기화 중..." />;

  const { my_classes, my_students } = data;

  if (my_classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold text-muted-foreground">담당 학급이 없어요</p>
        <p className="text-sm text-muted-foreground">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  const filteredStudents = (my_students || [])
    .filter(u => classFilter === 'all' || u.class_id === classFilter)
    .filter(u => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">내 학급</h1>
        <p className="text-muted-foreground text-sm mt-1">담당 학급 {my_classes.length}개</p>
      </div>

      {/* 학급 카드 리스트 */}
      <div className="space-y-3">
        {my_classes.map(cls => (
          <Card key={cls.id} className="p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => navigate(`/teacher/classes?class_id=${cls.id}`)}
                className="flex-1 flex items-center gap-3 cursor-pointer"
              >
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold">{cls.name}</p>
                  <p className="text-xs text-muted-foreground">{cls.academy_name}</p>
                  <p className="text-xs text-muted-foreground">{gradeLabel(cls.grade_range)}</p>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> {cls.student_count}명
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={e => { e.stopPropagation(); handleExpandStudents(cls.id); }}>
                  <Users className="w-4 h-4" />학생 관리
                </Button>
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedCodeClass(expandedCodeClass === cls.id ? null : cls.id);
                  }}>
                  <Key className="w-4 h-4" />초대코드
                </Button>
                <Button variant="outline" size="sm" className="gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedClassId(cls.id);
                    setShowForm(true);
                  }}>
                  <Plus className="w-4 h-4" />숙제 만들기
                </Button>
              </div>
            </div>

            {/* 학급 내 학생 관리 (expanded) */}
            {expandedStudentsClass === cls.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">학급 학생</p>
                {loadingStudents[cls.id] ? (
                  <InlineLoader message="학생 불러오는 중..." />
                ) : (classStudents[cls.id] || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">이 학급에 학생이 없어요. 초대코드로 추가해 주세요.</p>
                ) : (
                  <div className="space-y-1">
                    {(classStudents[cls.id] || []).map(student => (
                      <div key={student.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.full_name || '(이름 없음)'}</p>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        </div>
                        <button
                          onClick={() => setRemoveTarget({ student, classId: cls.id })}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 flex-shrink-0"
                          title="학급에서 빼기"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <InviteCodeManager classId={cls.id} academyId={cls.academy_id} allowedRoles={['student']} />
                </div>
              </div>
            )}

            {expandedCodeClass === cls.id && expandedStudentsClass !== cls.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <InviteCodeManager
                  classId={cls.id}
                  academyId={cls.academy_id}
                  allowedRoles={isOwner ? ['teacher', 'student'] : ['student']}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 구분선 */}
      <div className="border-t border-border pt-5">
        <h2 className="text-lg font-semibold mb-4">학생 검색</h2>

        {/* 학급 필터 chips */}
        <div className="flex gap-2 flex-wrap mb-3">
          <button
            onClick={() => setClassFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              classFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >전체</button>
          {my_classes.map(c => (
            <button key={c.id} onClick={() => setClassFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                classFilter === c.id ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* 검색 input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="이름 또는 이메일 검색..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* 학생 카드 리스트 */}
        <div className="space-y-2">
          {filteredStudents.map(u => (
            <Card key={u.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/teacher/students/${u.id}`)}>
                  <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{u.full_name || '(이름 없음)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.class_name}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{u.attempt_count}회</p>
                    <p className="text-xs text-muted-foreground">{u.avg_score > 0 ? `평균 ${u.avg_score}점` : '시도 없음'}</p>
                  </div>
                  <select
                    value={u.class_id || ''}
                    disabled={changingClass[u.id]}
                    onChange={e => handleClassChange(u, e.target.value || null)}
                    onClick={e => e.stopPropagation()}
                    className="text-xs h-7 px-2 rounded-md border border-input bg-background disabled:opacity-50"
                  >
                    <option value="">(학급 빼기)</option>
                    {my_classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          ))}
          {filteredStudents.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">해당하는 학생이 없어요</div>
          )}
        </div>
      </div>

      {/* 숙제 출제 폼 */}
      {showForm && selectedClassId && (
        <AssignmentForm
          classId={selectedClassId}
          onSave={async assignmentData => {
            await base44.entities.Assignment.create(assignmentData);
            setShowForm(false);
            setSelectedClassId(null);
          }}
          onClose={() => {
            setShowForm(false);
            setSelectedClassId(null);
          }}
        />
      )}

      {/* 학생 제거 확인 다이얼로그 */}
      {removeTarget && (
        <AlertDialog open onOpenChange={() => setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>학급에서 제거할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                {removeTarget.student.full_name || removeTarget.student.email} 학생을 이 학급에서 제거합니다. 학생의 계정은 유지됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveStudent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                제거
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}