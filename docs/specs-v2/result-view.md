# 채점 결과 화면 (ResultView)

학생이 풀이를 제출한 후 채점 결과를 보고, 다음 행동을 결정하는 화면.

Submission Pipeline 의 마지막 단계이자, 매듭 보강 / 숙제 흐름의 분기점.

---

## 1. 큰 그림

### 1.1 한 문장으로

> 점수 보고 → 단계별 피드백 확인 → OCR 잘못됐으면 수정해서 재채점 → 다음 문제 / 메인 / 매듭 보강 중 선택

### 1.2 누가 사용?

| 사용자 | 사용 가능 여부 |
|---|---|
| **student** | 자기 시도 결과만 |
| **admin** | 모든 학생의 결과 (spot-check 검토용) |
| **teacher** | (현재 별도 진입점 없음 — admin 이 검토 권한 가짐) |

---

## 1.A 학생 입장에서 보는 모습

### 진입 — 풀이 제출 후 자동

```
[ProblemSolve 의 제출]
   ↓
[OCR + 채점 (10~15초)]
   ↓
navigate(`/result/:attemptId`)
   ↓
[ResultView]
```

### 결과 화면 전체 구조

```
┌─ ← 홈으로 ───────────────────────────────┐
│                                          │
│ ┌─ 점수 카드 ─────────────────────┐       │
│ │      85점                         │       │
│ │      잘했어요!                     │       │
│ │   {AI 한 줄 요약}                  │       │
│ └────────────────────────┘       │
│                                          │
│ 이 문제에 사용된 도구                       │
│ [등식의 가감법] [이항] [부호 정리] (Chip)    │
│                                          │
│ ┌─ (선택) 필기 인식 의문 경고 ────────┐    │
│ │ ⚠️ 필기 인식에 의문이 있어요          │    │
│ │ {AI 가 쓴 우려 사항}                  │    │
│ └────────────────────────┘    │
│                                          │
│ ┌─ (선택) 채점 자신감 부족 경고 ─────┐    │
│ │ ⚠️ 채점 자신감이 낮아요 (68점)       │    │
│ │ 관리자가 검토할 거예요                │    │
│ └────────────────────────┘    │
│                                          │
│ 단계별 피드백                              │
│ ┌─ Step 1 [정답]  ✓  ─────────────┐   │
│ │ 학생 풀이 요약                       │   │
│ │ ▼                                  │   │
│ │ (확장) 학생 풀이 (LaTeX)              │   │
│ │ (확장) 피드백                        │   │
│ │ (확장) 정정                          │   │
│ └────────────────────────┘   │
│ ┌─ Step 2 [부분]  △  ─────────────┐   │
│ │ ...                                │   │
│ └────────────────────────┘   │
│                                          │
│ 빠진 단계                                 │
│ ┌─ amber 카드 ─────────────────┐       │
│ │ [등식의 가감법] — 여기에 단계가 빠졌어요 │
│ │ {설명}                            │       │
│ │ {예상 단계 LaTeX}                  │       │
│ └────────────────────────┘       │
│                                          │
│ 오류 위치                                 │
│ ┌─ red 카드 ───────────────────┐       │
│ │ [등식의 가감법] — 계산 오류        │       │
│ │ {설명}                            │       │
│ │ ┌─학생 풀이─┐  ┌─올바른 풀이─┐    │       │
│ │ │ x = 5    │  │ x = 6      │    │       │
│ │ └─────┘  └─────────┘    │       │
│ └────────────────────────┘       │
│                                          │
│ ┌─ 이런 방법도 있어요! 💡 ─────────┐    │
│ │ ▼                                 │    │
│ │ (확장) 별해 풀이 LaTeX              │    │
│ └────────────────────────┘    │
│                                          │
│ ┌─ OCR 인식 결과 보기 ─────────────┐    │
│ │ ▼                                  │    │
│ │ (확장) Gemini 가 인식한 풀이 텍스트   │    │
│ │ [OCR이 잘못됐어요] 버튼               │    │
│ └────────────────────────┘    │
│                                          │
│ ┌─ (틀렸을 때만) 🎯 매듭 보강하기 ─┐      │
│ │ {매듭 이름} 부분이 어려웠어요         │      │
│ │ [보강 시작하기] [그냥 넘어가기]       │      │
│ └────────────────────────┘      │
│                                          │
│ [메인으로]   [숙제로 돌아가기 또는 다시 풀기]│
│ [다음 문제 또는 다음 문제 (숙제)]            │
└──────────────────────────────────────┘
```

