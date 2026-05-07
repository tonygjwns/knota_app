import { base44 } from '@/api/base44Client';

export async function findSimilarProblems(targetToolId, currentProblem, studentId) {
  const all = await base44.entities.Problem.list('-created_date', 1000);
  const myAttempts = await base44.entities.StudentAttempt.filter(
    { student_id: studentId }, '-submitted_at', 1000
  );
  
  const attemptedIds = new Set(myAttempts.map(a => a.problem_id));
  const masteredIds = new Set(myAttempts.filter(a => (a.score || 0) >= 80).map(a => a.problem_id));
  
  const scored = all
    .map(p => {
      const toolIds = (() => { try { return JSON.parse(p.tool_ids || '[]'); } catch { return []; } })();
      if (!toolIds.includes(targetToolId)) return null;
      if (p.id === currentProblem.id) return null;
      
      let score = 100;
      if (p.domain_id === currentProblem.domain_id) score += 30;
      if (!attemptedIds.has(p.id)) score += 20;
      if (masteredIds.has(p.id)) score -= 50;
      if (toolIds.length <= 2) score += 10;
      if (p.difficulty && currentProblem.difficulty) {
        const diff = Math.abs(p.difficulty - currentProblem.difficulty);
        if (diff <= 1) score += 15;
      }
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  
  // 상위 10 개 중 random 3
  const topN = scored.slice(0, 10);
  return topN.sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.p);
}