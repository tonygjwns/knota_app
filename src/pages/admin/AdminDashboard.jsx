import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, GraduationCap, Users, BookOpen } from 'lucide-react';
import DataImportPanel from '@/components/admin/DataImportPanel';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [academies, classes, users, problems] = await Promise.all([
        base44.entities.Academy.list('name', 500),
        base44.entities.Class.list('name', 500),
        base44.entities.User.list('-created_date', 1000),
        base44.entities.Problem.list('-created_date', 1),
      ]);

      const teachers = users.filter(u => u.role === 'teacher');
      const students = users.filter(u => u.role === 'student');

      // 학원별 학급 수
      const classByAcademy = {};
      classes.forEach(c => {
        classByAcademy[c.academy_id] = (classByAcademy[c.academy_id] || 0) + 1;
      });

      // 학원별 학생 수
      const studentByAcademy = {};
      students.forEach(u => {
        if (u.academy_id) {
          studentByAcademy[u.academy_id] = (studentByAcademy[u.academy_id] || 0) + 1;
        }
      });

      // 학원별 강사 수
      const teacherByAcademy = {};
      teachers.forEach(u => {
        if (u.academy_id) {
          teacherByAcademy[u.academy_id] = (teacherByAcademy[u.academy_id] || 0) + 1;
        }
      });

      const academyRows = academies.map(a => ({
        id: a.id,
        name: a.name,
        class_count: classByAcademy[a.id] || 0,
        teacher_count: teacherByAcademy[a.id] || 0,
        student_count: studentByAcademy[a.id] || 0,
      }));

      setStats({
        academy_count: academies.length,
        class_count: classes.length,
        teacher_count: teachers.length,
        student_count: students.length,
        academyRows,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InlineLoader message="대시보드 불러오는 중..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">학원 운영 현황을 한눈에 확인하세요</p>
      </div>

      {/* 경영 지표 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Building2, label: '학원 수', value: stats.academy_count + '개', color: 'text-blue-500 bg-blue-50' },
            { icon: BookOpen, label: '총 학급 수', value: stats.class_count + '개', color: 'text-violet-500 bg-violet-50' },
            { icon: GraduationCap, label: '강사 수', value: stats.teacher_count + '명', color: 'text-amber-500 bg-amber-50' },
            { icon: Users, label: '학생 수', value: stats.student_count + '명', color: 'text-emerald-500 bg-emerald-50' },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* 학원별 현황 */}
      {stats?.academyRows?.length > 0 && (
        <Card className="p-5">
          <h2 className="text-base font-semibold mb-4">학원별 현황</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-2 font-medium">학원명</th>
                  <th className="pb-2 font-medium text-right">학급</th>
                  <th className="pb-2 font-medium text-right">강사</th>
                  <th className="pb-2 font-medium text-right">학생</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.academyRows.map(a => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-medium">{a.name}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{a.class_count}개</td>
                    <td className="py-2.5 text-right text-muted-foreground">{a.teacher_count}명</td>
                    <td className="py-2.5 text-right text-muted-foreground">{a.student_count}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <DataImportPanel />

      {/* 도구 매핑 재계산 */}
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-1">도구 매핑 재계산</h2>
        <p className="text-xs text-muted-foreground mb-3">TypeToolMap 을 재계산합니다. 새 문제/도구 데이터가 추가된 후 실행하세요.</p>
        <Button onClick={async () => {
          try {
            const res = await base44.functions.invoke('recomputeTypeToolMap', {});
            toast.success(`완료: ${res.data?.created || 0}개 생성, ${res.data?.updated || 0}개 갱신`);
          } catch (e) {
            toast.error('실패: ' + e.message);
          }
        }}>
          도구 매핑 재계산
        </Button>
      </Card>
    </div>
  );
}