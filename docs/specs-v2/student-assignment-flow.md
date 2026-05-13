# 학생 받은 숙제 진입 흐름

학생이 강사가 출제한 숙제를 받고, 풀고, 결과로 돌아가는 학생 측 경험.

(강사 측 출제 흐름은 `teacher-assignment-creation.md` 참조)

---

## 1. 큰 그림 — 학생이 직접 보는 모습

> 이 흐름은 student 만 사용합니다. admin / teacher 는 진입 자체가 자동 redirect 됨.

### 1.1 한 문장으로

> 메인에서 받은 숙제 보고 → 진행 중인 것 골라 → 안 푼 문제 차례로 풀고 → 결과 → 다음 문제 또는 숙제 페이지로 돌아감

### 1.2 전체 동선

```
[메인 화면]                    [/problems — 학습 경로 허브]
  ↓                              ↓
"문제" 메뉴 클릭   ────────→   "받은 숙제" 섹션
                                 ↓
                           ┌─ 진행 중인 숙제 ─┐
                           │ 카드 카드 카드   │  → 카드 클릭
                           └─────────────┘      ↓
                                                  ↓
                                        [/assignment/:id]
                                                  ↓
                                              "이어 풀기"
                                                  ↓
                                  [/problem/:id?assignment_id=X]
                                                  ↓
                                            (Submission Pipeline)
                                                  ↓
                                            [/result/:id]
                                                  ↓
                                       [숙제로 돌아가기] [다음 문제 (숙제)]
                                            ↓                ↓
                                      assignment 페이지   다음 안 푼 문제
```

### 1.3 받은 숙제 섹션 (`/problems` 의 위쪽)

```
┌─ 학습 경로 ─────────────────────────────┐
│ 어떻게 공부할까요?                          │
├─────────────────────────────────────┤
│ 받은 숙제                                │
│  📋 진행 중 (2)                          │
│   ┌─ 숙제 카드 ──────────────────────┐  │
│   │ 8주차 - 이차방정식  [마감 임박]      │  │
│   │ 마감: Jan 22, 23:59 (D-3)         │  │
│   │ 진행률: 6/10 문제                   │  │
│   │ ▓▓▓▓▓▓░░░░ 60%                    │  │
│   └────────────────────────────┘  │
│   ...                                    │
│                                          │
│  📁 마감된 숙제 (5)  [▸ 펼치기]            │
│  (펼치면 회색 톤 카드 리스트, 결과만 조회)    │
├─────────────────────────────────────┤
│ 오늘의 추천                               │
│ 진단 평가 (placeholder)                   │
│ 자유 연습 / 복습                           │
└─────────────────────────────────────┘
```

학급에 배정되지 않았거나 받은 숙제가 0건이면 빈 카드:
> "받은 숙제가 없어요"
> "강사님이 숙제를 출제하면 여기에 표시돼요"

### 1.4 숙제 상세 화면 (`/assignment/:id`)

```
┌─ ← 8주차 - 이차방정식  [진행중] ─────┐
│ 마감: Jan 22, 23:59 (D-3 마감 임박!)  │
├──────────────────────────────────┤
│ 설명: 이번 주 학습 내용 정리...        │
├──────────────────────────────────┤
│ 진행률                  6/10 문제    │
│ ▓▓▓▓▓▓░░░░                         │
│                                    │
│ (모든 문제 풀었으면)                  │
│ "🎉 모든 문제를 풀었어요!"            │
├──────────────────────────────────┤
│ [ 이어 풀기 ]  ← 안 푼 첫 문제로     │
├──────────────────────────────────┤
│ 출제된 문제                           │
│                                    │
│ ┌─ 풀음 (emerald 톤) ────────────┐ │
│ │ {도메인}                          │ │
│ │ {본문 60자}...    [✓ 85점]       │ │
│ └────────────────────────┘ │
│                                    │
│ ┌─ 미풀이 (gray 톤) ────────────┐  │
│ │ ...                  [○]        │  │
│ └────────────────────────┘  │
└──────────────────────────────────┘
```

학생이 할 수 있는 것:

- **이어 풀기** — 안 푼 첫 번째 문제로 자동 이동
- 문제 카드 클릭 — 그 문제로 이동 (이미 푼 문제도 다시 풀 수 있음)
- ← 버튼으로 `/problems` 로 돌아가기

### 1.5 마감된 숙제 진입

