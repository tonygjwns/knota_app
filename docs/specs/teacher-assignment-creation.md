# 강사 숙제 출제 / 관리 기능 명세서

## 1. 개요

강사가 자기 학급에 숙제를 출제하고 관리하는 기능. 도구별 / 단원별 / 직접 선택 방식으로 문제 N개를 묶어 Assignment 로 저장하고 학생들이 받아서 풀 수 있게 합니다. 출제한 숙제는 학생 제출이 0건일 때만 수정 가능, 진행(active) 과 마감(closed) 상태를 강사가 관리합니다. 학생 제출 현황(진행률 / 평균 점수 / 정답률) 도 강사가 실시간 확인 가능합니다.

- **상위/관련 기능**: 권한 분리 + 학원/학급 — 강사가 자기 학급(main_teacher_id 또는 assistant_teacher_ids 매칭) 에 출제. 학생 받은 숙제 진입 흐름 (별도 명세서) 의 출제 측면. 매듭별 인사이트와 연결 — TeacherDashboard 매듭별 약점 차트 막대 클릭 → AssignmentForm preselectedToolId 자동 설정.
- **대상 사용자**: teacher (자기 담당 학급) / admin (teacherSummary 함수가 admin 도 통과시키므로 admin 도 진입 가능 — 단 my_classes 는 main/assistant 매칭이 본인 id 기준이라 admin 본인이 해당되어야 함).
- **영향 받는 파일 리스트**:
  - `base44/entities/Assignment.jsonc` — title (필수) / description / class_id (필수) / created_by (필수) / problem_ids (필수, JSON string) / deadline / status (default `active`, enum) / selection_criteria (JSON string)
  - `src/components/AssignmentForm.jsx` — 출제 / 수정 모달 (Dialog, 3 탭)
  - `src/pages/teacher/TeacherAssignments.jsx` — 출제한 숙제 리스트
  - `src/pages/teacher/AssignmentDetail.jsx` — 숙제 상세 + 학생 제출 현황
  - `src/pages/teacher/TeacherClasses.jsx` — 학급 카드의 "숙제 만들기" 버튼
  - `src/pages/teacher/TeacherDashboard.jsx:78-93, 113-128` — 매듭별 약점 차트 막대 클릭 → AssignmentForm
  - `src/lib/TeacherContext.jsx` — `base44.functions.invoke('teacherSummary')` 1회 호출 + 5분 캐시
  - `base44/functions/teacherSummary/entry.ts` — 학급 / 학생 / 마스터리 server-side 집계

## 2. 화면 구상도 (텍스트 wireframe)

### 2.1 출제한 숙제 리스트 — TeacherAssignments

URL: `/teacher/assignments`

```
┌─ 출제한 숙제                        [+ 새 숙제] ┐
├──────────────────────────────────────────────┤
│ Tabs: [전체] [진행중] [마감]   ┌ Select 학급 ▼ ┐│
├──────────────────────────────────────────────┤
│ ┌─ 숙제 카드 ───────────────── [Badge진행중] [⋮]┐│
│ │ 8주차 - 이차방정식                            ││
│ │ {classNames[class_id] 또는 class_id}          ││
│ │ {description}                                 ││
│ │ 출제일: MMM d, HH:mm  마감: MMM d, HH:mm     ││
│ │ 총 N문제 · 학생 N명 · 제출 0건 (★ 항상 0)     ││
│ └──────────────────────────────────────────┘│
│ ...                                           │
└──────────────────────────────────────────────┘
```

- "+ 새 숙제" 클릭 → ClassSelectDialog (`TeacherAssignments.jsx:345-364`) 가 my_classes 리스트 표시 → 학급 클릭 시 setSelectedClassForForm → AssignmentForm 모달 표시
- 카드 본체 클릭 → `/teacher/assignments/:id` (AssignmentDetail)
- ⋮ DropdownMenu 항목 (`TeacherAssignments.jsx:243-261`) (e.stopPropagation 으로 카드 진입 차단):
  - active 일 때만: [마감] (status='closed' update)
  - [복사하여 새 숙제] (onSelect 으로 학급 사전 설정 + AssignmentForm — 단 빈 폼만 열림. 6번 미결정 참조)
  - [삭제] (destructive — AlertDialog confirm)

