# 매듭별 인사이트 + 분석 대시보드

KNOTA 의 핵심 차별점인 **"매듭(도구) 단위" 학습 분석**.

학생, 강사, 관리자 모두 자기에게 맞는 매듭 인사이트를 봅니다.

---

## 1. 큰 그림

### 1.1 한 문장으로

> 학생의 시도 데이터에서 어떤 도구(매듭) 에서 막히는지를 추출 → 학생/강사/관리자에게 차트로 보여주고 → 학습/보강/숙제 출제의 신호로 사용.

### 1.2 같은 데이터, 다른 시점

```
[StudentAttempt 시도 데이터]
        ↓
[claude_grade_json 의 error_locations.tool_id]
+ [problem.tool_ids fallback]
        ↓
[mastery 집계: tool_id 별 attempts / scores / avg_score]
        ↓
        ├─ 학생: 자기 약점/강점 매듭 (History)
        ├─ 강사: 학급 약점 매듭 (TeacherDashboard)
        └─ 관리자: 전체 학생 약점 매듭 (AdminDashboard)
```

---

## 1.A 학생 입장에서 보는 모습

### 진입 — `/history`

```
┌─ 내 풀이 기록 ─────────────────────┐
│ 지금까지 푼 문제들을 볼 수 있어요      │
├──────────────────────────────────┤
│ Stats Cards (3 분할)                │
│  총 풀이  │  정답  │  평균 점수       │
│   45개    │  28개  │   72점         │
├──────────────────────────────────┤
│ ┌─ 약점 매듭 Top 5 ─┐ ┌─ 강점 매듭 Top 5 ─┐│
│ │ 📉                │ │ 📈                ││
│ │ [등식의 가감법]     │ │ [부정적분 계산]    ││
│ │ ▓░░░ 45점 (12회) │ │ ▓▓▓▓ 88점 (8회) ││
│ │ ...               │ │ ...               ││
│ └────────────┘ └────────────┘│
├──────────────────────────────────┤
│ Tabs: [모든] [숙제] [자유]            │
│ 검색 / 정렬 / correctness / 도메인     │
│ 점수 범위 (이중 슬라이더)              │
├──────────────────────────────────┤
│ ─ 오늘 (3) ▼ ─                       │
│   시도 카드 ...                       │
│ ─ 어제 (5) ─                         │
│ ─ 이번 주 (12) ─                      │
│ ...                                  │
│ [더 보기]                             │
└──────────────────────────────────┘
```

### 학생이 보는 약점/강점 카드

```
┌─ 📉 약점 매듭 Top 5 ─────────────┐
│  [등식의 가감법]                    │
│  ▓░░░░░ 45점          12회         │
│                                   │
│  [완전제곱식]                       │
│  ▓▓░░░░ 52점          8회          │
│                                   │
│  ...                              │
└──────────────────────────────┘
```

빈 상태:
- 시도 0건 → 카드 자체 X (stats 도 0/0/0)
- 시도 1건+ but 도구당 < 3 → 빈 카드 (mastery 가 비어있음)

### 추천 진입점 — `/problems` 의 "오늘의 추천"

```
오늘의 추천
┌─ 추천 문제 카드 (5개까지) ──┐
│ {문제 본문 100자}             │
│ {도메인}                      │
│                              │
│ [▸ 클릭 시 문제 화면]          │
└─────────────────────┘
```

추천 로직:
1. 즐겨찾기 매듭 (BookmarkedTool) 우선
2. 약점 매듭 (avg < 70, 시도 ≥ 3) 보조
3. 각 도구당 random 1-2 문제

빈 결과 → 최근 5개 problem fallback.

---

## 1.B 강사 입장에서 보는 모습

### 진입 — `/teacher` (대시보드)

```
┌─ 강사 대시보드            [로드 87ms] ─┐
│ 내 학급 학생들의 학습 현황이에요        │
├────────────────────────────────┤
│ Stats Cards (4 분할)               │
│  담당 학급 │ 학생 수 │ 평균 점수 │ 정답률│
│    3개   │  35명   │  68점     │ 52% │
├────────────────────────────────┤
│ 학급 학생들이 자주 막히는 매듭          │
│ (평균 점수 낮은 순)                    │
│ "막대 클릭하면 그 매듭으로 숙제 출제 가능"│
│                                    │
│ [등식의 가감법]      ▓░░░ 42점       │  ← red
│ [완전제곱식]        ▓▓░░ 56점        │  ← amber
│ [근의 공식]         ▓▓▓░ 68점        │  ← amber
│ [인수분해]          ▓▓▓▓ 75점        │  ← emerald
│ ...                                 │
├────────────────────────────────┤
│ 학급에서 자주 풀이된 매듭 Top 10      │
│ (도구 활동량 — 어느 도구가 수업에      │
│  자주 등장했는지)                      │
└────────────────────────────────┘
```

