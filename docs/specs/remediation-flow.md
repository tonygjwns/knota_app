# 오답 교정 / 매듭 보강 Phase (Remediation Flow) 기능 명세서

## 1. 개요

학생이 풀이를 제출했을 때 채점 결과가 partial 또는 wrong 인 경우, 그 학생이 막힌 매듭(도구) 을 식별하고 단계별로 보강하는 학습 흐름. KNOTA 의 차별점인 "유형보다 세밀한 매듭 단위" 를 학습 액션으로 구현했어요. 3 단계 — (1) 같은 문제 다시 풀기, (2) 매듭 학습, (3) 유사 문제 보강 — 으로 구성되며 각 단계는 별도 페이지이고 학생이 자율적으로 진행/종료 가능합니다.

- **상위/관련 기능**: ResultView (보강 진입점) → Submission Pipeline (재풀이 / 유사 문제 풀이) → 매듭별 인사이트(mastery 대시보드). 즐겨찾기 매듭은 ProblemSelect "오늘의 추천" 추천 신호로 사용됩니다.
- **대상 사용자**: student.
- **영향 받는 파일 리스트**:
  - `src/pages/ResultView.jsx:519-554` — 매듭 보강 권유 카드 (조건 + dismiss 처리)
  - `src/pages/ResultView.jsx:557-580` — `attempt_type==='remediation_retry'` / `'remediation_practice'` 분기 액션 버튼
  - `src/pages/remediation/RemediationRetry.jsx` — 단계 1 (다시 풀기 / 건너뛰기)
  - `src/pages/remediation/RemediationLesson.jsx` — 단계 2 (매듭 학습 + 3 액션)
  - `src/pages/remediation/RemediationPractice.jsx` — 단계 3 (유사 문제 보강)
  - `src/pages/remediation/RemediationComplete.jsx` — 보강 완료 화면
  - `src/lib/findSimilarProblems.js` — 유사 문제 점수화 helper
  - `base44/entities/BookmarkedTool.jsonc` — 즐겨찾기 매듭
  - `base44/entities/StudentAttempt.jsonc` — `attempt_type`(default `practice`, enum 4종) / `parent_attempt_id` / `target_tool_id` 필드
  - `src/pages/ProblemSelect.jsx:194-283` — 즐겨찾기 + weak_tools 기반 "오늘의 추천"
  - `src/pages/ProblemSolve.jsx:64` — `remediation_for` query 추출 (※ 6번 미결정 참조 — 추출만 하고 사용 안 함)

## 2. 화면 구상도 (텍스트 wireframe)

### 2.1 진입점 — ResultView 의 매듭 보강 권유 카드

ResultView 의 OCR 영역 다음, 액션 버튼 그룹 앞에 카드로 표시 (`ResultView.jsx:519-554`).

```
... (점수 카드 / 도구 칩 / step_feedback / gap / error 영역)

┌─ 🎯 매듭 보강하기 ─────────────────────────┐
│ [등식의 가감법] 부분이 어려웠어요             │
│ 매듭 학습 + 유사 문제 3 개로 보강해 봐요       │
│ [ 보강 시작하기 ]   [ 그냥 넘어가기 ]         │
└──────────────────────────────────────────┘

[메인으로]   [숙제로 돌아가기 또는 다시 풀기]
[다음 문제 또는 다음 문제 (숙제)]
```

표시 조건 (`ResultView.jsx:519`, AND 결합):
- `attempt.correctness === 'partial' || 'wrong'`
- `weakToolIds.length > 0` (error_locations / gap_locations 의 unique tool_id 합집합, `ResultView.jsx:300-303`)
- `attempt.attempt_type !== 'remediation_retry' && !== 'remediation_practice'` (보강 중인 시도엔 표시 X)
- `!dismissedRemediation` ("그냥 넘어가기" 클릭 시 true 로 전환)

"보강 시작하기" → `navigate('/remediation/${attempt.id}/retry')`. "그냥 넘어가기" → 카드만 사라짐 (이 페이지에 한해, dismiss 영속화 X).

