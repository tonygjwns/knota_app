# 매듭 보강 (Remediation Flow)

학생이 문제를 틀렸을 때, 어떤 매듭(도구) 에서 막혔는지 식별하고 단계별로 보강하는 흐름.

KNOTA 의 차별점인 "유형보다 세밀한 매듭 단위 학습" 을 학생 액션으로 풀어낸 부분.

---

## 1. 큰 그림 — 학생이 직접 보는 모습

> 이 흐름은 student 만 사용. admin / teacher 는 진입 자체가 없음.
>
> 단, admin/teacher 는 StudentDetail 에서 "매듭 보강 이력" 을 볼 수 있음 (tool-mastery-dashboards 참조).

### 1.1 한 문장으로

> 틀린 문제의 결과 화면에서 → 막힌 매듭 진단 → 같은 문제 다시 풀기 → 매듭 학습 → 유사 문제 3개 보강 → 완료

### 1.2 진입점 — 결과 화면의 권유 카드

학생이 partial / wrong 으로 채점받으면, 결과 화면에서 이런 카드를 봅니다:

```
... (점수 카드 / 단계별 피드백 / OCR 영역)

┌─ 🎯 매듭 보강하기 ───────────────────┐
│ [등식의 가감법] 부분이 어려웠어요       │
│ 매듭 학습 + 유사 문제 3개로 보강해 봐요  │
│                                      │
│ [ 보강 시작하기 ]    [ 그냥 넘어가기 ]   │
└──────────────────────────────────┘

[메인으로]   [숙제로 돌아가기 또는 다시 풀기]
[다음 문제]
```

이 카드가 보이는 조건:

- correctness 가 partial 또는 wrong
- LLM 채점에서 매듭(도구) ID 가 식별됨 (error_locations 또는 gap_locations 에 tool_id)
- 현재 시도가 보강 시도 자체가 아님
- "그냥 넘어가기" 를 아직 안 눌렀음

### 1.3 보강 흐름 — 3 단계

```
[ResultView 매듭 보강 카드]
        ↓ "보강 시작하기"
        ↓
┌───────────────────┐
│ 단계 1            │  /remediation/:id/retry
│ 같은 문제 다시 풀기 │
│                  │
│ [다시 풀기]        │  ← /problem/:id?... 으로
│ [건너뛰기 →]       │  ← 학습 단계로 바로
└────────┬──────┘
         │
         ↓ (건너뛰기)
┌───────────────────┐
│ 단계 2            │  /remediation/:id/lesson
│ 매듭 학습          │
│                  │
│ - 도구 이름        │
│ - 목적 / 방법      │
│ - 이 문제에 적용한다면│
│                  │
│ [✅ 이해 + 유사 문제]│
│ [👍 이해했어요]    │  ← /home (보강 종료)
│ [⭐ 즐겨찾기]      │  ← BookmarkedTool 추가 + /home
└────────┬──────┘
         │
         ↓ (✅ 클릭)
┌───────────────────┐
│ 단계 3            │  /remediation/:id/practice/0
│ 유사 문제 보강      │
│ 1/3, 2/3, 3/3     │
│                  │
│ [다음 문제] / [완료]│
└────────┬──────┘
         │
         ↓ idx===2 후
┌───────────────────┐
│ 보강 완료          │  /remediation/:id/complete
│ 🏆 🎉             │
│                  │
│ [자유 풀이로]      │
│ [다른 약점 보강]   │
└───────────────────┘
```

### 1.4 단계별 화면

#### 단계 1 — 같은 문제 다시 풀기

```
┌─ ← (●○○) 1/3 단계         [✕] ─┐
│                                 │
│ 같은 문제 다시 풀기                │
│ 어디가 막혔는지 알았으니             │
│ 다시 풀어볼까요?                   │
│                                 │
│ ┌─ 문제 ────────────────────┐  │
│ │ {problem.content}            │  │
│ └─────────────────────┘  │
│                                 │
│ [ 다시 풀기 ]   [ 건너뛰기 ]      │
└─────────────────────────────┘
```

