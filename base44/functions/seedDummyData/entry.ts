import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DUMMY_OCR_MARKER = '더미 OCR 양식 — 합성 데이터입니다.';
const ACADEMY_NAME = 'KNOTA 테스트 학원';
const JOIN_CODE = 'TEST2026';

const TEACHER_PROFILES = [
  { email: 'dummy.teacher.1@knota.test', full_name: '더미 강사 1' },
  { email: 'dummy.teacher.2@knota.test', full_name: '더미 강사 2' },
];

const CLASS_DEFS = [
  { name: '중3-A반', grade_range: '9', teacherIdx: 0 },
  { name: '중3-B반', grade_range: '9', teacherIdx: 0 },
  { name: '고1-A반', grade_range: '10', teacherIdx: 1 },
];

// class_id assignment: [0,1]→중3-A반, [2,3]→중3-B반, [4,5]→고1-A반
const STUDENT_CLASS_MAP = [0, 0, 1, 1, 2, 2];

const BASE_PROFILES = [
  { avgTarget: 85, weakToolCount: 0 },
  { avgTarget: 80, weakToolCount: 1 },
  { avgTarget: 65, weakToolCount: 3 },
  { avgTarget: 60, weakToolCount: 4 },
  { avgTarget: 45, weakToolCount: 6 },
  { avgTarget: 35, weakToolCount: 8 },
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SUMMARIES_CORRECT = ['완벽하게 풀었어요! 풀이 과정도 깔끔해요.', '정확하게 풀었어요. 이 부분 잘 이해하고 있네요!', '훌륭해요! 모든 단계가 정합해요.'];
const SUMMARIES_PARTIAL = ['풀이 방향은 맞는데 마지막 단계를 다시 살펴볼까요?', '이 부분까지 잘 풀었어요. 계산 과정을 한 번 더 확인해 보세요.', '개념은 잘 잡았어요. 세부 계산 오류가 있어요.'];
const SUMMARIES_WRONG = ['풀이 방향을 다시 생각해볼까요? 힌트: 개념부터 확인해 보세요.', '이 부분 개념을 다시 한 번 살펴봐요. 같이 연습해 봐요!', '틀린 곳이 있어요. 기본 개념부터 차근차근 다시 해볼까요?'];
const STUDENT_STEPS = ['$x + y = 5$를 양변에 대입했어요', '$\\frac{dy}{dx} = 2x$로 미분했어요', '$\\int_{0}^{1} f(x)dx$ 를 계산했어요', '인수분해를 적용했어요: $(x+1)(x-1)$', '방정식을 정리했어요: $2x - 3 = 0$'];
const COMMENTS = ['이 단계 정확해요!', '이 부분 다시 살펴볼까요? 부호를 확인해 보세요.', '계산 과정은 맞지만 마지막 정리가 빠졌어요.', '개념 적용이 올바르지 않아요.', '잘 풀었어요!'];
const CORRECTIONS = ['$x = \\frac{3}{2}$', '$\\frac{d}{dx}(x^2) = 2x$', '$\\int x dx = \\frac{x^2}{2} + C$'];
const GAP_DESCS = ['등호 정리 단계가 빠졌어요', '적분 상수 C를 포함해야 해요', '부분분수 분해 단계가 누락됐어요', '치환 변수 환원 단계가 빠졌어요'];
const ERROR_DESCS = ['부호 오류: 음수를 양수로 잘못 계산했어요', '분모 계산이 잘못됐어요', '공식 적용이 틀렸어요', '계산 실수가 있어요'];

function makeGradeJson(score, correctness, toolIds, weakToolIds) {
  const overlapTools = toolIds.filter(id => weakToolIds.includes(id));
  const errorPool = overlapTools.length > 0 ? overlapTools : toolIds;
  let stepFeedback = [];
  if (correctness === 'correct') {
    stepFeedback = [1, 2, 3].map(n => ({ step_number: n, student_step: pick(STUDENT_STEPS), status: 'correct', comment: pick(COMMENTS.slice(0, 2)) }));
  } else if (correctness === 'partial') {
    stepFeedback = [
      { step_number: 1, student_step: pick(STUDENT_STEPS), status: 'correct', comment: pick(COMMENTS.slice(0, 1)) },
      { step_number: 2, student_step: pick(STUDENT_STEPS), status: 'partial', comment: pick(COMMENTS.slice(1, 3)) },
      { step_number: 3, student_step: pick(STUDENT_STEPS), status: 'wrong', comment: pick(COMMENTS.slice(3)), correction: pick(CORRECTIONS) },
    ];
  } else {
    stepFeedback = [
      { step_number: 1, student_step: pick(STUDENT_STEPS), status: 'partial', comment: pick(COMMENTS.slice(1, 3)) },
      { step_number: 2, student_step: pick(STUDENT_STEPS), status: 'wrong', comment: pick(COMMENTS.slice(3)), correction: pick(CORRECTIONS) },
      { step_number: 3, student_step: pick(STUDENT_STEPS), status: 'wrong', comment: pick(COMMENTS.slice(3)), correction: pick(CORRECTIONS) },
    ];
  }
  const gapCount = score < 70 ? rand(0, 2) : 0;
  const gapLocations = Array.from({ length: gapCount }, () => ({ description: pick(GAP_DESCS), expected_step: pick(CORRECTIONS), tool_id: errorPool.length > 0 ? pick(errorPool) : null }));
  const errCount = score < 80 ? rand(0, score < 50 ? 3 : 2) : 0;
  const errorTypes = ['calculation', 'conceptual', 'notation'];
  const errorLocations = Array.from({ length: errCount }, () => {
    const typeWeights = score < 50 ? [1, 3, 1] : [2, 1, 1];
    const typePool = [];
    errorTypes.forEach((t, i) => { for (let j = 0; j < typeWeights[i]; j++) typePool.push(t); });
    return { description: pick(ERROR_DESCS), student_wrote: pick(STUDENT_STEPS), correct_form: pick(CORRECTIONS), error_type: pick(typePool), tool_id: errorPool.length > 0 ? pick(errorPool) : null };
  });
  const altSolution = score < 60 && Math.random() < 0.3 ? '이런 방법으로도 풀 수 있어요: 양변을 나누면 $x = \\frac{b}{a}$ 형태로 정리할 수 있어요.' : null;
  const ocrQualityConcern = Math.random() < 0.05 ? '필기 일부가 불명확해서 인식에 오류가 있을 수 있어요.' : null;
  const summaryPool = correctness === 'correct' ? SUMMARIES_CORRECT : correctness === 'partial' ? SUMMARIES_PARTIAL : SUMMARIES_WRONG;
  return { schema_version: 'v1', score, correctness, summary: pick(summaryPool), step_feedback: stepFeedback, gap_locations: gapLocations, error_locations: errorLocations, alternative_solution: altSolution, confidence: rand(70, 95), ocr_quality_concern: ocrQualityConcern };
}

function computeScore(baseAvg, problemToolIds, weakToolIds) {
  const overlap = problemToolIds.filter(id => weakToolIds.includes(id)).length;
  return clamp(baseAvg - overlap * 15 + rand(-10, 10), 0, 100);
}

function scoreToCorrectness(score) {
  if (score >= 80) return 'correct';
  if (score >= 40) return 'partial';
  return 'wrong';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const count = Math.min(body.count ?? 6, 20);
    const minAttempts = body.attemptsPerStudent?.min ?? 15;
    const maxAttempts = body.attemptsPerStudent?.max ?? 25;
    const reset = body.reset === true;
    const dryRun = body.dry_run === true;
    const assignSelf = body.assign_self === true; // 내 계정을 중3-A반 강사로 배정

    const profiles = Array.from({ length: count }, (_, i) => {
      const base = BASE_PROFILES[i % BASE_PROFILES.length];
      return { ...base, name: `더미 학생 ${i + 1}`, email: `dummy.student.${i + 1}@knota.test` };
    });

    // ── dry_run ────────────────────────────────────────────────
    if (dryRun) {
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      const existingDummy = allUsers.filter(u => u.email?.endsWith('@knota.test'));
      const allAttempts = await base44.asServiceRole.entities.StudentAttempt.list('-submitted_at', 1000);
      const dummyAttempts = allAttempts.filter(a => a.ocr_text?.startsWith(DUMMY_OCR_MARKER));
      const allAcademies = await base44.asServiceRole.entities.Academy.list('name', 100);
      const testAcademy = allAcademies.find(a => a.name === ACADEMY_NAME);
      const allClasses = testAcademy
        ? await base44.asServiceRole.entities.Class.filter({ academy_id: testAcademy.id }, 'name', 50)
        : [];
      return Response.json({
        dry_run: true,
        existing_dummy_users: existingDummy.length,
        existing_dummy_attempts: dummyAttempts.length,
        existing_academy: testAcademy ? { id: testAcademy.id, name: testAcademy.name } : null,
        existing_classes: allClasses.map(c => c.name),
        plan: {
          students_to_create: count,
          attempts_per_student_range: [minAttempts, maxAttempts],
          estimated_total_attempts: `${count * minAttempts}~${count * maxAttempts}`,
          reset_on_run: reset,
        },
        profiles: profiles.map(p => ({ email: p.email, avg_target: p.avgTarget, weak_tools_count: p.weakToolCount })),
      });
    }

    // ── assign_self: 중3-A반 teacher_id 를 현재 admin 으로 교체 ──
    if (assignSelf) {
      const allAcademies = await base44.asServiceRole.entities.Academy.list('name', 100);
      const testAcademy = allAcademies.find(a => a.name === ACADEMY_NAME);
      if (!testAcademy) return Response.json({ error: '테스트 학원이 없어요. 먼저 더미 환경을 생성해 주세요.' }, { status: 400 });
      const allClasses = await base44.asServiceRole.entities.Class.filter({ academy_id: testAcademy.id }, 'name', 50);
      const targetClass = allClasses.find(c => c.name === '중3-A반');
      if (!targetClass) return Response.json({ error: '중3-A반 학급을 찾을 수 없어요.' }, { status: 400 });
      await base44.asServiceRole.entities.Class.update(targetClass.id, { teacher_id: user.id });
      return Response.json({ success: true, updated_class: targetClass.name, new_teacher_id: user.id });
    }

    // ── reset: 삭제 순서: StudentAttempt → Class → User → Academy ──
    if (reset) {
      const allAttempts = await base44.asServiceRole.entities.StudentAttempt.list('-submitted_at', 2000);
      const dummyAttempts = allAttempts.filter(a => a.ocr_text?.startsWith(DUMMY_OCR_MARKER));
      for (const a of dummyAttempts) {
        await base44.asServiceRole.entities.StudentAttempt.delete(a.id);
      }
      const allAcademies = await base44.asServiceRole.entities.Academy.list('name', 100);
      const testAcademy = allAcademies.find(a => a.name === ACADEMY_NAME);
      if (testAcademy) {
        const classes = await base44.asServiceRole.entities.Class.filter({ academy_id: testAcademy.id }, 'name', 100);
        for (const c of classes) {
          await base44.asServiceRole.entities.Class.delete(c.id);
        }
      }
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      const dummyUsers = allUsers.filter(u => u.email?.endsWith('@knota.test'));
      for (const u of dummyUsers) {
        await base44.asServiceRole.entities.User.delete(u.id);
      }
      if (testAcademy) {
        await base44.asServiceRole.entities.Academy.delete(testAcademy.id);
      }
    }

    // ── A-1. Academy ───────────────────────────────────────────
    const allAcademies = await base44.asServiceRole.entities.Academy.list('name', 100);
    let academy = allAcademies.find(a => a.name === ACADEMY_NAME);
    let academyCreated = false;
    if (!academy) {
      academy = await base44.asServiceRole.entities.Academy.create({
        name: ACADEMY_NAME,
        owner_id: user.id,
        join_code: JOIN_CODE,
      });
      academyCreated = true;
    }

    // ── A-2. Teachers ──────────────────────────────────────────
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    const userByEmail = new Map(allUsers.map(u => [u.email, u]));

    const teacherRecords = [];
    for (const tp of TEACHER_PROFILES) {
      let teacherCreated = false;
      let t = userByEmail.get(tp.email);
      if (!t) {
        t = await base44.asServiceRole.entities.User.create({
          email: tp.email,
          full_name: tp.full_name,
          role: 'teacher',
          approval_status: 'approved',
          academy_id: academy.id,
        });
        teacherCreated = true;
      } else {
        await base44.asServiceRole.entities.User.update(t.id, { role: 'teacher', academy_id: academy.id });
      }
      teacherRecords.push({ id: t.id, email: tp.email, created: teacherCreated });
    }

    // ── A-3. Classes ───────────────────────────────────────────
    const existingClasses = await base44.asServiceRole.entities.Class.filter({ academy_id: academy.id }, 'name', 50);
    const classByName = new Map(existingClasses.map(c => [c.name, c]));

    const classRecords = [];
    for (const cd of CLASS_DEFS) {
      const teacherId = teacherRecords[cd.teacherIdx].id;
      let cls = classByName.get(cd.name);
      let classCreated = false;
      if (!cls) {
        cls = await base44.asServiceRole.entities.Class.create({
          name: cd.name,
          academy_id: academy.id,
          teacher_id: teacherId,
          grade_range: cd.grade_range,
        });
        classCreated = true;
      }
      classRecords.push({ id: cls.id, name: cd.name, teacher_email: TEACHER_PROFILES[cd.teacherIdx].email, student_count: 0, created: classCreated });
    }

    // ── A-4. Students + attempts ───────────────────────────────
    const [allProblems, allTools, freshUsers] = await Promise.all([
      base44.asServiceRole.entities.Problem.list('-created_date', 1000),
      base44.asServiceRole.entities.MathTool.list('name', 100),
      base44.asServiceRole.entities.User.list('-created_date', 1000),
    ]);

    if (allProblems.length === 0) {
      return Response.json({ error: '문제 데이터가 없어요. 먼저 KNOTA 데이터를 Import 해주세요.' }, { status: 400 });
    }

    const allToolIds = allTools.map(t => t.tool_id).filter(Boolean);
    const freshByEmail = new Map(freshUsers.map(u => [u.email, u]));

    let studentsCreated = 0;
    let studentsSkipped = 0;
    const studentRecords = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const classIdx = STUDENT_CLASS_MAP[i % STUDENT_CLASS_MAP.length];
      const classId = classRecords[classIdx].id;
      const shuffled = [...allToolIds].sort(() => Math.random() - 0.5);
      const weakToolIds = shuffled.slice(0, profile.weakToolCount);

      let existing = freshByEmail.get(profile.email);
      if (existing) {
        // 재배정
        await base44.asServiceRole.entities.User.update(existing.id, {
          role: 'student',
          approval_status: 'approved',
          academy_id: academy.id,
          class_id: classId,
        });
        studentsSkipped++;
        studentRecords.push({ email: profile.email, studentId: existing.id, profile, weakToolIds, classIdx });
        classRecords[classIdx].student_count++;
        continue;
      }

      let studentId;
      try {
        const created = await base44.asServiceRole.entities.User.create({
          email: profile.email,
          full_name: profile.name,
          role: 'student',
          approval_status: 'approved',
          academy_id: academy.id,
          class_id: classId,
        });
        studentId = created.id;
        studentsCreated++;
      } catch {
        studentId = `dummy-student-${i}-${Date.now()}`;
        studentsCreated++;
      }
      studentRecords.push({ email: profile.email, studentId, profile, weakToolIds, classIdx });
      classRecords[classIdx].student_count++;
    }

    // ── Attempts ───────────────────────────────────────────────
    let attemptsCreated = 0;
    for (const { email, studentId, profile, weakToolIds } of studentRecords) {
      const numAttempts = rand(minAttempts, maxAttempts);
      for (let i = 0; i < numAttempts; i++) {
        const problem = pick(allProblems);
        let problemToolIds = [];
        try {
          const parsed = JSON.parse(problem.tool_ids || '[]');
          if (Array.isArray(parsed)) problemToolIds = parsed.filter(Boolean);
        } catch {}

        const score = computeScore(profile.avgTarget, problemToolIds, weakToolIds);
        const correctness = scoreToCorrectness(score);
        const daysAgo = rand(1, 30);
        const extraSecs = rand(60, 300);
        const startedAt = new Date(Date.now() - daysAgo * 86400000 - extraSecs * 1000).toISOString();
        const durationSec = rand(60, 300);
        const submittedAt = new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString();
        const gradeJson = makeGradeJson(score, correctness, problemToolIds, weakToolIds);

        let problemContent = '';
        try {
          const arr = typeof problem.content === 'string' ? JSON.parse(problem.content) : problem.content;
          problemContent = Array.isArray(arr) ? arr.map(b => b.text).join(' ').slice(0, 200) : String(problem.content).slice(0, 200);
        } catch {
          problemContent = String(problem.content || '').slice(0, 200);
        }

        await base44.asServiceRole.entities.StudentAttempt.create({
          student_id: studentId,
          student_email: email,
          problem_id: problem.id,
          problem_content: problemContent,
          problem_domain: problem.domain_name || '',
          ocr_text: DUMMY_OCR_MARKER,
          claude_grade_json: JSON.stringify(gradeJson),
          score,
          correctness,
          started_at: startedAt,
          submitted_at: submittedAt,
          duration_sec: durationSec,
          admin_review_status: Math.random() < 0.1 ? 'ok' : null,
        });
        attemptsCreated++;
      }
    }

    return Response.json({
      success: true,
      academy: { id: academy.id, name: academy.name, created: academyCreated },
      teachers: teacherRecords,
      classes: classRecords,
      students: { created: studentsCreated, skipped: studentsSkipped },
      attempts_created: attemptsCreated,
      profiles: profiles.map(p => ({ email: p.email, avg_target: p.avgTarget, weak_tools_count: p.weakToolCount })),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});