```
┌─ ← 6주차 - 다항식   [마감] ──────┐
│ 마감: Jan 15, 23:59              │
├──────────────────────────────┤
│ ⏰ 이 숙제는 마감됐어요             │
├──────────────────────────────┤
│ 진행률                  3/10 문제 │
│                                │
│ [ 결과 보기 ]                    │
├──────────────────────────────┤
│ 출제된 문제                       │
│                                │
│ ✓ 풀은 문제 — 결과 조회 가능       │
│ ⏰ 안 푼 문제 — disabled (회색)    │
└──────────────────────────────┘
```

마감된 숙제에서는:
- 풀은 문제는 결과 보기 가능
- 안 푼 문제는 disable (클릭 불가)

### 1.6 문제 풀이 후 결과 화면

```
┌─ 결과 (스크롤 가능) ──────────┐
│ 점수, 단계별 피드백 등          │
│ (Submission Pipeline 참조)    │
├──────────────────────────┤
│ [메인으로]  [숙제로 돌아가기]   │
│ [다음 문제 (숙제)]              │
└──────────────────────────┘
```

자유 풀이 때는 [다시 풀기] 였는데 숙제 안에서 풀면 그 자리에 [숙제로 돌아가기] 가 표시됩니다.

[다음 문제 (숙제)] 는 같은 숙제 안에서 안 푼 다음 문제로 이동.

### 1.7 학생이 마주치는 에러

| 상황 | 학생이 보는 것 |
|---|---|
| 잘못된 assignment id (URL 직접) | "숙제를 찾을 수 없어요" |
| 다른 학급 숙제 URL 직접 진입 | 토스트: "이 숙제를 볼 권한이 없어요" + /home |
| 네트워크 / 서버 오류 | (Submission Pipeline 의 에러 카드와 동일) |

---

## 2. 알고리즘 / 로직

### 2.1 데이터 fetch 순서

#### `/problems` 의 받은 숙제 섹션

```
useEffect (user 변경 시):
  if (!user.class_id) → 빈 상태 placeholder
  else:
    Assignment.filter({ class_id: user.class_id }, '-created_date', 100)
      ↓
    분리 (closed-wins 규칙):
      isClosed(a) = (status === 'closed') OR (deadline && deadline <= now)
      closed = all.filter(isClosed)
      active = all.filter(a => !isClosed(a))
      ↓
    각 AssignmentCard 가 mount 시:
      StudentAttempt.filter({ student_id, assignment_id })
        ↓
      unique problem_id 수 → 진행률 계산
```

마감 지난 숙제는 status 가 'active' 든 'closed' 든 무조건 마감 섹션으로 — 양쪽 중복 노출 X.

#### `/assignment/:id` 진입

```
1. Assignment.filter({ id: assignmentId })
     ↓ 0건이면 throw → 에러 메시지

2. 권한 체크:
     a.class_id !== user.class_id
       → toast + navigate('/home')
       → return (다른 처리 안 함)

3. problem_ids JSON 파싱
     ↓
   Problem.filter({}, ..., 1000) 후 client filter

4. StudentAttempt.filter({ student_id, assignment_id })
     ↓
   myAttempts → attemptMap 만들기
```

### 2.2 진행률 / 안 푼 문제 식별

```
attemptMap = new Map(myAttempts.map(a => [a.problem_id, a]))

doneCount = myAttempts.length  ← 단순 시도 수 (★ unique 가 아님, 알려진 이슈)

nextUnfinished = problems.find(p => !attemptMap.has(p.id))

allDone = doneCount >= totalCount

isClosed = (status === 'closed') OR (deadline && deadline <= now)
```

### 2.3 메인 액션 버튼 동작

```
[ 이어 풀기 ] / [ 결과 보기 ] / [ 다시 풀기 ]
        ↓
   분기:
   - 마감 + 모두 풀음    → "결과 보기" (라벨)
   - 마감 + 미완료       → disabled
   - 진행 + 안 푼 문제 있음 → 안 푼 첫 문제로
   - 진행 + 모두 풀음    → "다시 풀기" (첫 문제로)
        ↓
   navigate(`/problem/${id}?assignment_id=${assignmentId}`)
```

### 2.4 ProblemSolve 의 assignment_id 처리

```
useSearchParams().get('assignment_id') → assignmentId

채점 후 StudentAttempt.create payload:
  { ..., assignment_id: assignmentId || null }
```

(자세한 내용은 `submission-pipeline.md`)

### 2.5 ResultView 의 "다음 문제 (숙제)" 동작

```
attempt.assignment_id 있음:
  Assignment.filter({ id: attempt.assignment_id })
    ↓
  problem_ids JSON 파싱
    ↓
  StudentAttempt.filter({ student_id, assignment_id }) → myAttempts
    ↓
  doneIds = Set(myAttempts.problem_id)
    ↓
  nextId = problemIds.find(id => !doneIds.has(id))
    ↓
  있음 → navigate(`/problem/${nextId}?assignment_id=...`)
  없음 → fall through → 일반 random 자유 풀이로 빠짐 (★ 안내 토스트 없음)
```

