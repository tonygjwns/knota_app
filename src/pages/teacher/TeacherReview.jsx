import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function TeacherReview() {
  const { data: teacherData } = useTeacher();
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, [teacherData]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const studentIds = new Set(teacherData?.my_students?.map(s => s.id) || []);
      const requests = await base44.entities.StudentAttempt.filter(
        { review_requested: true },
        '-created_date',
        100
      );
      const filtered = requests.filter(a => {
        if (!a.review_resolved_at && (studentIds.size === 0 || studentIds.has(a.student_id))) return true;
        return false;
      });
      setPending(filtered);
    } catch {
      toast.error('불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InlineLoader message="검토 목록 불러오는 중..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">검토 요청</h1>
        <Button variant="outline" size="sm" onClick={loadQueue}>새로고침</Button>
      </div>
      <p className="text-sm text-muted-foreground">학생이 채점을 다시 봐달라고 요청한 풀이</p>

      {pending.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          대기 중인 검토 요청이 없어요
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map(a => (
            <Card key={a.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/teacher/review/${a.id}`)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.student_email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.problem_domain && <span className="mr-1">{a.problem_domain} ·</span>}
                    {a.problem_content?.slice(0, 60)}...
                  </p>
                  <p className="text-sm font-semibold mt-2">채점 점수: {a.score}점</p>
                  {a.review_request_note && (
                    <div className="mt-2 p-2 bg-muted/40 rounded text-xs">
                      학생 메모: "{a.review_request_note}"
                    </div>
                  )}
                </div>
                <Button size="sm">검토하기 →</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}