### 2.2 단계 1 — RemediationRetry

URL: `/remediation/:attemptId/retry`

```
┌────────────────────────────────────┐
│ [←] (●○○) 1/3 단계            [X] │
├────────────────────────────────────┤
│ 같은 문제 다시 풀기                  │
│ 어디가 막혔는지 알았으니 다시 풀어볼까요? │
│                                    │
│ ┌─ 문제 ─────────────────────┐    │
│ │ {problem.content}            │    │
│ └────────────────────────┘    │
│                                    │
│ [ 다시 풀기 ]  [ 건너뛰기 — 매듭 학습으로 ]│
└────────────────────────────────────┘
```

데이터 fetch (`RemediationRetry.jsx:19-41`): `StudentAttempt.filter({id:attemptId})` + `Problem.list('-created_date',1000)` → 그 attempt 의 problem_id 매칭.

- "다시 풀기" 클릭 (`RemediationRetry.jsx:54-59`) → URLSearchParams 에 `assignment_id=` (있으면) + `remediation_for=:attemptId` 추가 → `navigate('/problem/:problemId?assignment_id=...&remediation_for=...')`
- "건너뛰기" → `navigate('/remediation/:attemptId/lesson')`
- 헤더의 [X] / [←] → `navigate('/home')`

### 2.3 단계 2 — RemediationLesson

URL: `/remediation/:attemptId/lesson`

```
┌────────────────────────────────────┐
│ [←] (✓●○) 2/3 단계            [X] │
├────────────────────────────────────┤
│ 매듭 학습                          │
│                                    │
│ ┌─ 🔧 [등식의 가감법] ──────────┐   │
│ │ (name_en — optional)         │   │
│ │ 📖 목적: {tool.goal}           │   │
│ │ 💡 방법: {tool.description}    │   │
│ │ 이 문제에 적용한다면:           │   │
│ │  [step.description / operation │   │
│ │   MathRenderer 로 렌더]        │   │
│ └────────────────────────┘   │
│                                    │
│ [ ✅ 이해했어요 — 유사 문제 풀기 ]    │
│ [ 👍 이해했어요 ]                   │
│ [ ⭐ 나중에 다시 공부할래요 ]         │
└────────────────────────────────────┘
```

데이터 fetch (`RemediationLesson.jsx:21-65`):
1. `StudentAttempt.filter({id:attemptId})` + `MathTool.list('name',100)` + `Problem.list('-created_date',1000)` 3개 병렬
2. attempt.claude_grade_json 파싱 후 `rawGrading?.response ?? rawGrading` 으로 unwrap
3. **targetToolId 식별** = `errorToolIds[0] || gapToolIds[0]` (error 가 우선)
4. tool = `tools.find(t.tool_id === targetToolId)`
5. step = `problem.solution_path` 파싱 후 `path.find(s.tool_id === targetToolId)`

3 액션 버튼 (`RemediationLesson.jsx:165-176`):
- ✅ "이해했어요 — 유사 문제 풀기" → `navigate('/remediation/:attemptId/practice/0')`
- 👍 "이해했어요" → `navigate('/home')` (보강 종료, 즐겨찾기 X)
- ⭐ "나중에 다시 공부할래요" → `BookmarkedTool.create({student_id:user.id, tool_id:tool.tool_id, context_attempt_id:attemptId})` → `toast.success('즐겨찾기에 추가했어요')` → `navigate('/home')`

### 2.4 단계 3 — RemediationPractice

URL: `/remediation/:attemptId/practice/:practiceIdx` (idx = 0, 1, 2)

```
┌────────────────────────────────────┐
│ [←] (●●●) 3/3 단계 · {idx+1}/3 [X]│
├────────────────────────────────────┤
│ 유사 문제 보강                       │
│ 비슷한 문제를 풀어봐요               │
│                                    │
│ ┌─ 문제 ──────────────────────┐   │
│ │ {problem.content}             │   │
│ └────────────────────────┘   │
│                                    │
│ ┌─ 풀이 ──────────────────────┐   │
│ │ DrawingCanvas (펜 / 지우개)    │   │
│ └────────────────────────┘   │
│                                    │
│ [ 다음 문제 ]   (또는 [ 보강 완료 ]) │
└────────────────────────────────────┘
```