학생 선택지:
- **다시 풀기** — 문제 풀이 화면으로 (Submission Pipeline)
- **건너뛰기** — 단계 2 (매듭 학습) 으로 바로

#### 단계 2 — 매듭 학습

```
┌─ ← (✓●○) 2/3 단계         [✕] ─┐
│                                 │
│ 매듭 학습                         │
│ 이 도구를 함께 살펴봐요             │
│                                 │
│ ┌─ 🔧 [등식의 가감법] ─────────┐  │
│ │ (영문명)                       │  │
│ │                              │  │
│ │ 📖 목적                       │  │
│ │  방정식의 양변에 같은 값을      │  │
│ │  더하거나 빼서 미지수를 분리... │  │
│ │                              │  │
│ │ 💡 방법                       │  │
│ │  ax + b = c 형태에서 b를       │  │
│ │  옮겨 ax = c - b 로...        │  │
│ │                              │  │
│ │ 이 문제에 적용한다면            │  │
│ │  [정답 풀이의 그 step LaTeX]   │  │
│ └─────────────────────┘  │
│                                 │
│ [ ✅ 이해했어요 — 유사 문제 풀기 ]   │
│ [ 👍 이해했어요 ]                  │
│ [ ⭐ 나중에 다시 공부할래요 ]        │
└─────────────────────────────┘
```

#### 단계 3 — 유사 문제 보강

```
┌─ ← (✓✓●) 3/3 단계 · 1/3   [✕] ─┐
│                                 │
│ 유사 문제 보강                    │
│ 비슷한 문제를 풀어봐요             │
│                                 │
│ ┌─ 문제 ─────────────────────┐ │
│ │ {유사 problem.content}        │ │
│ └─────────────────────┘ │
│                                 │
│ ┌─ 풀이 (캔버스) ───────────────┐│
│ │   (학생이 손으로 풀이 그리기)   ││
│ └─────────────────────┘│
│                                 │
│ [ 다음 문제 → ]                  │
└─────────────────────────────┘
```

idx === 2 일 때는 [ 보강 완료 → ] 라벨로 변경.

#### 보강 완료

```
┌─ 🏆 ──────────────────────────┐
│                                │
│  🎉 매듭 보강 완료!              │
│  3 단계를 모두 완료했어요. 대단해요!│
│                                │
│  [ 자유 풀이로 ]   [ 다른 약점 보강 ]│
└────────────────────────────┘
```

### 1.5 즐겨찾기 매듭의 활용

⭐ "나중에 다시 공부할래요" 를 누르면 BookmarkedTool 이 1행 추가됩니다.

이 매듭은 다음 두 곳에서 활용됩니다:

1. **`/bookmarks` 페이지** — 학생이 자기 즐겨찾기 매듭을 모아 보고, 그 매듭의 문제를 풀거나, 즐겨찾기를 해제. (자세한 내용은 `bookmarks.md` 참조)
2. **`/problems` 의 "오늘의 추천"** — 추천 문제의 신호로 사용 (즐겨찾기 우선 + weak_tools 보조). (자세한 내용은 `tool-mastery-dashboards.md` 참조)

또한 `/problems` 허브에 "내 즐겨찾기 매듭 (N)" 카드가 떠서 `/bookmarks` 로 진입할 수 있습니다.

### 1.6 학생이 마주치는 에러

| 상황 | 학생이 보는 것 |
|---|---|
| attemptId 잘못 / 없음 | 토스트: "시도를 찾을 수 없어요" + /home |
| 매듭 ID 식별 실패 | 매듭 학습 카드 자체가 표시 안 됨 (액션 버튼만) |
| 유사 문제 0개 | 단계 3 진입 후 빈 화면 (UX 이슈) |
| 즐겨찾기 추가 실패 | 토스트: "즐겨찾기 추가 실패" |
| 단계 3 제출 실패 | 토스트: "제출 실패" |

---

## 2. 알고리즘 / 로직

### 2.1 매듭 (target_tool_id) 식별 로직

```
attempt.claude_grade_json 파싱 후:

1순위: grading.error_locations[0].tool_id  (있으면 사용)
2순위: grading.gap_locations[0].tool_id    (error 없을 때)
실패: null → 매듭 학습 카드 자체 표시 X
```

