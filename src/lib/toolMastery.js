/**
 * 매듭(도구) 단위 성취도 집계 유틸리티
 */

/**
 * attempts 와 problemMap 을 받아 tool_id 별 성취도 집계
 * @param {Array} attempts - StudentAttempt 배열
 * @param {Map} problemMap - Map<problem_id, problem entity>
 * @returns {Map<tool_id, { attempts, correct_count, avg_score, scores }>}
 */
export function aggregateToolMastery(attempts, problemMap) {
  const masteryMap = new Map();

  attempts.forEach(attempt => {
    const problem = problemMap.get(attempt.problem_id);
    if (!problem) return;

    let toolIds = [];

    // 1순위: claude_grade_json 의 error_locations[].tool_id
    if (attempt.claude_grade_json) {
      try {
        const grading = JSON.parse(attempt.claude_grade_json);
        const g = grading?.response ?? grading;
        const errorToolIds = (g?.error_locations || [])
          .map(e => e.tool_id)
          .filter(Boolean);
        if (errorToolIds.length > 0) {
          toolIds = [...new Set(errorToolIds)];
        }
      } catch {}
    }

    // fallback: problem.tool_ids
    if (toolIds.length === 0 && problem.tool_ids) {
      try {
        const parsed = JSON.parse(problem.tool_ids);
        if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
      } catch {}
    }

    toolIds.forEach(toolId => {
      if (!masteryMap.has(toolId)) {
        masteryMap.set(toolId, { attempts: 0, correct_count: 0, scores: [] });
      }
      const entry = masteryMap.get(toolId);
      entry.attempts += 1;
      entry.scores.push(attempt.score || 0);
      if ((attempt.score || 0) >= 80) entry.correct_count += 1;
    });
  });

  // avg_score 계산
  masteryMap.forEach((entry) => {
    entry.avg_score = entry.scores.length > 0
      ? Math.round(entry.scores.reduce((s, x) => s + x, 0) / entry.scores.length)
      : 0;
  });

  return masteryMap;
}

/**
 * 약점 매듭 Top N (avg_score 낮은 순, minSamples 이상)
 * @param {Map} masteryMap
 * @param {Map} toolNameMap - Map<tool_id, tool entity>
 * @param {number} n
 * @param {number} minSamples
 * @returns {Array<{ tool_id, name, attempts, avg_score, correct_count }>}
 */
export function topWeakTools(masteryMap, toolNameMap, n = 5, minSamples = 3) {
  const result = [];
  masteryMap.forEach((entry, toolId) => {
    if (entry.attempts < minSamples) return;
    const tool = toolNameMap.get(toolId);
    result.push({
      tool_id: toolId,
      name: tool?.name || tool?.name_en || toolId,
      goal: tool?.goal || '',
      attempts: entry.attempts,
      avg_score: entry.avg_score,
      correct_count: entry.correct_count,
    });
  });
  return result.sort((a, b) => a.avg_score - b.avg_score).slice(0, n);
}

/**
 * 강점 매듭 Top N (avg_score 높은 순, minScore 이상, minSamples 이상)
 * @param {Map} masteryMap
 * @param {Map} toolNameMap - Map<tool_id, tool entity>
 * @param {number} n
 * @param {number} minScore
 * @param {number} minSamples
 * @returns {Array<{ tool_id, name, attempts, avg_score, correct_count }>}
 */
export function topStrongTools(masteryMap, toolNameMap, n = 5, minScore = 70, minSamples = 3) {
  const result = [];
  masteryMap.forEach((entry, toolId) => {
    if (entry.attempts < minSamples) return;
    if (entry.avg_score < minScore) return;
    const tool = toolNameMap.get(toolId);
    result.push({
      tool_id: toolId,
      name: tool?.name || tool?.name_en || toolId,
      goal: tool?.goal || '',
      attempts: entry.attempts,
      avg_score: entry.avg_score,
      correct_count: entry.correct_count,
    });
  });
  return result.sort((a, b) => b.avg_score - a.avg_score).slice(0, n);
}