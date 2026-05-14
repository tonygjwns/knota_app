export const HALF_LIFE_MS = 180 * 24 * 60 * 60 * 1000; // 반감기 180일
export const WEIGHT_THRESHOLD = 0.3; // 후보 채택 최소 weight

/**
 * Build a Map of tool_id -> { weightedScore, weight, wrongnessSum, lastAt }
 * @param {Array} attempts - StudentAttempt records
 * @param {Map} problemMap - Map<problem.id, problem>
 */
export function buildMasteryMap(attempts, problemMap) {
  const masteryMap = new Map();
  const now = Date.now();

  for (const attempt of attempts) {
    const problem = problemMap.get(attempt.problem_id);
    if (!problem) continue;

    const submittedAt = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : now;
    const ageMs = now - submittedAt;
    const w = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    const score = attempt.score ?? 0;

    // 도구 추출 우선순위
    let toolIds = [];
    // Priority 1: teacher_review_json (강사 보정)
    if (attempt.teacher_review_json) {
      try {
        const tr = JSON.parse(attempt.teacher_review_json);
        const edits = tr.step_edits || {};
        Object.values(edits).forEach(edit => {
          if ((edit.status === 'wrong' || edit.status === 'partial') && edit.tool_id) {
            toolIds.push(edit.tool_id);
          }
        });
        if (toolIds.length > 0) toolIds = [...new Set(toolIds)];
      } catch {}
    }
    // Priority 2: claude_grade_json error_locations
    if (toolIds.length === 0 && attempt.claude_grade_json) {
      try {
        const raw = JSON.parse(attempt.claude_grade_json);
        const g = raw?.response ?? raw;
        const errIds = (g?.error_locations || []).map(e => e.tool_id).filter(Boolean);
        if (errIds.length > 0) toolIds = [...new Set(errIds)];
      } catch {}
    }
    // Priority 3: problem.tool_ids (fallback)
    if (toolIds.length === 0 && problem.tool_ids) {
      try {
        const parsed = JSON.parse(problem.tool_ids);
        if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
      } catch {}
    }

    for (const tid of toolIds) {
      if (!masteryMap.has(tid)) {
        masteryMap.set(tid, { weightedScore: 0, weight: 0, wrongnessSum: 0, lastAt: 0 });
      }
      const m = masteryMap.get(tid);
      m.weightedScore += score * w;
      m.weight += w;
      m.wrongnessSum += (100 - score) * w;
      m.lastAt = Math.max(m.lastAt, submittedAt);
    }
  }
  return masteryMap;
}

/**
 * Returns Tailwind text color class based on mastery score.
 */
export function getMasteryColor(avg, isNew) {
  if (isNew) return 'text-muted-foreground';
  if (avg < 70) return 'text-red-500';
  if (avg < 90) return 'text-amber-500';
  return 'text-emerald-500';
}

/**
 * Compute a unified weakness score for a mastery entry.
 * Returns null if the entry doesn't meet the threshold (not a candidate).
 */
export function computeWeakness(m) {
  if (m.weight < WEIGHT_THRESHOLD) return null;
  const ageDays = (Date.now() - m.lastAt) / (24 * 60 * 60 * 1000);
  const ratio = ageDays / 180;
  const stalenessBonus = Math.max(0, Math.min((ratio - 0.5) * 60, 30));
  return m.wrongnessSum + stalenessBonus;
}

/**
 * Summarize mastery data for the Diagnosis page.
 * @param {Array} attempts
 * @param {Map} problemMap - Map<problem.id, problem>
 * @param {Array} tools - MathTool records
 */
export function summarizeMastery(attempts, problemMap, tools) {
  if (!attempts || attempts.length < 5) return null;

  const masteryMap = buildMasteryMap(attempts, problemMap);
  const toolMap = new Map(tools.map(t => [t.tool_id, t]));

  // A-2. Overall average — attempt 기반 시간 가중 평균
  let totalWeightedScore = 0, totalWeight = 0;
  const now = Date.now();
  for (const a of attempts) {
    if (a.score == null) continue;
    const submittedAt = a.submitted_at ? new Date(a.submitted_at).getTime() : now;
    const w = Math.pow(0.5, (now - submittedAt) / HALF_LIFE_MS);
    totalWeightedScore += (a.score || 0) * w;
    totalWeight += w;
  }
  const overallAvg = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : null;

  // Recent trend: last 10 vs previous 10
  const sorted = [...attempts]
    .filter(a => a.score != null)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const recent = sorted.slice(0, 10);
  const older = sorted.slice(10, 20);
  const recentAvg = recent.length > 0 ? recent.reduce((s, a) => s + a.score, 0) / recent.length : 0;
  const olderAvg = older.length > 0 ? older.reduce((s, a) => s + a.score, 0) / older.length : recentAvg;
  // A-5. null = 데이터 부족
  const recentTrend = older.length > 0 ? recentAvg - olderAvg : null;

  // New tool ids (weight < 0.5)
  const newToolIds = new Set();
  for (const [tid, m] of masteryMap) {
    if (m.weight < 0.5) newToolIds.add(tid);
  }

  // A-3. Weak tools top 3
  const weakTools = [];
  for (const [tid, m] of masteryMap) {
    const weakness = computeWeakness(m);
    if (weakness === null) continue;
    const tool = toolMap.get(tid);
    if (!tool) continue;
    const avg = Math.round(m.weightedScore / m.weight);
    weakTools.push({ tool, avg, weakness });
  }
  weakTools.sort((a, b) => b.weakness - a.weakness);
  const top3Weak = weakTools.slice(0, 3);

  // A-4. Domain map — attempt.problem_domain 기반
  const domainMap = {};
  const now2 = Date.now();
  for (const a of attempts) {
    if (a.score == null) continue;
    const key = a.problem_domain || '미분류';
    if (!domainMap[key]) domainMap[key] = { totalScore: 0, totalWeight: 0, count: 0 };
    const submittedAt = a.submitted_at ? new Date(a.submitted_at).getTime() : now2;
    const w = Math.pow(0.5, (now2 - submittedAt) / HALF_LIFE_MS);
    domainMap[key].totalScore += (a.score || 0) * w;
    domainMap[key].totalWeight += w;
    domainMap[key].count += 1;
  }
  for (const d of Object.values(domainMap)) {
    d.avgScore = d.totalWeight > 0 ? Math.round(d.totalScore / d.totalWeight) : 0;
  }

  return {
    masteryMap,
    weakTools: top3Weak,
    newToolIds,
    totalAttempts: attempts.length,
    overallAvg,
    recentTrend,
    domainMap,
  };
}