import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ExternalLink } from 'lucide-react';

const parseGrading = (a) => {
  try {
    const raw = JSON.parse(a.claude_grade_json || '{}');
    return raw?.response ?? raw;
  } catch { return null; }
};

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

export default function AssignmentProblemStats({ problem, attempts, solutions, stepsBySol, toolMap }) {
  const validAttempts = attempts.filter(a => a.claude_grade_json);

  // ── 별해 분포 집계
  const matchData = useMemo(() => {
    const distByMatch = new Map();
    for (const a of validAttempts) {
      const g = parseGrading(a);
      const msid = g?.matched_solution_id || 'unmatched';
      if (!distByMatch.has(msid)) distByMatch.set(msid, { count: 0, scoreSum: 0 });
      const e = distByMatch.get(msid);
      e.count += 1;
      e.scoreSum += a.score || 0;
    }
    const rows = solutions.map(s => ({
      label: `풀이 #${s.priority}`,
      count: distByMatch.get(s.solution_id)?.count || 0,
      avgScore: Math.round((distByMatch.get(s.solution_id)?.scoreSum || 0) / Math.max(distByMatch.get(s.solution_id)?.count || 1, 1)),
      solution_id: s.solution_id,
    }));
    if (distByMatch.has('unmatched')) {
      const u = distByMatch.get('unmatched');
      rows.push({ label: '미매칭', count: u.count, avgScore: Math.round(u.scoreSum / u.count), solution_id: null });
    }
    return rows;
  }, [validAttempts, solutions]);

  // ── 주된 별해 결정 (가장 많이 매칭된 것)
  const mainSolution = useMemo(() => {
    const best = matchData.filter(d => d.solution_id).sort((a, b) => b.count - a.count)[0];
    return best ? solutions.find(s => s.solution_id === best.solution_id) : solutions[0] || null;
  }, [matchData, solutions]);

  const mainSteps = useMemo(() => {
    if (!mainSolution) return [];
    return (stepsBySol.get(mainSolution.solution_id) || []).slice().sort((a, b) => a.sequence_order - b.sequence_order);
  }, [mainSolution, stepsBySol]);

  const matchedAttempts = useMemo(() => {
    if (!mainSolution) return [];
    return validAttempts.filter(a => {
      const g = parseGrading(a);
      return g?.matched_solution_id === mainSolution.solution_id;
    });
  }, [validAttempts, mainSolution]);

  // ── 단계별 정답률
  const stepStats = useMemo(() => {
    return mainSteps.map(step => {
      const counts = { correct: 0, partial: 0, wrong: 0, missing: 0 };
      matchedAttempts.forEach(a => {
        const g = parseGrading(a);
        const sf = (g?.step_feedback || []).find(s => s.step_number === step.sequence_order);
        if (sf?.status && counts[sf.status] !== undefined) {
          counts[sf.status] += 1;
        } else {
          counts.missing += 1;
        }
      });
      return {
        step_number: step.sequence_order,
        tool_name: toolMap?.get(step.tool_id)?.name || step.tool_id || `Step ${step.sequence_order}`,
        ...counts,
        total: matchedAttempts.length,
      };
    });
  }, [mainSteps, matchedAttempts, toolMap]);

  // ── 학생별 요약 표
  const studentRows = useMemo(() => {
    return validAttempts.map(a => {
      const g = parseGrading(a);
      const msid = g?.matched_solution_id;
      const sol = msid ? solutions.find(s => s.solution_id === msid) : null;
      const steps = sol ? (stepsBySol.get(sol.solution_id) || []) : [];
      const sfList = g?.step_feedback || [];
      const passedSteps = sfList.filter(s => s.status === 'correct' || s.status === 'partial').length;
      return {
        studentId: a.student_id,
        studentEmail: a.student_email || a.student_id?.slice(0, 8),
        matchLabel: sol ? `#${sol.priority}` : '—',
        score: a.score ?? '—',
        passed: passedSteps,
        totalSteps: steps.length,
      };
    });
  }, [validAttempts, solutions, stepsBySol]);

  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">아직 제출이 없어요</p>;
  }

  return (
    <div className="space-y-5 pt-2">
      {/* 링크 */}
      <div className="flex justify-end">
        <Link
          to={`/teacher/problems/${problem.id}`}
          className="text-xs text-primary flex items-center gap-1 hover:underline"
          onClick={e => e.stopPropagation()}
        >
          문제 상세 보기 <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* 별해 분포 */}
      <div>
        <p className="text-sm font-semibold mb-2">학생들이 사용한 풀이</p>
        {matchData.every(d => d.count === 0) ? (
          <p className="text-xs text-muted-foreground">채점 데이터가 없어요</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(80, matchData.length * 42)}>
            <BarChart data={matchData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={60} />
              <Tooltip
                formatter={(v, _n, p) => [`${v}명 · 평균 ${p.payload.avgScore}점`, '학생']}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 단계별 정답률 */}
      {stepStats.length > 0 && mainSolution && (
        <div>
          <p className="text-sm font-semibold mb-1">
            단계별 결과
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (풀이 #{mainSolution.priority} 매칭 학생 기준, n={matchedAttempts.length})
            </span>
          </p>
          {matchedAttempts.length < 2 && (
            <p className="text-xs text-muted-foreground mb-2">* 표본이 적어 참고용으로만 활용하세요</p>
          )}
          {/* 범례 */}
          <div className="flex gap-3 text-xs mb-2 flex-wrap">
            {[['#10b981','정합'],['#f59e0b','부분'],['#ef4444','오류'],['#94a3b8','누락']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          {/* Step 라벨 + 차트 */}
          <div className="space-y-1">
            {stepStats.map(s => (
              <div key={s.step_number} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                  Step {s.step_number} — {s.tool_name}
                </span>
                <div className="flex-1 h-5 rounded overflow-hidden flex">
                  {[['correct','#10b981'],['partial','#f59e0b'],['wrong','#ef4444'],['missing','#94a3b8']].map(([key, color]) => {
                    const pct = s.total > 0 ? (s[key] / s.total) * 100 : 0;
                    return pct > 0 ? (
                      <div
                        key={key}
                        style={{ width: `${pct}%`, background: color }}
                        title={`${key}: ${s[key]}명`}
                      />
                    ) : null;
                  })}
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                  {s.total > 0 ? `정합 ${Math.round((s.correct / s.total) * 100)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 학생별 요약 표 */}
      {studentRows.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">학생별 요약</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">학생</th>
                  <th className="text-center py-1.5 px-3 text-muted-foreground font-medium">매칭 풀이</th>
                  <th className="text-center py-1.5 px-3 text-muted-foreground font-medium">점수</th>
                  <th className="text-center py-1.5 pl-3 text-muted-foreground font-medium">단계 통과</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 truncate max-w-[120px]">{r.studentEmail}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{r.matchLabel}</td>
                    <td className="py-1.5 px-3 text-center font-semibold">{r.score}</td>
                    <td className="py-1.5 pl-3 text-center text-muted-foreground">
                      {r.totalSteps > 0 ? `${r.passed}/${r.totalSteps}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}