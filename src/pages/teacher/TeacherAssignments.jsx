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
import { Plus, MoreVertical, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AssignmentForm from '@/components/AssignmentForm';
import ClassSelectDialog from '@/components/ClassSelectDialog';
import { InlineLoader } from '@/components/LoadingOverlay';
import { format } from 'date-fns';

function ToolRecRow({ tool, onAssign }) {
  return (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{tool.tool_name}</p>
        <p className="text-xs text-muted-foreground">
          {tool.attempted_student_count > 0
            ? `${tool.attempted_student_count}명 시도 · 평균 ${tool.avg_score}점${tool.unattempted_count > 0 ? ` · ${tool.unattempted_count}명 시도 X` : ''}`
            : `${tool.total_student_count}명 모두 안 풀어봄`}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onAssign} className="flex-shrink-0 gap-1">
        숙제 출제 <ChevronRight className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function TeacherAssignments() {
  const { data, loading: teacherLoading } = useTeacher();
  const { user } = useAuth();
  const navigate = useNavigate();
  const my_classes = data?.my_classes || [];
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClassForForm, setSelectedClassForForm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [classNames, setClassNames] = useState({});
  const [allDomains, setAllDomains] = useState([]);
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [recTab, setRecTab] = useState('weak');
  const [pendingToolId, setPendingToolId] = useState(null);

  // 클래스 이름 맵 구성
  useEffect(() => {
    if (my_classes.length > 0) {
      const names = {};
      my_classes.forEach(c => { names[c.id] = c.name; });
      setClassNames(names);
    }
  }, [my_classes]);

  // 도메인 fetch
  useEffect(() => {
    (async () => {
      const ds = await base44.entities.Domain.list('grade_range', 200);
      setAllDomains(ds);
    })();
  }, []);

  // 학급 필터 변경 시 단원 필터 초기화
  useEffect(() => {
    setSelectedDomainId(null);
  }, [classFilter]);

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

  // 추천 매듭 → 숙제 출제
  const handleAssignTool = (toolId) => {
    const targetClassId = classFilter !== 'all' ? classFilter : (my_classes[0]?.id || null);
    setPendingToolId(toolId);
    setSelectedClassForForm(targetClassId);
    setShowForm(true);
  };

  // 숙제 저장
  const handleSave = async assignmentData => {
    await base44.entities.Assignment.create(assignmentData);
    await loadAssignments();
    setShowForm(false);
    setSelectedClassForForm(null);
    setPendingToolId(null);
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

  // 추천 도구 계산
  const recClassId = classFilter !== 'all' ? classFilter : (my_classes[0]?.id || null);
  const recClass = my_classes.find(c => c.id === recClassId);
  const recTools = (data?.weak_or_unattempted_tools_by_class?.[recClassId]) || [];
  const weakTools = recTools
    .filter(t => t.attempted_student_count > 0)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 20);
  const unattemptedTools = recTools.filter(t => t.attempted_student_count === 0);

  const recDomainIds = new Set();
  for (const t of recTools) { (t.domain_ids || []).forEach(d => recDomainIds.add(d)); }
  const availableDomains = allDomains.filter(d =>
    recClass?.grade_range && d.grade_range === recClass.grade_range && recDomainIds.has(d.domain_id)
  );

  const filterByDomain = (arr) =>
    selectedDomainId ? arr.filter(t => (t.domain_ids || []).includes(selectedDomainId)) : arr;
  const displayWeak = filterByDomain(weakTools);
  const displayUnattempted = filterByDomain(unattemptedTools);

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* 헤더 + 상태 탭 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">출제한 숙제</h1>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="active">진행중</TabsTrigger>
            <TabsTrigger value="closed">마감</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 숙제 카드 리스트 */}
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
              <Card
                key={assignment.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/teacher/assignments/${assignment.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    <CardDescription>
                      {classNames[assignment.class_id] || assignment.class_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                      {assignment.status === 'active' ? '진행중' : '마감'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {assignment.status === 'active' && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleClose(assignment.id); }}>
                            마감
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(assignment); }}>
                          복사하여 새 숙제
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(assignment.id); }}>
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {assignment.description && (
                      <p className="text-sm text-muted-foreground">{assignment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>출제일: {format(new Date(assignment.created_date), 'MMM d, HH:mm')}</span>
                      {assignment.deadline && (
                        <span>마감: {format(new Date(assignment.deadline), 'MMM d, HH:mm')}</span>
                      )}
                    </div>
                    <div className="flex gap-6 text-sm">
                      <span className="font-medium">총 {problemIds.length}문제</span>
                      <span className="text-muted-foreground">학생 {studentCount}명</span>
                      <span className="text-muted-foreground">제출 0건</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 학급 필터 + 새 숙제 */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="학급 선택" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 학급</SelectItem>
            {my_classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setSelectedClassForForm(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />새 숙제
        </Button>
      </div>

      {/* 추천 도구 섹션 */}
      {recClassId && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">📌 이 학급에서 약한 도구 / 미경험 도구</h2>
            </div>
          </div>

          {availableDomains.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              <button
                onClick={() => setSelectedDomainId(null)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  selectedDomainId === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >전체</button>
              {availableDomains.map(d => (
                <button
                  key={d.domain_id}
                  onClick={() => setSelectedDomainId(selectedDomainId === d.domain_id ? null : d.domain_id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    selectedDomainId === d.domain_id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >{d.name}</button>
              ))}
            </div>
          )}

          <Tabs value={recTab} onValueChange={setRecTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="weak">⚠️ 약점 도구 ({displayWeak.length})</TabsTrigger>
              <TabsTrigger value="unattempted">🆕 미경험 도구 ({displayUnattempted.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="weak" className="mt-3">
              {displayWeak.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {selectedDomainId ? '이 단원에 해당하는 약점 도구가 없어요' : '약점 도구가 없어요'}
                </p>
              ) : (
                <div className="space-y-2">
                  {displayWeak.map(t => (
                    <ToolRecRow key={t.tool_id} tool={t} onAssign={() => handleAssignTool(t.tool_id)} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="unattempted" className="mt-3">
              {displayUnattempted.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {selectedDomainId ? '이 단원에 해당하는 미경험 도구가 없어요' : '학급 전원이 모든 도구를 한 번씩 풀어봤어요'}
                </p>
              ) : (
                <div className="space-y-2">
                  {displayUnattempted.map(t => (
                    <ToolRecRow key={t.tool_id} tool={t} onAssign={() => handleAssignTool(t.tool_id)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {classFilter === 'all' && (
            <p className="text-xs text-muted-foreground mt-3">
              💡 학급 필터로 특정 학급을 선택하면 그 학급 기준으로 분석돼요.
            </p>
          )}
        </Card>
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
          preselectedToolId={pendingToolId}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setSelectedClassForForm(null);
            setPendingToolId(null);
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