### 점수 색상 분기

| 점수 | 점수 카드 배경 | 점수 텍스트 |
|---|---|---|
| ≥ 80 | emerald 그라디언트 | emerald-600 (#059669) |
| 40 ~ 79 | amber 그라디언트 | amber-600 (#d97706) |
| < 40 | red 그라디언트 | red-600 (#dc2626) |

### Step 카드의 상태별 색상

| status | 색상 |
|---|---|
| correct | emerald 배경 + ✓ |
| partial | amber 배경 + △ |
| missing | slate 배경 + ⊝ |
| wrong | red 배경 + ✗ |

correct 가 아닌 단계는 default 로 펼쳐진 상태.

### OCR 잘못됐을 때 — 학생이 직접 수정

```
┌─ OCR 인식 결과 보기 (펼친 상태) ─────┐
│                                      │
│ Gemini가 인식한 풀이                   │
│ ┌─ pre 박스 ──────────────────┐    │
│ │ x^2 - 5x + 6 = 0              │    │
│ │ (x-2)(x-3) = 0                 │    │
│ │ x = 2, 3                       │    │
│ └────────────────────────┘    │
│                                      │
│ [ ↻ OCR이 잘못됐어요 ]                  │
└──────────────────────────────────┘

         ↓ 클릭

┌─ OCR 수정 모드 ──────────────────────┐
│                                      │
│ OCR 결과를 수정해 주세요                 │
│ ┌─ Textarea (font-mono) ─────────┐  │
│ │ x^2 - 5x + 6 = 0                │  │
│ │ (x-2)(x-3) = 0                  │  │
│ │ x = 2, 3                        │  │
│ │ (학생이 직접 수정)                  │  │
│ └────────────────────────┘  │
│                                      │
│ [취소]  [↻ 수정해서 다시 채점]            │
└──────────────────────────────────┘
```

수정 후 재채점:
- Gemini OCR 호출 X (이미 학생이 수정한 텍스트 그대로 사용)
- Claude 만 다시 호출
- StudentAttempt 가 update 됨 (새 row 생성 X)

### 학생이 마주치는 에러

| 상황 | 학생이 보는 것 |
|---|---|
| 잘못된 attempt id | "결과를 찾을 수 없어요." |
| 다른 학생의 attempt URL 직접 진입 | 토스트: "이 결과를 볼 권한이 없어요" + /home |
| 재채점 시 빈 텍스트 | 토스트: "풀이를 작성해 주세요" |
| 재채점 API 실패 | 토스트: "다시 채점 중 문제가 생겼어요. 다시 시도해 주세요" |

---

## 1.B 관리자 입장에서 보는 모습

### 진입 — 학생 상세에서

```
[/admin/students/:userId]
   ↓ 시도 카드 클릭
[/result/:attemptId]
   ↓
[ResultView] (학생이 보는 화면과 동일하지만 권한 우회)
```

### 권한 차이

| 항목 | 학생 | 관리자 |
|---|---|---|
| 자기 시도 진입 | OK | OK |
| 다른 학생 시도 진입 | "권한이 없어요" + /home | OK (`user.role === 'admin'` 체크) |
| OCR 수정 / 재채점 | 가능 | 가능 (이론상 — admin 이 학생 시도를 수정할 수 있음) |
| 매듭 보강 권유 | 본인이 보강 가능 | 화면에는 보이지만 보강 진입은 별로 의미 없음 |

### admin 이 사용하는 시나리오

#### A. spot-check 검토

`/admin/review` 의 시도 큐에서 검토 미실시 시도들을 차례로 봅니다.

(참고: AdminReview 페이지는 별도 — 이 명세서 범위 외)

#### B. 학생별 시도 추적

`/admin/students/:id` → 시도 카드 클릭 → 그 학생의 특정 시도 결과를 본인이 보는 것과 동일하게 확인.

#### C. 채점 자신감 부족 경고 모니터링

화면에 "채점 자신감이 낮아요 ({confidence}점). 관리자가 검토할 거예요." 가 표시됨 — admin 이 이런 결과를 따로 빠르게 식별하는 신호.

---

## 2. 알고리즘 / 로직

### 2.1 데이터 fetch 흐름

```
[/result/:id 진입]
   ↓
StudentAttempt.filter({ id }, ..., 1)
   ↓
   ├─ 0건 → "결과를 찾을 수 없어요"
   ↓
[권한 체크]
   attempt.student_id === user.id
   OR user.role === 'admin'
   ├─ FAIL → toast + /home
   ↓
attempt.claude_grade_json JSON 파싱
   → grading 상태 (response unwrap 적용)
   ↓
attempt.problem_id 가 있으면:
  Problem.filter({ id: a.problem_id }, ..., 1)
    ↓
  problem.tool_ids JSON 파싱
    ↓ tool_ids 1개+ 있으면
  MathTool.list('name', 100)
    ↓ filter
  setTools(...)
   ↓
화면 렌더
```

### 2.2 매듭 보강 권유 카드의 표시 조건

```
표시 조건 (AND):
  attempt.correctness ∈ {'partial', 'wrong'}
  AND weakToolIds.length > 0
       (= error_locations + gap_locations 의 unique tool_id)
  AND attempt.attempt_type ∉ {'remediation_retry', 'remediation_practice'}
  AND !dismissedRemediation
```

(Remediation Flow 명세서 참조)

### 2.3 액션 버튼 분기

```
attempt.attempt_type 분기:

case 'remediation_retry':
  if correctness === 'correct':
    [매듭 보강 계속하기 (단계 3)] → /remediation/:parent/practice/0
  else:
    [매듭 학습하기 (단계 2)] → /remediation/:parent/lesson

case 'remediation_practice':
  [🎉 보강 완료!] → /remediation/:parent/complete

else (보통의 경우):
  if attempt.assignment_id:
    [메인으로] [숙제로 돌아가기]
    [다음 문제 (숙제)]
  else:
    [메인으로] [다시 풀기]
    [다음 문제]
```

### 2.4 OCR 수정 후 재채점

```
[학생이 textarea 에서 수정]
   ↓
[수정해서 다시 채점] 클릭
   ↓
가드: correctedText.trim() 빈 ? toast + return
   ↓
setRegrading(true) → LoadingOverlay (stage='grading')
   ↓
base44.integrations.Core.InvokeLLM({
  prompt: REGRADE_PROMPT_TEMPLATE(problem_content, correctedText),
  model: 'claude_sonnet_4_6',
  response_json_schema: REGRADE_SCHEMA
})
   ↓ unwrap (response ?? raw)
result
   ↓
StudentAttempt.update(attempt.id, {
  ocr_corrected_text: correctedText,
  claude_grade_json: JSON.stringify(result),
  score: result.score || 0,
  correctness: result.correctness || 'wrong'
})
   ↓
setGrading(result)
setAttempt 갱신
setEditingOCR(false)
toast.success('다시 채점됐어요!')
```

(★ Gemini OCR 재호출 없음 — 비용/속도 절감)

### 2.5 다음 문제 처리

```
attempt.assignment_id 있음:
  Assignment.filter + 학생 attempts → 안 푼 문제 찾기
  → /problem/:nextId?assignment_id=...
  없으면 fallback (일반 random)

attempt.assignment_id 없음:
  Problem.list 1000 → random 1개
  → /problem/:randomId
```

### 2.6 도구 칩과 tooltip

```
[도구 chip 클릭]
   ↓
setTooltipTool(tool)
   ↓
모달 오버레이 표시:
  - tool.name
  - tool.goal
  - tool.description
  - [닫기]
   ↓ 닫기 또는 배경 클릭
setTooltipTool(null)
```

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/pages/ResultView.jsx
src/pages/ProblemSolve.jsx        ← 진입 직전 단계
src/components/ScoreBadge.jsx      ← ScoreSummaryText, StepStatusBadge
src/components/MathRenderer.jsx
src/components/LoadingOverlay.jsx  ← 재채점 중 표시
base44/entities/StudentAttempt.jsonc
base44/entities/Problem.jsonc
```

### 3.2 URL 및 진입

```
/result/:id

useParams() → id (StudentAttempt.id)
```

### 3.3 데이터 fetch (`ResultView.jsx:177-219`)

```js
const loadAttempt = async () => {
  setLoading(true);
  try {
    const attempts = await base44.entities.StudentAttempt.filter(
      { id }, '-created_date', 1
    );
    if (attempts.length > 0) {
      const a = attempts[0];

      // 권한 체크
      if (user && a.student_id !== user.id && user.role !== 'admin') {
        toast.error('이 결과를 볼 권한이 없어요');
        navigate('/home');
        return;
      }

      setAttempt(a);

      // grading unwrap
      if (a.claude_grade_json) {
        const parsed = JSON.parse(a.claude_grade_json);
        setGrading(parsed?.response ?? parsed);
      }

      setCorrectedText(a.ocr_corrected_text || a.ocr_text || '');

      // problem + tools
      if (a.problem_id) {
        const problems = await base44.entities.Problem.filter(
          { id: a.problem_id }, '-created_date', 1
        );
        if (problems.length > 0) {
          const prob = problems[0];
          setProblem(prob);
          let toolIds = [];
          try {
            const parsed = JSON.parse(prob.tool_ids || '[]');
            if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
          } catch {}
          if (toolIds.length > 0) {
            const allTools = await base44.entities.MathTool.list('name', 100);
            setTools(allTools.filter(t => toolIds.includes(t.tool_id)));
          }
        }
      }
    }
  } finally {
    setLoading(false);
  }
};
```

### 3.4 점수 카드 색상 (`ResultView.jsx:289-293`)

```js
const score = attempt.score || 0;
const scoreColor =
  score >= 80 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' :
  score >= 40 ? 'from-amber-50 to-amber-100/50 border-amber-200' :
                'from-red-50 to-red-100/50 border-red-200';
```

### 3.5 weakToolIds 계산 (`ResultView.jsx:299-304`)

```js
const weakToolIds = [...new Set([
  ...errors.map(e => e.tool_id).filter(Boolean),
  ...gaps.map(g => g.tool_id).filter(Boolean),
])];
const weakToolNames = weakToolIds.map(id => getToolName(id)).filter(Boolean);
```

### 3.6 StepCard 컴포넌트 (`ResultView.jsx:102-154`)

```jsx
function StepCard({ step }) {
  const [open, setOpen] = useState(step.status !== 'correct');

  return (
    <div className={`rounded-xl border ${
      step.status === 'correct' ? 'border-emerald-200 bg-emerald-50/30' :
      step.status === 'partial' ? 'border-amber-200 bg-amber-50/30' :
      step.status === 'missing' ? 'border-slate-200 bg-slate-50/30' :
                                    'border-red-200 bg-red-50/30'
    }`}>
      <button onClick={() => setOpen(o => !o)}>
        <span>{step.step_number}단계</span>
        <StepStatusBadge status={step.status} />
        <span>{step.student_step.slice(0, 50)}</span>
        {open ? <ChevronUp /> : <ChevronDown />}
      </button>
      {open && (
        <>
          {step.student_step && (
            <div>
              <p>학생 풀이</p>
              <MathRenderer content={step.student_step} />
            </div>
          )}
          {step.comment && <div><p>피드백</p><p>{step.comment}</p></div>}
          {step.correction && (
            <div>
              <p>정정</p>
              <MathRenderer content={step.correction} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

correct 단계는 default 로 닫혀있고, 그 외는 default 로 열려있음.

### 3.7 OCR 재채점 (`ResultView.jsx:229-258`)

```js
const handleRegrade = async () => {
  if (!attempt || !correctedText.trim()) return;
  setRegrading(true);
  try {
    // available_tools 블록 빌드 (tools state 는 loadAttempt 가 이미 채움)
    const toolsBlock = tools.map(t => (
      `- tool_id: "${t.tool_id}"
  name: "${t.name}"
  goal: "${t.goal || ''}"`
    )).join('\n');

    const resultRaw = await base44.integrations.Core.InvokeLLM({
      prompt: REGRADE_PROMPT_TEMPLATE(
        attempt.problem_content,
        correctedText,
        toolsBlock
      ),
      model: 'claude_sonnet_4_6',
      response_json_schema: REGRADE_SCHEMA
    });

    const result = resultRaw?.response ?? resultRaw;

    // sanitize tool_id
    const validIds = new Set(tools.map(t => t.tool_id));
    const sanitize = (arr) => (arr || []).map(item => ({
      ...item,
      tool_id: validIds.has(item.tool_id) ? item.tool_id : null
    }));
    result.error_locations = sanitize(result.error_locations);
    result.gap_locations = sanitize(result.gap_locations);

    await base44.entities.StudentAttempt.update(attempt.id, {
      ocr_corrected_text: correctedText,
      claude_grade_json: JSON.stringify(result),
      score: result?.score || 0,
      correctness: result?.correctness || 'wrong',
    });

    setGrading(result);
    setAttempt(prev => ({ ...prev, score: result?.score || 0, correctness: result?.correctness }));
    setEditingOCR(false);
    toast.success('다시 채점됐어요!');
  } catch (err) {
    console.error(err);
    toast.error('다시 채점 중 문제가 생겼어요. 다시 시도해 주세요');
  } finally {
    setRegrading(false);
  }
};
```

### 3.8 REGRADE_PROMPT_TEMPLATE (`ResultView.jsx:16-46`)

요점:
- 시스템 prompt 의 채점 원칙 7개 + 매듭 매핑 엄격 원칙 (Submission Pipeline 의 #8 동일)
- User message 에 `<problem>` + `<available_tools>` + `<student_ocr_solution>` 포함 (verified_answer / agent_solution / correct_solution_path 는 가벼움 위해 생략)
- 시그니처: `REGRADE_PROMPT_TEMPLATE(problemContent, correctedText, toolsBlock)`

### 3.9 REGRADE_SCHEMA (`ResultView.jsx:48-100`)

GradingOutput 과 동일한 구조 (Submission Pipeline 참조).

### 3.10 다음 문제 (`ResultView.jsx:260-285`)

```js
const handleNextProblem = async () => {
  // 숙제 안에서는 안 푼 다음 문제로
  if (attempt.assignment_id) {
    const assignment = await base44.entities.Assignment.filter({ id: attempt.assignment_id }).then(r => r[0]);
    if (assignment) {
      const problemIds = JSON.parse(assignment.problem_ids || '[]');
      const myAttempts = await base44.entities.StudentAttempt.filter(
        { student_id: user.id, assignment_id: attempt.assignment_id },
        '-submitted_at', 100
      );
      const doneIds = new Set(myAttempts.map(a => a.problem_id));
      const nextId = problemIds.find(id => !doneIds.has(id));
      if (nextId) {
        navigate(`/problem/${nextId}?assignment_id=${attempt.assignment_id}`);
        return;
      }
    }
  }
  // 일반 자유 풀이
  const problems = await base44.entities.Problem.list('-created_date', 1000);
  if (problems.length > 0) {
    const idx = Math.floor(Math.random() * problems.length);
    navigate(`/problem/${problems[idx].id}`);
  }
};
```

### 3.11 액션 버튼 분기 (`ResultView.jsx:557-604`)

```jsx
{/* remediation_retry: 정답이면 단계 3, 틀림이면 단계 2 */}
{attempt.attempt_type === 'remediation_retry' && (
  attempt.correctness === 'correct' ? (
    <Button onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/practice/0`)}>
      매듭 보강 계속하기 (단계 3)
    </Button>
  ) : (
    <Button onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/lesson`)}>
      매듭 학습하기 (단계 2)
    </Button>
  )
)}

{/* remediation_practice: 보강 완료 화면으로 */}
{attempt.attempt_type === 'remediation_practice' && (
  <Button onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/complete`)}>
    🎉 보강 완료!
  </Button>
)}

{/* 일반: 메인 / 다시 풀기 (또는 숙제 돌아가기) */}
{attempt.attempt_type !== 'remediation_retry'
 && attempt.attempt_type !== 'remediation_practice' && (
  <>
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => navigate('/home')}>
        메인으로
      </Button>
      {attempt.assignment_id ? (
        <Button onClick={() => navigate(`/assignment/${attempt.assignment_id}`)}>
          숙제로 돌아가기
        </Button>
      ) : (
        <Button variant="outline" onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
          다시 풀기
        </Button>
      )}
    </div>
    <Button onClick={handleNextProblem}>
      {attempt.assignment_id ? '다음 문제 (숙제)' : '다음 문제'}
    </Button>
  </>
)}
```

### 3.12 도구 tooltip 모달 (`ResultView.jsx:311-324`)

```jsx
{tooltipTool && (
  <div className="fixed inset-0 z-50" onClick={() => setTooltipTool(null)}>
    <div className="absolute inset-0 bg-black/40" />
    <Card onClick={e => e.stopPropagation()}>
      <Wrench /> {tooltipTool.name}
      {tooltipTool.goal && <p>{tooltipTool.goal}</p>}
      {tooltipTool.description && <p>{tooltipTool.description}</p>}
      <Button onClick={() => setTooltipTool(null)}>닫기</Button>
    </Card>
  </div>
)}
```

### 3.13 알려진 이슈 / 미결정

- **REGRADE_PROMPT_TEMPLATE / REGRADE_SCHEMA 가 컴포넌트 안에 하드코딩** — prompt/schema 변경 시 코드 배포 필요. 백엔드에서 동적 제공 검토.
- **다음 문제 fallback 이 random** — Problem.list 1000 중에서 random. 학생 학습 이력 기반 추천이 V2.
- **로딩 표시 일관성** — 진입 시는 `<InlineLoader>`, 재채점 중은 `<LoadingOverlay>`. 두 위젯의 사용 일관성 검토.
- **OCR 수정 후 update 정책** — 새 row 가 아니라 기존 row update. spot-check 큐의 admin 이 어떤 버전 (원본 vs 수정본) 을 보는지 정의 필요.
- **admin 의 OCR 수정** — 권한 체크상 admin 도 다른 학생의 OCR 을 수정할 수 있음. 정책 정의 필요.

### 3.14 QA 체크리스트

#### 정상 흐름

- [ ] ProblemSolve 제출 후 ResultView 로 정상 이동
- [ ] 점수 / 한 줄 요약 / 단계별 피드백 / 오류 위치 정상 표시
- [ ] MathRenderer 가 LaTeX 정상 렌더
- [ ] ScoreSummaryText / StepStatusBadge 가 점수/단계 상태별로 표시
- [ ] [메인으로] / [다시 풀기] / [다음 문제] 버튼 동작
- [ ] 도구 chip 클릭 → tooltip 모달

#### 로딩

- [ ] ResultView 진입 시 `<InlineLoader message="결과 불러오는 중..."/>`
- [ ] 재채점 시 `<LoadingOverlay stage="grading"/>`

#### Empty / Not Found

- [ ] 잘못된 attempt id → "결과를 찾을 수 없어요"

#### 권한

- [ ] 다른 학생의 attempt URL 직접 진입 → toast + /home (admin 제외)
- [ ] admin 이 모든 학생 결과 진입 가능

#### 경고 메시지

- [ ] grading.ocr_quality_concern 있음 → "필기 인식에 의문이 있어요" 카드
- [ ] grading.confidence < 70 → "채점 자신감이 낮아요" 카드

#### OCR 수정 / 재채점

- [ ] [OCR 인식 결과 보기] 토글 → 펼침/접힘
- [ ] 펼친 OCR 영역에 인식된 텍스트 표시
- [ ] [OCR이 잘못됐어요] → Textarea 표시 + 기존 텍스트 채워짐
- [ ] 수정 후 [수정해서 다시 채점] → 재채점 진행
- [ ] 빈 텍스트 재채점 시도 → toast + 차단
- [ ] [취소] → 일반 표시 모드로 복귀
- [ ] 재채점 성공 → toast.success('다시 채점됐어요!')

#### 에러 처리

- [ ] 재채점 API 실패 → toast.error
- [ ] ProblemSolve 의 10MB 초과 사진 → toast (Submission Pipeline 명세서)

#### 매듭 보강 권유 / 분기

- [ ] partial / wrong + tool_id 1+ → 보강 권유 카드 표시
- [ ] [그냥 넘어가기] → 카드 사라짐
- [ ] remediation_retry 일 때 → "매듭 보강 계속하기" 또는 "매듭 학습하기"
- [ ] remediation_practice 일 때 → "🎉 보강 완료!"

#### 기타

- [ ] [이런 방법도 있어요! 💡] → 펼침/접힘
- [ ] LaTeX 수식 정상 표시
- [ ] 모바일 / 데스크탑 반응형