### 차트 막대 클릭 — 숙제 출제로 직행

```
[등식의 가감법] 막대 클릭
        ↓
my_classes 가 2개 이상이면:
[ClassSelectDialog 모달] (어느 학급에 출제할지 선택)
        ↓
my_classes 가 1개면 그 학급으로 자동 진행
        ↓
[AssignmentForm 모달]
  - selectionTab='tool' 자동
  - selectedTool = 'tool_등식의_가감법' 자동
  - classId = 위에서 선택한 학급
        ↓
[강사가 문제 수 / 마감일 등 채워서 출제]
```

### 학생 상세 — `/teacher/students/:id`

학생 카드를 클릭하면 그 학생의 매듭 상세를 봅니다 (admin 도 동일 화면).

```
┌─ ← {학생 이름} ────────────────┐
│   {이메일}                      │
├──────────────────────────────┤
│ Stats: 시도 / 정답률 / 평균       │
├──────────────────────────────┤
│ ── 약점 매듭 (red) ──            │
│  [등식의 가감법]    45점          │
│   시도 12회 · 정답 3회             │
│  ...                             │
├──────────────────────────────┤
│ ── 강점 매듭 (emerald) ──         │
│  [부정적분]        88점           │
│  ...                             │
├──────────────────────────────┤
│ 🎯 매듭 보강 이력                  │
│  [등식의 가감법]   +27점 ↑         │
│   보강 4회 · 재풀이 1 · 유사 9      │
│   보강 전 45점 → 후 72점          │
│  ...                             │
├──────────────────────────────┤
│ 시도 기록 (정렬 / 페이지네이션)     │
│  Card 리스트 (correctness 색상)   │
└──────────────────────────────┘
```

(주의: 보강 이력의 "보강 전 → 후" 가 항상 음수 가능. 알려진 버그 — RemediationPractice 가 score=0 으로만 저장하기 때문)

### 강사가 자기 학급 외의 학생 진입 시도

studentDetailSummary 가 server 에서 차단:

```
caller.role === 'teacher' 일 때:
  target.class_id 가 caller 의 my_classes 에 속해야 통과
  아니면 403 → 토스트 + navigate(-1)
```

---

## 1.C 관리자 입장에서 보는 모습

### 진입 — `/admin` (대시보드)

```
┌─ 분석 대시보드 ────────────────────┐
│                                    │
│ [DataImportPanel — 별도 컴포넌트]    │
├──────────────────────────────────┤
│ Stats Cards (4 분할)                │
│  학생 │ 풀이 │ 평균 │ 정답률          │
├──────────────────────────────────┤
│ 단원별 평균 점수 (BarChart, 세로)     │
├──────────────────────────────────┤
│ 전체 학생이 자주 막히는 매듭 Top 10   │
│ "5회 이상 시도 · 평균 점수 낮은 순"    │
│                                    │
│ [등식의 가감법]    ▓░░░ 38점          │ ← red    (<40)
│ [완전제곱식]      ▓▓░░ 52점           │ ← orange (<60)
│ [근의 공식]       ▓▓▓░ 68점           │ ← yellow
│ ...                                  │
├──────────────────────────────────┤
│ 전체 학생이 자주 푼 매듭 Top 10        │
│ (도구 활동량)                           │
├──────────────────────────────────┤
│ 가장 어려운 문제 (5개)                  │
│  1. {본문 60자}    32점 평균 · 8회      │
│  2. ...                                │
│ (클릭 시 ProblemDetail 로 이동)         │
└──────────────────────────────────┘
```

### 학생 상세 — `/admin/students/:id`

teacher 화면과 같은 컴포넌트 (StudentDetail). admin 은 모든 학생 진입 가능.

### 매듭별 시도 데이터 부족할 때

```
┌─ 전체 학생이 자주 막히는 매듭 ──────┐
│  충분한 시도 데이터가 쌓이면          │
│  표시돼요 (도구당 5회 이상 시도 필요) │
└────────────────────────────┘
```