> 카드의 "제출 0건" 은 하드코딩 — TeacherAssignments 가 학생 시도 fetch 를 하지 않음 (6번 미결정 참조).

### 2.2 숙제 출제 / 수정 모달 — AssignmentForm

```
┌─ 새 숙제 출제 (또는 "숙제 수정") ──────────[X]┐
│ 제목 *: [_______________________]              │
│ 설명 (선택): Textarea                          │
│ 마감일 (선택):                                │
│  [datetime-local Input] [확인] [지우기]        │
│   ✓ 마감일: MMM d, HH:mm (deadline 적용 후)   │
├──────────────────────────────────────────────┤
│ 문제 선택 *                                   │
│ ┌─ Tabs: [도구별] [단원별] [직접 선택] ────┐ │
│ │ (도구별 탭)                              │ │
│ │  도구 Select ▼                           │ │
│ │  문제 수 [10] 개 + [↻ 다시 뽑기]         │ │
│ │  미리보기 (N개)  [전체 선택] [전체 해제]   │ │
│ │   ┌─ Card (체크박스 + p.id 8자리 + 본문 50자) ┐│
│ │   │ ☐ ...                                    ││
│ │   └────────────────────────────────────┘│
│ │  [선택한 N개 문제 추가] (size 0 일 때 disabled)│
│ │ (단원별 탭 — 동일한 패턴)                │ │
│ │ (직접 선택 탭 — 검색 + 결과 grid 토글)    │ │
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ 선택된 문제 (N개)                            │
│  - p.id 8자리 + 본문 50자 + domain Badge [X]   │
│  - ...                                        │
├──────────────────────────────────────────────┤
│ [취소]                  [숙제 출제 또는 수정 완료]│
└──────────────────────────────────────────────┘
```

3 탭 동작 (`AssignmentForm.jsx:285-542`):
- **도구별** (`tool`): MathTool Select → 문제 수 input (1-50, default 10) → `regenerateToolPreview` 가 그 도구 사용한 problem 들을 random shuffle 해서 toolCount 만큼 추출 → 미리보기 카드 + 체크박스 → "전체 선택"/"전체 해제" + "다시 뽑기" + "선택한 N개 문제 추가" (selectedToolPreviewIds 의 ids 를 selectedProblems 에 추가)
- **단원별** (`domain`): Domain Select → 동일한 패턴 (`regenerateDomainPreview`)
- **직접 선택** (`direct`): 검색 input (제목 / 도메인) → grid 의 결과 카드 토글 (`toggleProblem`)

선택된 문제 영역: `selectedProblems` 의 ids 를 카드로 나열 (X 버튼으로 제거).

### 2.3 숙제 상세 — AssignmentDetail

URL: `/teacher/assignments/:assignmentId`

