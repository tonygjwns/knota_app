import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTeacher } from '@/lib/TeacherContext';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical } from 'lucide-react';
import AssignmentForm from '@/components/AssignmentForm';
import { InlineLoader } from '@/components/LoadingOverlay';
import { format } from 'date-fns';

export default function TeacherAssignments() {
  const { data, loading: teacherLoading } = useTeacher();
  const { user } = useAuth();
  const my_classes = data?.my_classes || [];
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClassForForm, setSelectedClassForForm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [classNames, setClassNames] = useState({});

  // 클래스 이름 맵 구성
  useEffect(() => {
    if (my_classes.length > 0) {
      const names = {};
      my_classes.forEach(c => {
        names[c.id] = c.name;
      });
      setClassNames(names);
    }
  }, [my_classes]);

  // 숙제 로드
  const loadAssignments = React.useCallback(async () => {
    setLoading(true);
    try {
      if (!my_classes || my_classes.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const classIds = my_classes.map(c => c.id);
      const allAssignments = [];

      // 각 학급별로 병렬 조회 (필터 미지원이므로)
      const results = await Promise.all(
        classIds.map(cid =>
          base44.entities.Assignment.filter({ class_id: cid }, '-created_date', 100)
        )
      );

      results.forEach(res => {
        if (Array.isArray(res)) {
          allAssignments.push(...res);
        }
      });

      setAssignments(allAssignments);
    } finally {
      setLoading(false);
    }
  }, [my_classes]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // 필터링
  const filtered = useMemo(() => {
    let result = assignments;

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }

    // 학급 필터
    if (classFilter !== 'all') {
      result = result.filter(a => a.class_id === classFilter);
    }

    return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [assignments, statusFilter, classFilter]);

  // 숙제 저장
  const handleSave = async assignmentData => {
    await base44.entities.Assignment.create(assignmentData);
    await loadAssignments();
    setShowForm(false);
    setSelectedClassForForm(null);
  };

  // 삭제
  const handleDelete = async () => {
    if (deleteId) {
      await base44.entities.Assignment.delete(deleteId);
      await loadAssignments();
      setDeleteId(null);
    }
  };

  // 마감 처리
  const handleClose = async assignmentId => {
    await base44.entities.Assignment.update(assignmentId, { status: 'closed' });
    await loadAssignments();
  };

  // 복사하여 새 숙제
  const handleDuplicate = async assignment => {
    setSelectedClassForForm(assignment.class_id);
    setShowForm(true);
    // 복사된 데이터는 폼에서 설정 (현재는 빈 폼)
  };

  if (teacherLoading || !data) {
    return <InlineLoader message="학급 정보 불러오는 중..." />;
  }

  if (!my_classes || my_classes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground">담당 학급이 없습니다.</p>
      </div>
    );
  }

  if (loading) {
    return <InlineLoader message="숙제 로딩 중..." />;
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">출제한 숙제</h1>
        <Button
          onClick={() => {
            setSelectedClassForForm(null);
            setShowForm(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          새 숙제
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex gap-4 items-center">
        <Tabs
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="flex-1"
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="active">진행중</TabsTrigger>
            <TabsTrigger value="closed">마감</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="학급 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 학급</SelectItem>
            {my_classes.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 숙제 리스트 */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">출제한 숙제가 없습니다.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(assignment => {
            const problemIds = JSON.parse(assignment.problem_ids || '[]');
            const studentCount = my_classes.find(c => c.id === assignment.class_id)
              ?.student_count || 0;

            return (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    <CardDescription>
                      {classNames[assignment.class_id] || assignment.class_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={assignment.status === 'active' ? 'default' : 'secondary'}
                    >
                      {assignment.status === 'active' ? '진행중' : '마감'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {assignment.status === 'active' && (
                          <DropdownMenuItem
                            onClick={() => handleClose(assignment.id)}
                          >
                            마감
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicate(assignment)}>
                          복사하여 새 숙제
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(assignment.id)}
                        >
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {assignment.description && (
                      <p className="text-sm text-muted-foreground">
                        {assignment.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>출제일: {format(new Date(assignment.created_date), 'MMM d, HH:mm')}</span>
                      {assignment.deadline && (
                        <span>
                          마감: {format(new Date(assignment.deadline), 'MMM d, HH:mm')}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-6 text-sm">
                      <span className="font-medium">
                        총 {problemIds.length}문제
                      </span>
                      <span className="text-muted-foreground">
                        학생 {studentCount}명
                      </span>
                      <span className="text-muted-foreground">
                        제출 0건
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 새 숙제 버튼 클릭 시 학급 선택 모달 */}
      {showForm && !selectedClassForForm && (
        <ClassSelectDialog
          classes={my_classes}
          onSelect={classId => {
            setSelectedClassForForm(classId);
          }}
          onClose={() => {
            setShowForm(false);
          }}
        />
      )}

      {/* 숙제 폼 */}
      {showForm && selectedClassForForm && (
        <AssignmentForm
          classId={selectedClassForForm}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setSelectedClassForForm(null);
          }}
        />
      )}

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>숙제를 삭제하시겠어요?</AlertDialogTitle>
          <AlertDialogDescription>
            이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              삭제
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassSelectDialog({ classes, onSelect, onClose }) {
  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogTitle>어느 학급에 출제할까요?</AlertDialogTitle>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {classes.map(c => (
            <Button
              key={c.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}