데이터 fetch (`RemediationPractice.jsx:27-63`):
1. `StudentAttempt.filter({id:attemptId})` + `Problem.list('-created_date',1000)` 병렬
2. grading unwrap (`rawGrading?.response ?? rawGrading` 안 거치고 `JSON.parse(a.claude_grade_json)` 결과 그대로 사용 — ★ Lesson 과 처리 일관성 X. 6번 미결정 참조)
3. `errorToolIds[0] || gapToolIds[0]` → targetToolId
4. `findSimilarProblems(targetToolId, currentProblem, user.id)` 호출 → similar (3개 이내)
5. `setProblem(similar[idx])`

제출 흐름 (`RemediationPractice.jsx:65-108`):
1. canvasBlob FormData 로 wrap → `fetch('/api/integrations/Core/UploadFile')` → `file_url`
2. `StudentAttempt.create({student_id, student_email, problem_id, problem_content (500자), problem_domain, canvas_image_url, ocr_text:'', claude_grade_json:'', score:0, correctness:'wrong', started_at, submitted_at, duration_sec:0, attempt_type:'remediation_practice', parent_attempt_id:attemptId, target_tool_id: attempt.target_tool_id})`
3. `idx < 2` → `navigate('/remediation/:attemptId/practice/${idx+1}')`. `idx===2` → `navigate('/remediation/:attemptId/complete')`

> ⚠️ **주의**: Submission Pipeline (ProblemSolve) 의 OCR + 채점 호출이 여기엔 없음. score / correctness / claude_grade_json 가 placeholder 값으로 저장됨 (6번 미결정 참조).

### 2.5 단계 완료 — RemediationComplete

URL: `/remediation/:attemptId/complete`

```
┌────────────────────────────────────┐
│ [🏆]                                │
│ 🎉 매듭 보강 완료!                   │
│ 3 단계를 모두 완료했어요. 대단해요!     │
│                                    │
│ [ 자유 풀이로 ]   [ 다른 약점 보강 ]   │
└────────────────────────────────────┘
```

`RemediationComplete.jsx:7-36` — 데이터 fetch 없이 정적 화면. 액션 2개:
- 자유 풀이로 → `navigate('/home')`
- 다른 약점 보강 → `navigate('/problems')`

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| ResultView — partial / wrong + weakToolIds 1+ + dismiss 안 함 | 매듭 보강 권유 카드 표시 |
| ResultView — correctness === 'correct' | 카드 표시 X |
| ResultView — `attempt.attempt_type === 'remediation_retry'` | 권유 카드 X. 대신 "매듭 보강 계속하기 (단계 3)" 버튼 (correct 일 때) 또는 "매듭 학습하기 (단계 2)" (틀림 일 때) (`ResultView.jsx:557-569`) |
| ResultView — `attempt.attempt_type === 'remediation_practice'` | 권유 카드 X. "🎉 보강 완료!" 버튼 → `/remediation/:parent_attempt_id/complete` (`ResultView.jsx:571-580`) |
| ResultView — "그냥 넘어가기" 클릭 후 | dismissedRemediation=true → 카드 즉시 사라짐 (DB 변경 X) |
| RemediationRetry — attempts 0건 또는 problem 미매칭 | toast.error + `navigate('/home')` (catch path) |
| RemediationLesson — targetToolId 식별 실패 | tool null 상태로 카드 자체가 렌더 안 됨 (`{tool && ...}`). 액션 버튼은 그대로 노출 |
| RemediationLesson — solution_path 에 그 도구 step 없음 | step null → "이 문제에 적용한다면" 섹션만 미표시 |
| RemediationPractice — 유사 문제 0 개 | `problems` 빈 배열 → `problem` null → "if (!problem) return null" (`RemediationPractice.jsx:119`) — 빈 화면 (UX 이슈, 6번 미결정 참조) |
| RemediationPractice — 제출 중 | `<LoadingOverlay stage="grading" />` 전체 화면 (실제로는 채점 호출이 없으므로 표시만 "채점 중...") |