```
┌─ [←] 8주차 - 이차방정식  [Badge진행중] ─[수정][⋮]─┐
│ {classNames[class_id]}                             │
│ 출제일: MMM d, HH:mm   마감: MMM d, HH:mm           │
├──────────────────────────────────────────────┤
│ 설명: ...                                     │
├──────────────────────────────────────────────┤
│ 출제된 문제 (N)                              │
│ ┌─ 문제 카드 ──────────────────────────┐    │
│ │ {id 8자리}...                        │    │
│ │ {domain_name}                         │    │
│ │ {본문 80자}...                        │    │
│ └──────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│ 학생별 제출 현황                              │
│ ┌─ 학생 카드 ──────────────────────────┐    │
│ │ {full_name}                            │    │
│ │ {email}                                │    │
│ │ progressCount/totalCount 문제          │    │
│ │ 평균: N점 · 정답: N% (correctRate)    │    │
│ │ Progress bar (progressCount/total)    │    │
│ └──────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

- [수정] Button — `disabled={submissionCount > 0}` (전체 제출 1건이라도 있으면 disable, hover title="제출이 있으면 수정할 수 없어요")
- ⋮ DropdownMenu 항목:
  - active 일 때만: [마감] → `Assignment.update(_, {status:'closed'})` + `setAssignment(prev=>{...prev, status:'closed'})` (페이지 자체 reload 안 함)
  - [삭제] (destructive — AlertDialog confirm) → `Assignment.delete` → `navigate('/teacher/assignments')`
- 출제된 문제 카드 클릭 → `/teacher/problems/:id` (ProblemDetail)
- 학생 카드 클릭 → `/teacher/students/:id` (StudentDetail)

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| Teacher 가 담당 학급 0 개 | TeacherAssignments / TeacherClasses 에 "담당 학급이 없습니다." 또는 "담당 학급이 없어요" |
| TeacherAssignments — assignments 0건 | "출제한 숙제가 없습니다." Card |
| 숙제 진행 중 (`status==='active'`) | 카드/헤더에 [Badge진행중] (default variant) |
| 숙제 마감 (`status==='closed'`) | [Badge마감] (secondary variant) |
| AssignmentForm — title 빈 / problem_ids 0 | "숙제 출제" / "수정 완료" 버튼 disabled |
| AssignmentForm — `tempDeadline` 변경 후 미확인 | "확인" 버튼 활성화 (`!tempDeadline \|\| tempDeadline === deadline` 이면 disabled) |
| AssignmentForm — deadline 적용 완료 | emerald 톤 "✓ 마감일: ..." 메시지 + "지우기" 버튼 노출 |
| AssignmentForm — selectionTab='tool' 인데 selectedTool 빈 | "도구를 선택하세요" placeholder 만 보임. 미리보기 영역 미표시 |
| AssignmentForm — preselectedToolId 가 있을 때 | useEffect 에서 selectedTool 자동 설정 + selectionTab='tool' default |
| AssignmentForm — selectedToolPreviewIds.size === 0 | "선택한 0개 문제 추가" 버튼 disabled |
| AssignmentDetail — 학생 제출 0건 (submissionCount===0) | [수정] 활성. submissions 영역에 학생 카드는 그대로 표시 |
| AssignmentDetail — 학생 제출 1건+ | [수정] disabled |
| AssignmentDetail — assignmentId 잘못됨 | "{error}" 빨간 메시지 ("숙제를 찾을 수 없어요" 또는 catch message) |
| AssignmentDetail — 그 학급 학생 0명 | "이 학급에 배정된 학생이 없어요" |
| TeacherProvider — 5분 캐시 적용 중 | data null + loading=true → InlineLoader. 5분 안에 재진입 시 → fetch skip |

## 4. 동작

### 4.1 TeacherAssignments 데이터 fetch

| 조건 | 동작 |
| --- | --- |
| 페이지 진입 | useTeacher() 로 my_classes 가져옴. classNames 맵 만듦 (`TeacherAssignments.jsx:51-59`).<br>my_classes 0개면 setAssignments([]) + setLoading(false). 그 외엔 my_classes 의 class_id 별로 `Assignment.filter({class_id:cid}, '-created_date', 100)` 병렬 호출 (`TeacherAssignments.jsx:75-79`) → flat. SDK 가 in 미지원이라 학급별 호출 |
| 필터 변경 (statusFilter / classFilter) | client-side filter (assignments state 를 useMemo) |
| 정렬 | `created_date` 내림차순 ((b) - (a)) |

### 4.2 새 숙제 출제 흐름

| 조건 (액션) | 동작 |
| --- | --- |
| "+ 새 숙제" 버튼 클릭 (`TeacherAssignments.jsx:166-174`) | setSelectedClassForForm(null) + setShowForm(true) → ClassSelectDialog 표시 |
| ClassSelectDialog 의 학급 클릭 | setSelectedClassForForm(cid) → AssignmentForm 모달 노출 (classId 사전 주입) |
| 학급 카드 [숙제 만들기] 버튼 (`TeacherClasses.jsx:63-75`) | e.stopPropagation 으로 카드 진입 차단 → setSelectedClassId(cls.id) + setShowForm(true) → AssignmentForm 모달 |
| TeacherDashboard 매듭별 차트 막대 클릭 (`TeacherDashboard.jsx:78-89`) | onClick 에서 `weak_tools.find(t=>t.name===data.name)` → setSelectedToolForAssignment(tool.tool_id) + setShowAssignmentForm(true). AssignmentForm 에 `classId={my_classes[0]?.id}` (★ 항상 첫 학급 — 학급 선택 다이얼로그 없음. 6번 미결정 참조) + `preselectedToolId` prop 으로 전달 |
| AssignmentForm 진입 시 데이터 fetch (`AssignmentForm.jsx:73-93`) | `MathTool.list('name',100)` + `Domain.list('name',100)` + `Problem.list('-created_date',1000)` 3개 병렬. preselectedToolId 가 있을 때 setSelectedTool 자동 설정 |
| 도구 / 문제 수 변경 시 미리보기 재생성 | useEffect 에서 `regenerateToolPreview` — `allProblems.filter(p => JSON.parse(p.tool_ids).includes(selectedTool))` → shuffle + slice(0, toolCount) → setToolPreview + setSelectedToolPreviewIds 를 모두 채움 (default 로 전체 체크) |
| "다시 뽑기" 버튼 | regenerateToolPreview 재호출 (다른 random) |
| 미리보기 카드 클릭 / 체크박스 | toggleToolPreview(p.id) — selectedToolPreviewIds Set 토글 |
| "전체 선택" / "전체 해제" | selectedToolPreviewIds 를 모든 ids set / 빈 Set |
| "선택한 N개 문제 추가" | `addSelectedPreviewProblems(toolPreview, selectedToolPreviewIds)` — selectedIds 의 ids 를 selectedProblems 에 추가 (중복 제거: `!selectedProblems.includes(id)`) |
| 단원별 탭 — 동일 패턴 (`regenerateDomainPreview`, selectedDomainPreviewIds) | filter: `p.domain_id === selectedDomain` |
| 직접 선택 탭 | searchQuery → useMemo 로 client-side filter (content / domain_name 의 lowercase contains). 결과 카드 클릭 → toggleProblem |
| 선택된 문제의 X 클릭 | toggleProblem 으로 제거 |
| 마감일 datetime-local input | tempDeadline 만 변경 (deadline 에는 미반영) |
| 마감일 [확인] | setDeadline(tempDeadline) — emerald 톤 메시지 표시 |
| 마감일 [지우기] | setDeadline('') + setTempDeadline('') |
| [숙제 출제] / [수정 완료] (`AssignmentForm.jsx:174-202`) | 1. 가드: `title.trim() && selectedProblems.length > 0` 둘 다 만족 (아니면 disabled).<br>2. `await base44.auth.me()` → user.<br>3. selection_criteria 만들기 ({type: selectionTab, ...(tool 일 때 tool: selectedTool, domain 일 때 domain: selectedDomain)}).<br>4. data = {title, description (trim 후 빈 값이면 null), class_id: classId, created_by: user.id, problem_ids: JSON.stringify(selectedProblems), deadline: deadline \|\| null, status: assignment?.status \|\| 'active', selection_criteria: JSON.stringify(criteria)}.<br>5. `await onSave(data)` 호출 — TeacherAssignments 의 `Assignment.create`, AssignmentDetail 의 `Assignment.update(assignmentId, data)`.<br>6. onClose() 호출 |

### 4.3 숙제 상세 + 학생 제출 현황 (AssignmentDetail)

| 조건 | 동작 |
| --- | --- |
| `/teacher/assignments/:id` 진입 | 1. `Assignment.filter({id: assignmentId})` → assignment.<br>2. problem_ids 파싱 → `Problem.filter({}, '-created_date', 1000)` 후 client-side filter.<br>3. teacherData.my_students 에서 `s.class_id===assignmentData.class_id` 만 추출.<br>4. **각 학생을 순차 처리**: `StudentAttempt.filter({student_id, assignment_id}, '-submitted_at', 100)` (★ 병렬 X — for 루프 안에서 await — `AssignmentDetail.jsx:74`).<br>5. 학생별 통계: progressCount = `unique problem_id 수`, avgScore = `avg(score)`, correctRate = `correctCount / uniqueProblemIds.length × 100` |
| 학생 카드 클릭 | `navigate('/teacher/students/${student.id}')` |
| 출제된 문제 카드 클릭 | `navigate('/teacher/problems/${p.id}')` |
| [수정] Button | setShowEditForm(true) → AssignmentForm 모달 (`assignment` prop 으로 기존 값 주입). 저장 후 `Assignment.update(assignmentId, data)` → toast.success → `window.location.reload()` (★ 풀 페이지 리로드 사용 — 6번 미결정 참조) |
| ⋮ [마감] | `Assignment.update(_, {status:'closed'})` → toast + setAssignment(prev=>{...prev, status:'closed'}) |
| ⋮ [삭제] | setDeleteId(true) → AlertDialog → `Assignment.delete(assignmentId)` → toast + `navigate('/teacher/assignments')` |

### 4.4 데이터 변경

- **Create**: Assignment 1 row (TeacherAssignments / TeacherClasses / TeacherDashboard 에서 출제 시).
- **Update**: Assignment 1 row (수정 / 마감 / status 변경).
- **Delete**: Assignment 1 row (확인 다이얼로그 후).
- 기존 StudentAttempt 는 변경 X. Problem 은 read-only.

## 5. 에러

| 조건 | 사용자 표시 | 시스템 처리 |
| --- | --- | --- |
| Teacher 가 학급 0개 | "담당 학급이 없습니다." (TeacherAssignments) / "담당 학급이 없어요\n관리자에게 학급 배정을 요청해 주세요." (TeacherClasses, TeacherDashboard) | render 분기 |
| AssignmentForm — title 빈 / 선택 0 | 버튼 disabled | "숙제 출제" 버튼 자체 차단 |
| Assignment.create 실패 (네트워크) | (toast 등 안내 없음 — handleSave 의 try/finally 가 catch 없음 — 6번 미결정) | TeacherAssignments 가 try/finally 로만 처리 (saving state 만 풀림) |
| AssignmentDetail 의 assignment 0건 | "숙제를 찾을 수 없어요" 또는 e.message | setError + "{error}" 표시 |
| Assignment 수정 실패 | `toast.error('수정 실패: ' + e.message)` | catch (`AssignmentDetail.jsx:117`) |
| Assignment 마감 실패 | `toast.error('마감 실패: ' + e.message)` | catch |
| Assignment 삭제 실패 | `toast.error('삭제 실패: ' + e.message)` | catch |
| 자기 학급이 아닌 assignment URL 직접 진입 | (현재 별도 가드 X — teacherData 의 my_students 가 그 학급 학생을 비추므로 0건만 표시될 뿐 — 명시적 권한 체크 가드 부재) | UI 표시 자체는 가능 |

## 6. 미결정 / 보류

### 🔴 발견된 잠재 버그 / UX 이슈

- **TeacherDashboard 차트 → 학급 자동 선택 부재**: `<AssignmentForm classId={my_classes[0]?.id} ...>` (`TeacherDashboard.jsx:116`) — 항상 my_classes 첫 학급에 출제됨. 다른 학급에 출제하려면 ClassSelectDialog 부터 거치도록 수정 필요.
- **TeacherAssignments 카드 "제출 0건" 하드코딩**: `<span>제출 0건</span>` (`TeacherAssignments.jsx:289-291`) — 실제 제출 수와 무관하게 항상 0. AssignmentDetail 처럼 실제 fetch 필요.
- **AssignmentDetail 의 학생별 attempts 순차 fetch**: `AssignmentDetail.jsx:74` 의 `for (const student of classStudents) {...await...}` — 학생 N명 일 때 N 회 sequential. 병렬 (`Promise.all`) 로 바꾸면 빠름.
- **AssignmentDetail 수정 후 reload**: `window.location.reload()` (`AssignmentDetail.jsx:115`) — React 답지 않은 풀 리로드. 대신 setAssignment 상태 갱신이나 React Query invalidate 적합.
- **"복사하여 새 숙제"** (TeacherAssignments ⋮): `setSelectedClassForForm(assignment.class_id) + setShowForm(true)` — 학급만 사전 설정한 빈 폼이 열림 (제목/문제 사전 채움 X). 주석에 "복사된 데이터는 폼에서 설정 (현재는 빈 폼)" — 미구현.
- **handleSave catch 누락**: TeacherAssignments / TeacherClasses 의 `Assignment.create` 호출이 try/finally 만 — 네트워크 오류 시 사용자에게 표시 X.

### 향후 검토

- **학원장 (Academy.owner_id) 의 숙제 출제 권한**: 현재는 main_teacher / assistant_teacher 만. 학원장 role 의 권한 범위 정의 필요.
- **숙제 출제 시 학생 알림**: 새 숙제가 도착했을 때 학생에게 알림 표시 필요.
- **자동 마감**: deadline 경과 시 status 가 자동 'closed' 로 바뀌는 처리 X — 현재는 client-side 에서만 마감 판정 (deadline < now 면 UI 상으로만 closed). server cron / hook 필요.
- **수정 가능 — 학생 제출 0 건 조건**: AssignmentDetail.jsx 에만 있음 — TeacherAssignments 카드 ⋮ 에는 [수정] 항목이 아예 없음 (현재 상태가 의도된 건지 확인 필요).
- **selection_criteria 표시**: Assignment 의 selection_criteria JSON 이 저장됨 — UI 로 노출하는 곳은 없음. AssignmentDetail 등에서 메타 정보로 표시 검토.

## 7. 검증 (QA 체크리스트)

### 출제 흐름
- [ ] /teacher/assignments — 출제한 숙제 리스트 정상
- [ ] "+ 새 숙제" → ClassSelectDialog → 학급 선택 → AssignmentForm
- [ ] /teacher/classes — 학급 카드 [숙제 만들기] → AssignmentForm (classId 사전 주입)
- [ ] /teacher (대시보드) 매듭별 차트 막대 클릭 → AssignmentForm 의 도구 사전 선택 (★ 학급은 my_classes[0] 자동 — 명시 필요)
- [ ] AssignmentForm 도구별 탭 — 도구 Select + 문제 수 + 미리보기 + 체크박스 + "선택한 N개 추가"
- [ ] AssignmentForm 단원별 탭 — 동일한 동작
- [ ] AssignmentForm 직접 선택 — 검색 + 결과 클릭 → 추가
- [ ] 마감일 datetime-local + [확인] / [지우기] + 적용 메시지
- [ ] 저장 → Assignment 1 row create + TeacherAssignments 갱신

### 숙제 상세
- [ ] /teacher/assignments/:id — 숙제 정보 + 문제 리스트 + 학생 제출 현황 표시
- [ ] 학생 카드 클릭 → /teacher/students/:id 이동
- [ ] 출제된 문제 카드 클릭 → /teacher/problems/:id
- [ ] ⋮ 메뉴: 마감 / 삭제 동작
- [ ] [수정] 버튼 — 학생 제출 0건일 때만 활성
- [ ] 수정 후 window.location.reload (★ 알려진 안티패턴)

### 회귀
- [ ] 다른 학급의 숙제는 본인 화면에 안 보임 (★ URL 직접 진입은 막지 않음 — 명시적 권한 가드 부재)
- [ ] Teacher 가 main_teacher 또는 assistant_teacher 인 학급 모두가 my_classes 에 포함
- [ ] AssignmentForm 의 수정 모드 — 기존 값 그대로 채워서 표시 (assignment prop 사용)
- [ ] TeacherProvider 의 5분 캐시 동작 — 페이지 간 이동 시 fetch 생략