(★ RemediationLesson 은 unwrap 적용 (`grading?.response ?? grading`),
RemediationPractice 는 unwrap 미적용 — 알려진 일관성 차이)

### 2.2 ResultView 의 보강 권유 표시 조건

```
표시 조건 (AND):
  attempt.correctness ∈ {'partial', 'wrong'}
  AND weakToolIds.length > 0
       (= error_locations + gap_locations 의 unique tool_id)
  AND attempt.attempt_type ∉ {'remediation_retry', 'remediation_practice'}
  AND !dismissedRemediation (학생이 "그냥 넘어가기" 안 누름)
```

### 2.3 ResultView 의 보강 시도 분기

```
attempt.attempt_type === 'remediation_retry':
   correct → "매듭 보강 계속하기 (단계 3)" 버튼
            → /remediation/:parent_attempt_id/practice/0
   틀림    → "매듭 학습하기 (단계 2)" 버튼
            → /remediation/:parent_attempt_id/lesson

attempt.attempt_type === 'remediation_practice':
   "🎉 보강 완료!" 버튼
   → /remediation/:parent_attempt_id/complete
```

(주의: ★ ProblemSolve 가 `?remediation_for=X` query 를 무시하므로 이 분기가 실제로는 발동 안 함 — 알려진 버그. 6번 미결정 참조)

### 2.4 RemediationLesson 의 데이터 fetch

```
1. StudentAttempt.filter({ id: attemptId })
   MathTool.list('name', 100)
   Problem.list('-created_date', 1000)
   ↓ 3개 병렬

2. unwrap grading
   ↓
   targetToolId = errorToolIds[0] || gapToolIds[0]

3. tool = tools.find(t => t.tool_id === targetToolId)

4. step = JSON.parse(problem.solution_path)
            .find(s => s.tool_id === targetToolId)
```

### 2.5 RemediationPractice 의 처리

```
[페이지 진입]
    ↓
1. StudentAttempt + Problem 병렬 fetch
    ↓
2. targetToolId 식별
    ↓
3. findSimilarProblems(targetToolId, currentProblem, user.id)
    ↓ 점수화 후 random 3개
4. setProblem(similar[idx])

[캔버스에 그림 그리기]
    ↓
5. canvasBlob → FormData → UploadFile API
    ↓ file_url 받음
6. StudentAttempt.create({
     ...,
     score: 0, correctness: 'wrong',  ★ 채점 호출 없음
     ocr_text: '', claude_grade_json: '',
     attempt_type: 'remediation_practice',
     parent_attempt_id: attemptId,
     target_tool_id
   })

[idx 분기]
   idx < 2 → /remediation/:id/practice/(idx+1)
   idx === 2 → /remediation/:id/complete
```

### 2.6 findSimilarProblems 점수화

```
입력: targetToolId, currentProblem, studentId

데이터:
  Problem.list 1000
  StudentAttempt.filter({student_id: studentId}, ..., 1000)

각 problem 의 점수:
  게이트:
    - tool_ids 에 targetToolId 포함 안 함 → skip
    - currentProblem 자기 자신 → skip

  기본 100점
    + 30: 같은 domain_id
    + 20: 학생이 아직 안 푼 문제 (attempted 아님)
    - 50: 학생이 이미 정답 받은 문제 (mastered)
    + 10: 도구 수 ≤ 2 (단순 문제)
    + 15: 난이도 비슷 (|diff| ≤ 1)

→ 점수 내림차순 → 상위 10 → random shuffle → 3개
```

### 2.7 즐겨찾기 매듭 처리

```
RemediationLesson 의 ⭐ 클릭:
  await BookmarkedTool.create({
    student_id: user.id,
    tool_id: tool.tool_id,
    context_attempt_id: attemptId
  })
  toast.success('즐겨찾기에 추가했어요')
  navigate('/home')
```

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/pages/ResultView.jsx
  ├─ 매듭 보강 권유 카드 (라인 519-554)
  └─ 보강 시도 액션 분기 (라인 557-580)

