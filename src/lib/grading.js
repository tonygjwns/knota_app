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
 */
export function buildToolsBlock(tools) {
  if (!tools || tools.length === 0) return '(도구 정보 없음)';
  return tools.map(t =>
    `- tool_id: "${t.tool_id}"\n  name: "${t.name}"\n  goal: "${t.goal || ''}"`
  ).join('\n');
}

/**
 * Solution 배열 → prompt용 별해 블록 문자열
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
 * Stage 1: Fast Check — 학생 답안 이미지 vision → verified_answer 매칭
 * @param {string} answerImageUrl - 업로드된 답안 캔버스 이미지 URL
 * @param {string} verifiedAnswer - 검증된 정답 텍스트
 * @param {Function} llmInvoke - base44.integrations.Core.InvokeLLM
 * @returns {{ result: 'match'|'no_match'|'unclear', student_answer_text?: string, reason?: string }}
 */
export async function checkAnswerFast(answerImageUrl, verifiedAnswer, llmInvoke) {
  if (!answerImageUrl || !verifiedAnswer?.trim()) return { result: 'unclear' };

  const prompt = `이 학생이 손으로 쓴 답이 정답과 수학적으로 동등한지 판정해 주세요.

정답: ${verifiedAnswer.trim()}

학생이 손글씨로 쓴 답은 이미지로 첨부되어 있어요.

규칙:
- 동등한 표현 (0.5 = 1/2, x=2 = 2 = "x=2") → "match"
- 다른 값 → "no_match"
- 손글씨 인식 어려움 또는 불확실 → "unclear"

student_answer_text 에 학생이 쓴 답을 텍스트로 추출해 주세요 (LaTeX 표기 가능).

JSON 으로만 응답.`;

  const raw = await llmInvoke({
    prompt,
    file_urls: [answerImageUrl],
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        result: { type: 'string', enum: ['match', 'no_match', 'unclear'] },
        student_answer_text: { type: 'string', description: '학생이 쓴 답을 텍스트(LaTeX 가능)로 추출' },
        reason: { type: 'string' },
      },
      required: ['result'],
    },
  });
  return raw?.response ?? raw;
}

/**
 * Stage 2: 인식 오류 체크 — OCR 후 풀이가 정답에 도달했는가?
 */
export async function checkSolutionReachesAnswer({ problemText, ocrText, verifiedAnswer, studentAnswer }, llmInvoke) {
  const prompt = `학생의 풀이가 정답에 실제로 도달했는지 빠르게 판정해 주세요.

<problem>
${problemText}
</problem>

<verified_answer>
${verifiedAnswer || '(없음)'}
</verified_answer>

<student_answer_input>
${studentAnswer?.trim() || '(비어 있음)'}
</student_answer_input>

<student_solution_ocr>
${ocrText}
</student_solution_ocr>

규칙:
- 풀이상 최종 결과가 verified_answer 와 수학적으로 동등 → "reached"
- 풀이가 답에 도달 못 함 → "not_reached"
- 판단 불확실 → "unclear"

학생이 답안 input 에 오타를 적었더라도 풀이 자체가 정답에 도달했다면 reached.

JSON 만 응답.`;

  const raw = await llmInvoke({
    prompt,
    model: 'claude_sonnet_4_6',
    response_json_schema: {
      type: 'object',
      properties: {
        result: { type: 'string', enum: ['reached', 'not_reached', 'unclear'] },
        reason: { type: 'string' },
      },
      required: ['result'],
    },
  });
  return raw?.response ?? raw;
}

/**
 * 채점 prompt 문자열 생성
 */