### 2.6 문제 카드 색상 분기

```
matchedAttempt = attemptMap.get(p.id)

if (matchedAttempt) → emerald 톤 + ✓ + 점수
else if (isClosed)  → opacity 60% + cursor-not-allowed + ⏰
else                → gray 톤 + ○ (clickable)
```

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/pages/ProblemSelect.jsx
  ├─ ProblemHub          (받은 숙제 섹션 + 오늘의 추천 등)
  ├─ AssignmentCard      (진행 중 카드)
  ├─ ClosedAssignmentCard (마감 카드, 회색)
  └─ ComingSoonCard      (placeholder)

src/pages/StudentAssignment.jsx        ← 숙제 상세

src/pages/ProblemSolve.jsx             ← assignment_id query 처리 (라인 62-63, 333)
src/pages/ResultView.jsx               ← handleNextProblem (라인 260-285)
                                       ← 액션 버튼 분기 (라인 582-604)

base44/entities/Assignment.jsonc
base44/entities/StudentAttempt.jsonc   ← assignment_id 필드
```

### 3.2 Assignment entity 구조

```
{
  title (필수),
  description: ?,
  class_id (필수),
  created_by (필수),
  problem_ids (필수, JSON 문자열),
  deadline: ?,
  status: 'active' | 'closed' (default 'active'),
  selection_criteria: ?  ← 출제 메타 (도구별/단원별/직접)
}
```

### 3.3 ProblemSelect 의 받은 숙제 fetch (`ProblemSelect.jsx:173-192`)

```js
const loadAssignments = async () => {
  if (!user?.class_id) {
    setLoading(false);
    return;
  }
  const all = await base44.entities.Assignment.filter(
    { class_id: user.class_id }, '-created_date', 100
  );
  const now = new Date();
  const isClosed = (a) =>
    a.status === 'closed' || (a.deadline && new Date(a.deadline) <= now);
  const closed = all.filter(isClosed);
  const active = all.filter(a => !isClosed(a));
  setAssignments({ active, closed });
};
```

closed-wins 규칙: 마감일이 지난 숙제는 status 와 무관하게 closed 로만 분류. 양쪽 중복 X.

### 3.4 AssignmentCard 의 진행률 fetch (`ProblemSelect.jsx:100-116`)

```js
useEffect(() => {
  const loadProgress = async () => {
    const problemIds = JSON.parse(assignment.problem_ids || '[]');
    const attempts = await base44.entities.StudentAttempt.filter(
      { student_id: user.id, assignment_id: assignment.id },
      '-submitted_at', 100
    );
    const uniqueDone = new Set(attempts.map(a => a.problem_id)).size;
    setProgress({ done: uniqueDone, total: problemIds.length });
  };
  loadProgress();
}, [assignment, user.id]);
```

(여기는 unique 사용. StudentAssignment.jsx:80 의 doneCount 와 다름 — 알려진 일관성 문제)

### 3.5 마감 임박 배지 조건 (`ProblemSelect.jsx:118-121`)

```js
const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
const now = new Date();
const isUrgent = deadline && (deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000);
const daysLeft = deadline
  ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  : null;
```

### 3.6 StudentAssignment 의 진입 가드 (`StudentAssignment.jsx:36-46`)

```js
const assignments = await base44.entities.Assignment.filter({ id: assignmentId });
if (assignments.length === 0) throw new Error('숙제를 찾을 수 없어요');
const a = assignments[0];

if (!user || a.class_id !== user.class_id) {
  toast.error('이 숙제를 볼 권한이 없어요');
  navigate('/home');
  return;
}
```

### 3.7 메인 액션 버튼 (`StudentAssignment.jsx:152-166`)

```jsx
<Button
  size="lg"
  className="w-full"
  variant={isClosed ? 'outline' : 'default'}
  onClick={() => {
    if (nextUnfinishedProblem && !isClosed) {
      navigate(`/problem/${nextUnfinishedProblem.id}?assignment_id=${assignment.id}`);
    } else if (problems.length > 0) {
      navigate(`/problem/${problems[0].id}?assignment_id=${assignment.id}`);
    }
  }}
  disabled={isClosed && !allDone}
>
  {isClosed
    ? '결과 보기'
    : allDone
      ? '다시 풀기'
      : nextUnfinishedProblem
        ? '이어 풀기'
        : '문제 풀기'}
