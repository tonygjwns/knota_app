// Shared mastery calculation utilities

export const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const STALE_MS = 30 * 24 * 60 * 60 * 1000;    // 30 days

/**
 * Build a map of tool_id -> mastery score (0-100) from attempt history.
 * Uses exponential decay weighting so recent attempts count more.
 */
export function buildMasteryMap(attempts) {
  const now = Date.now();
  const toolData = {}; // tool_id -> { weightedScore, totalWeight }

  for (const attempt of attempts) {
    if (!attempt.claude_grade_json || attempt.score == null) continue;

    let toolIds = [];
    try {
      const grade = JSON.parse(attempt.claude_grade_json);
      toolIds = grade.tool_ids || [];
    } catch {
      continue;
    }

    const submittedAt = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : now;
    const age = now - submittedAt;
    const weight = Math.exp(-age / HALF_LIFE_MS);
    const score = attempt.score ?? 0;

    for (const toolId of toolIds) {
      if (!toolData[toolId]) toolData[toolId] = { weightedScore: 0, totalWeight: 0 };
      toolData[toolId].weightedScore += score * weight;
      toolData[toolId].totalWeight += weight;
    }
  }

  const masteryMap = {};
  for (const [toolId, data] of Object.entries(toolData)) {
    masteryMap[toolId] = data.totalWeight > 0
      ? Math.round(data.weightedScore / data.totalWeight)
      : 0;
  }
  return masteryMap;
}

/**
 * Returns Tailwind color classes based on mastery score.
 */
export function getMasteryColor(score) {
  if (score >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' };
  if (score >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-400' };
}

/**
 * Summarize mastery data for the Diagnosis page.
 * Returns { overallScore, trend, weakTools, staleTools, domainMap }
 */
export function summarizeMastery(attempts, tools) {
  if (!attempts || attempts.length < 5) return null;

  const now = Date.now();
  const masteryMap = buildMasteryMap(attempts);

  // Overall score = average of all tool mastery scores
  const scores = Object.values(masteryMap);
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Trend: compare last 10 vs previous 10 attempts
  const sorted = [...attempts]
    .filter(a => a.score != null)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const recent = sorted.slice(0, 10);
  const older = sorted.slice(10, 20);
  const recentAvg = recent.length > 0
    ? recent.reduce((s, a) => s + a.score, 0) / recent.length : 0;
  const olderAvg = older.length > 0
    ? older.reduce((s, a) => s + a.score, 0) / older.length : recentAvg;
  const trend = recentAvg - olderAvg; // positive = improving

  // Weak tools: mastery < 60, sorted ascending
  const toolMap = {};
  for (const t of (tools || [])) toolMap[t.tool_id] = t;

  const weakTools = Object.entries(masteryMap)
    .filter(([, score]) => score < 60)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5)
    .map(([toolId, score]) => ({ toolId, score, tool: toolMap[toolId] }));

  // Stale tools: last attempt > 30 days ago
  const lastAttemptByTool = {};
  for (const attempt of attempts) {
    let toolIds = [];
    try {
      const grade = JSON.parse(attempt.claude_grade_json || '{}');
      toolIds = grade.tool_ids || [];
    } catch { continue; }
    const t = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : 0;
    for (const tid of toolIds) {
      if (!lastAttemptByTool[tid] || t > lastAttemptByTool[tid]) {
        lastAttemptByTool[tid] = t;
      }
    }
  }
  const staleTools = Object.entries(lastAttemptByTool)
    .filter(([, t]) => now - t > STALE_MS)
    .map(([toolId]) => ({ toolId, tool: toolMap[toolId] }));

  // Domain map: domain_name -> { tools: [{toolId, score}], avgScore }
  const domainMap = {};
  for (const [toolId, score] of Object.entries(masteryMap)) {
    const tool = toolMap[toolId];
    if (!tool) continue;
    let domainIds = [];
    try { domainIds = JSON.parse(tool.domain_ids || '[]'); } catch { domainIds = []; }
    const domainLabel = domainIds[0] || '기타';
    if (!domainMap[domainLabel]) domainMap[domainLabel] = { tools: [], totalScore: 0 };
    domainMap[domainLabel].tools.push({ toolId, score, tool });
    domainMap[domainLabel].totalScore += score;
  }
  for (const d of Object.values(domainMap)) {
    d.avgScore = Math.round(d.totalScore / d.tools.length);
  }

  return { overallScore, trend, weakTools, staleTools, domainMap, masteryMap, totalAttempts: attempts.length };
}