## 4. 동작

### 4.1 매듭 식별 (target_tool_id) 우선순위

attempt.claude_grade_json 파싱 후:

1. `grading.error_locations[].tool_id` 첫 번째 (LLM 의 매핑 시도)
2. `grading.gap_locations[].tool_id` 첫 번째
3. 둘 다 없으면 null → 매듭 학습 카드 표시 X

> RemediationLesson 은 `rawGrading?.response ?? rawGrading` unwrap 적용. RemediationPractice 는 unwrap 미적용 (`a.claude_grade_json` 직접 파싱). 6번 미결정 참조.

### 4.2 RemediationRetry 동작

| 조건 | 동작 |
| --- | --- |
| 페이지 진입 | StudentAttempt + Problem fetch. problem 매칭 후 본문 표시 |
| "다시 풀기" 클릭 | URLSearchParams 에 `assignment_id=` (a.assignment_id 또는 빈 문자열) + `remediation_for=attemptId` 추가 → `navigate('/problem/:problemId?...')` |
| "건너뛰기" 클릭 | `navigate('/remediation/:attemptId/lesson')` |
| [X] / [←] / 데이터 로드 실패 | `navigate('/home')` |

### 4.3 RemediationLesson 동작

| 조건 | 동작 |
| --- | --- |
| 페이지 진입 | StudentAttempt + MathTool(100) + Problem(1000) 병렬 fetch. grading unwrap → targetToolId 식별 → tool / step set |
| "✅ 이해했어요 — 유사 문제 풀기" | `navigate('/remediation/:attemptId/practice/0')` |
| "👍 이해했어요" | `navigate('/home')` |
| "⭐ 나중에 다시 공부할래요" | `BookmarkedTool.create({student_id, tool_id, context_attempt_id})` → toast 성공 → `/home`. 실패 시 `toast.error('즐겨찾기 추가 실패')` |

### 4.4 RemediationPractice 동작 (현 구현 한계 포함)

| 조건 | 동작 |
| --- | --- |
| 페이지 진입 | StudentAttempt + Problem(1000) fetch. targetToolId 식별 → `findSimilarProblems` 호출 → similar set → `setProblem(similar[idx])` |
| 캔버스 그리기 | `<DrawingCanvas value={canvasBlob} onChange={setCanvasBlob}>` — ★ DrawingCanvas 의 실제 prop 은 `onImageReady` 단 하나 (ProblemSolve 에서 사용). 현재 RemediationPractice 는 `value`/`onChange` 으로 호출하므로 prop mismatch — canvasBlob 이 늘 null 일 가능성 높음 (6번 미결정 참조) |
| "다음 문제" / "보강 완료" 클릭 | `setSubmitting(true)` → canvasBlob FormData → `fetch('/api/integrations/Core/UploadFile')` → file_url → `StudentAttempt.create({..., score:0, correctness:'wrong', ocr_text:'', claude_grade_json:'', attempt_type:'remediation_practice', parent_attempt_id:attemptId, target_tool_id: attempt.target_tool_id})`. **OCR / 채점 호출 없음**. → idx<2 → 다음 idx, idx===2 → complete |

### 4.5 findSimilarProblems 점수화 (`src/lib/findSimilarProblems.js`)

