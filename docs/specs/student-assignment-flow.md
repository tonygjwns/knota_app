# 학생 받은 숙제 진입 흐름 기능 명세서

## 1. 개요

학생이 강사가 출제한 숙제를 받아 풀이하는 흐름. 학생의 학급(class_id) 에 출제된 Assignment 가 학습 경로 허브의 "받은 숙제" 섹션에 표시되고, 카드 클릭 → 숙제 상세 페이지(StudentAssignment) → 안 푼 문제 풀기 → 채점 → 자동으로 다음 안 푼 문제로 진행. 마감된 숙제도 결과 조회는 가능합니다.

- **상위/관련 기능**: 강사 숙제 출제(별도 명세서)의 학생 측면. 문제 풀이 + 채점 (Submission Pipeline 명세서) 의 진입 한 종류. ResultView 의 액션 버튼이 자유 풀이 때와 다르게 표시됩니다.
- **대상 사용자**: student 만. 본인 학급의 active 숙제만 풀이 가능. 마감된 숙제는 결과만 조회 (안 푼 문제는 disable).
- **영향 받는 파일 리스트**:
  - `src/pages/ProblemSelect.jsx:38-91` (ClosedAssignmentCard) / `:96-160` (AssignmentCard) / `:165-424` (ProblemHub) — "받은 숙제" 섹션 (진행중 / 마감 분리)
  - `src/pages/StudentAssignment.jsx` — 숙제 상세 + 풀이 진입
  - `src/pages/ProblemSolve.jsx:62-63, 333` — `?assignment_id=X` query 처리 (StudentAttempt.create 의 `assignment_id` 채우기)
  - `src/pages/ResultView.jsx:260-285` (handleNextProblem) / `:582-604` (액션 버튼 분기) — 숙제 흐름 (숙제 돌아가기 / 다음 문제)
  - `base44/entities/Assignment.jsonc` — title (필수) / description / class_id (필수) / created_by (필수) / problem_ids (필수, JSON string) / deadline / status (default `active`, enum `active`|`closed`) / selection_criteria
  - `base44/entities/StudentAttempt.jsonc` — `assignment_id` 필드 (자유 풀이는 null)

## 2. 화면 구상도 (텍스트 wireframe)

### 2.1 ProblemSelect 허브 — "받은 숙제" 섹션

URL: `/problems` (mode 없음 — 허브)

```
┌─ 학습 경로                                ┐
│ 어떻게 공부할까요?                         │
├──────────────────────────────────────────┤
│ 받은 숙제                                 │
│  📋 진행 중 (2)                           │
│   ┌─ AssignmentCard ─────────────────┐    │
│   │ 8주차 - 이차방정식  [마감 임박]    │    │
│   │ 마감: Jan 22, 23:59 (D-3)        │    │
│   │ 진행률: 6/10 문제 ▓▓▓▓▓▓░░░░     │    │
│   └────────────────────────────┘    │
│   ...                                    │
│  📁 마감된 숙제 (5)  [▸ 펼치기]            │
│   (펼치면 ClosedAssignmentCard, 회색)     │
├──────────────────────────────────────────┤
│ 오늘의 추천                               │
│ 진단 평가 (placeholder)                   │
│ 자유 연습 (랜덤/단원별/도구별)             │
│ 복습 (틀렸던 문제)                         │
└──────────────────────────────────────────┘
```

### 2.2 StudentAssignment — 숙제 상세 + 풀이 진입

URL: `/assignment/:assignmentId`

```
┌─ [←] 8주차 - 이차방정식  [진행중] ──────┐
│ 마감: Jan 22, 23:59 (D-3 마감 임박!)     │
├──────────────────────────────────────┤
│ 설명: 이번 주 학습 내용 정리...           │
├──────────────────────────────────────┤
│ 진행률                       6/10 문제   │
│ ▓▓▓▓▓▓░░░░                              │
│ (allDone 일 때: "🎉 모든 문제를 풀었어요!")│
├──────────────────────────────────────┤
│ (마감 일 때: 회색 카드 "이 숙제는 마감됐어요")│
├──────────────────────────────────────┤
│ [ 이어 풀기 ]   (마감/완료 시 라벨 변경)   │
├──────────────────────────────────────┤
│ 출제된 문제                              │
│ ┌─ 풀음 카드 (emerald 톤) ───────────┐   │
│ │ {id 8자리}...                      │   │
│ │ {domain_name}                      │   │
│ │ {본문 60자}...           [✓ 85점]   │   │
│ └─────────────────────────────┘   │
│ ┌─ 미풀이 카드 (gray 톤) ───────────┐    │
│ │ ...                       [○]     │    │
│ └─────────────────────────────┘   │
│ ┌─ 마감+미풀이 (disabled, opacity 60%)┐  │
│ │ ...                       [⏰ 마감됨]│  │
│ └─────────────────────────────┘   │
└──────────────────────────────────────┘
```