</Button>
```

### 3.8 ResultView 의 "다음 문제 (숙제)" (`ResultView.jsx:260-285`)

```js
const handleNextProblem = async () => {
  if (attempt.assignment_id) {
    const assignment = await Assignment.filter({ id: attempt.assignment_id }).then(r => r[0]);
    if (assignment) {
      const problemIds = JSON.parse(assignment.problem_ids || '[]');
      const myAttempts = await StudentAttempt.filter(
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
  // fallback: 일반 자유 풀이 random
  const problems = await Problem.list('-created_date', 1000);
  if (problems.length > 0) {
    const idx = Math.floor(Math.random() * problems.length);
    navigate(`/problem/${problems[idx].id}`);
  }
};
```

### 3.9 액션 버튼 분기 (`ResultView.jsx:582-604`)

```jsx
{/* 자유 풀이의 [다시 풀기] 자리에 [숙제로 돌아가기] */}
{attempt.assignment_id ? (
  <Button onClick={() => navigate(`/assignment/${attempt.assignment_id}`)}>
    숙제로 돌아가기
  </Button>
) : (
  <Button onClick={() => navigate(`/problem/${attempt.problem_id}`)}>
    다시 풀기
  </Button>
)}

<Button onClick={handleNextProblem}>
  {attempt.assignment_id ? '다음 문제 (숙제)' : '다음 문제'}
</Button>
```

### 3.10 알려진 이슈 / 미결정

- **doneCount 가 unique 가 아님** — `StudentAssignment.jsx:80` 의 `myAttempts.filter(a=>a.problem_id).length` 는 한 문제 여러 번 풀면 중복 카운트 → 진행률이 100% 초과 표시 가능. AssignmentCard 처럼 `Set` 으로 통일 필요.
- **마감 후 결과 조회 흐름 어색** — "결과 보기" 버튼이 첫 번째 문제 페이지로 보냄. ResultView 로 직접 가지 않음.
- **모두 풀음 후 "다음 문제 (숙제)"** — fallback 으로 일반 random 으로 빠짐. 안내 토스트 없음.
- **숙제 알림 없음** — 학생 홈에 새 숙제 도착 알림이 없음.
- **재제출 정책 미정** — 한 번 풀고 다시 풀면 새 row 생성. 점수 갱신 / 덮어쓰기 정책 미정.
- **AssignmentCard 진행률 fetch 가 카드별** — N+1. 카드 다수 시 비효율적.

✅ 해결됨 (이 spec 의 이전 버전에서 알려진 이슈였던 것):

- ~~"진행 중 / 마감된 숙제 양쪽 중복 노출"~~ — closed-wins 규칙으로 fix.

### 3.11 QA 체크리스트

#### 받은 숙제 표시 (ProblemSelect)

- [ ] 학급 배정된 학생 — active 숙제가 진행 중 섹션에 표시
- [ ] 학급 미배정 — "받은 숙제가 없어요" placeholder
- [ ] active 0건 — 동일 placeholder
- [ ] 마감된 숙제 — "📁 마감된 숙제 (N)" 토글
- [ ] 마감 임박 (24h 내) — [마감 임박] 빨간 Badge + (D-N)
- [ ] AssignmentCard — 제목 / 마감일 / 진행률 progress bar
- [ ] ClosedAssignmentCard — 회색 톤 + [마감됨] Badge

#### 숙제 상세 (StudentAssignment)

- [ ] /assignment/:id — 숙제 정보 + 진행률 + 문제 리스트
- [ ] 안 푼 ○, 풀은 ✓ + 점수
- [ ] [이어 풀기] → 안 푼 첫 문제 (?assignment_id 포함)
- [ ] 다른 학급 assignment URL 직접 진입 → toast + /home
- [ ] 마감된 숙제 진입 → [마감] Badge + 안내 + 안 푼 카드 disable
- [ ] 모두 풀음 → "🎉 모든 문제를 풀었어요!" + [다시 풀기] 라벨

#### ProblemSolve 처리

- [ ] `?assignment_id=X` 진입 → StudentAttempt.assignment_id 채워짐
- [ ] 채점 후 ResultView 도착

#### ResultView 분기

- [ ] attempt.assignment_id 있음 → [숙제로 돌아가기] + [다음 문제 (숙제)]
- [ ] [숙제로 돌아가기] → /assignment/:id
- [ ] [다음 문제 (숙제)] → 안 푼 problem 첫 번째
- [ ] 모두 풀음 → fallback random (안내 토스트 없음)

#### 회귀

- [ ] 자유 풀이 ResultView (assignment_id null) → 자유 풀이 액션 버튼
- [ ] 학생이 자기 학급 외 숙제에 접근 못함
