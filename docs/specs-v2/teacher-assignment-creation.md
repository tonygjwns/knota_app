# 강사 숙제 출제 / 관리

강사가 자기 학급에 숙제를 만들고, 학생 제출을 모니터링하고, 마감/삭제하는 흐름.

(학생 측 받은 숙제 흐름은 `student-assignment-flow.md` 참조)

---

## 1. 큰 그림

### 1.1 한 문장으로

> 강사가 도구별 / 단원별 / 직접 선택으로 문제 N개를 묶어 학급에 출제하고, 학생들의 진행률을 실시간 확인.

### 1.2 누가 사용?

| 사용자 | 사용 가능 여부 |
|---|---|
| **teacher** | 본인이 main_teacher_id 또는 assistant_teacher_ids 인 학급에만 출제 / 관리 |
| **admin** | teacher 와 동일하게 동작 (teacherSummary 함수가 admin 도 통과시킴) — 단 본인이 학급 강사로 배정돼 있어야 my_classes 에 잡힘 |
| **student** | 진입 자체 차단 (`/teacher/*` 접근 시 `/home` 으로) |

---

## 1.A teacher 입장에서 보는 모습

### 진입 동선

```
[/teacher (대시보드)]
   │
   ├─→ "숙제" 메뉴 클릭
   │      ↓
   │   [/teacher/assignments]
   │      ↓ "+새 숙제"
   │   [ClassSelectDialog]
   │      ↓
   │   [AssignmentForm 모달]
   │
   ├─→ "내 학급" 메뉴
   │      ↓
   │   [/teacher/classes]
   │      ↓ 학급 카드의 [숙제 만들기]
   │   [AssignmentForm 모달] (그 학급 사전 선택)
   │
   └─→ 대시보드 매듭별 약점 차트
          ↓ 막대 클릭
       (학급 2개 이상이면) [ClassSelectDialog]
          ↓ 학급 1개면 자동으로 그 학급
       [AssignmentForm 모달] (도구 + 학급 사전 선택)
```

### 숙제 리스트 화면 (`/teacher/assignments`)

```
┌─ 출제한 숙제              [+ 새 숙제] ─┐
├──────────────────────────────────┤
│ Tabs: [전체] [진행중] [마감]            │
│                  [학급 선택 ▼]         │
├──────────────────────────────────┤
│ ┌─ 숙제 카드 ──────[진행중] [⋮]─────┐ │
│ │ 8주차 - 이차방정식                  │ │
│ │ 중3-A반                            │ │
│ │ {description}                       │ │
│ │ 출제일: Jan 15, 14:30                │ │
│ │ 마감: Jan 22, 23:59                 │ │
│ │                                    │ │
│ │ 총 10문제 · 학생 12명 · 제출 0건    │ │
│ │              ↑                      │ │
│ │   ★ 항상 0 (하드코딩, 알려진 이슈)  │ │
│ └────────────────────────────┘ │
│                                    │
│ (카드 클릭 → /teacher/assignments/:id) │
│ (⋮ 메뉴: 마감 / 복사 / 삭제)            │
└──────────────────────────────────┘
```

### 숙제 출제 모달 (AssignmentForm)

3 가지 방식으로 문제를 모을 수 있습니다.