### 2.3 ProblemSolve — assignment_id query 처리

URL: `/problem/:problemId?assignment_id=X`

- 화면 자체는 Submission Pipeline 명세서 참조.
- 진입 시 `useSearchParams().get('assignment_id')` 로 추출 (`ProblemSolve.jsx:62-63`).
- StudentAttempt.create 의 payload 에 `assignment_id: assignmentId || null` 채워짐 (`ProblemSolve.jsx:333`).

### 2.4 ResultView — 숙제 흐름 액션

```
... (점수 카드 / step_feedback / OCR 영역 / 매듭 보강 권유 카드)

┌─ 액션 버튼 (attempt.assignment_id 있을 때) ─┐
│ [메인으로]   [숙제로 돌아가기]                 │
│ [다음 문제 (숙제)]                            │
└──────────────────────────────────────────┘
```

자유 풀이 때 액션 ([메인으로] / [다시 풀기] / [다음 문제]) 과 비교해서, assignment_id 가 있으면 "다시 풀기" 자리에 "숙제로 돌아가기" 가 표시됩니다 (`ResultView.jsx:588-597`).

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| 학생이 학급 미배정 (`!user?.class_id`) | ProblemSelect "받은 숙제" 섹션: `<ComingSoonCard title="받은 숙제가 없어요" desc="강사님이 숙제를 출제하면 여기에 표시돼요"/>` (loadAssignments 가 즉시 return) |
| 학생 학급 배정 + active 0 건 | 동일 placeholder (`!assignments.active || assignments.active.length === 0`) |
| 학생 학급 배정 + active 1+ 건 | "📋 진행 중 (N)" 헤더 + AssignmentCard 리스트 |
| 학생 학급 배정 + closed 1+ 건 | "📁 마감된 숙제 (N)" 토글 (기본 접힘, showClosed=false). 펼치면 ClosedAssignmentCard 리스트 |
| 진행중 숙제 — deadline < now+24h | AssignmentCard 에 [마감 임박] 빨간 Badge + "(D-N)" 또는 "(오늘)" 텍스트 |
| StudentAssignment — 숙제 fetch 중 | `<InlineLoader message="숙제 불러오는 중..."/>` |
| StudentAssignment — assignment 0건 | "숙제를 찾을 수 없어요" (setError) |
| StudentAssignment — `assignment.class_id !== user.class_id` | `toast.error('이 숙제를 볼 권한이 없어요')` + `navigate('/home')` |
| StudentAssignment — 마감 (`status==='closed' \|\| deadline <= now`) | 헤더 [마감] secondary Badge + 회색 안내 카드 ("이 숙제는 마감됐어요") + 안 푼 문제 카드 disable + "이어 풀기" 버튼이 "결과 보기" 로 + `disabled={isClosed && !allDone}` |
| StudentAssignment — allDone | "🎉 모든 문제를 풀었어요!" emerald 메시지 + "이어 풀기" → "다시 풀기" 라벨 (마감 일 때는 "결과 보기") |
| StudentAssignment — nextUnfinishedProblem 있음 + !isClosed | "이어 풀기" 활성 → 안 푼 첫 번째 문제로 |
| 문제 카드 — 풀음 (attemptMap.has(p.id)) | emerald 톤 + ✓ 아이콘 + `{attempt.score}점` |
| 문제 카드 — 미풀이 + !isClosed | gray 톤 + ○ 아이콘, 클릭 가능 |
| 문제 카드 — 미풀이 + isClosed | opacity 60% + cursor-not-allowed + ⏰ 아이콘 + "마감됨" 텍스트 |
| ResultView — `attempt.assignment_id` 있음 | 자유 풀이 때 "다시 풀기" 자리에 "숙제로 돌아가기" Button (`ResultView.jsx:588-591`). 다음 문제 버튼 라벨이 "다음 문제 (숙제)" |

## 4. 동작

### 4.1 ProblemSelect — 받은 숙제 fetch

| 조건 | 동작 |
| --- | --- |
| 페이지 진입 | useAuth() 로 user 가져옴. `!user?.class_id` 면 setLoading(false) + return |
| user.class_id 가 있는 경우 | `Assignment.filter({class_id: user.class_id}, '-created_date', 100)` 호출 (`ProblemSelect.jsx:180`) |
| 분리 로직 (`ProblemSelect.jsx:181-184`) | active = `a.status==='active' \|\| (a.deadline && new Date(a.deadline) > now)`<br>closed = `a.status==='closed' \|\| (a.deadline && new Date(a.deadline) <= now)` |
| AssignmentCard mount 시 진행률 fetch (`ProblemSelect.jsx:100-116`) | `StudentAttempt.filter({student_id: user.id, assignment_id: assignment.id}, '-submitted_at', 100)` → `new Set(attempts.map(a=>a.problem_id)).size` 가 done. total 은 problem_ids 길이 |
| 카드 클릭 | `navigate('/assignment/${assignment.id}')` |
| ClosedAssignmentCard | 동일한 진행률 fetch + 회색 톤 (gray-200 border / gray-400 progress bar) + [마감됨] gray Badge |