src/pages/remediation/RemediationRetry.jsx     ← 단계 1
src/pages/remediation/RemediationLesson.jsx    ← 단계 2
src/pages/remediation/RemediationPractice.jsx  ← 단계 3
src/pages/remediation/RemediationComplete.jsx  ← 완료

src/lib/findSimilarProblems.js                 ← 점수화 helper

src/pages/ProblemSolve.jsx
  └─ ?remediation_for=X 추출 (라인 64) ★ 사용 안 됨

src/pages/ProblemSelect.jsx
  └─ "오늘의 추천" 즐겨찾기 + weak_tools (라인 194-283)

base44/entities/BookmarkedTool.jsonc
base44/entities/StudentAttempt.jsonc  ← attempt_type, parent_attempt_id, target_tool_id
```

### 3.2 entity 정의

**BookmarkedTool**

```
{
  student_id (필수),
  tool_id (필수),
  context_attempt_id: ?,  ← 보강 중이던 시도 id
  note: ?
}
```

**StudentAttempt 의 보강 관련 필드**

```
{
  ...,
  attempt_type: 'practice' | 'homework' | 'remediation_retry' | 'remediation_practice',
                (default 'practice')
  parent_attempt_id: ?,  ← 보강의 부모 시도 (1차 풀이) ID
  target_tool_id: ?      ← 보강 중인 매듭 ID
}
```

### 3.3 ResultView 의 보강 권유 카드 (`ResultView.jsx:519-554`)

```jsx
{(attempt.correctness === 'partial' || attempt.correctness === 'wrong')
 && weakToolIds.length > 0
 && attempt.attempt_type !== 'remediation_retry'
 && attempt.attempt_type !== 'remediation_practice'
 && !dismissedRemediation && (
  <Card className="p-4 border-primary/30 bg-primary/5">
    <h3>🎯 매듭 보강하기</h3>
    <p>
      {weakToolNames.length > 0
        ? `[${weakToolNames.join(', ')}] 부분이 어려웠어요`
        : '일부 매듭이 부족했어요'}
    </p>
    <p>매듭 학습 + 유사 문제 3 개로 보강해 봐요</p>
    <Button onClick={() => navigate(`/remediation/${attempt.id}/retry`)}>
      보강 시작하기
    </Button>
    <Button variant="outline" onClick={() => setDismissedRemediation(true)}>
      그냥 넘어가기
    </Button>
  </Card>
)}
```

`weakToolIds` 는 error_locations + gap_locations 의 union (라인 300-303).

### 3.4 ResultView 의 보강 시도 분기 (`ResultView.jsx:557-580`)

```jsx
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