```
┌─ 새 숙제 출제                        [✕] ─┐
│ 제목 *                                    │
│ [______________________________________]   │
│                                          │
│ 설명 (선택)                                │
│ [________________________________________]│
│                                          │
│ 마감일 (선택)                              │
│ [datetime-local] [확인] [지우기]            │
│ ✓ 마감일: Jan 22, 23:59                   │
├──────────────────────────────────────┤
│ 문제 선택 *                                │
│ Tabs: [도구별] [단원별] [직접 선택]          │
│                                          │
│ ─ 도구별 탭 ─                              │
│  도구 ▼ : 등식의 가감법                     │
│  문제 수 [10] 개   [↻ 다시 뽑기]            │
│  미리보기 (10개)  [전체 선택] [전체 해제]    │
│                                          │
│  ┌─ 카드 (체크박스) ─────────────────┐   │
│  │ ☑ 65b3d2... 본문 50자...           │   │
│  │ ☐ 78f1a5... 본문 50자...           │   │
│  │ ...                                  │   │
│  └────────────────────────────┘   │
│  [선택한 7개 문제 추가]                     │
├──────────────────────────────────────┤
│ 선택된 문제 (7개)                           │
│  - 65b3d2... [도메인] [✕]                  │
│  - ...                                    │
├──────────────────────────────────────┤
│              [취소]  [숙제 출제]            │
└──────────────────────────────────────┘
```

각 탭의 차이:

| 탭 | 동작 |
|---|---|
| **도구별** | MathTool 선택 + 문제 수 → 그 도구를 쓰는 problem 들 random shuffle 후 N개 미리보기 → 체크박스로 추리기 |
| **단원별** | Domain 선택 + 동일한 패턴 |
| **직접 선택** | 검색 (제목 / 도메인) → grid 결과 카드 클릭 토글 |

### 숙제 상세 화면 (`/teacher/assignments/:id`)

```
┌─ ← 8주차 - 이차방정식  [진행중]  [수정] [⋮] ─┐
│ 중3-A반                                       │
│ 출제일: Jan 15, 14:30                          │
│ 마감: Jan 22, 23:59                            │
├────────────────────────────────────────┤
│ 설명: ...                                     │
├────────────────────────────────────────┤
│ 출제된 문제 (10)                              │
│ ┌─ 카드 (클릭 시 ProblemDetail 로) ──────┐   │
│ │ 65b3d2...                              │   │
│ │ [도메인]                                 │   │
│ │ {본문 80자}...                           │   │
│ └────────────────────────────────┘   │
│ ...                                          │
├────────────────────────────────────────┤
│ 학생별 제출 현황                               │
│ ┌─ 학생 카드 ───────────────────────────┐   │
│ │ 김철수                                  │   │
│ │ kim@example.com                         │   │
│ │ 진행: 6/10 문제                          │   │
│ │ 평균: 75점 · 정답: 60%                   │   │
│ │ ▓▓▓▓▓▓░░░░ 60%                         │   │
│ └────────────────────────────────┘   │
│ (카드 클릭 → /teacher/students/:id)            │
└────────────────────────────────────────┘
```

학생 제출이 1건이라도 있으면 [수정] 버튼이 disabled (제출자에게 영향 줄까봐).

### ⋮ 메뉴 항목

```
[수정]   ← 제출 0건일 때만 활성 (AssignmentDetail 헤더에만 있음)
[마감]   ← active 일 때만 표시 (status='closed' 로 update)
[복사하여 새 숙제]   ← (현재는 학급만 사전 설정한 빈 폼만 열림 — 미구현)
[삭제]   ← AlertDialog confirm 후 delete
```

### 다른 학급 숙제 직접 URL 진입

현재 별도 가드가 없습니다.

다만 teacherData.my_students 가 그 학급에 속한 학생만 들고 있으므로, **학생 제출 현황이 빈 리스트로 표시되는 것**으로 우회 표현됨. 이상적이지 않은 가드 — 6번 미결정 참조.

---

## 1.B admin 입장에서 보는 모습

admin 의 출제 흐름은 거의 teacher 와 동일합니다.

### 차이점

| 항목 | admin | teacher |
|---|---|---|
| 진입 가드 | `/admin` 영역에 있음 | `/teacher` 영역에 있음 |
| 사이드바 | 관리자 패널 사이드바 | 강사 패널 사이드바 |
| my_classes | 본인이 main 또는 assistant 로 배정된 학급 (보통 0개) | 동일 |
| 학원/학급 자체 만들기 | `/admin/academies` 에서 가능 | 불가 |
| 모든 학원의 학생 / 숙제 보기 | `/admin/students` 등에서 전체 조회 | 자기 학급만 |

