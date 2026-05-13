import React, { useState, useEffect } from 'react';
import { useTeacher } from '@/lib/TeacherContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, ChevronRight, Plus, Key, X } from 'lucide-react';
import AssignmentForm from '@/components/AssignmentForm';
import InviteCodeManager from '@/components/InviteCodeManager';
import { base44 } from '@/api/base44Client';
import { gradeLabel, extractGradeOptions } from '@/lib/grade-labels.js';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  const [showForm, setShowForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [expandedCodeClass, setExpandedCodeClass] = useState(null);
  const [expandedStudentsClass, setExpandedStudentsClass] = useState(null);
  const [classStudents, setClassStudents] = useState({}); // { classId: [students] }
  const [loadingStudents, setLoadingStudents] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null); // { student, classId }

  const loadClassStudents = async (classId) => {
    if (classStudents[classId]) return; // already loaded
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
    // refresh local cache
    setClassStudents(prev => ({
      ...prev,
      [removeTarget.classId]: (prev[removeTarget.classId] || []).filter(s => s.id !== student.id),
    }));
    setRemoveTarget(null);
    refresh();
  };

  if (loading) return <InlineLoader message="학급 목록 불러오는 중..." />;
  if (!data) return <InlineLoader message="초기화 중..." />;

  const { my_classes } = data;

  if (my_classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold text-muted-foreground">담당 학급이 없어요</p>
        <p className="text-sm text-muted-foreground">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">내 학급</h1>
        <p className="text-muted-foreground text-sm mt-1">담당 학급 {my_classes.length}개</p>
      </div>

      <div className="space-y-3">
         {my_classes.map(cls => (
           <Card
             key={cls.id}
             className="p-4 hover:shadow-md transition-all"
           >
             <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => navigate(`/teacher/students?class_id=${cls.id}`)}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={e => { e.stopPropagation(); handleExpandStudents(cls.id); }}
                >
                  <Users className="w-4 h-4" />
                  학생 관리
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    setExpandedCodeClass(expandedCodeClass === cls.id ? null : cls.id);
                  }}
                >
                  <Key className="w-4 h-4" />
                  초대코드
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedClassId(cls.id);
                    setShowForm(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  숙제 만들기
                </Button>
              </div>
              </div>

              {/* 학생 목록 */}
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
                    <InviteCodeManager
                      classId={cls.id}
                      academyId={cls.academy_id}
                      allowedRoles={['student']}
                    />
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