### 4.2 StudentAssignment — 데이터 fetch + 진입 가드

순서 (`StudentAssignment.jsx:33-73`):
1. `Assignment.filter({id: assignmentId})` → 0건이면 `throw new Error('숙제를 찾을 수 없어요')`
2. **권한 체크**: `!user || a.class_id !== user.class_id` 면 `toast.error('이 숙제를 볼 권한이 없어요')` + `navigate('/home')` + return (assignment 자체를 set 하지 않음)
3. `setAssignment(a)`
4. problem_ids 를 JSON parse → `Problem.filter({}, '-created_date', 1000)` 후 client-side 에서 problem_ids 에 포함된 것만 필터
5. `StudentAttempt.filter({student_id: user.id, assignment_id: assignmentId}, '-submitted_at', 100)` → myAttempts

| 조건 | 동작 |
| --- | --- |
| attemptMap 만들기 | `new Map(myAttempts.map(a=>[a.problem_id, a]))` (`StudentAssignment.jsx:79`) |
| doneCount | `myAttempts.filter(a=>a.problem_id).length` (단순 시도 수, unique 가 아님 — 한 문제 여러 번 풀면 전부 카운트) |
| nextUnfinishedProblem | `problems.find(p => !attemptMap.has(p.id))` (`StudentAssignment.jsx:85`) |
| isClosed 판정 | `assignment.status==='closed' \|\| (deadline && deadline<=now)` |

### 4.3 풀이 진입

| 조건 (액션) | 동작 |
| --- | --- |
| 메인 액션 버튼 클릭 (`StudentAssignment.jsx:152-166`) | `if (nextUnfinishedProblem && !isClosed)` → `navigate('/problem/${id}?assignment_id=${assignmentId}')`<br>else if (problems.length>0) → `navigate('/problem/${problems[0].id}?assignment_id=...')` (allDone 이면 다시 풀기, 마감 이면 결과 보기)<br>`disabled={isClosed && !allDone}` |
| 문제 카드 클릭 | `if (!isDisabled)` → `navigate('/problem/${p.id}?assignment_id=${assignmentId}')`. 이미 풀었어도 진입 가능 (재제출 가능). isClosed 이면서 미풀이 인 경우 disable |
| ProblemSolve 에서 채점 후 | StudentAttempt.create 에 assignment_id 채워서 → ResultView 로 진입 (Submission Pipeline 참조) |

### 4.4 ResultView — 숙제 흐름 액션

| 조건 | 동작 |
| --- | --- |
| `attempt.assignment_id` 있음 — 액션 분기 | 자유 풀이의 [다시 풀기] 자리에 [숙제로 돌아가기] 표시 (`ResultView.jsx:588-591`). [다음 문제] 라벨도 "다음 문제 (숙제)" 으로 변경 (`ResultView.jsx:602`) |
| "숙제로 돌아가기" 클릭 | `navigate('/assignment/${attempt.assignment_id}')` |
| "다음 문제 (숙제)" 클릭 (`ResultView.jsx:260-285` handleNextProblem) | 1. `Assignment.filter({id: attempt.assignment_id})` → assignment.<br>2. problem_ids 파싱.<br>3. `StudentAttempt.filter({student_id, assignment_id}, '-submitted_at', 100)` → myAttempts.<br>4. `doneIds = new Set(myAttempts.problem_id)`.<br>5. `nextId = problemIds.find(id => !doneIds.has(id))`.<br>6. nextId 있으면 → `navigate('/problem/${nextId}?assignment_id=...')`<br>7. nextId 없으면 (모두 풀음) → fall through 해서 일반 자유 풀이의 random 1000 중 하나로 진입 (`ResultView.jsx:280-284`) |

### 4.5 데이터 변경

- ProblemSolve 의 채점 → StudentAttempt 1 row create (assignment_id 채워짐). Assignment / Problem 은 read-only.
- 재제출은 새 row create — 기존 row 를 update 하지 않음. 진행률 계산이 unique problem_id 기반이므로 재시도 해도 진행률은 그대로.

## 5. 에러

