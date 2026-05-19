import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── toolMastery 서버-사이드 재구현 (lib 공유 불가) ────────────────────────
function aggregateToolMastery(attempts, problemMap) {
  const masteryMap = new Map();

  for (const attempt of attempts) {
    const problem = problemMap.get(attempt.problem_id);
    if (!problem) continue;

    let toolIds = [];

    if (attempt.teacher_review_json) {
      try {
        const tr = JSON.parse(attempt.teacher_review_json);
        const judgments = tr.step_judgments || tr.step_edits || {};
        Object.values(judgments).forEach(j => {
          if ((j.status === 'wrong' || j.status === 'partial' || j.status === 'missing') && j.tool_id) {
            toolIds.push(j.tool_id);
          }
        });
        if (toolIds.length > 0) toolIds = [...new Set(toolIds)];
      } catch {}
    }

    if (toolIds.length === 0 && attempt.claude_grade_json) {
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
    if (user.role !== 'teacher' && user.role !== 'owner') {
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
        domain_summary: [],
        active_assignments: [],
        weak_or_unattempted_tools_by_class: {},
        domain_summary_by_class: {},
        type_summary_by_class: {},
        review_request_count: 0,
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
        domain_summary: [],
        active_assignments: [],
        weak_or_unattempted_tools_by_class: {},
        domain_summary_by_class: {},
        type_summary_by_class: {},
        review_request_count: 0,
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

    // Step 4: Problem + Tools + Assignments + Domains + Types + ProblemTypes 병렬
    const uniqueProblemIds = [...new Set(allAttempts.map(a => a.problem_id).filter(Boolean))];
    const [allProblems, allTools, assignmentArrays, allDomains, allTypes, allProblemTypes] = await Promise.all([
      uniqueProblemIds.length > 0
        ? base44.asServiceRole.entities.Problem.list('-created_date', 5000)
        : Promise.resolve([]),
      base44.asServiceRole.entities.MathTool.list('name', 500),
      Promise.all(
        myClasses.map(c =>
          base44.asServiceRole.entities.Assignment.filter({ class_id: c.id }, '-created_date', 100)
        )
      ),
      base44.asServiceRole.entities.Domain.list('grade_range', 200),
      base44.asServiceRole.entities.Type.list('name', 500),
      base44.asServiceRole.entities.ProblemType.list('-created_date', 10000),
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

    // Step 7: active_assignments 계산 (deadline 없는 active 포함)
    const now = Date.now();
    const DAY_MS = 86400000;
    const allAssignmentsFlat = assignmentArrays.flat();
    const active = allAssignmentsFlat.filter(a =>
      a.status === 'active' &&
      (!a.deadline || new Date(a.deadline).getTime() > now)
    );

    // assignment별 제출 통계
    const assignmentsByClass = new Map();
    for (const a of active) {
      if (!assignmentsByClass.has(a.class_id)) assignmentsByClass.set(a.class_id, []);
      assignmentsByClass.get(a.class_id).push(a);
    }

    // 학급별 학생 수 맵
    const studentCountByClass = new Map();
    const studentsByClass = new Map();
    for (const u of allStudents) {
      studentCountByClass.set(u.class_id, (studentCountByClass.get(u.class_id) || 0) + 1);
      if (!studentsByClass.has(u.class_id)) studentsByClass.set(u.class_id, []);
      studentsByClass.get(u.class_id).push(u);
    }

    // attempt별 assignment_id 인덱스
    const attemptsByAssignment = new Map();
    for (const a of allAttempts) {
      if (!a.assignment_id) continue;
      if (!attemptsByAssignment.has(a.assignment_id)) attemptsByAssignment.set(a.assignment_id, []);
      attemptsByAssignment.get(a.assignment_id).push(a);
    }

    const active_assignments = active.map(a => {
      const cls = classMap.get(a.class_id);
      const total_students = studentCountByClass.get(a.class_id) || 0;
      const assignAttempts = attemptsByAssignment.get(a.id) || [];
      const submittedSet = new Set(assignAttempts.map(x => x.student_id));
      const submitted_students = submittedSet.size;
      const scores = assignAttempts.map(x => x.score || 0);
      const avg_score = scores.length > 0
        ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length)
        : 0;
      const days_left = a.deadline
        ? Math.ceil((new Date(a.deadline).getTime() - now) / DAY_MS)
        : null;
      const progress_pct = total_students > 0
        ? Math.round(submitted_students / total_students * 100)
        : 0;
      return {
        id: a.id,
        title: a.title,
        class_id: a.class_id,
        class_name: cls?.name || '—',
        deadline: a.deadline,
        total_students,
        submitted_students,
        progress_pct,
        avg_score,
        days_left,
        submitted_student_ids: [...submittedSet],
      };
    });

    // Step 8: my_students — risk_flags 포함
    const myStudentIds = new Set(allStudents.map(u => u.id));
    const review_request_count = allAttempts.filter(a =>
      a.review_requested === true &&
      !a.review_resolved_at &&
      myStudentIds.has(a.student_id)
    ).length;

    const my_students = allStudents.map(u => {
      const ua = (attemptsByStudent.get(u.id) || [])
        .slice()
        .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
      const avg_score = ua.length > 0
        ? Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length)
        : 0;
      const correct_count = ua.filter(a => a.correctness === 'correct').length;
      const cls = classMap.get(u.class_id);

      // risk signals
      const last_attempt_at = ua.length > 0 ? (ua[0].submitted_at || null) : null;
      const days_since_last_attempt = last_attempt_at
        ? Math.floor((now - new Date(last_attempt_at).getTime()) / DAY_MS)
        : null;

      const recent10 = ua.slice(0, 10);
      const older10 = ua.slice(10, 20);
      const recent10_avg = recent10.length > 0
        ? Math.round(recent10.reduce((s, a) => s + (a.score || 0), 0) / recent10.length)
        : 0;
      const older10_avg = older10.length > 0
        ? Math.round(older10.reduce((s, a) => s + (a.score || 0), 0) / older10.length)
        : 0;
      const score_drop_delta = older10.length > 0 ? recent10_avg - older10_avg : 0;

      const risk_flags = [];
      if (last_attempt_at && days_since_last_attempt > 7) risk_flags.push('dormant');
      if (ua.length >= 20 && score_drop_delta < -20) risk_flags.push('score_drop');

      // homework_lag: days_left null인 숙제는 제외
      let homework_lag_info = null;
      const classAssignmentsForStudent = active_assignments.filter(a => a.class_id === u.class_id);
      for (const asn of classAssignmentsForStudent) {
        if (asn.days_left === null) continue;
        if (!asn.submitted_student_ids.includes(u.id) && asn.days_left <= 3) {
          risk_flags.push('homework_lag');
          homework_lag_info = {
            assignment_id: asn.id,
            assignment_title: asn.title,
            days_left: asn.days_left,
            progress_pct: asn.progress_pct,
          };
          break;
        }
      }

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
        last_attempt_at,
        days_since_last_attempt,
        score_drop_delta,
        risk_flags,
        homework_lag_info,
      };
    });

    // Step 9: my_classes with student_count
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

    // Step 10: domain_summary + domain_summary_by_class + type_summary_by_class
    const domainMapGlobal = new Map();
    const domainMapByClass = new Map();

    // type_summary_by_class 준비
    const typesByProblemId = new Map();
    for (const pt of allProblemTypes) {
      if (!typesByProblemId.has(pt.problem_id)) typesByProblemId.set(pt.problem_id, []);
      typesByProblemId.get(pt.problem_id).push(pt.type_id);
    }
    const typeNameMap = new Map(allTypes.map(t => [t.type_id, t.name]));
    const typeSumMapByClass = new Map();

    for (const a of allAttempts) {
      const d = a.problem_domain || '미분류';
      // global domain
      if (!domainMapGlobal.has(d)) domainMapGlobal.set(d, { sum: 0, count: 0 });
      const ge = domainMapGlobal.get(d);
      ge.sum += a.score || 0;
      ge.count += 1;

      const student = allStudents.find(u => u.id === a.student_id);
      if (!student?.class_id) continue;

      // domain by class
      if (!domainMapByClass.has(student.class_id)) domainMapByClass.set(student.class_id, new Map());
      const cm = domainMapByClass.get(student.class_id);
      if (!cm.has(d)) cm.set(d, { sum: 0, count: 0 });
      const ce = cm.get(d);
      ce.sum += a.score || 0;
      ce.count += 1;

      // type by class
      const problem = problemMap.get(a.problem_id);
      if (!problem) continue;
      const typeIds = typesByProblemId.get(problem.problem_id) || [];
      if (typeIds.length === 0) continue;
      if (!typeSumMapByClass.has(student.class_id)) typeSumMapByClass.set(student.class_id, new Map());
      const tcm = typeSumMapByClass.get(student.class_id);
      for (const tid of typeIds) {
        if (!tcm.has(tid)) tcm.set(tid, { sum: 0, count: 0 });
        const te = tcm.get(tid);
        te.sum += a.score || 0;
        te.count += 1;
      }
    }

    const domain_summary = [];
    domainMapGlobal.forEach((entry, name) => {
      domain_summary.push({ name, avg: Math.round(entry.sum / entry.count), count: entry.count });
    });
    domain_summary.sort((a, b) => b.count - a.count);

    const domain_summary_by_class = {};
    domainMapByClass.forEach((cm, classId) => {
      const arr = [];
      cm.forEach((entry, name) => {
        arr.push({ name, avg: Math.round(entry.sum / entry.count), count: entry.count });
      });
      arr.sort((a, b) => b.count - a.count);
      domain_summary_by_class[classId] = arr;
    });

    const type_summary_by_class = {};
    typeSumMapByClass.forEach((tcm, classId) => {
      const arr = [];
      tcm.forEach((entry, tid) => {
        arr.push({ type_id: tid, name: typeNameMap.get(tid) || tid, avg: Math.round(entry.sum / entry.count), count: entry.count });
      });
      arr.sort((a, b) => b.count - a.count);
      type_summary_by_class[classId] = arr;
    });

    // Step 11: weak_or_unattempted_tools_by_class (학급 학년 영역 한정)
    const studentAttemptedTools = new Map();
    for (const attempt of allAttempts) {
      const problem = problemMap.get(attempt.problem_id);
      if (!problem) continue;
      let toolIds = [];
      if (attempt.teacher_review_json) {
        try {
          const tr = JSON.parse(attempt.teacher_review_json);
          const judgments = tr.step_judgments || tr.step_edits || {};
          Object.values(judgments).forEach(j => {
            if ((j.status === 'wrong' || j.status === 'partial' || j.status === 'missing') && j.tool_id) {
              toolIds.push(j.tool_id);
            }
          });
          if (toolIds.length > 0) toolIds = [...new Set(toolIds)];
        } catch {}
      }
      if (toolIds.length === 0 && attempt.claude_grade_json) {
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
      if (!studentAttemptedTools.has(attempt.student_id)) {
        studentAttemptedTools.set(attempt.student_id, new Map());
      }
      const studentToolMap = studentAttemptedTools.get(attempt.student_id);
      for (const toolId of toolIds) {
        if (!studentToolMap.has(toolId)) studentToolMap.set(toolId, []);
        studentToolMap.get(toolId).push(attempt.score || 0);
      }
    }

    const weak_or_unattempted_tools_by_class = {};
    for (const cls of myClasses) {
      const classStudentList = studentsByClass.get(cls.id) || [];
      const total_student_count = classStudentList.length;
      if (total_student_count === 0) {
        weak_or_unattempted_tools_by_class[cls.id] = [];
        continue;
      }

      // 학급 학년 영역 도구만 후보
      const classGradeRange = cls.grade_range;
      const classDomainIds = new Set(
        classGradeRange
          ? allDomains.filter(d => d.grade_range === classGradeRange).map(d => d.domain_id)
          : []
      );

      const toolScoresByClass = new Map();
      for (const student of classStudentList) {
        const toolMap2 = studentAttemptedTools.get(student.id) || new Map();
        toolMap2.forEach((scores, toolId) => {
          if (!toolScoresByClass.has(toolId)) {
            toolScoresByClass.set(toolId, { scores: [], studentSet: new Set() });
          }
          const entry2 = toolScoresByClass.get(toolId);
          entry2.scores.push(...scores);
          entry2.studentSet.add(student.id);
        });
      }

      const toolEntries = [];
      allTools.forEach(tool => {
        let domain_ids = [];
        try {
          if (tool.domain_ids) domain_ids = JSON.parse(tool.domain_ids);
        } catch {}

        // 학급 학년 영역 한정 (grade_range 없으면 전체 허용)
        if (classDomainIds.size > 0) {
          const inGrade = domain_ids.some(d => classDomainIds.has(d));
          if (!inGrade) return;
        }

        const entry2 = toolScoresByClass.get(tool.tool_id);
        const attempted_student_count = entry2 ? entry2.studentSet.size : 0;
        const unattempted_count = total_student_count - attempted_student_count;
        const avg_sc = entry2 && entry2.scores.length > 0
          ? Math.round(entry2.scores.reduce((s, x) => s + x, 0) / entry2.scores.length)
          : 0;
        const priority_score = attempted_student_count > 0
          ? (100 - avg_sc) + (unattempted_count * 10)
          : 100 + unattempted_count * 10;

        toolEntries.push({
          tool_id: tool.tool_id,
          tool_name: tool.name || tool.name_en || tool.tool_id,
          domain_ids,
          attempted_student_count,
          total_student_count,
          unattempted_count,
          avg_score: avg_sc,
          priority_score,
        });
      });

      toolEntries.sort((a, b) => b.priority_score - a.priority_score);
      weak_or_unattempted_tools_by_class[cls.id] = toolEntries.slice(0, 30);
    }

    // attempts_summary
    const total = allAttempts.length;
    const avg_score_global = total > 0
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
      attempts_summary: { total, avg_score: avg_score_global, correct_rate },
      weak_tools: top_weak,
      tool_distribution: top_dist,
      domain_summary,
      active_assignments,
      weak_or_unattempted_tools_by_class,
      domain_summary_by_class,
      type_summary_by_class,
      review_request_count,
      timing: { classes_ms, students_ms, attempts_ms, mastery_ms, total_ms },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});