```
입력: targetToolId, currentProblem, studentId

1. Problem.list('-created_date', 1000) + StudentAttempt.filter({student_id:studentId}, '-submitted_at', 1000)
2. attemptedIds = Set(myAttempts.problem_id)
   masteredIds = Set(myAttempts.score >= 80 의 problem_id)
3. 각 problem 별 점수화:
   - 게이트: tool_ids 가 targetToolId 를 포함하지 않거나 currentProblem 자체면 skip
   - 기본 100점
   - +30: 같은 domain_id
   - +20: 학생이 아직 안 푼 문제 (attempted X)
   - -50: 학생이 이미 정답 받은 문제 (mastered)
   - +10: 도구 수 ≤ 2 (단순 문제)
   - +15: 난이도 비슷 (|diff| ≤ 1, 둘 다 difficulty 있을 때)
4. 점수 내림차순 정렬 → 상위 10 개 → random shuffle → slice(0,3)
5. return [Problem...]
```

### 4.6 즐겨찾기 매듭의 활용

- `BookmarkedTool` 은 RemediationLesson 의 ⭐ 액션에서만 생성됨.
- `ProblemSelect.jsx:194-283` 의 "오늘의 추천" 섹션에서 사용:
  - `BookmarkedTool.filter({student_id})` + 학생 attempts 로 weak_tools 계산 (avg<70, attempts≥3) → unique tool_ids 결합 (즐겨찾기 우선, weak 상위 5개)
  - 각 도구당 1-2 문제 random 추천 (상위 3 도구) → 결과 없으면 random 5 fallback

### 4.7 데이터 변경

- **Create**: `BookmarkedTool` 1 row (RemediationLesson ⭐ 액션). `StudentAttempt` 1 row (RemediationPractice 제출 시 `attempt_type='remediation_practice'`).
- 단계 1 재풀이 시 ProblemSolve 를 거쳐 StudentAttempt 가 생성됨 — but 현재 ProblemSolve 는 `remediation_for` query 를 채우지 않음 (6번 미결정).
- Update / Delete 동작 X.

## 5. 에러

| 조건 | 사용자 표시 | 시스템 처리 |
| --- | --- | --- |
| Remediation 페이지 — attemptId 잘못 / 0건 | `toast.error(메시지)` | `navigate('/home')` (load() catch) |
| RemediationLesson — tool_id 식별 실패 | (UX 표시 없음) | `tool` null → 카드 자체 안 보임. 학습 콘텐츠 없이 액션 버튼만 노출 |
| RemediationPractice — 유사 문제 fetch 0 | (UX 표시 없음 — 빈 화면) | `if (!problem) return null` |
| 즐겨찾기 추가 실패 | `toast.error('즐겨찾기 추가 실패')` | catch |
| 단계 3 풀이 제출 실패 (UploadFile / Create) | `toast.error('제출 실패')` | catch + `setSubmitting(false)` |

## 6. 미결정 / 보류

### 🔴 발견된 잠재 버그

- **RemediationPractice 가 OCR / 채점 호출 안 함** (`RemediationPractice.jsx:76-93`) — canvas 이미지를 file_url 만 저장, score:0 / correctness:'wrong' / ocr_text:'' / claude_grade_json:'' 으로 저장. 즉 학생이 보강 단계에서 푼 문제는 절대 채점되지 않고 0점 wrong 으로만 기록됨. **수정 필요**: Submission Pipeline 의 OCR + 채점 호출을 동일하게 사용 (또는 reuse 가능하게 추출).
- **RemediationPractice 의 DrawingCanvas prop mismatch** — `<DrawingCanvas value={canvasBlob} onChange={setCanvasBlob}>` (`RemediationPractice.jsx:167-171`) 으로 호출하는데 DrawingCanvas 의 실제 prop 은 `onImageReady` 하나 (ProblemSolve.jsx:396). value/onChange 는 무시되므로 canvasBlob 이 영원히 null → "다음 문제" 버튼이 disabled 상태로 머물 가능성 높음.
- **ProblemSolve 가 `?remediation_for=X` query 사용 안 함** — query 추출은 함 (`ProblemSolve.jsx:64`) 그러나 StudentAttempt.create 의 payload (`ProblemSolve.jsx:318-334`) 에 `attempt_type` / `parent_attempt_id` / `target_tool_id` 를 채우지 않음. 결과: 단계 1 재풀이가 일반 자유 풀이처럼 처리되며 ResultView 의 `remediation_retry` 분기가 절대 발동 안 함.
- **RemediationLesson vs RemediationPractice grading unwrap 불일치** — Lesson 은 `rawGrading?.response ?? rawGrading` (`RemediationLesson.jsx:35`), Practice 는 `JSON.parse(a.claude_grade_json)` 직접 사용 (`RemediationPractice.jsx:39`). 응답이 `{response:{...}}` 으로 wrapping 됐을 때 Practice 는 한 단계 들어가기 전이라 tool_id 추출 실패.
- **RemediationLesson 의 step.description / step.operation** — `step.description || step.operation` (`RemediationLesson.jsx:158`) 으로 fallback 사용 — solution_path 데이터의 둘 중 어느 필드를 일관되게 채우는지 정의 필요.

