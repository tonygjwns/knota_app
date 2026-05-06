import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, BookOpen, TrendingUp, CheckCircle } from 'lucide-react';
import DataImportPanel from '@/components/admin/DataImportPanel';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [domainData, setDomainData] = useState([]);
  const [hardestProblems, setHardestProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [attempts, users, problems] = await Promise.all([
        base44.entities.StudentAttempt.list('-submitted_at', 200),
        base44.entities.User.list('-created_date', 100),
        base44.entities.Problem.list('-created_date', 50),
      ]);

      // Overall stats
      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / totalAttempts)
        : 0;
      const correctCount = attempts.filter(a => a.correctness === 'correct').length;
      setStats({
        totalStudents: users.length,
        totalAttempts,
        avgScore,
        correctRate: totalAttempts > 0 ? Math.round(correctCount / totalAttempts * 100) : 0,
      });

      // Domain data
      const domainMap = {};
      attempts.forEach(a => {
        const d = a.problem_domain || '미분류';
        if (!domainMap[d]) domainMap[d] = { total: 0, sum: 0 };
        domainMap[d].total++;
        domainMap[d].sum += a.score || 0;
      });
      const dData = Object.entries(domainMap)
        .map(([name, v]) => ({ name, avg: Math.round(v.sum / v.total), count: v.total }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setDomainData(dData);

      // Hardest problems
      const problemMap = {};
      attempts.forEach(a => {
        if (!problemMap[a.problem_id]) problemMap[a.problem_id] = { scores: [], content: a.problem_content };
        problemMap[a.problem_id].scores.push(a.score || 0);
      });
      const hardest = Object.entries(problemMap)
        .map(([pid, v]) => ({
          problem_id: pid,
          content: v.content,
          avg: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length),
          count: v.scores.length,
        }))
        .filter(p => p.count >= 2)
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 5);
      setHardestProblems(hardest);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InlineLoader message="대시보드 불러오는 중..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">분석 대시보드</h1>
      <DataImportPanel />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: '전체 학생', value: stats.totalStudents + '명', color: 'text-blue-500 bg-blue-50' },
            { icon: BookOpen, label: '총 풀이', value: stats.totalAttempts + '회', color: 'text-purple-500 bg-purple-50' },
            { icon: TrendingUp, label: '평균 점수', value: stats.avgScore + '점', color: 'text-amber-500 bg-amber-50' },
            { icon: CheckCircle, label: '정답률', value: stats.correctRate + '%', color: 'text-emerald-500 bg-emerald-50' },
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

      {/* Domain avg chart */}
      {domainData.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">단원별 평균 점수</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={domainData} margin={{ top: 5, right: 10, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${v}점`, '평균 점수']}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Hardest problems */}
      {hardestProblems.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">가장 어려운 문제</h2>
          <div className="space-y-3">
            {hardestProblems.map((p, i) => (
              <div key={p.problem_id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {p.content?.slice(0, 60) || `문제 #${p.problem_id}`}...
                    </p>
                    <p className="text-xs text-muted-foreground">{p.count}회 시도</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold ${p.avg < 40 ? 'text-red-500' : p.avg < 70 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {p.avg}점
                  </p>
                  <p className="text-xs text-muted-foreground">평균</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}