{attempt.attempt_type === 'remediation_practice' && (
  <Button onClick={() => navigate(`/remediation/${attempt.parent_attempt_id}/complete`)}>
    🎉 보강 완료!
  </Button>
)}
```

### 3.5 RemediationRetry (`RemediationRetry.jsx:54-59`)

```js
const handleRetry = () => {
  const params = new URLSearchParams();
  params.set('assignment_id', attempt.assignment_id || '');
  params.set('remediation_for', attemptId);
  navigate(`/problem/${problem.id}?${params.toString()}`);
};
```

→ `?remediation_for=:attemptId` 가 query 에 붙어서 ProblemSolve 로 진입.

(다만 ProblemSolve 가 이 query 를 무시하는 게 알려진 버그)

### 3.6 RemediationLesson (`RemediationLesson.jsx:21-89`)

```js
useEffect(() => {
  const load = async () => {
    const [attempts, tools, problems] = await Promise.all([
      StudentAttempt.filter({ id: attemptId }),
      MathTool.list('name', 100),
      Problem.list('-created_date', 1000)
    ]);
    const a = attempts[0];
    setAttempt(a);

    // grading unwrap
    const rawGrading = a.claude_grade_json ? JSON.parse(a.claude_grade_json) : null;
    const grading = rawGrading?.response ?? rawGrading;

    const errorToolIds = grading?.error_locations?.map(e => e.tool_id).filter(Boolean) || [];
    const gapToolIds = grading?.gap_locations?.map(g => g.tool_id).filter(Boolean) || [];
    const targetToolId = errorToolIds[0] || gapToolIds[0];

    if (targetToolId) {
      const t = tools.find(t => t.tool_id === targetToolId);
      if (t) setTool(t);

      if (a.problem_id) {
        const problem = problems.find(p => p.id === a.problem_id);
        if (problem?.solution_path) {
          const path = JSON.parse(problem.solution_path);
          const toolStep = path.find(s => s.tool_id === targetToolId);
          if (toolStep) setStep(toolStep);
        }
      }
    }
  };
  load();
}, [attemptId, navigate]);
```

⭐ 액션:

```js
const handleBookmark = async () => {
  await BookmarkedTool.create({
    student_id: user.id,
    tool_id: tool.tool_id,
    context_attempt_id: attemptId
  });
  toast.success('즐겨찾기에 추가했어요');
  navigate('/home');
};
```

### 3.7 RemediationPractice (`RemediationPractice.jsx:27-108`)

```js
useEffect(() => {
  const load = async () => {
    const [attempts, allProblems] = await Promise.all([
      StudentAttempt.filter({ id: attemptId }),
      Problem.list('-created_date', 1000)
    ]);
    const a = attempts[0];
    setAttempt(a);

    // ★ unwrap 미적용 — RemediationLesson 과 다름
    const grading = a.claude_grade_json ? JSON.parse(a.claude_grade_json) : null;
    const errorToolIds = grading?.error_locations?.map(e => e.tool_id).filter(Boolean) || [];
    const gapToolIds = grading?.gap_locations?.map(g => g.tool_id).filter(Boolean) || [];
    const targetToolId = errorToolIds[0] || gapToolIds[0];

    if (targetToolId && user) {
      const currentProblem = allProblems.find(p => p.id === a.problem_id);
      if (currentProblem) {
        const similar = await findSimilarProblems(targetToolId, currentProblem, user.id);
        setProblems(similar);
        if (similar.length > idx) setProblem(similar[idx]);
      }
    }
  };
  load();
}, [attemptId, practiceIdx, user, navigate]);

const handleSubmit = async () => {
  // ...
  const formData = new FormData();
  formData.append('file', canvasBlob);
  const uploadRes = await fetch('/api/integrations/Core/UploadFile', {
    method: 'POST', body: formData
  });
  const { file_url } = await uploadRes.json();

  await StudentAttempt.create({
    student_id: user.id,
    student_email: user.email,
    problem_id: problem.id,
    problem_content: problem.content?.slice(0, 500) || '',
    problem_domain: problem.domain_name || '',
    canvas_image_url: file_url,
    ocr_text: '',                  // ★ OCR 호출 없음
    claude_grade_json: '',         // ★ 채점 호출 없음
    score: 0,                       // ★ 항상 0
    correctness: 'wrong',           // ★ 항상 wrong
    started_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
    duration_sec: 0,
    attempt_type: 'remediation_practice',
    parent_attempt_id: attemptId,
    target_tool_id: attempt.target_tool_id,
  });

  if (idx < 2) navigate(`/remediation/${attemptId}/practice/${idx + 1}`);
  else navigate(`/remediation/${attemptId}/complete`);
};
```

### 3.8 DrawingCanvas prop mismatch

`RemediationPractice.jsx:167-171`:

```jsx
<DrawingCanvas
  value={canvasBlob}      ← ★ DrawingCanvas 가 무시
  onChange={setCanvasBlob} ← ★ DrawingCanvas 가 무시
  className="border rounded-lg"
