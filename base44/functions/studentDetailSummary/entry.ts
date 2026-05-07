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

    return Response.json({ student: target, attempts, weak_tools, strong_tools });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});