---

## 2. 알고리즘 / 로직

### 2.1 도구 매핑 — claude_grade_json 의 신호

같은 mastery 집계가 4 곳에서 따로 구현되어 있음 (lib 공유 X — 불일치 가능):

| 위치 | minSamples |
|---|---|
| History (학생 본인) | 3 |
| AdminDashboard | 5 |
| TeacherDashboard (server-side) | 2 |
| StudentDetail (server-side) | 3 |

### 2.2 mastery 집계 알고리즘

```
입력: attempts, problemMap

Map<tool_id, { attempts, correct_count, scores, avg_score }>

for attempt of attempts:
   problem = problemMap.get(attempt.problem_id)
   if (!problem) skip

   toolIds = []

   ─ 1순위: claude_grade_json 의 error_locations
   if (attempt.claude_grade_json):
     grading = JSON.parse(...)
     g = grading?.response ?? grading
     errorToolIds = (g.error_locations || []).map(e => e.tool_id).filter(Boolean)
     if (errorToolIds.length > 0):
       toolIds = unique(errorToolIds)

   ─ fallback: problem.tool_ids
   if (toolIds.length === 0 && problem.tool_ids):
     toolIds = JSON.parse(problem.tool_ids).filter(Boolean)

   for tid in toolIds:
     entry.attempts += 1
     entry.scores.push(attempt.score || 0)
     if (attempt.score >= 80) entry.correct_count += 1

후처리:
   for entry: avg_score = round(mean(scores))
```

> ★ gap_locations.tool_id 는 **mastery 에 사용 X**. error_locations 만 1순위 신호.
> (단 ResultView 의 매듭 보강 권유 카드는 error + gap union — 다른 데이터 정의)

### 2.3 약점 / 강점 매듭 추출

```
topWeakTools(masteryMap, toolNameMap, n, minSamples):
   filter: entry.attempts >= minSamples
   sort: avg_score 오름차순
   slice: 상위 n

topStrongTools(masteryMap, toolNameMap, n, minScore=70, minSamples):
   filter:
     entry.attempts >= minSamples
     AND entry.avg_score >= minScore
   sort: avg_score 내림차순
   slice: 상위 n
```

### 2.4 학생 — History 의 mastery 흐름

```
[mount useEffect]
  ↓
4 개 병렬 fetch:
  StudentAttempt.filter({ student_id }, ..., 1000)
  Problem.list(..., 1000)
  MathTool.list('name', 100)
  Domain.list('name', 50)
  ↓
attempts 0 ? stats {0,0,0}, 종료
  ↓
problemMap, toolNameMap 만들기
  ↓
masteryMap = aggregateToolMastery(attempts, problemMap)
  ↓
weakTools = topWeakTools(masteryMap, toolNameMap, 5, 3)
strongTools = topStrongTools(masteryMap, toolNameMap, 5, 70, 3)
```

### 2.5 강사 — TeacherDashboard 흐름

server function 이 모든 작업을 처리:

```
[client]
  useTeacher() — 5분 캐시
    ↓ data null + cache 만료 시
  base44.functions.invoke('teacherSummary')

[server: teacherSummary]
  1. Class.list 500 + Academy.list 200 → my_classes 추출
  2. 학급별 User.filter (병렬) → my_students
  3. 학생별 StudentAttempt.filter (배치 20 병렬) → allAttempts
  4. unique problem_ids 추출 → Problem.list 5000 → problemMap
  5. MathTool.list 100 → toolNameMap
  6. aggregateToolMastery (서버 재구현)
  7. weak_tools: minSamples 2, avg 오름차순 Top 8
  8. tool_distribution: attempts 내림차순 Top 10
  9. attempts_summary 전체 집계
  ↓ JSON 응답

[client]
  data.weak_tools → BarChart 의 dataKey="avg_score"
  data.tool_distribution → BarChart 의 dataKey="attempts"
```

### 2.6 차트 막대 onClick → 숙제 출제