### admin 이 자기 학급에 출제하려면

admin 본인을 어느 학급의 main_teacher_id 또는 assistant_teacher_ids 에 추가해야 합니다.

→ AdminAcademies 의 학급 ClassModal 에서 본인을 강사로 배정.

### 모니터링 차원의 사용

admin 은 보통 강사 화면 (`/teacher`) 진입 시 redirect 됩니다 (`'강사만 접근 가능해요'` → /admin).

→ admin 이 숙제 데이터를 보려면 `/admin/students/:id` 를 통해 개별 학생 시도 timeline 을 보거나, AdminDashboard 의 차트로 확인.

---

## 2. 알고리즘 / 로직

### 2.1 숙제 데이터 흐름

```
[teacher 가 출제]
   ↓ Assignment.create
[Assignment 1행 생성]
   ↓ class_id 가 학급에 매칭
[학생들의 ProblemSelect 의 받은 숙제 섹션에 표시]
   ↓
[학생이 풀이 제출 시]
   ↓ StudentAttempt.create with assignment_id
[StudentAttempt 1행 (assignment_id 채워짐)]
   ↓
[teacher 의 AssignmentDetail 에서 학생별 진행률 계산]
```

### 2.2 my_classes 매칭 (teacherSummary 함수)

```
my_classes =
  Class.list 전체 중에서
  c.main_teacher_id === user.id
  OR c.assistant_teacher_ids.includes(user.id)
```

### 2.3 TeacherAssignments 의 fetch

```
teacherData.my_classes (TeacherProvider 캐시)
  ↓
각 학급별 병렬 호출:
  Assignment.filter({ class_id: cid }, '-created_date', 100)
  ↓
flat → 합쳐서 setAssignments
  ↓
client-side 필터:
  statusFilter (전체 / 진행중 / 마감)
  classFilter (전체 / 특정 학급)
  ↓
정렬: created_date 내림차순
```

### 2.4 AssignmentForm 의 문제 선택 알고리즘

```
[도구별 탭]

selectedTool 변경 또는 toolCount 변경 시:
  filtered = allProblems.filter(p =>
    JSON.parse(p.tool_ids).includes(selectedTool)
  )
  shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, toolCount)
  setToolPreview(shuffled)
  setSelectedToolPreviewIds(new Set(shuffled.map(p => p.id)))
                              ↑
                       default 로 모두 체크된 상태

"선택한 N개 추가" 클릭:
  ids = preview 중 selectedToolPreviewIds 에 들어있는 ids
  - 이미 selectedProblems 에 있는 건 제외 (중복 방지)
  selectedProblems 에 추가
```

### 2.5 AssignmentForm 의 저장 처리

```
가드: title.trim() && selectedProblems.length > 0

user = await base44.auth.me()

selection_criteria = {
  type: selectionTab,    // 'tool' / 'domain' / 'direct'
  tool: selectedTool,    // tool 탭일 때만
  domain: selectedDomain // domain 탭일 때만
}

data = {
  title, description (빈 값이면 null), class_id,
  created_by: user.id,
  problem_ids: JSON.stringify(selectedProblems),
  deadline: deadline || null,
  status: assignment?.status || 'active',
  selection_criteria: JSON.stringify(selection_criteria)
}

await onSave(data)  // 부모가 create 또는 update 결정
onClose()
```

### 2.6 AssignmentDetail 의 학생별 진행률 계산

```
classStudents = teacherData.my_students.filter(
  s => s.class_id === assignment.class_id
)

for student of classStudents:
  ★ 순차 (await in for loop) — 알려진 성능 이슈
  attempts = await StudentAttempt.filter({
    student_id: student.id,
    assignment_id: assignmentId
  })

  uniqueProblemIds = unique(attempts.map(a => a.problem_id))
  avgScore = round(mean(attempts.score))
  correctRate = round(correctCount / uniqueProblemIds.length × 100)

  push({ student, attempts, progressCount, avgScore, correctRate })
```

