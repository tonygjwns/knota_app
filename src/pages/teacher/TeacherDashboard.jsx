import React from 'react';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { aggregateToolMastery, topWeakTools } from '@/lib/toolMastery';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, BookOpen, Target, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';

export default function TeacherDashboard() {
  const { myClasses, students, attempts, loading } = useTeacher();
  const [weakTools, setWeakTools] = useState([]);
  const [toolDist, setToolDist] = useState([]);

  useEffect(() => {
    if (loading || attempts.length === 0) return;

    const buildCharts = async () => {
      const allTools = await base44.entities.MathTool.list('name', 100);
      const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));

      // attempts already have problem_domain cached, but for mastery we need tool_ids from problem
      // Use problem_id to look up tool — aggregate from attempt.problem_id via problems
      // Minimal fetch: only distinct problem IDs referenced in attempts
      const problemIds = [...new Set(attempts.map(a => a.problem_id).filter(Boolean))];
      // Fetch problems in parallel batches of 50
      const BATCH = 50;
      const problemBatches = [];
      for (let i = 0; i < problemIds.length; i += BATCH) {
        problemBatches.push(problemIds.slice(i, i + BATCH));
      }
      const problemResults = await Promise.all(
        problemBatches.map(batch =>
          Promise.all(batch.map(pid => base44.entities.Problem.filter({ problem_id: pid }, '-created_date', 1)))
        )
      );
      const allProblems = problemResults.flat(2);
      const problemMap = new Map(allProblems.map(p => [p.id, p]));

      const masteryMap = aggregateToolMastery(attempts, problemMap);
      const allToolsList = await Promise.resolve(allTools); // already fetched
      setWeakTools(topWeakTools(masteryMap, toolNameMap, 8, 2));

      const dist = [];
      masteryMap.forEach((entry, toolId) => {
        const tool = toolNameMap.get(toolId);
        dist.push({ name: tool?.name || toolId, attempts: entry.attempts, avg_score: entry.avg_score });
      });
      setToolDist(dist.sort((a, b) => b.attempts - a.attempts).slice(0, 10));
    };

    buildCharts();
  }, [loading, attempts]);

  if (loading) return <InlineLoader message="대시보드 불러오는 중..." />;

  if (myClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold text-muted-foreground">담당 학급이 없어요</p>
        <p className="text-sm text-muted-foreground">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / totalAttempts)
    : 0;
  const correctRate = totalAttempts > 0
    ? Math.round(attempts.filter(a => a.correctness === 'correct').length / totalAttempts * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">강사 대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">내 학급 학생들의 학습 현황이에요</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { Icon: BookOpen, label: '담당 학급', value: myClasses.length, unit: '개', color: 'text-violet-600' },
          { Icon: Users, label: '학생 수', value: students.length, unit: '명', color: 'text-blue-600' },
          { Icon: Target, label: '평균 점수', value: avgScore, unit: '점', color: 'text-emerald-600' },
          { Icon: TrendingUp, label: '정답률', value: correctRate, unit: '%', color: 'text-amber-600' },
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

      {weakTools.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">매듭별 약점 (평균 점수 낮은 순)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weakTools} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}점`, '평균 점수']} />
              <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
                {weakTools.map((entry, i) => (
                  <Cell key={i} fill={entry.avg_score < 50 ? '#ef4444' : entry.avg_score < 70 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {toolDist.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">매듭별 시도 분포 (Top 10)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={toolDist} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}회`, '시도 수']} />
              <Bar dataKey="attempts" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {totalAttempts === 0 && (
        <Card className="p-8 text-center text-muted-foreground text-sm">학생들의 제출 데이터가 없어요</Card>
      )}
    </div>
  );
}