```
weak_tools BarChart 의 Bar 컴포넌트:

onClick(data):
  tool = weak_tools.find(t => t.name === data.name)
  if (!tool) return
  setPendingTool(tool.tool_id)

  if (my_classes.length === 1):
    setSelectedClass(my_classes[0].id)
    setShowForm(true)
  else:
    (조건부 렌더로 ClassSelectDialog 표시)
   ↓
[ClassSelectDialog (학급 2개 이상일 때만)]
  onSelect(classId):
    setSelectedClass(classId)
    setShowForm(true)
   ↓
<AssignmentForm
  classId={selectedClass}        ← 강사가 선택한 학급
  preselectedToolId={pendingTool}
  ...
/>
```

### 2.7 관리자 — AdminDashboard 흐름

client-side 에서 처리 (server function 없음):

```
[/admin 진입]
  ↓
4 병렬 fetch:
  StudentAttempt.list('-submitted_at', 200)   ← 양 적음
  User.list('-created_date', 100)
  Problem.list('-created_date', 1000)
  MathTool.list('name', 100)
  ↓
stats: total / avg / correctRate
domainData: problem_domain 별 그룹 → 평균 + count → count desc Top 10
masteryMap: client-side aggregateToolMastery
weakToolChart: topWeakTools(_,_,10,5)  ← minSamples 5
toolUsageChart: attempts desc Top 10
hardestProblems: problem_id 별 그룹 → count >= 2 → avg 오름차순 Top 5
```

### 2.8 학생 상세 — StudentDetail 흐름

server function 으로 처리:

```
[client]
  base44.functions.invoke('studentDetailSummary', { userId })

[server]
  1. caller 권한 체크 (admin 또는 teacher)
  2. teacher 면 my_classes 매칭으로 권한 체크 (다른 학급 학생 → 403)
  3. target user 조회
  4. StudentAttempt.filter({student_id}, ..., 1000)
  5. MathTool.list 100
  6. Problem.list 1000 → unique problem_ids 만 filter
  7. mastery 집계 (toolMastery inline 재구현)
  8. weak_tools: minSamples 3, avg 오름차순 Top 5
     strong_tools: minSamples 3, avg >= 70, avg 내림차순 Top 5
  9. remediation_history 계산 (다음 단락)
  ↓ JSON 응답
```

### 2.9 remediation_history 계산

```
attempts 의 attempt_type 이 remediation_retry 또는 remediation_practice 인 것 만:

target_tool_id 별 그룹:
  retry_count, practice_count 누적

  retry 일 때:
    parent_attempt_id 로 부모 시도 찾기
    parent.score → before_scores 에 push

  practice 일 때:
    attempt.score → after_scores 에 push  ★ 항상 0 (RemediationPractice 버그)

각 그룹별:
  before_avg = round(mean(before_scores))
  after_avg = round(mean(after_scores))    ★ 항상 0
  improvement = round(after_avg - before_avg)  ★ 거의 항상 음수

filter: retry_count > 0 OR practice_count > 0
```

→ improvement 가 항상 음수로 표시될 가능성. RemediationPractice 의 OCR/채점 미호출 버그 영향.

### 2.10 ProblemSelect "오늘의 추천" — 학생 client-side

```
[user 변경 시 useEffect]
  ↓
4 병렬:
  BookmarkedTool.filter({ student_id })
  StudentAttempt.filter({ student_id }, ..., 500)
  Problem.list('-created_date', 1000)
  MathTool.list('name', 100)
  ↓
client-side mastery 집계 (toolMastery 인라인)
  ↓
weakToolIds = entries.filter(attempts >= 3 && avg < 70).map(toolId)
  ↓
recommendedToolIds =
  unique([...bookmarks.map(b=>b.tool_id), ...weakToolIds.slice(0,5)])
  ↓
recommendedToolIds.slice(0, 3) 의 각 도구:
  toolProblems = allProblems.filter(p => p.tool_ids.includes(toolId))
  shuffled.slice(0, 2) 추가
  ↓
recProblems 빈 ? allProblems.slice(0, 5)  ← random 적용 X (★ 알려진 한계)
```

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/lib/toolMastery.js                  ← aggregateToolMastery + topWeakTools + topStrongTools

src/pages/History.jsx                   ← 학생 본인 약점/강점
src/pages/admin/AdminDashboard.jsx      ← 전체 학생 차트
src/pages/teacher/TeacherDashboard.jsx  ← 학급 차트 + 막대 클릭 → AssignmentForm

src/pages/shared/StudentDetail.jsx      ← admin/teacher 모두 사용

src/pages/ProblemSelect.jsx
  └─ "오늘의 추천" (라인 194-283)