/>
```

DrawingCanvas 의 실제 prop:

```jsx
function DrawingCanvas({ onImageReady, penColor, penSize }) { ... }
```

→ canvasBlob 이 영원히 null 일 가능성 → "다음 문제" 버튼이 disabled 상태로 머묾.

### 3.9 findSimilarProblems (`src/lib/findSimilarProblems.js`)

```js
export async function findSimilarProblems(targetToolId, currentProblem, studentId) {
  const all = await Problem.list('-created_date', 1000);
  const myAttempts = await StudentAttempt.filter(
    { student_id: studentId }, '-submitted_at', 1000
  );

  const attemptedIds = new Set(myAttempts.map(a => a.problem_id));
  const masteredIds = new Set(
    myAttempts.filter(a => (a.score || 0) >= 80).map(a => a.problem_id)
  );

  const scored = all
    .map(p => {
      const toolIds = JSON.parse(p.tool_ids || '[]');
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

  const topN = scored.slice(0, 10);
  return topN.sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.p);
}
```

### 3.10 알려진 이슈 / 미결정

#### 잠재 버그

- **RemediationPractice 의 OCR / 채점 미호출** — score:0, correctness:'wrong', claude_grade_json:'' 으로만 저장. 실제로는 채점이 안 됨. **수정 필요** (Submission Pipeline 의 OCR + 채점 흐름 재사용).
- **RemediationPractice 의 DrawingCanvas prop mismatch** — `value`/`onChange` 가 아닌 `onImageReady` 가 정상. canvasBlob 이 항상 null 일 수 있음.
- **ProblemSolve 가 ?remediation_for 사용 안 함** — query 추출은 하지만 변수 미사용. attempt_type / parent_attempt_id / target_tool_id 가 안 채워짐. → 단계 1 재풀이가 일반 자유 풀이로 처리됨.
- **RemediationLesson vs Practice grading unwrap 불일치** — Lesson 은 `?.response ?? raw`, Practice 는 raw 직접. 응답이 wrap 됐을 때 Practice 가 tool_id 추출 실패.
- **step.description / step.operation fallback** — `step.description || step.operation` — solution_path 의 어느 필드를 일관되게 쓰는지 정의 필요.

#### 향후 검토

- ProblemSelect "오늘의 추천" 추천 품질 — 현재는 random + fallback 수준.
- Teacher 시점 보강 이력 — studentDetailSummary 에서 산출은 됨 (tool-mastery-dashboards 참조).

✅ 해결됨:
- ~~즐겨찾기 매듭 별도 진입점 부재~~ → `/bookmarks` 페이지 추가됨 (`bookmarks.md` 참조).

### 3.11 QA 체크리스트

#### 진입점

- [ ] partial / wrong + weakToolIds 1+ → 보강 권유 카드 표시
- [ ] correct → 카드 X
- [ ] [그냥 넘어가기] → 카드만 사라짐 (페이지 새로고침 시 다시 표시)

#### 단계 1 (Retry)

- [ ] /remediation/:id/retry 진입 + 문제 본문 표시
- [ ] [다시 풀기] → /problem/:id?assignment_id=&remediation_for=:id
- [ ] [건너뛰기] → /remediation/:id/lesson

#### 단계 2 (Lesson)

- [ ] /remediation/:id/lesson 진입 — 도구 이름 / 목적 / 방법 / 적용 step 표시
- [ ] tool_id 식별 실패 시 카드 자체 안 보이고 액션 3개만 노출
- [ ] [✅ 이해 + 유사 문제] → /remediation/:id/practice/0
- [ ] [👍 이해했어요] → /home
- [ ] [⭐ 즐겨찾기] → BookmarkedTool 1행 + toast + /home

#### 단계 3 (Practice)

- [ ] /remediation/:id/practice/0 — 유사 문제 첫 번째 표시
- [ ] DrawingCanvas 동작 (★ prop mismatch 로 disabled 가능)
- [ ] 풀이 제출 → idx+1 페이지로
- [ ] idx===2 → /remediation/:id/complete

#### 데이터

- [ ] BookmarkedTool — student_id / tool_id / context_attempt_id 정상
- [ ] StudentAttempt (단계 3 제출) — attempt_type='remediation_practice', parent_attempt_id, target_tool_id (★ score=0 / claude_grade_json='' 알려진 이슈)
- [ ] ProblemSelect "오늘의 추천" 에 즐겨찾기 우선 + weak_tools 보조 반영

#### 회귀

- [ ] 자유 풀이 / 숙제 풀이 ResultView 에 보강 권유 카드 정상 표시
- [ ] 보강 시도 자체 (remediation_retry / practice) ResultView 에는 권유 카드 X
- [ ] correct 시 권유 카드 X
