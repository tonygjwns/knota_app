import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || (caller.role !== 'admin' && caller.role !== 'teacher')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    // target user
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 9999);
    const target = allUsers.find(u => u.id === userId);
    if (!target) return Response.json({ error: 'Student not found' }, { status: 404 });

    // permission check (teacher: my classes 의 학생만)
    if (caller.role === 'teacher') {
      const classes = await base44.asServiceRole.entities.Class.list('name', 500);
      const myClassIds = new Set(
        classes.filter(c =>
          c.main_teacher_id === caller.id ||
          (c.assistant_teacher_ids || []).includes(caller.id)
        ).map(c => c.id)
      );
      if (!myClassIds.has(target.class_id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // attempts + problems + tools
    const attempts = await base44.asServiceRole.entities.StudentAttempt.filter(
      { student_id: userId }, '-submitted_at', 1000
    );
    const allTools = await base44.asServiceRole.entities.MathTool.list('name', 100);
    
    // attempts 의 unique problem_id 만 fetch (필요시)
    let problems = [];
    if (attempts.length > 0) {
      const allProblems = await base44.asServiceRole.entities.Problem.list('-created_date', 1000);
      const problemIds = new Set(attempts.map(a => a.problem_id));
      problems = allProblems.filter(p => problemIds.has(p.id));
    }

    // mastery 집계 (lib/toolMastery 양식 inline)
    const problemMap = new Map(problems.map(p => [p.id, p]));
    const masteryMap = new Map();
    
    attempts.forEach(attempt => {
      const problem = problemMap.get(attempt.problem_id);
      if (!problem) return;
      let toolIds = [];
      if (attempt.claude_grade_json) {
        try {
          const grading = JSON.parse(attempt.claude_grade_json);
          const g = grading?.response ?? grading;
          const errorToolIds = (g?.error_locations || []).map(e => e.tool_id).filter(Boolean);
          if (errorToolIds.length > 0) toolIds = [...new Set(errorToolIds)];
        } catch {}
      }
      if (toolIds.length === 0 && problem.tool_ids) {
        try {
          const parsed = JSON.parse(problem.tool_ids);
          if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
        } catch {}
      }
      toolIds.forEach(tid => {
        if (!masteryMap.has(tid)) masteryMap.set(tid, { attempts: 0, correct_count: 0, scores: [] });
        const e = masteryMap.get(tid);
        e.attempts += 1;
        e.scores.push(attempt.score || 0);
        if ((attempt.score || 0) >= 80) e.correct_count += 1;
      });
    });
    masteryMap.forEach(e => {
      e.avg_score = e.scores.length > 0
        ? Math.round(e.scores.reduce((s, x) => s + x, 0) / e.scores.length) : 0;
    });

    const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));
    const buildList = (arr) => arr.map(([tid, e]) => ({
      tool_id: tid, name: toolNameMap.get(tid)?.name || tid,
      attempts: e.attempts, correct_count: e.correct_count, avg_score: e.avg_score
    }));
    const masteryArr = [...masteryMap.entries()].filter(([_, e]) => e.attempts >= 3);
    const weak_tools = buildList([...masteryArr].sort((a,b) => a[1].avg_score - b[1].avg_score)).slice(0, 5);
    const strong_tools = buildList([...masteryArr].filter(([_,e]) => e.avg_score >= 70)
      .sort((a,b) => b[1].avg_score - a[1].avg_score)).slice(0, 5);

    // Remediation history 계산
    const remediationMap = new Map();
    attempts.forEach(attempt => {
      if (attempt.attempt_type === 'remediation_retry' || attempt.attempt_type === 'remediation_practice') {
        const tid = attempt.target_tool_id;
        if (!tid) return;
        if (!remediationMap.has(tid)) {
          remediationMap.set(tid, { retry_count: 0, practice_count: 0, before_scores: [], after_scores: [] });
        }
        const entry = remediationMap.get(tid);
        if (attempt.attempt_type === 'remediation_retry') {
          entry.retry_count += 1;
          // parent_attempt 의 score 를 before 로
          if (attempt.parent_attempt_id) {
            const parent = attempts.find(a => a.id === attempt.parent_attempt_id);
            if (parent) entry.before_scores.push(parent.score || 0);
          }
        } else if (attempt.attempt_type === 'remediation_practice') {
          entry.practice_count += 1;
          entry.after_scores.push(attempt.score || 0);
        }
      }
    });

    const remediation_history = [...remediationMap.entries()].map(([tid, entry]) => ({
      tool_id: tid,
      tool_name: toolNameMap.get(tid)?.name || tid,
      retry_count: entry.retry_count,
      practice_count: entry.practice_count,
      before_avg: entry.before_scores.length > 0
        ? Math.round(entry.before_scores.reduce((s, x) => s + x, 0) / entry.before_scores.length)
        : 0,
      after_avg: entry.after_scores.length > 0
        ? Math.round(entry.after_scores.reduce((s, x) => s + x, 0) / entry.after_scores.length)
        : 0,
      improvement: entry.after_scores.length > 0 && entry.before_scores.length > 0
        ? Math.round(entry.after_scores.reduce((s, x) => s + x, 0) / entry.after_scores.length -
                   entry.before_scores.reduce((s, x) => s + x, 0) / entry.before_scores.length)
        : 0
    })).filter(r => r.retry_count > 0 || r.practice_count > 0);

    return Response.json({ student: target, attempts, weak_tools, strong_tools, remediation_history });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});