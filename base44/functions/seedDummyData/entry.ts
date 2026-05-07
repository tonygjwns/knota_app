import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DUMMY_OCR_MARKER = '더미 OCR 양식 — 합성 데이터입니다.';

// 6 student profiles
const BASE_PROFILES = [
  { name: '더미 학생 1', avgTarget: 85, weakToolCount: 0 },
  { name: '더미 학생 2', avgTarget: 80, weakToolCount: 1 },
  { name: '더미 학생 3', avgTarget: 65, weakToolCount: 3 },
  { name: '더미 학생 4', avgTarget: 60, weakToolCount: 4 },
  { name: '더미 학생 5', avgTarget: 45, weakToolCount: 6 },
  { name: '더미 학생 6', avgTarget: 35, weakToolCount: 8 },
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const SUMMARIES_CORRECT = [
  '완벽하게 풀었어요! 풀이 과정도 깔끔해요.',
  '정확하게 풀었어요. 이 부분 잘 이해하고 있네요!',
  '훌륭해요! 모든 단계가 정합해요.',
];
const SUMMARIES_PARTIAL = [
  '풀이 방향은 맞는데 마지막 단계를 다시 살펴볼까요?',
  '이 부분까지 잘 풀었어요. 계산 과정을 한 번 더 확인해 보세요.',
  '개념은 잘 잡았어요. 세부 계산 오류가 있어요.',
];
const SUMMARIES_WRONG = [
  '풀이 방향을 다시 생각해볼까요? 힌트: 개념부터 확인해 보세요.',
  '이 부분 개념을 다시 한 번 살펴봐요. 같이 연습해 봐요!',
  '틀린 곳이 있어요. 기본 개념부터 차근차근 다시 해볼까요?',
];

const STUDENT_STEPS = [
  '$x + y = 5$를 양변에 대입했어요',
  '$\\frac{dy}{dx} = 2x$로 미분했어요',
  '$\\int_{0}^{1} f(x)dx$ 를 계산했어요',
  '인수분해를 적용했어요: $(x+1)(x-1)$',
  '방정식을 정리했어요: $2x - 3 = 0$',
];
const COMMENTS = [
  '이 단계 정확해요!',
  '이 부분 다시 살펴볼까요? 부호를 확인해 보세요.',
  '계산 과정은 맞지만 마지막 정리가 빠졌어요.',
  '개념 적용이 올바르지 않아요.',
  '잘 풀었어요!',
];
const CORRECTIONS = [
  '$x = \\frac{3}{2}$',
  '$\\frac{d}{dx}(x^2) = 2x$',
  '$\\int x dx = \\frac{x^2}{2} + C$',
];
const GAP_DESCS = [
  '등호 정리 단계가 빠졌어요',
  '적분 상수 C를 포함해야 해요',
  '부분분수 분해 단계가 누락됐어요',
  '치환 변수 환원 단계가 빠졌어요',
];
const ERROR_DESCS = [
  '부호 오류: 음수를 양수로 잘못 계산했어요',
  '분모 계산이 잘못됐어요',
  '공식 적용이 틀렸어요',
  '계산 실수가 있어요',
];

function makeGradeJson(score, correctness, toolIds, weakToolIds) {
  const overlapTools = toolIds.filter(id => weakToolIds.includes(id));
  const errorPool = overlapTools.length > 0 ? overlapTools : toolIds;

  // step_feedback
  let stepFeedback = [];
  if (correctness === 'correct') {
    stepFeedback = [1, 2, 3].map(n => ({
      step_number: n,
      student_step: pick(STUDENT_STEPS),
      status: 'correct',
      comment: pick(COMMENTS.slice(0, 2)),
    }));
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

  // gap_locations (score < 70)
  const gapCount = score < 70 ? rand(0, 2) : 0;
  const gapLocations = Array.from({ length: gapCount }, () => ({
    description: pick(GAP_DESCS),
    expected_step: pick(CORRECTIONS),
    tool_id: errorPool.length > 0 ? pick(errorPool) : null,
  }));

  // error_locations (score < 80)
  const errCount = score < 80 ? rand(0, score < 50 ? 3 : 2) : 0;
  const errorTypes = ['calculation', 'conceptual', 'notation'];
  const errorLocations = Array.from({ length: errCount }, () => {
    // lower score → more conceptual
    const typeWeights = score < 50 ? [1, 3, 1] : [2, 1, 1];
    const typePool = [];
    errorTypes.forEach((t, i) => { for (let j = 0; j < typeWeights[i]; j++) typePool.push(t); });
    return {
      description: pick(ERROR_DESCS),
      student_wrote: pick(STUDENT_STEPS),
      correct_form: pick(CORRECTIONS),
      error_type: pick(typePool),
      tool_id: errorPool.length > 0 ? pick(errorPool) : null,
    };
  });

  // alternative_solution (score < 60, 30% chance)
  const altSolution = score < 60 && Math.random() < 0.3
    ? '이런 방법으로도 풀 수 있어요: 양변을 나누면 $x = \\frac{b}{a}$ 형태로 정리할 수 있어요.'
    : null;

  // ocr_quality_concern (5% chance)
  const ocrQualityConcern = Math.random() < 0.05
    ? '필기 일부가 불명확해서 인식에 오류가 있을 수 있어요.'
    : null;

  const summaryPool = correctness === 'correct' ? SUMMARIES_CORRECT
    : correctness === 'partial' ? SUMMARIES_PARTIAL
    : SUMMARIES_WRONG;

  return {
    schema_version: 'v1',
    score,
    correctness,
    summary: pick(summaryPool),
    step_feedback: stepFeedback,
    gap_locations: gapLocations,
    error_locations: errorLocations,
    alternative_solution: altSolution,
    confidence: rand(70, 95),
    ocr_quality_concern: ocrQualityConcern,
  };
}

function computeScore(baseAvg, problemToolIds, weakToolIds) {
  const overlap = problemToolIds.filter(id => weakToolIds.includes(id)).length;
  const raw = baseAvg - overlap * 15 + rand(-10, 10);
  return clamp(raw, 0, 100);
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

    // Build profiles for requested count
    const profiles = Array.from({ length: count }, (_, i) => {
      const base = BASE_PROFILES[i % BASE_PROFILES.length];
      return { ...base, name: `더미 학생 ${i + 1}`, email: `dummy.student.${i + 1}@knota.test` };
    });

    if (dryRun) {
      // Fetch existing dummy users
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      const existingDummy = allUsers.filter(u => u.email?.endsWith('@knota.test'));
      const allAttempts = await base44.asServiceRole.entities.StudentAttempt.list('-submitted_at', 1000);
      const dummyAttempts = allAttempts.filter(a => a.ocr_text?.startsWith(DUMMY_OCR_MARKER));
      return Response.json({
        dry_run: true,
        existing_dummy_users: existingDummy.length,
        existing_dummy_attempts: dummyAttempts.length,
        plan: {
          students_to_create: count,
          attempts_per_student_range: [minAttempts, maxAttempts],
          estimated_total_attempts: `${count * minAttempts}~${count * maxAttempts}`,
          reset_on_run: reset,
        },
        profiles: profiles.map(p => ({ email: p.email, avg_target: p.avgTarget, weak_tools_count: p.weakToolCount })),
      });
    }

    // --- Real run ---

    // 1. Reset if requested
    if (reset) {
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      const dummyUsers = allUsers.filter(u => u.email?.endsWith('@knota.test'));
      for (const u of dummyUsers) {
        await base44.asServiceRole.entities.User.delete(u.id);
      }
      const allAttempts = await base44.asServiceRole.entities.StudentAttempt.list('-submitted_at', 1000);
      const dummyAttempts = allAttempts.filter(a => a.ocr_text?.startsWith(DUMMY_OCR_MARKER));
      for (const a of dummyAttempts) {
        await base44.asServiceRole.entities.StudentAttempt.delete(a.id);
      }
    }

    // 2. Fetch problems and tools
    const [allProblems, allTools, currentUsers] = await Promise.all([
      base44.asServiceRole.entities.Problem.list('-created_date', 1000),
      base44.asServiceRole.entities.MathTool.list('name', 100),
      base44.asServiceRole.entities.User.list('-created_date', 1000),
    ]);

    if (allProblems.length === 0) {
      return Response.json({ error: '문제 데이터가 없어요. 먼저 KNOTA 데이터를 Import 해주세요.' }, { status: 400 });
    }

    const allToolIds = allTools.map(t => t.tool_id).filter(Boolean);

    // 3. Create students
    const existingDummyEmails = new Set(currentUsers.filter(u => u.email?.endsWith('@knota.test')).map(u => u.email));
    let studentsCreated = 0;
    let studentsSkipped = 0;
    const studentRecords = []; // { email, studentId, profile, weakToolIds }

    for (const profile of profiles) {
      // Assign weak tools (shuffle allToolIds, pick N)
      const shuffled = [...allToolIds].sort(() => Math.random() - 0.5);
      const weakToolIds = shuffled.slice(0, profile.weakToolCount);

      if (existingDummyEmails.has(profile.email) && !reset) {
        // Find existing user id
        const existing = currentUsers.find(u => u.email === profile.email);
        studentRecords.push({ email: profile.email, studentId: existing?.id ?? `dummy-${profile.email}`, profile, weakToolIds });
        studentsSkipped++;
        continue;
      }

      // Create user
      let studentId;
      try {
        const created = await base44.asServiceRole.entities.User.create({
          email: profile.email,
          full_name: profile.name,
          role: 'user',
          approval_status: 'approved',
        });
        studentId = created.id;
        studentsCreated++;
      } catch {
        // Fallback: use synthetic id
        studentId = `dummy-student-${profile.email}-${Date.now()}`;
        studentsCreated++;
      }
      studentRecords.push({ email: profile.email, studentId, profile, weakToolIds });
    }

    // 4. Create attempts
    let attemptsCreated = 0;
    let sampleAttemptId = null;

    for (const { email, studentId, profile, weakToolIds } of studentRecords) {
      const numAttempts = rand(minAttempts, maxAttempts);
      for (let i = 0; i < numAttempts; i++) {
        const problem = pick(allProblems);

        // Parse tool_ids
        let problemToolIds = [];
        try {
          const parsed = JSON.parse(problem.tool_ids || '[]');
          if (Array.isArray(parsed)) problemToolIds = parsed.filter(Boolean);
        } catch {}

        // Compute score
        const score = computeScore(profile.avgTarget, problemToolIds, weakToolIds);
        const correctness = scoreToCorrectness(score);

        // Synthetic timestamps: started 1-30 days ago
        const daysAgo = rand(1, 30);
        const extraSecs = rand(60, 300);
        const startedAt = new Date(Date.now() - daysAgo * 86400000 - extraSecs * 1000).toISOString();
        const durationSec = rand(60, 300);
        const submittedAt = new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString();

        // Synthetic grade JSON
        const gradeJson = makeGradeJson(score, correctness, problemToolIds, weakToolIds);

        // Problem content (first 200 chars)
        let problemContent = '';
        try {
          const arr = typeof problem.content === 'string' ? JSON.parse(problem.content) : problem.content;
          problemContent = Array.isArray(arr) ? arr.map(b => b.text).join(' ').slice(0, 200) : String(problem.content).slice(0, 200);
        } catch {
          problemContent = String(problem.content || '').slice(0, 200);
        }

        const attempt = await base44.asServiceRole.entities.StudentAttempt.create({
          student_id: studentId,
          student_email: email,
          problem_id: problem.id,
          problem_content: problemContent,
          problem_domain: problem.domain_name || '',
          canvas_image_url: null,
          photo_url: null,
          ocr_text: DUMMY_OCR_MARKER,
          ocr_corrected_text: null,
          claude_grade_json: JSON.stringify(gradeJson),
          score,
          correctness,
          started_at: startedAt,
          submitted_at: submittedAt,
          duration_sec: durationSec,
          admin_review_status: Math.random() < 0.1 ? 'ok' : null,
        });

        attemptsCreated++;
        if (!sampleAttemptId) sampleAttemptId = attempt.id;
      }
    }

    return Response.json({
      success: true,
      students_created: studentsCreated,
      students_skipped: studentsSkipped,
      attempts_created: attemptsCreated,
      profiles: profiles.map(p => ({ email: p.email, avg_target: p.avgTarget, weak_tools_count: p.weakToolCount })),
      sample_attempt_id: sampleAttemptId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});