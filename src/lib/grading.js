// ──────────────────────────────────────────────
// 채점 공통 모듈 — ProblemSolve + ResultView 공유
// ──────────────────────────────────────────────

/** 채점 결과 JSON schema */
export const GRADING_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string', enum: ['v1'] },
    score: { type: 'integer', minimum: 0, maximum: 100 },
    correctness: { type: 'string', enum: ['correct', 'partial', 'wrong'] },
    summary: { type: 'string', description: '1-2 문장 한국어 격려+정정 요약. 해요체.' },
    step_feedback: {
      type: 'array',
      description: '학생 풀이의 매 step별 피드백',
      items: {
        type: 'object',
        properties: {
          step_number: { type: 'integer', minimum: 1 },
          matched_solution_step_number: {
            type: 'integer',
            description: '이 학생 step이 매칭된 별해의 어느 step(sequence_order)에 해당하는지. 매칭 안 되면 null. matched_solution_id가 null이면 항상 null.'
          },
          student_step: { type: 'string' },
          status: { type: 'string', enum: ['correct', 'partial', 'missing', 'wrong'] },
          comment: { type: 'string' },
          correction: { type: 'string' },
          tool_id: { type: 'string', description: '매칭된 별해 path의 step의 tool_id. matched_solution_step_number와 일치해야 함. 없으면 null.' }
        },
        required: ['step_number', 'student_step', 'status', 'comment']
      }
    },
    gap_locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          expected_step: { type: 'string' },
          tool_id: { type: 'string', description: '매칭된 별해의 path에서 매핑된 도구 ID. 불명확하면 null.' }
        },
        required: ['description', 'expected_step']
      }
    },
    error_locations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          student_wrote: { type: 'string' },
          correct_form: { type: 'string' },
          error_type: { type: 'string', enum: ['calculation', 'conceptual', 'notation'] },
          tool_id: { type: 'string', description: '매칭된 별해의 path에서 매핑된 도구 ID. 불명확하면 null.' }
        },
        required: ['description', 'student_wrote', 'correct_form', 'error_type']
      }
    },
    matched_solution_id: { type: 'string', description: '학생 풀이와 가장 가까운 별해 solution_id. 매칭 안 되면 null. 별해 0개면 null.' },
    matched_solution_priority: { type: 'integer', description: '매칭 별해의 priority (UI 표시용). 없으면 null.' },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    ocr_quality_concern: { type: 'string' }
  },
  required: ['schema_version', 'score', 'correctness', 'summary', 'step_feedback', 'gap_locations', 'error_locations', 'confidence']
};

/**
 * MathTool 배열 → prompt용 도구 블록 문자열
 * @param {Array} tools - MathTool 배열
 */
export function buildToolsBlock(tools) {
  if (!tools || tools.length === 0) return '(도구 정보 없음)';
  return tools.map(t =>
    `- tool_id: "${t.tool_id}"\n  name: "${t.name}"\n  goal: "${t.goal || ''}"`
  ).join('\n');
}

/**
 * Solution 배열 → prompt용 별해 블록 문자열
 * @param {Array} solutions - Solution 배열 (이미 slice된 최대 5개)
 * @param {Map} stepsBySolutionId - Map<solution_id, SolutionStep[]>
 * @param {Array} tools - MathTool 배열 (도구 이름 매핑용)
 */
export function buildSolutionsBlock(solutions, stepsBySolutionId, tools) {
  if (!solutions || solutions.length === 0) return '(별해 데이터 없음)';

  return solutions.map(sol => {
    let body;
    try {
      const blocks = JSON.parse(sol.contents || '[]');
      body = Array.isArray(blocks) ? blocks.map(b => b.text || '').join('\n\n') : String(sol.contents || '');
    } catch {
      body = sol.contents || '';
    }

    const steps = (stepsBySolutionId.get(sol.solution_id) || [])
      .slice()
      .sort((a, b) => a.sequence_order - b.sequence_order);

    const pathText = steps.map(s => {
      const toolName = (tools || []).find(t => t.tool_id === s.tool_id)?.name || s.tool_id;
      return `  Step ${s.sequence_order}: 도구="${s.tool_id}" (${toolName})
    선택사유: ${s.reason || ''}
    적용: ${s.application || ''}
    결과: ${s.appended_info || ''}`;
    }).join('\n');

    return `<solution priority="${sol.priority}" id="${sol.solution_id}">
<body>
${body}
</body>
<path>
${pathText}
</path>
</solution>`;
  }).join('\n\n');
}

/**
 * 채점 prompt 문자열 생성
 * @param {Object} params
 * @param {string} params.problemText
 * @param {string} params.verifiedAnswer
 * @param {string} params.solutionsBlock
 * @param {string} params.toolsBlock
 * @param {string} params.studentOcrSolution
 */