### 2.7 마감 / 삭제 / 수정 처리

```
[마감] Assignment.update(_, { status: 'closed' })
       + setAssignment(prev => { ...prev, status: 'closed' })

[삭제] Assignment.delete(assignmentId)
       + navigate('/teacher/assignments')

[수정] AssignmentForm 모달 열기 (assignment prop 으로 기존 값 주입)
       저장 시 Assignment.update(assignmentId, data)
       + window.location.reload()  ★ 알려진 안티 패턴
```

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/pages/teacher/TeacherAssignments.jsx
src/pages/teacher/AssignmentDetail.jsx
src/pages/teacher/TeacherClasses.jsx       ← [숙제 만들기] 버튼
src/pages/teacher/TeacherDashboard.jsx     ← 차트 클릭 → AssignmentForm

src/components/AssignmentForm.jsx          ← 출제 / 수정 모달

src/lib/TeacherContext.jsx                 ← 5분 캐시 + my_classes
base44/functions/teacherSummary/entry.ts   ← server-side 집계

base44/entities/Assignment.jsonc
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
  selection_criteria: ?  ← 출제 메타 JSON
}
```

### 3.3 TeacherAssignments 의 fetch (`TeacherAssignments.jsx:62-91`)

```js
const loadAssignments = async () => {
  if (!my_classes || my_classes.length === 0) {
    setAssignments([]);
    return;
  }
  const classIds = my_classes.map(c => c.id);
  const results = await Promise.all(
    classIds.map(cid =>
      base44.entities.Assignment.filter(
        { class_id: cid }, '-created_date', 100
      )
    )
  );
  results.forEach(res => {
    if (Array.isArray(res)) allAssignments.push(...res);
  });
  setAssignments(allAssignments);
};
```

(SDK 가 `$in` 미지원이라 학급별 병렬 호출)

### 3.4 새 숙제 출제 흐름

#### TeacherAssignments 의 [+ 새 숙제]

```
setSelectedClassForForm(null) + setShowForm(true)
   ↓
ClassSelectDialog 표시 (my_classes 리스트)
   ↓ 학급 클릭
setSelectedClassForForm(cid)
   ↓
<AssignmentForm classId={selectedClassForForm} ... />
```

#### TeacherClasses 학급 카드의 [숙제 만들기]

```
e.stopPropagation 으로 카드 진입 차단
   ↓
setSelectedClassId(cls.id) + setShowForm(true)
   ↓
<AssignmentForm classId={selectedClassId} ... />
```

#### TeacherDashboard 차트 막대 클릭 (`TeacherDashboard.jsx:78-89`)

```jsx
const [pendingTool, setPendingTool] = useState(null);
const [selectedClass, setSelectedClass] = useState(null);
const [showForm, setShowForm] = useState(false);

<Bar dataKey="avg_score" onClick={(data) => {
  const tool = weak_tools.find(t => t.name === data.name);
  if (!tool) return;
  setPendingTool(tool.tool_id);
  if (my_classes.length === 1) {
    setSelectedClass(my_classes[0].id);
    setShowForm(true);
  }
  // else: ClassSelectDialog 가 조건부 렌더로 표시됨
}}>
```

조건부 렌더:

```jsx
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

`ClassSelectDialog` 는 `src/components/ClassSelectDialog.jsx` 로 추출되어 TeacherAssignments 와 공유됨.

### 3.5 AssignmentForm 진입 시 데이터 fetch (`AssignmentForm.jsx:73-93`)

```js
useEffect(() => {
  const init = async () => {
    const [toolsData, domainsData, problemsData] = await Promise.all([
      base44.entities.MathTool.list('name', 100),
      base44.entities.Domain.list('name', 100),
      base44.entities.Problem.list('-created_date', 1000),
    ]);
    setTools(toolsData);
    setDomains(domainsData);
    setAllProblems(problemsData);

    if (preselectedToolId && toolsData.length > 0) {
      setSelectedTool(preselectedToolId);
    }
  };
  init();
}, [preselectedToolId]);
```

