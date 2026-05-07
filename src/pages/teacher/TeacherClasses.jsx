import React from 'react';
import { useTeacher } from '@/lib/TeacherContext';
import { useNavigate } from 'react-router-dom';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { BookOpen, Users, ChevronRight } from 'lucide-react';

export default function TeacherClasses() {
  const { data, loading } = useTeacher();
  const navigate = useNavigate();

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
            onClick={() => navigate(`/teacher/students?class_id=${cls.id}`)}
            className="p-4 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold">{cls.name}</p>
                  <p className="text-xs text-muted-foreground">{cls.academy_name}</p>
                  {cls.grade_range && <p className="text-xs text-muted-foreground">{cls.grade_range}</p>}
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3" /> {cls.student_count}명
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}