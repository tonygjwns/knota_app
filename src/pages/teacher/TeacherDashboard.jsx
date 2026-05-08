import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacher } from '@/lib/TeacherContext';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Users, BookOpen, Target, TrendingUp } from 'lucide-react';
import AssignmentForm from '@/components/AssignmentForm';
import ClassSelectDialog from '@/components/ClassSelectDialog';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useTeacher();
  const [pendingTool, setPendingTool] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showForm, setShowForm] = useState(false);

  if (loading) return <InlineLoader message="대시보드 불러오는 중..." />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
      <p className="text-red-500 font-semibold">데이터를 불러오지 못했어요</p>
      <p className="text-sm text-muted-foreground">{error}</p>
    </div>
  );

  if (!data) return <InlineLoader message="초기화 중..." />;

  if (data.my_classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold text-muted-foreground">담당 학급이 없어요</p>
        <p className="text-sm text-muted-foreground">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  const { my_classes, my_students, attempts_summary, weak_tools, tool_distribution, domain_summary, timing } = data;

  // hardest problems from students
  const hardestDomains = domain_summary
    ? [...domain_summary].sort((a, b) => a.avg - b.avg).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">강사 대시보드</h1>
          <p className="text-muted-foreground text-sm mt-1">내 학급 학생들의 학습 현황이에요</p>
        </div>
        {timing && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
            로드 {timing.total_ms}ms
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { Icon: BookOpen, label: '담당 학급', value: my_classes.length, unit: '개', color: 'text-violet-600' },
          { Icon: Users, label: '학생 수', value: my_students.length, unit: '명', color: 'text-blue-600' },
          { Icon: Target, label: '평균 점수', value: attempts_summary.avg_score, unit: '점', color: 'text-emerald-600' },
          { Icon: TrendingUp, label: '정답률', value: attempts_summary.correct_rate, unit: '%', color: 'text-amber-600' },
        ].map(({ Icon, label, value, unit, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span></p>
          </Card>
        ))}
      </div>

      {/* 단원별 평균 점수 */}
      {domain_summary && domain_summary.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-1">단원별 평균 점수</h2>
          <p className="text-xs text-muted-foreground mb-4">내 학급 학생들의 단원별 성취도</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={domain_summary} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${v}점`, '평균 점수']}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {domain_summary.map((entry, i) => (
                  <Cell key={i} fill={entry.avg < 50 ? '#ef4444' : entry.avg < 70 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 자주 막히는 매듭 */}
      {weak_tools.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-1">학급 학생들이 자주 막히는 매듭</h2>
          <p className="text-xs text-muted-foreground mb-4">평균 점수 낮은 순 — 막대를 클릭하면 숙제 출제</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weak_tools} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}점`, '평균 점수']} />
              <Bar dataKey="avg_score" radius={[0, 4, 4, 0]} onClick={(d) => {
                const tool = weak_tools.find(t => t.name === d.name);
                if (!tool) return;
                setPendingTool(tool.tool_id);
                if (my_classes.length === 1) {
                  setSelectedClass(my_classes[0].id);
                  setShowForm(true);
                }
              }} style={{ cursor: 'pointer' }}>
                {weak_tools.map((entry, i) => (
                  <Cell key={i} fill={entry.avg_score < 50 ? '#ef4444' : entry.avg_score < 70 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 자주 풀이된 매듭 */}
      {tool_distribution.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-1">학급에서 자주 풀이된 매듭 Top 10</h2>
          <p className="text-xs text-muted-foreground mb-4">어느 도구가 수업에 자주 등장했는지</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tool_distribution} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}회`, '시도 수']} />
              <Bar dataKey="attempts" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {attempts_summary.total === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">학생들의 제출 데이터가 없어요</Card>
      )}

      {/* Class select dialog */}
      {pendingTool && !selectedClass && my_classes.length > 1 && (
        <ClassSelectDialog
          classes={my_classes}
          onSelect={(cid) => { setSelectedClass(cid); setShowForm(true); }}
          onClose={() => { setPendingTool(null); }}
        />
      )}

      {/* Assignment form */}
      {showForm && selectedClass && (
        <AssignmentForm
          classId={selectedClass}
          preselectedToolId={pendingTool}
          onSave={async (d) => {
            await base44.entities.Assignment.create(d);
            setShowForm(false);
            setSelectedClass(null);
            setPendingTool(null);
            toast.success('숙제가 출제됐어요');
          }}
          onClose={() => {
            setShowForm(false);
            setSelectedClass(null);
            setPendingTool(null);
          }}
        />
      )}
    </div>
  );
}