export function buildGradingPrompt({ problemText, verifiedAnswer, solutionsBlock, toolsBlock, studentOcrSolution, studentAnswer }) {
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
9. 학생 step → 정해 step 매핑 (가장 중요):
    - 정해 path 는 N 개 step, 학생 풀이는 여러 줄로 구성됩니다.
    - **한 정해 step 에 대응하는 학생 풀이는 step_feedback 한 개로 합쳐서 출력하세요.**
      학생이 그 부분에 여러 줄을 썼다면 student_step 에 줄바꿈으로 합쳐 넣으세요.
      한 도구가 step_feedback 에 반복해서 등장하면 안 됩니다.
    - 각 항목의 matched_solution_step_number 를 정확히 채우는 것이 가장 중요합니다.
    - matched_solution_id 가 null 이면 모든 step 의 matched_solution_step_number 도 null.
10. tool_id 채우기:
    - tool_id 는 서버가 matched_solution_step_number 에서 자동으로 도출하므로,
      잘 모르겠으면 null 로 두세요.
    - matched_solution_id 가 null 인 케이스에서만 가장 가까운 도구를
      <available_tools> 에서 선택해 채워주세요.
11. 학생이 정해 path 와 다른 순서로 풀었더라도 step_feedback 항목 자체는
    학생이 쓴 순서로 출력하세요. matched_solution_step_number 만 정해 순서를 가리킵니다.
12. 학생이 도구의 이름을 명시적으로 쓰지 않더라도, 그 도구의 결과
    (공식·정리의 산물) 를 사용했다면 그 정해 step 에 매핑하세요.
13. 학생이 답안 input 칸에 적은 답이 있다면 참고하되, 풀이 자체를 우선 분석하세요.

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

<student_answer_input>
${studentAnswer || '(비어 있음)'}
</student_answer_input>

<student_ocr_solution>
${studentOcrSolution}
</student_ocr_solution>

위 학생 풀이를 GradingOutput 양식으로 채점해 주세요.`;
}

// ─── Status priority for merging ────────────────
const STATUS_PRIORITY = { wrong: 4, partial: 3, missing: 2, correct: 1 };

/**
 * 같은 matched_solution_step_number 를 가진 step_feedback 항목들을 1개로 병합.
 * null 인 항목은 각각 그대로 유지.
 * @param {Array} items - 원본 step_feedback 배열
 * @returns {Array} 병합된 배열 (step_number 오름차순)
 */
export function mergeStepFeedback(items) {
  const groups = new Map();
  const nullItems = [];

  for (const sf of items) {
    const key = sf.matched_solution_step_number;
    if (key === null || key === undefined) {
      nullItems.push(sf);
    } else {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sf);
    }
  }

  const merged = [];

  for (const [stepNum, arr] of groups) {
    arr.sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));
    const baseStepNumber = Math.min(...arr.map(x => x.step_number ?? 0));
    const joinedStudent = arr.map(x => x.student_step || '').filter(Boolean).join('\n');
    const worstStatus = arr.reduce((acc, x) => {
      const p = STATUS_PRIORITY[x.status] ?? 0;
      const accP = STATUS_PRIORITY[acc] ?? 0;
      return p > accP ? x.status : acc;
    }, 'correct');
    const seenComments = new Set();
    const joinedComment = arr.map(x => x.comment || '').filter(c => {
      if (!c || seenComments.has(c)) return false;
      seenComments.add(c);
      return true;
    }).join('\n');
    const firstCorrection = arr.find(x => x.correction)?.correction || '';

    merged.push({
      step_number: baseStepNumber,
      student_step: joinedStudent,
      status: worstStatus,
      comment: joinedComment,
      correction: firstCorrection,
      matched_solution_step_number: stepNum,
      tool_id: null, // Step 3 에서 결정
    });
  }

  for (const sf of nullItems) {
    merged.push({ ...sf, tool_id: sf.tool_id });
  }

  merged.sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));
  return merged;
}

/**
 * matched_solution_id 가 있을 때 step_feedback 각 항목의 tool_id 를
 * SolutionStep 데이터에서 결정적으로 도출 (override).
 * 매칭 실패 시 원본 LLM tool_id 를 validToolIds 로 검증.
 * @param {Array} mergedSteps - mergeStepFeedback 결과
 * @param {Array} matchedSteps - matched solution 의 SolutionStep[]
 * @param {Set} validToolIds
 * @param {Array} originalItems - sanitize 진입 전 원본 step_feedback (tool_id 참조용)
 * @returns {Array}
 */
export function deriveToolIdsFromMatchedSolution(mergedSteps, matchedSteps, validToolIds, originalItems) {
  const stepByOrder = new Map((matchedSteps || []).map(s => [s.sequence_order, s]));
  const hasMatchedSolution = matchedSteps && matchedSteps.length > 0;

  return mergedSteps.map(sf => {
    const stepNum = sf.matched_solution_step_number;
    if (hasMatchedSolution && stepByOrder.has(stepNum)) {
      return { ...sf, tool_id: stepByOrder.get(stepNum).tool_id };
    }
    // matched_solution_id 가 없거나 stepNum 매칭 실패 → 원본 LLM 값 검증
    const originalItem = (originalItems || []).find(x => x.step_number === sf.step_number);
    const originalToolId = originalItem?.tool_id;
    return { ...sf, tool_id: validToolIds.has(originalToolId) ? originalToolId : null };
  });
}

/**
 * LLM 채점 결과 sanitize — tool_id / solution_id 유효성 검증 + step 병합 + tool_id 결정적 도출
 * @param {Object} result - LLM 응답 채점 결과 (원본 불변)
 * @param {Object} opts
 * @param {Set<string>} opts.validToolIds
 * @param {Set<string>} opts.validSolutionIds
 * @param {Map} opts.stepsBySolutionId
 * @returns {Object} 새 객체
 */
export function sanitizeGradingResult(result, { validToolIds, validSolutionIds, stepsBySolutionId }) {
  // Step 1. matched_solution_id 검증
  let sanitized = { ...result };
  if (!validSolutionIds.has(sanitized.matched_solution_id)) {
    sanitized = { ...sanitized, matched_solution_id: null, matched_solution_priority: null };
  }

  const matchedSolId = sanitized.matched_solution_id;
  const matchedSteps = matchedSolId ? (stepsBySolutionId.get(matchedSolId) || []) : [];

  // Step 2. step_feedback 병합 (같은 matched_solution_step_number → 1개)
  const originalItems = result.step_feedback || [];
  const merged = mergeStepFeedback(originalItems);

  // Step 3. tool_id 결정적 도출
  const derivedSteps = deriveToolIdsFromMatchedSolution(merged, matchedSteps, validToolIds, originalItems);
  sanitized = { ...sanitized, step_feedback: derivedSteps };

  // Step 4. error_locations / gap_locations 의 tool_id
  const matchedSolToolIds = new Set(matchedSteps.map(s => s.tool_id).filter(Boolean));
  const allowedToolIds = matchedSolId ? matchedSolToolIds : validToolIds;

  const sanitizeAux = (arr) => (arr || []).map(item => ({
    ...item,
    tool_id: allowedToolIds.has(item.tool_id) ? item.tool_id : null,
  }));

  sanitized = {
    ...sanitized,
    error_locations: sanitizeAux(result.error_locations),
    gap_locations: sanitizeAux(result.gap_locations),
  };

  return sanitized;
}