| 조건 | 사용자 표시 | 시스템 처리 |
| --- | --- | --- |
| StudentAssignment 진입 — assignment 0건 | "숙제를 찾을 수 없어요" 또는 e.message | `setError(e.message)` (`StudentAssignment.jsx:67`) → "{error}" 빨간 메시지 |
| 권한 부족 (`class_id` 불일치) | `toast.error('이 숙제를 볼 권한이 없어요')` | `navigate('/home')` |
| ProblemSolve 의 OCR/채점 실패 (네트워크 등) | "잠시 문제가 생겼어요. 다시 시도해 주세요" | catch — Submission Pipeline 참조 |
| 마감된 숙제 의 미풀이 문제 카드 클릭 | (반응 X — `isDisabled` 가 cursor-not-allowed + onClick 무반응) | UI 차단 |
| 마감된 숙제 의 메인 액션 버튼 | `disabled` 상태 (`isClosed && !allDone`) | UI 차단 |
| AssignmentCard / ClosedAssignmentCard 진행률 fetch 실패 | (UX 표시 X — `console.error` 만) | progress 0/0 으로 유지 |
| ProblemSelect 에서 학급 미배정 학생 | "받은 숙제가 없어요" placeholder | loadAssignments 가 즉시 return |

## 6. 미결정 / 보류

- **doneCount 가 unique problem_id 기준이 아님**: `StudentAssignment.jsx:80` 의 `myAttempts.filter(a=>a.problem_id).length` — 한 문제를 여러 번 풀면 진행률이 100% 초과로 표시될 수 있음. 수정 필요 (`new Set(myAttempts.map(a=>a.problem_id)).size` 로 바꾸면 AssignmentCard / handleNextProblem 와 일관됨).
- **마감 후 결과 조회 흐름**: 마감된 숙제 카드 클릭 → StudentAssignment 진입 → "결과 보기" 버튼 누르면 첫 번째 문제 페이지로 이동 (`StudentAssignment.jsx:159-160`) — ResultView 로 직접 가지 않음. UX 정리 필요.
- **모든 문제 풀음 후 ResultView "다음 문제 (숙제)"**: 마지막 문제 풀고 나면 nextId 가 안 잡혀서 fallback 으로 일반 random 으로 빠짐 (toast 등 안내 없음). 메시지 추가 검토.
- **숙제 알림**: 학생 Home 에서 새 숙제 알림 표시 (현재 미구현).
- **재제출 정책**: 한 번 풀고 다시 풀면 새 StudentAttempt 가 쌓임 — 점수 갱신/덮어쓰기 정책 미정. UI 상으로도 안내 없음.
- **진행률 캐시**: AssignmentCard / ClosedAssignmentCard 가 mount 마다 진행률 fetch — 카드 다수 시 N+1 쿼리.

## 7. 검증 (QA 체크리스트)

### 받은 숙제 표시 (ProblemSelect)
- [ ] /problems — 학생 class_id 의 active 숙제가 진행중 섹션에 표시
- [ ] 마감된 숙제 — "📁 마감된 숙제 (N)" 토글 펼침/접힘
- [ ] AssignmentCard — 제목 / 마감일 (D-N 표시) / 진행률 progress bar
- [ ] 마감 임박 (24h 내) — [마감 임박] 빨간 Badge
- [ ] 학급 미배정 학생 — "받은 숙제가 없어요" placeholder
- [ ] active 숙제 0건 — 동일 placeholder
- [ ] ClosedAssignmentCard — 회색 톤 + [마감됨] Badge

### StudentAssignment
- [ ] /assignment/:id — 숙제 정보 + 진행률 + 문제 리스트 표시
- [ ] 안 푼 문제 ○, 풀은 문제 ✓ + 점수 표시
- [ ] "이어 풀기" → 안 푼 첫 번째 문제로 (`?assignment_id=X` query 포함)
- [ ] 다른 학급의 assignmentId URL 직접 진입 시 toast + /home
- [ ] 마감된 숙제 진입 시 [마감] Badge + 안내 카드 + 안 푼 문제 카드 disable
- [ ] 모두 푼 후 "🎉 모든 문제를 풀었어요!" + "다시 풀기" 라벨

### ProblemSolve 처리
- [ ] `?assignment_id=X` query 가 있는 채로 진입 → StudentAttempt.create 에 assignment_id 채움
- [ ] 채점 후 ResultView 로 이동

### ResultView 처리
- [ ] attempt.assignment_id 가 있는 경우 — "숙제로 돌아가기" + "다음 문제 (숙제)" 노출
- [ ] "숙제로 돌아가기" → /assignment/:id 이동
- [ ] "다음 문제 (숙제)" → 안 푼 problem 첫 번째로 이동
- [ ] 모두 푼 후 "다음 문제 (숙제)" → fallback random (toast 안내 없음)

### 회귀
- [ ] 자유 풀이 ResultView (assignment_id null) — 자유 풀이 액션 버튼 (메인 / 다시 풀기 / 다음 문제)
- [ ] 학생이 자기 학급 외의 숙제에 접근 못함