export function buildGradingPrompt({ problemText, verifiedAnswer, solutionsBlock, toolsBlock, studentOcrSolution }) {
  const answerText = verifiedAnswer || '(검증된 정답 없음)';
  return `당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생의 손글씨 풀이(OCR)를 받아, problem + verified_answer + 큐레이션된 별해 N개와
비교해 채점합니다. 출력은 GradingOutput JSON.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. 부정 표현 금지 ("틀렸어요" X)
3. 별해 매칭 — 학생 풀이가 <solutions> 안의 어느 별해와 가장 비슷한지 판정해
   matched_solution_id에 그 별해의 solution_id를 채워주세요. 어느 것과도 비슷하지 않으면 null.
   별해가 0개면 항상 null.
4. 정답 처리 — 학생이 매칭 별해의 path와 일치하면서 verified_answer에 도달하면 score 80+ (correct).
   사소한 계산/표기 오류는 허용. 개념적 오류만 score 크게 차감.
5. 오류 분류:
   - calculation = 산수/부호 오류 (소소)
   - conceptual = 개념/공식 오류 (큼)
   - notation = 표기 오류 (작음)
6. 할루시 방지 — 학생이 안 쓴 내용 추측 금지. 확신 없으면 confidence ↓
7. OCR 검증 — 의심스러우면 ocr_quality_concern에 명시
8. Actionable feedback — 모호한 표현 금지. 어느 자리/왜를 명시.
9. 매듭 매핑 — step_feedback/error_locations/gap_locations 의 tool_id는 반드시
   <available_tools> 안 ID만 사용. 매칭된 별해의 path 도구를 우선 매핑.
   불명확하면 null.
10. 학생 step → 정해 step 매핑 (매우 중요):
    - 정해 path는 N개의 step (Step 1 = 도구 X, Step 2 = 도구 Y, …)
    - 학생 풀이는 M개의 step. 일반적으로 N ≠ M.
    - 각 학생 step에 대해 어느 정해 step에 해당하는지 matched_solution_step_number 에 채우기 (1부터 시작, 매칭 안 되면 null).
    - 여러 학생 step이 같은 정해 step에 매핑 가능 (N:1).
    - tool_id는 반드시 매핑된 정해 step의 도구만 사용. 다른 도구 부여 금지.
    - matched_solution_id가 null이면 모든 step의 matched_solution_step_number도 null.

## 점수 기준
- 100 = 정답 + 풀이 완전
- 80-99 = 정답 + 사소 오류
- 60-79 = 정답 + 일부 누락
- 40-59 = 풀이 일부 + 정답 미도달
- 20-39 = 풀이 일부 + 다수 오류
- 1-19 = 형식만
- 0 = 풀이 없음

## 톤
정합: "잘 풀었어요!", "이 부분 다시 살펴볼까요?", "다른 방법도 시도해보세요"
금지: "틀렸어요", "X", "잘못했어요"

<problem>
${problemText}
</problem>

<verified_answer>
${answerText}
</verified_answer>

<solutions>
${solutionsBlock}
</solutions>

<available_tools>
${toolsBlock}
</available_tools>

학생 풀이가 어느 별해 path와 가장 가까운지 판정해 matched_solution_id에 채우고,
step_feedback[].tool_id 는 그 별해의 도구로 매핑하세요.

<student_ocr_solution>
${studentOcrSolution}
</student_ocr_solution>

위 학생 풀이를 GradingOutput 양식으로 채점해 주세요.`;
}

/**
 * LLM 채점 결과 sanitize — tool_id / solution_id 유효성 검증
 * @param {Object} result - LLM 응답 채점 결과 (원본 불변)
 * @param {Object} opts
 * @param {Set<string>} opts.validToolIds
 * @param {Set<string>} opts.validSolutionIds
 * @param {Map} opts.stepsBySolutionId
 * @returns {Object} 새 객체
 */
export function sanitizeGradingResult(result, { validToolIds, validSolutionIds, stepsBySolutionId }) {
  const sanitizeArr = (arr) => (arr || []).map(item => ({
    ...item,
    tool_id: validToolIds.has(item.tool_id) ? item.tool_id : null
  }));

  let sanitized = {
    ...result,
    step_feedback: sanitizeArr(result.step_feedback),
    error_locations: sanitizeArr(result.error_locations),
    gap_locations: sanitizeArr(result.gap_locations),
  };

  // matched_solution_id 검증
  if (!validSolutionIds.has(sanitized.matched_solution_id)) {
    sanitized = { ...sanitized, matched_solution_id: null, matched_solution_priority: null };
  }

  // matched_solution_step_number 검증
  const matchedSolId = sanitized.matched_solution_id;
  let validSolStepNums = new Set();
  if (matchedSolId) {
    const matchedSteps = stepsBySolutionId.get(matchedSolId) || [];
    validSolStepNums = new Set(matchedSteps.map(s => s.sequence_order));
  }
  sanitized = {
    ...sanitized,
    step_feedback: (sanitized.step_feedback || []).map(sf => ({
      ...sf,
      matched_solution_step_number: validSolStepNums.has(sf.matched_solution_step_number)
        ? sf.matched_solution_step_number
        : null,
    })),
  };

  return sanitized;
}