src/lib/TeacherContext.jsx              ← 5분 캐시
base44/functions/teacherSummary/entry.ts
base44/functions/studentDetailSummary/entry.ts

base44/entities/BookmarkedTool.jsonc
base44/entities/MathTool.jsonc
```

### 3.2 toolMastery.js 의 시그니처

```js
// aggregateToolMastery
export function aggregateToolMastery(attempts, problemMap)
   → Map<tool_id, { attempts, correct_count, scores, avg_score }>

// topWeakTools
export function topWeakTools(masteryMap, toolNameMap, n = 5, minSamples = 3)
   → Array<{ tool_id, name, goal, attempts, avg_score, correct_count }>
     // avg_score 오름차순 N 개

// topStrongTools
export function topStrongTools(masteryMap, toolNameMap, n = 5, minScore = 70, minSamples = 3)
   → Array<{ tool_id, name, goal, attempts, avg_score, correct_count }>
     // avg_score 내림차순 N 개
```

### 3.3 History 의 mastery fetch (`History.jsx:69-104`)

```js
useEffect(() => {
  if (!user) return;
  (async () => {
    setMasteryLoading(true);
    try {
      const [allAttempts, allProblems, allTools, allDomains] = await Promise.all([
        base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 1000, 0),
        base44.entities.Problem.list('-created_date', 1000, 0),
        base44.entities.MathTool.list('name', 100),
        base44.entities.Domain.list('name', 50),
      ]);

      if (allAttempts.length === 0) {
        setStats({ total: 0, correct: 0, avg: 0 });
        setMasteryLoading(false);
        return;
      }

      const total = allAttempts.length;
      const correct = allAttempts.filter(a => a.correctness === 'correct').length;
      const avg = Math.round(allAttempts.reduce((s, a) => s + (a.score || 0), 0) / total);
      setStats({ total, correct, avg, capped: total >= 1000 });

      const problemMap = new Map(allProblems.map(p => [p.id, p]));
      const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));
      setDomains(allDomains);

      const masteryMap = aggregateToolMastery(allAttempts, problemMap);
      setWeakTools(topWeakTools(masteryMap, toolNameMap, 5, 3));
      setStrongTools(topStrongTools(masteryMap, toolNameMap, 5, 70, 3));
    } finally {
      setMasteryLoading(false);
    }
  })();
}, [user?.id]);
```

### 3.4 AdminDashboard 의 처리 (`AdminDashboard.jsx:24-100`)

```js
const loadDashboard = async () => {
  const [attempts, users, allProblems, allTools] = await Promise.all([
    base44.entities.StudentAttempt.list('-submitted_at', 200),
    base44.entities.User.list('-created_date', 100),
    base44.entities.Problem.list('-created_date', 1000),
    base44.entities.MathTool.list('name', 100),
  ]);

  // stats
  setStats({
    totalStudents: users.length,
    totalAttempts: attempts.length,
    avgScore: ...,
    correctRate: ...,
  });

  // domainData
  const domainMap = {};
  attempts.forEach(a => {
    const d = a.problem_domain || '미분류';
    if (!domainMap[d]) domainMap[d] = { total: 0, sum: 0 };
    domainMap[d].total++;
    domainMap[d].sum += a.score || 0;
  });
  setDomainData(
    Object.entries(domainMap)
      .map(([name, v]) => ({ name, avg: Math.round(v.sum / v.total), count: v.total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  );

  // hardestProblems
  // ... problem_id 별 그룹 + count >= 2 → avg 오름차순 Top 5

  // weakToolChart, toolUsageChart
  const problemMap = new Map(allProblems.map(p => [p.id, p]));
  const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));
  const masteryMap = aggregateToolMastery(attempts, problemMap);

  setWeakToolChart(
    topWeakTools(masteryMap, toolNameMap, 10, 5)
      .map(t => ({ name: t.name, avg: t.avg_score, count: t.attempts }))
  );

  const usageArr = [];
  masteryMap.forEach((entry, toolId) => {
    const tool = toolNameMap.get(toolId);
    usageArr.push({ name: tool?.name || toolId, count: entry.attempts, avg: entry.avg_score });
  });
  setToolUsageChart(usageArr.sort((a, b) => b.count - a.count).slice(0, 10));
};
```

차트의 색상 분기:

```jsx
{weakToolChart.map((entry, i) => (
  <Cell key={i} fill={
    entry.avg < 40 ? '#ef4444' :
    entry.avg < 60 ? '#f97316' :
                     '#eab308'
  } />
))}
```

### 3.5 TeacherDashboard 의 차트 onClick (`TeacherDashboard.jsx:78-93`)

```jsx
<Bar
  dataKey="avg_score"
  onClick={(data) => {
    const tool = weak_tools.find(t => t.name === data.name);
    if (tool) {
      setSelectedToolForAssignment(tool.tool_id);
      setShowAssignmentForm(true);
    }
  }}
  style={{ cursor: 'pointer' }}
>
  {weak_tools.map((entry, i) => (
    <Cell key={i} fill={
      entry.avg_score < 50 ? '#ef4444' :
      entry.avg_score < 70 ? '#f59e0b' :
                              '#10b981'
    } />
  ))}
</Bar>
```

(★ Admin 의 색상 임계값과 다름: 40/60 vs 50/70 — 의도된 건지 정의 필요)

2단계 흐름 (ClassSelectDialog → AssignmentForm):

```jsx
const [pendingTool, setPendingTool] = useState(null);
const [selectedClass, setSelectedClass] = useState(null);
const [showForm, setShowForm] = useState(false);

const handleBarClick = (data) => {
  const tool = weak_tools.find(t => t.name === data.name);
  if (!tool) return;
  setPendingTool(tool.tool_id);
  if (my_classes.length === 1) {
    setSelectedClass(my_classes[0].id);
    setShowForm(true);
  }
};

{pendingTool && !selectedClass && my_classes.length > 1 && (
  <ClassSelectDialog
    classes={my_classes}
    onSelect={(cid) => { setSelectedClass(cid); setShowForm(true); }}
    onClose={() => { setPendingTool(null); }}
  />
)}
{showForm && selectedClass && (
  <AssignmentForm
    classId={selectedClass}
    preselectedToolId={pendingTool}
    ...
  />
)}
```

`ClassSelectDialog` 는 `src/components/ClassSelectDialog.jsx` 로 추출되어 TeacherAssignments 와 공유.

### 3.6 TeacherContext (`src/lib/TeacherContext.jsx`)

```js
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

const load = useCallback(async (force = false) => {
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return;
  if (!force && data && loadedAtRef.current) {
    const age = Date.now() - loadedAtRef.current;
    if (age < CACHE_TTL_MS) return;
  }
  setLoading(true);
  try {
    const res = await base44.functions.invoke('teacherSummary', {});
    setData(res.data);
    loadedAtRef.current = Date.now();
  } catch (e) {
    setError(e.message || '데이터를 불러오지 못했어요');
  } finally {
    setLoading(false);
  }
}, [user?.id]);

return (
  <TeacherContext.Provider value={{
    data, loading, error,
    refresh: () => load(true)
  }}>
    {children}
  </TeacherContext.Provider>
);
```

### 3.7 teacherSummary 의 mastery 집계 (`teacherSummary/entry.ts:4-45`)

```ts
function aggregateToolMastery(attempts, problemMap) {
  const masteryMap = new Map();

  for (const attempt of attempts) {
    const problem = problemMap.get(attempt.problem_id);
    if (!problem) continue;

    let toolIds = [];

    if (attempt.claude_grade_json) {
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
      if (!masteryMap.has(toolId)) {
        masteryMap.set(toolId, { attempts: 0, correct_count: 0, scores: [] });
      }
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
```

(클라이언트 toolMastery.js 와 거의 동일 — 단지 lib 공유 X 라 따로 구현)

### 3.8 weak_tools 추출 (`teacherSummary/entry.ts:158-171`)

```ts
const weak_tools = [];
masteryMap.forEach((entry, toolId) => {
  if (entry.attempts < 2) return;       // ★ minSamples 2
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
```

### 3.9 studentDetailSummary 의 remediation_history (`studentDetailSummary/entry.ts:92-131`)

```ts
const remediationMap = new Map();
attempts.forEach(attempt => {
  if (attempt.attempt_type === 'remediation_retry'
   || attempt.attempt_type === 'remediation_practice') {
    const tid = attempt.target_tool_id;
    if (!tid) return;
    if (!remediationMap.has(tid)) {
      remediationMap.set(tid, {
        retry_count: 0, practice_count: 0,
        before_scores: [], after_scores: []
      });
    }
    const entry = remediationMap.get(tid);
    if (attempt.attempt_type === 'remediation_retry') {
      entry.retry_count += 1;
      if (attempt.parent_attempt_id) {
        const parent = attempts.find(a => a.id === attempt.parent_attempt_id);
        if (parent) entry.before_scores.push(parent.score || 0);
      }
    } else {
      entry.practice_count += 1;
      entry.after_scores.push(attempt.score || 0);  // ★ 항상 0
    }
  }
});

const remediation_history = [...remediationMap.entries()].map(([tid, entry]) => ({
  tool_id: tid,
  tool_name: toolNameMap.get(tid)?.name || tid,
  retry_count: entry.retry_count,
  practice_count: entry.practice_count,
  before_avg: ...,
  after_avg: ...,
  improvement: ...
})).filter(r => r.retry_count > 0 || r.practice_count > 0);
```

### 3.10 StudentDetail 의 remediation 카드 (`StudentDetail.jsx:158-187`)

```jsx
{remediationHistory.map(rec => (
  <Card key={rec.tool_id}>
    <p>{rec.tool_name}</p>
    <span className={
      rec.improvement > 0 ? 'text-emerald-600'
      : rec.improvement < 0 ? 'text-red-600'
      : 'text-muted-foreground'
    }>
      {rec.improvement > 0 ? '+' : ''}{rec.improvement}점
    </span>
    <div>
      보강 {rec.retry_count + rec.practice_count}회
      · 재풀이 {rec.retry_count}회
      · 유사 문제 {rec.practice_count * 3}개   {/* ★ × 3 가정 */}
    </div>
    <div>
      보강 전 {rec.before_avg}점 → 후 {rec.after_avg}점
    </div>
  </Card>
))}
```

> "유사 문제 N×3개" 는 practice 카운트에 3 을 곱함 — practice 1회당 3 문제 가정. 그러나 실제로는 practice 1 회당 row 1 개라 정확하지 않음.

### 3.11 ProblemSelect "오늘의 추천" (`ProblemSelect.jsx:194-283`)

```js
useEffect(() => {
  const loadRecs = async () => {
    if (!user) return;
    try {
      const [bookmarks, allAttempts, allProblems, allTools] = await Promise.all([
        BookmarkedTool.filter({ student_id: user.id }),
        StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 500),
        Problem.list('-created_date', 1000, 0),
        MathTool.list('name', 100),
      ]);

      const problemMap = new Map(allProblems.map(p => [p.id, p]));
      const toolMap = new Map(allTools.map(t => [t.tool_id, t]));

      // mastery 집계 (inline)
      const masteryMap = new Map();
      allAttempts.forEach(attempt => {
        const problem = problemMap.get(attempt.problem_id);
        if (!problem) return;
        let toolIds = [];
        if (attempt.claude_grade_json) {
          try {
            const g = JSON.parse(attempt.claude_grade_json);
            const grading = g?.response ?? g;
            const errorToolIds = (grading?.error_locations || []).map(e => e.tool_id).filter(Boolean);
            if (errorToolIds.length > 0) toolIds = [...new Set(errorToolIds)];
          } catch {}
        }
        if (toolIds.length === 0 && problem.tool_ids) {
          const parsed = JSON.parse(problem.tool_ids);
          if (Array.isArray(parsed)) toolIds = parsed.filter(Boolean);
        }
        toolIds.forEach(toolId => {
          if (!masteryMap.has(toolId)) masteryMap.set(toolId, { attempts: 0, scores: [] });
          const entry = masteryMap.get(toolId);
          entry.attempts += 1;
          entry.scores.push(attempt.score || 0);
        });
      });

      // weak: avg < 70, attempts >= 3
      const weakToolIds = [];
      masteryMap.forEach((entry, toolId) => {
        if (entry.attempts >= 3) {
          const avg = entry.scores.reduce((s, x) => s + x, 0) / entry.scores.length;
          if (avg < 70) weakToolIds.push(toolId);
        }
      });

      // 즐겨찾기 + weak 결합
      const recommendedToolIds = [
        ...new Set([
          ...bookmarks.map(b => b.tool_id),
          ...weakToolIds.slice(0, 5)
        ])
      ];

      // 도구당 1-2 문제 random
      const recProblems = [];
      recommendedToolIds.slice(0, 3).forEach(toolId => {
        const toolProblems = allProblems.filter(p => {
          const ids = JSON.parse(p.tool_ids || '[]');
          return ids.includes(toolId);
        });
        if (toolProblems.length > 0) {
          const shuffled = toolProblems.sort(() => Math.random() - 0.5);
          recProblems.push(...shuffled.slice(0, 2));
        }
      });

      // fallback
      const finalRecs = recProblems.length > 0
        ? recProblems
        : allProblems.slice(0, 5);   // ★ random 적용 X
      setRecommendedProblems(finalRecs);
    } catch (e) {
      console.error(e);
    }
  };
  loadRecs();
}, [user]);
```

### 3.12 알려진 이슈 / 미결정

#### 데이터 정합성

- **mastery minSamples 4종 불일치** — History (3), Admin (5), Teacher server (2), StudentDetail (3). 한 곳에서 정의해 공유 필요.
- **mastery 가 lib 공유 X** — toolMastery.js 와 server 들에서 각각 inline 재구현. drift 가능.
- **차트 색상 임계값 불일치** — Admin (40/60) vs Teacher (50/70). 의도된 건지 정의 필요.

#### LLM 매핑 신뢰도

- 비어 있을 때 `problem.tool_ids` 로 fallback — 한 문제에 도구 여러 개일 때 부정확.
- gap_locations.tool_id 는 mastery 에 사용 X (Remediation 권유 카드와 다름).

✅ 해결됨:
- ~~claude_grade_json.error_locations.tool_id 가 LLM 임의 ID 로 채워짐~~ → grading prompt 의 `<available_tools>` 강제 + 저장 전 sanitize 로 해결.

#### remediation_history

- **after_scores 가 항상 0** — RemediationPractice 의 score=0 저장 버그 영향.
- improvement 가 거의 항상 음수.
- "유사 문제 N×3" 표시가 부정확 — practice 1회당 row 1 개임에도 ×3 가정.

#### 기능 부재

- 기간별 분석 (최근 7일 / 한 달 / 전체) V2.
- 도구별 그룹화 / 정렬 옵션 V2.
- 점진적 향상 시간 추이 분석 V2.
- 학급 간 비교 V2.
- ProblemSelect 추천의 random fallback (현재 항상 최근 5개).

### 3.13 QA 체크리스트

#### 학생 — History

- [ ] /history 의 stats Card (총 풀이 / 정답 / 평균) 정상
- [ ] 약점 / 강점 매듭 Card (도구당 시도 ≥ 3)
- [ ] 시도 < 3 도구는 표시 X
- [ ] avg / 시도 / 정답 정확
- [ ] Tabs (모든/숙제/자유) client-side filter
- [ ] 검색 / 정렬 / correctness / 도메인 / 점수 범위 동작
- [ ] 날짜 그룹화 + 토글
- [ ] [더 보기] 페이지네이션

#### 관리자 — Dashboard

- [ ] /admin 매듭별 약점 차트 (도구당 시도 ≥ 5, Top 10)
- [ ] Cell 색상 (<40 red / <60 orange / 그 외 yellow)
- [ ] 시도 분포 차트 (Top 10)
- [ ] 단원별 평균 차트 (Top 10)
- [ ] hardestProblems 클릭 → /admin/problems/{entity_id}

#### 강사 — Dashboard

- [ ] /teacher 의 자기 학급 매듭 차트 (다른 학급 데이터 X)
- [ ] 차트 막대 클릭 → AssignmentForm (preselectedToolId 적용)
- [ ] ★ classId 가 항상 my_classes[0] (알려진 이슈)
- [ ] 담당 학급 0 시 안내
- [ ] TeacherProvider 5분 캐시

#### StudentDetail (admin/teacher)

- [ ] /admin/students/:id 또는 /teacher/students/:id 진입
- [ ] studentDetailSummary 1회 호출로 모든 데이터
- [ ] 약점 / 강점 매듭 (시도 ≥ 3)
- [ ] 보강 이력 (★ practice score=0 영향)
- [ ] 시도 timeline + 페이지네이션 (PAGE_SIZE=20)
- [ ] Teacher 가 자기 학급 외 진입 시 차단 → toast + navigate(-1)

#### ProblemSelect "오늘의 추천"

- [ ] 즐겨찾기 우선 + weak 보조 결합
- [ ] 각 도구당 random 1-2 문제 (상위 3 도구)
- [ ] 추천 카드 클릭 → /problem/:id (자유 풀이)
- [ ] 빈 상태 fallback — 최근 5개 (random X)