### 3.6 미리보기 재생성 (`AssignmentForm.jsx:95-109`)

```js
const regenerateToolPreview = useCallback(() => {
  if (!selectedTool) return;
  const filtered = allProblems.filter(p => {
    const toolIds = p.tool_ids ? JSON.parse(p.tool_ids) : [];
    return toolIds.includes(selectedTool);
  });
  const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, toolCount);
  setToolPreview(shuffled);
  setSelectedToolPreviewIds(new Set(shuffled.map(p => p.id)));
}, [selectedTool, toolCount, allProblems]);

useEffect(() => {
  regenerateToolPreview();
}, [selectedTool, toolCount, regenerateToolPreview]);
```

### 3.7 마감일 처리 (`AssignmentForm.jsx:245-279`)

```jsx
<Input
  type="datetime-local"
  value={tempDeadline}
  onChange={e => setTempDeadline(e.target.value)}
/>
<Button
  disabled={!tempDeadline || tempDeadline === deadline}
  onClick={() => setDeadline(tempDeadline)}
>
  확인
</Button>
{deadline && (
  <Button onClick={() => { setDeadline(''); setTempDeadline(''); }}>
    지우기
  </Button>
)}
{deadline && (
  <p className="text-xs text-emerald-600 mt-1">
    ✓ 마감일: {format(deadline, ...)}
  </p>
)}
```

`tempDeadline` (편집 중) 과 `deadline` (적용 완료) 분리 — [확인] 눌러야 적용.

### 3.8 AssignmentDetail 의 학생 fetch (`AssignmentDetail.jsx:70-98`)

```js
const submissions = [];
for (const student of classStudents) {       // ★ 순차 — 병렬화 가능
  const attempts = await StudentAttempt.filter(
    { student_id: student.id, assignment_id: assignmentId },
    '-submitted_at', 100
  );
  const uniqueProblemIds = [...new Set(attempts.map(a => a.problem_id))];
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length)
    : 0;
  const correctCount = attempts.filter(a => a.correctness === 'correct').length;
  const correctRate = attempts.length > 0
    ? Math.round((correctCount / uniqueProblemIds.length) * 100)
    : 0;

  submissions.push({
    student, attempts,
    progressCount: uniqueProblemIds.length,
    totalCount: problemIds.length,
    avgScore, correctRate
  });
}
setStudentSubmissions(submissions);
```

### 3.9 ⋮ 메뉴 핸들러

```js
// 마감
handleClose = async () => {
  await Assignment.update(assignmentId, { status: 'closed' });
  setAssignment(prev => ({ ...prev, status: 'closed' }));
  toast.success('숙제가 마감되었어요');
};

// 삭제
handleDelete = async () => {
  await Assignment.delete(assignmentId);
  toast.success('숙제가 삭제되었어요');
  navigate('/teacher/assignments');
};

// 수정 후
handleSave = async (data) => {
  await Assignment.update(assignmentId, data);
  toast.success('숙제가 수정되었어요');
  setShowEditForm(false);
  window.location.reload();   // ★ 알려진 안티 패턴
};
```

### 3.10 [수정] 버튼 활성 조건 (`AssignmentDetail.jsx:169-176`)

```jsx
<Button
  variant="outline"
  onClick={() => setShowEditForm(true)}
  disabled={submissionCount > 0}
  title={submissionCount > 0 ? '제출이 있으면 수정할 수 없어요' : ''}
>
  수정
</Button>
```

submissionCount = 모든 학생의 attempts 합계 (`AssignmentDetail.jsx:145`).

### 3.11 알려진 이슈 / 미결정

#### 잠재 버그

