import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTeacher } from '@/lib/TeacherContext';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { BookOpen, AlertTriangle, ClipboardList, CheckSquare, ChevronRight } from 'lucide-react';
import AssignmentForm from '@/components/AssignmentForm';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useTeacher();
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [pendingTool, setPendingTool] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [initialTypeId, setInitialTypeId] = useState(null);

  if (loading) return <InlineLoader message="대시보드 불러오는 중..." />;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
      <p className="text-red-500 font-semibold">데이터를 불러오지 못했어요</p>
      <p className="text-sm text-muted-foreground">{error}</p>
    </div>
  );
  if (!data || !data.my_classes) return <InlineLoader message="초기화 중..." />;

  if (data.my_classes.length === 0) {
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
      {/* 헤더 */}
      <div>
        <p className="text-muted-foreground text-sm">전체 학급 현황 + 학급별 분석</p>
      </div>

      {/* Section 2: 위험 신호 학생 (모든 학급) */}
      {(() => {
        const atRiskAll = (data.my_students || []).filter(s => (s.risk_flags || []).length > 0);
        return atRiskAll.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              신경 써야 할 학생
            </h2>
            <div className="space-y-2">
              {atRiskAll.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {s.full_name || s.email}
                      <span className="text-xs text-muted-foreground ml-2">{s.class_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.risk_flags.includes('dormant') && `${s.days_since_last_attempt}일째 풀이 0건. `}
                      {s.risk_flags.includes('homework_lag') && s.homework_lag_info &&
                        `"${s.homework_lag_info.assignment_title}" 진행률 ${s.homework_lag_info.progress_pct}% (D-${s.homework_lag_info.days_left}). `}
                      {s.risk_flags.includes('score_drop') && `최근 평균 ${s.score_drop_delta}점 하락.`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/teacher/students/${s.id}`)}>
                    상세 <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Section 3: 진행 중인 숙제 (모든 학급) */}
      {(data.active_assignments || []).length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            진행 중인 숙제
          </h2>
          <div className="space-y-2">
            {data.active_assignments.map(a => (
              <div key={a.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/teacher/assignments/${a.id}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.class_name} · {a.days_left !== null ? `D-${a.days_left}` : '마감 없음'} · {a.submitted_students}/{a.total_students} 제출 ({a.progress_pct}%)
                    {a.avg_score > 0 && ` · 평균 ${a.avg_score}점`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 학급 필터 */}
      <div className="pt-2">
        <Select value={selectedClassId || ''} onValueChange={(v) => setSelectedClassId(v || null)}>
          <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="학급 선택..." /></SelectTrigger>
          <SelectContent>
            {data.my_classes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!selectedClassId && (
          <p className="text-xs text-muted-foreground mt-2">
            학급을 선택하면 약점 도구 / 검토 요청 / 단원별 차트가 표시돼요
          </p>
        )}
      </div>

      {/* 학급 선택 시만 */}
      {selectedClassId && (
        <>
          {/* Section 1: 약점/미경험 도구 TOP 3 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">📌 숙제로 낼 만한 도구</h2>
              <Link to="/teacher/problems" className="text-xs text-primary hover:underline">도구 더 보기 →</Link>
            </div>
            {(() => {
              const top3 = ((data.weak_or_unattempted_tools_by_class?.[selectedClassId]) || []).slice(0, 3);
              return top3.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">아직 데이터가 부족해요</p>
              ) : (
                <div className="space-y-2">
                  {top3.map(t => (
                    <div key={t.tool_id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.tool_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.attempted_student_count > 0
                            ? `${t.attempted_student_count}명 시도 · 평균 ${t.avg_score}점${t.unattempted_count > 0 ? ` · ${t.unattempted_count}명 시도 X` : ''}`
                            : `${t.total_student_count}명 모두 안 풀어봄`}
                        </p>
                      </div>
                      <Button size="sm" variant="outline"
                        onClick={() => { setPendingTool(t.tool_id); setShowForm(true); }}>
                        숙제 출제 <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* Section 4: 검토 요청 카운트 */}
          {(data.review_request_count || 0) > 0 && (
            <Card className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate('/teacher/review')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium">검토 요청 {data.review_request_count}건</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          )}

          {/* Section 5: 단원별 차트 */}
          {(data.type_summary_by_class?.[selectedClassId] || []).length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold mb-1">단원별 평균 점수</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {data.my_classes.find(c => c.id === selectedClassId)?.name} 단원별 성취도 (막대 클릭 → 그 단원으로 숙제 출제)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.type_summary_by_class[selectedClassId]} margin={{ top: 5, right: 10, bottom: 80, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} height={80} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}점`, '평균 점수']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Bar
                    dataKey="avg"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(entry) => {
                      if (!entry?.type_id) return;
                      setInitialTypeId(entry.type_id);
                      setShowForm(true);
                    }}
                  >
                    {data.type_summary_by_class[selectedClassId].map((entry, i) => (
                      <Cell key={i} fill={entry.avg < 50 ? '#ef4444' : entry.avg < 70 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* Assignment form modal */}
      {showForm && selectedClassId && (
        <AssignmentForm
          classId={selectedClassId}
          preselectedToolId={pendingTool}
          initialTypeId={initialTypeId}
          onSave={async (d) => {
            await base44.entities.Assignment.create(d);
            setShowForm(false);
            setPendingTool(null);
            setInitialTypeId(null);
            toast.success('숙제가 출제됐어요');
          }}
          onClose={() => { setShowForm(false); setPendingTool(null); setInitialTypeId(null); }}
        />
      )}
    </div>
  );
}