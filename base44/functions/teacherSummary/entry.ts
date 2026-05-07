import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── toolMastery 서버-사이드 재구현 (lib 공유 불가) ────────────────────────
function aggregateToolMastery(attempts, problemMap) {
  const masteryMap = new Map();

  for (const attempt of attempts) {
    const problem = problemMap.get(attempt.problem_id);
    if (!problem) continue;

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

    for (const toolId of toolIds) {
      if (!masteryMap.has(toolId)) masteryMap.set(toolId, { attempts: 0, correct_count: 0, scores: [] });
      const entry = masteryMap.get(toolId);
      entry.attempts += 1;
      entry.scores.push(attempt.score || 0);
      if ((attempt.score || 0) >= 80) entry.correct_count += 1;
    }
  }

  masteryMap.forEach(entry => {
    entry.avg_score = entry.scores.length > 0
      ? Math.round(entry.scores.reduce((s, x) => s + x, 0) / entry.scores.length)
      : 0;
  });

  return masteryMap;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const t_classes_start = Date.now();
    // Step 1: 내 담당 학급 찾기
    const [allClasses, allAcademies] = await Promise.all([
      base44.asServiceRole.entities.Class.list('name', 500),
      base44.asServiceRole.entities.Academy.list('name', 200),
    ]);
    const academyMap = new Map(allAcademies.map(a => [a.id, a]));
    const myClasses = allClasses.filter(c =>
      c.main_teacher_id === user.id ||
      (c.assistant_teacher_ids || []).includes(user.id)
    );
    const classes_ms = Date.now() - t_classes_start;

    if (myClasses.length === 0) {
      return Response.json({
        success: true,
        loaded_at: new Date().toISOString(),
        my_classes: [],
        my_students: [],
        attempts_summary: { total: 0, avg_score: 0, correct_rate: 0 },
        weak_tools: [],
        tool_distribution: [],
        timing: { classes_ms, students_ms: 0, attempts_ms: 0, mastery_ms: 0, total_ms: Date.now() - t0 },
      });
    }

    const t_students_start = Date.now();
    // Step 2: 학생 fetch (학급별 병렬)
    const studentArrays = await Promise.all(
      myClasses.map(c => base44.asServiceRole.entities.User.filter({ class_id: c.id }, '-created_date', 500))
    );
    const seen = new Set();
    const allStudents = studentArrays.flat().filter(u => seen.has(u.id) ? false : seen.add(u.id));
    const students_ms = Date.now() - t_students_start;

    if (allStudents.length === 0) {
      const my_classes = myClasses.map(c => ({
        id: c.id,
        name: c.name,
        academy_id: c.academy_id,
        academy_name: academyMap.get(c.academy_id)?.name || '—',
        main_teacher_id: c.main_teacher_id,
        assistant_teacher_ids: c.assistant_teacher_ids || [],
        student_count: 0,
        grade_range: c.grade_range || '',
      }));
      return Response.json({
        success: true,
        loaded_at: new Date().toISOString(),
        my_classes,
        my_students: [],
        attempts_summary: { total: 0, avg_score: 0, correct_rate: 0 },
        weak_tools: [],
        tool_distribution: [],
        timing: { classes_ms, students_ms, attempts_ms: 0, mastery_ms: 0, total_ms: Date.now() - t0 },
      });
    }

    // class_id → class_name 맵
    const classMap = new Map(myClasses.map(c => [c.id, c]));

    const t_attempts_start = Date.now();
    // Step 3: attempts fetch (학생별 병렬, 배치 20)
    const studentIds = allStudents.map(u => u.id);
    const BATCH = 20;
    const batches = [];
    for (let i = 0; i < studentIds.length; i += BATCH) batches.push(studentIds.slice(i, i + BATCH));

    const attemptArrays = await Promise.all(
      batches.map(batch =>
        Promise.all(batch.map(sid =>
          base44.asServiceRole.entities.StudentAttempt.filter({ student_id: sid }, '-submitted_at', 200)
        ))
      )
    );
    const allAttempts = attemptArrays.flat(2);
    const attempts_ms = Date.now() - t_attempts_start;

    const t_mastery_start = Date.now();

    // Step 4: Problem fetch (unique problem_ids only)
    const uniqueProblemIds = [...new Set(allAttempts.map(a => a.problem_id).filter(Boolean))];
    // 전체 list 후 필터 (SDK $in 미지원 — 문제 전체 fetch가 빠름, 1000개 한 번)
    const [allProblems, allTools] = await Promise.all([
      uniqueProblemIds.length > 0
        ? base44.asServiceRole.entities.Problem.list('-created_date', 5000)
        : Promise.resolve([]),
      base44.asServiceRole.entities.MathTool.list('name', 100),
    ]);

    const problemSet = new Set(uniqueProblemIds);
    const problemMap = new Map(
      allProblems.filter(p => problemSet.has(p.id)).map(p => [p.id, p])
    );
    const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));

    // Step 5: toolMastery 집계
    const masteryMap = aggregateToolMastery(allAttempts, problemMap);

    // weak_tools (Top 8, minSamples 2)
    const weak_tools = [];
    masteryMap.forEach((entry, toolId) => {
      if (entry.attempts < 2) return;
      const tool = toolNameMap.get(toolId);
      weak_tools.push({
        tool_id: toolId,
        name: tool?.name || tool?.name_en || toolId,
        attempts: entry.attempts,
        avg_score: entry.avg_score,
        correct_count: entry.correct_count,
      });
    });
    weak_tools.sort((a, b) => a.avg_score - b.avg_score);
    const top_weak = weak_tools.slice(0, 8);

    // tool_distribution (Top 10 by usage)
    const tool_distribution = [];
    masteryMap.forEach((entry, toolId) => {
      const tool = toolNameMap.get(toolId);
      tool_distribution.push({
        tool_id: toolId,
        name: tool?.name || tool?.name_en || toolId,
        attempts: entry.attempts,
        avg_score: entry.avg_score,
      });
    });
    tool_distribution.sort((a, b) => b.attempts - a.attempts);
    const top_dist = tool_distribution.slice(0, 10);

    // Step 6: student 통계 집계
    const attemptsByStudent = new Map();
    for (const a of allAttempts) {
      if (!attemptsByStudent.has(a.student_id)) attemptsByStudent.set(a.student_id, []);
      attemptsByStudent.get(a.student_id).push(a);
    }

    const my_students = allStudents.map(u => {
      const ua = attemptsByStudent.get(u.id) || [];
      const avg_score = ua.length > 0
        ? Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length)
        : 0;
      const correct_count = ua.filter(a => a.correctness === 'correct').length;
      const cls = classMap.get(u.class_id);
      return {
        id: u.id,
        full_name: u.full_name || '',
        email: u.email || '',
        class_id: u.class_id || '',
        class_name: cls?.name || '—',
        grade: cls?.grade_range || '',
        attempt_count: ua.length,
        avg_score,
        correct_count,
      };
    });

    // my_classes with student_count
    const studentCountByClass = new Map();
    for (const u of allStudents) {
      studentCountByClass.set(u.class_id, (studentCountByClass.get(u.class_id) || 0) + 1);
    }
    const my_classes = myClasses.map(c => ({
      id: c.id,
      name: c.name,
      academy_id: c.academy_id,
      academy_name: academyMap.get(c.academy_id)?.name || '—',
      main_teacher_id: c.main_teacher_id,
      assistant_teacher_ids: c.assistant_teacher_ids || [],
      student_count: studentCountByClass.get(c.id) || 0,
      grade_range: c.grade_range || '',
    }));

    // attempts_summary
    const total = allAttempts.length;
    const avg_score = total > 0
      ? Math.round(allAttempts.reduce((s, a) => s + (a.score || 0), 0) / total)
      : 0;
    const correct_rate = total > 0
      ? Math.round(allAttempts.filter(a => a.correctness === 'correct').length / total * 100)
      : 0;

    const mastery_ms = Date.now() - t_mastery_start;
    const total_ms = Date.now() - t0;

    return Response.json({
      success: true,
      loaded_at: new Date().toISOString(),
      my_classes,
      my_students,
      attempts_summary: { total, avg_score, correct_rate },
      weak_tools: top_weak,
      tool_distribution: top_dist,
      timing: { classes_ms, students_ms, attempts_ms, mastery_ms, total_ms },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});