- **TeacherAssignments 카드의 "제출 0건" 하드코딩** — 실제 제출 수와 무관하게 항상 0. AssignmentDetail 처럼 실제 fetch 필요.
- **AssignmentDetail 의 학생별 attempts 순차 fetch** — `for...await` — 학생 N명일 때 N회 sequential. `Promise.all` 로 병렬화 가능.
- **AssignmentDetail 수정 후 reload** — `window.location.reload()` — React 답지 않음. setAssignment 상태 갱신이나 invalidate 적합.
- **"복사하여 새 숙제" 미구현** — 학급만 사전 설정한 빈 폼이 열림. 코드 주석에도 "현재는 빈 폼" 명시.
- **handleSave catch 누락** — TeacherAssignments / TeacherClasses 의 `Assignment.create` 가 try/finally 만 — 네트워크 오류 시 사용자 피드백 X.

✅ 해결됨:
- ~~TeacherDashboard 차트 → 학급 자동 선택 부재~~ → ClassSelectDialog 를 거치는 두 단계 흐름으로 수정 완료.

#### 정의 필요

- **다른 학급 assignment URL 직접 진입 가드 부재** — server function 단의 권한 체크 없음. 클라이언트 분기로만 막힘.
- **학원장 (Academy.owner_id) 의 출제 권한** — 현재는 main_teacher / assistant_teacher 만. 학원장 role 의 권한 미정.
- **숙제 출제 알림** — 학생 측 알림 시스템 없음.
- **자동 마감** — deadline 경과 시 status 자동 'closed' 안 됨. UI 상으로만 closed 처리. server cron / hook 필요.
- **수정 가능 조건의 일관성** — AssignmentDetail 에만 있음. TeacherAssignments 카드 ⋮ 에는 [수정] 항목이 아예 없음.
- **selection_criteria UI 노출** — JSON 으로 저장은 되지만 어디에도 표시되지 않음.

### 3.12 QA 체크리스트

#### 출제 흐름

- [ ] /teacher/assignments — 출제한 숙제 리스트 정상
- [ ] [+ 새 숙제] → ClassSelectDialog → 학급 선택 → AssignmentForm
- [ ] /teacher/classes — 학급 카드 [숙제 만들기] → AssignmentForm (classId 사전 주입)
- [ ] /teacher 대시보드 차트 막대 클릭 (학급 2개 이상) → ClassSelectDialog → 학급 선택 → AssignmentForm 의 도구 + 학급 사전 선택
- [ ] /teacher 대시보드 차트 막대 클릭 (학급 1개) → 다이얼로그 없이 바로 AssignmentForm
- [ ] 도구별 탭 — 도구 select + 문제 수 + 미리보기 + 체크박스 + [선택한 N개 추가]
- [ ] 단원별 탭 — 동일 동작
- [ ] 직접 선택 탭 — 검색 + 결과 클릭 → 추가
- [ ] 마감일 datetime-local + [확인] / [지우기] + 적용 메시지
- [ ] 저장 → Assignment 1 row create + 리스트 갱신

#### 숙제 상세

- [ ] /teacher/assignments/:id — 정보 + 문제 + 학생 현황
- [ ] 학생 카드 클릭 → /teacher/students/:id
- [ ] 출제된 문제 카드 클릭 → /teacher/problems/:id
- [ ] ⋮ 메뉴: 마감 / 삭제 동작
- [ ] [수정] — 학생 제출 0건일 때만 활성
- [ ] 수정 후 window.location.reload (★ 안티 패턴)

#### 회귀

- [ ] 다른 학급 숙제 카드 본인 화면에 안 보임
- [ ] URL 직접 진입 — 별도 가드 없음 (★ 알려진 이슈)
- [ ] main 또는 assistant 인 학급 모두가 my_classes 에 잡힘
- [ ] AssignmentForm 수정 모드 — 기존 값 그대로 채워서 표시
- [ ] TeacherProvider 5분 캐시 — 페이지 간 이동 시 fetch 생략