### 향후 검토 항목

- **ProblemSelect "오늘의 추천" 추천 품질**: 현재 도구 별 random 추출 + 결과 없을 때 random 5 fallback. 학습 효율을 더 반영하는 가중치 보정 필요 — 지금은 placeholder 수준.
- **즐겨찾기 매듭 별도 진입점**: 학생이 자기 즐겨찾기 매듭만 모아 볼 수 있는 진입 페이지 (Home 또는 ProblemSelect 의 별도 섹션) 추가 검토.
- **Teacher 시점 보강 이력**: studentDetailSummary 함수에서 remediation_history 가 산출되긴 함 (tool-mastery-dashboards.md 참조). StudentDetail 에서 표시까지는 되지만 정확도 이슈 있음.

## 7. 검증 (QA 체크리스트)

### 진입점
- [ ] partial / wrong + weakToolIds 1+ — ResultView 에 매듭 보강 권유 카드 표시
- [ ] correct 인 경우 — 카드 표시 X
- [ ] "그냥 넘어가기" 클릭 — 카드만 사라짐 (페이지 새로고침 시 다시 표시)

### 단계 1 (Retry)
- [ ] /remediation/:id/retry 정상 진입 + 문제 본문 표시
- [ ] "다시 풀기" — `?assignment_id=&remediation_for=:id` query 로 ProblemSolve 진입
- [ ] "건너뛰기" — /remediation/:id/lesson 진입

### 단계 2 (Lesson)
- [ ] /remediation/:id/lesson 정상 진입 — tool 이름 / 목적 / 방법 / 적용 step 표시
- [ ] tool_id 식별 실패 시 카드 자체 안 보이고 액션 3개만 노출
- [ ] "✅ 이해했어요 + 유사 문제 풀기" — /remediation/:id/practice/0
- [ ] "👍 이해했어요" — /home
- [ ] "⭐ 즐겨찾기" — BookmarkedTool 1 row 생성 + toast + /home

### 단계 3 (Practice)
- [ ] /remediation/:id/practice/0 — 유사 문제 첫 번째 표시
- [ ] DrawingCanvas 정상 동작 (★ prop mismatch 로 disabled 가능 — 6번 미결정 참조)
- [ ] 풀이 제출 → idx+1 페이지로 이동
- [ ] idx===2 일 때 → /remediation/:id/complete 진입

### 데이터 검증
- [ ] BookmarkedTool 생성 — student_id, tool_id, context_attempt_id 정상 저장
- [ ] StudentAttempt (단계 3 의 제출) — attempt_type='remediation_practice', parent_attempt_id, target_tool_id 모두 채움 (단 score=0 / claude_grade_json='' 채움 — 6번 미결정 참조)
- [ ] ProblemSelect "오늘의 추천" 에 즐겨찾기 우선 + weak_tools 보조 반영

### 회귀
- [ ] 일반 자유 풀이 / 숙제 풀이 의 매듭 보강 권유 카드 정상 표시
- [ ] 보강 시도 자체 (remediation_retry / remediation_practice) 의 ResultView 에는 권유 카드 X
- [ ] correct 일 때 권유 카드 X
