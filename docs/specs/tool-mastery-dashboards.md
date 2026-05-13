# 매듭별 인사이트 + 분석 대시보드 기능 명세서

## 1. 개요

KNOTA 의 핵심 차별점인 "매듭(도구) 단위" 학습 분석. 학생의 시도(StudentAttempt) + 정답 풀이 path(Problem.solution_path) + LLM 채점의 매듭 매핑 (claude_grade_json 의 error_locations) 을 결합해 학생별 / 학급별 / 전체 매듭 사용 통계를 집계합니다. 약점 매듭 / 강점 매듭 / 매듭별 시도 분포를 차트로 보여주며 학습 / 보강 / 숙제 출제의 신호로 사용합니다.

- **상위/관련 기능**: Submission Pipeline 의 채점 결과 (claude_grade_json 의 error_locations[].tool_id) → 모든 분석의 1순위 신호. 매듭 보강 (Remediation) 은 학생의 약점 매듭 진단 결과를 활용. 강사 숙제 출제 흐름은 차트 막대 클릭으로 도구 사전 선택을 받아옴.
- **대상 사용자**:
  - **학생** (History): 자기 약점 / 강점 매듭 카드
  - **Teacher** (TeacherDashboard, StudentDetail): 자기 학급의 약점 매듭 차트 + 막대 클릭으로 숙제 출제
  - **Admin** (AdminDashboard, StudentDetail): 전체 학생 매듭 차트
- **영향 받는 파일 리스트**:
  - `src/lib/toolMastery.js` — 핵심 helper (aggregateToolMastery, topWeakTools, topStrongTools)
  - `src/pages/History.jsx:69-104` — 학생 자기 약점/강점 매듭 카드
  - `src/pages/shared/StudentDetail.jsx` — admin/teacher 모두 사용 (mode='admin' / 'teacher')
  - `base44/functions/studentDetailSummary/entry.ts` — server-side 매듭 + remediation_history 집계
  - `src/pages/admin/AdminDashboard.jsx` — 전체 학생 매듭 차트 (Top 10 weak / Top 10 usage)
  - `src/pages/teacher/TeacherDashboard.jsx` — 자기 학급 매듭 차트 + 막대 클릭 → 숙제 출제
  - `src/pages/ProblemSelect.jsx:194-283` — "오늘의 추천" 매듭 기반 추천 문제
  - `base44/entities/BookmarkedTool.jsonc` / `MathTool.jsonc`
  - `base44/functions/teacherSummary/entry.ts` — 자기 학급 my_classes / my_students / weak_tools / tool_distribution

## 2. 화면 구상도 (텍스트 wireframe)

### 2.1 학생 — History 의 매듭 인사이트

URL: `/history`

```
┌─ 내 풀이 기록 ──────────────────────┐
│ 지금까지 푼 문제들을 볼 수 있어요      │
├──────────────────────────────────┤
│ stats Cards (3 분할):               │
│  총 풀이 / 정답 / 평균 점수            │
├──────────────────────────────────┤
│ md:grid-cols-2:                      │
│ ┌─ 약점 매듭 Top N ─┐ ┌─ 강점 매듭 Top N ─┐ │
│ │📉 …                │ │📈 …                │ │
│ │ {name}             │ │ {name}             │ │
│ │ progress bar 빨강   │ │ progress bar 에메랄드│ │
│ │ {avg_score}점 (right)│ │ {avg_score}점       │ │
│ │ {attempts}회 (right)│ │ {attempts}회        │ │
│ └─────────────┘ └─────────────┘ │
├──────────────────────────────────┤
│ Tabs: [모든 풀이] [숙제 풀이] [자유 풀이]  │
│ Search / Sort / correctness / 도메인 / 점수 범위 (이중 슬라이더) │
│ ─ 오늘 (N) ▼ — 시도 카드 리스트 ──    │
│ ─ 어제 / 이번 주 / 이번 달 / 그 이전   │
│ [더 보기]                            │
└──────────────────────────────────┘
```

빈 상태 (`History.jsx:81-85`): attempts 0건이면 stats {total:0,correct:0,avg:0} + masteryLoading false → mastery 카드 자체 미표시. attempts 0건+filter 0건이면 "아직 푼 문제가 없어요" 안내 + [문제 풀러 가기].

### 2.2 Admin — AdminDashboard 의 매듭 차트

URL: `/admin`

```
┌─ 분석 대시보드 ──────────────────────┐
│ DataImportPanel (별도 컴포넌트)        │
├──────────────────────────────────┤
│ stats Cards (4 분할):                │
│  전체 학생 / 총 풀이 / 평균 점수 / 정답률 │
├──────────────────────────────────┤
│ 단원별 평균 점수 (BarChart, 세로형)    │
├──────────────────────────────────┤
│ 전체 학생이 자주 막히는 매듭 Top N      │
│  (가로 BarChart) "5회 이상 시도 · 평균 점수 낮은 순" │
│  Cell 색상: <40 red / <60 orange / 그 외 yellow │
├──────────────────────────────────┤
│ 매듭별 시도 분포 Top N                │
│  (가로 BarChart, primary fill)        │
├──────────────────────────────────┤
│ 가장 어려운 문제 (5)                  │
│  rank · 본문 60자 · count회 · 평균 점수 (색상 분기) │
│  클릭 시 → /admin/problems/{entity_id} │
└──────────────────────────────────┘
```

weakToolChart 가 비어 있을 때 (도구당 5회 시도가 안 모인 경우): "충분한 시도 데이터가 쌓이면 표시돼요 (도구당 5회 이상 시도 필요)"

### 2.3 Teacher — TeacherDashboard 의 학급 매듭 차트

URL: `/teacher`

```
┌─ 강사 대시보드 ──────────────────────┐
│ 내 학급 학생들의 학습 현황이에요       │
│                          [로드 N ms]  │
├──────────────────────────────────┤
│ stats Cards (4 분할):                │
│  담당 학급 / 학생 수 / 평균 점수 / 정답률 │
├──────────────────────────────────┤
│ 매듭별 약점 (가로 BarChart)            │
│  "막대를 클릭하면 해당 매듭으로 숙제를 출제할 수 있어요" │
│  Cell 색상: <50 red / <70 amber / 그 외 emerald │
│  ★ Bar onClick → setSelectedToolForAssignment(tool.tool_id) → AssignmentForm │
├──────────────────────────────────┤
│ 매듭별 시도 분포 Top 10 (가로 BarChart, primary)│
└──────────────────────────────────┘
```

비고: 담당 학급 0 → "담당 학급이 없어요". `attempts_summary.total === 0` 일 때 "학생들의 제출 데이터가 없어요".

### 2.4 Admin/Teacher — StudentDetail

URL: `/admin/students/:userId` 또는 `/teacher/students/:userId` (App.jsx 에서 mode prop 으로 분기)

```
┌─ [←] {full_name} ──────────────────┐
│      {email}                         │
├──────────────────────────────────┤
│ 통계: 총 시도 / 정답률 / 평균 점수      │
├──────────────────────────────────┤
│ 약점 매듭 (red border)                │
│  Card · {name} · {avg_score}점         │
│         시도 N회 · 정답 N회             │
├──────────────────────────────────┤
│ 강점 매듭 Top 5 (emerald border)      │
├──────────────────────────────────┤
│ 🎯 매듭 보강 이력                      │
│ ┌─ Card (primary 톤) ──────────┐    │
│ │ {tool_name}     {improvement}점 │   │
│ │ 보강 N회 · 재풀이 N회 · 유사 문제 N개 │   │
│ │ 보강 전 N점 → 후 N점               │   │
│ └────────────────────────┘   │
├──────────────────────────────────┤
│ 시도 기록 (정렬 select)               │
│  Card 리스트 (correctness 별 색상 분기) │
│  pageIdx PAGE_SIZE=20                │
│  [이전] {pageIdx+1}/{maxPage} [다음]    │
└──────────────────────────────────┘
```

### 2.5 학생 — ProblemSelect "오늘의 추천"

URL: `/problems`

```
... (받은 숙제 / ...)

오늘의 추천
 ┌─ Card (clickable) ─────┐
 │ {본문 100자}             │
 │ {domain_name}            │
 │                  [▸]    │
 └────────────────────┘
 ...
```

빈 상태에서는 "ComingSoonCard": "추천 문제 준비 중\n더 많은 문제를 풀면 추천이 생겨요". 추천 결과가 0건이면 random 5 fallback (`ProblemSelect.jsx:274`).

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| 학생 시도 0건 | History 의 stats Card 만 (모두 0) + mastery 카드 미표시 (`weakTools.length===0 && strongTools.length===0`) |
| 학생 시도 < 3 (per tool) | 그 도구는 `topWeakTools(_,_,5,3)` / `topStrongTools(_,_,5,70,3)` 의 minSamples 미달 → 결과에서 제외 |
| AdminDashboard mastery 부족 (도구당 < 5) | "충분한 시도 데이터가 쌓이면 표시돼요 (도구당 5회 이상 시도 필요)" 안내 |
| TeacherDashboard 학생 0명 / 시도 0건 | "학생들의 제출 데이터가 없어요" Card |
| TeacherDashboard 매듭 차트 막대 클릭 후 | (학급 선택 다이얼로그 X — `my_classes[0]?.id` 자동 — teacher-assignment 명세서 6번 미결정 참조) |
| StudentDetail remediation_history 0건 | "🎯 매듭 보강 이력" Card 자체 표시 X (`remediationHistory.length === 0`) |
| ProblemSelect "오늘의 추천" — 즐겨찾기 0 + weak_tools 0 (도구당 < 3) | random 5 fallback (`ProblemSelect.jsx:274`) — 단 ComingSoonCard 도 같이 보일 수 있음 (`recProblems.length===0 && allProblems.length===0` 인 경우만) |
| StudentDetail — Teacher 가 자기 학급이 아닌 학생 진입 | studentDetailSummary 가 403 → toast + navigate(-1) |

## 4. 동작

### 4.1 toolMastery.js 핵심 함수 (`src/lib/toolMastery.js`)

```
aggregateToolMastery(attempts, problemMap) → Map<tool_id, { attempts, correct_count, scores, avg_score }>
  for attempt of attempts:
    problem = problemMap.get(attempt.problem_id)
    if (!problem) skip
    
    toolIds = []
    
    // 1순위: claude_grade_json 의 error_locations[].tool_id (unwrap 적용)
    if (attempt.claude_grade_json) {
      grading = JSON.parse(...)
      g = grading?.response ?? grading
      errorToolIds = (g.error_locations || []).map(e => e.tool_id).filter(Boolean)
      if (errorToolIds.length > 0) toolIds = [...new Set(errorToolIds)]
    }
    
    // fallback: problem.tool_ids
    if (toolIds.length === 0 && problem.tool_ids) {
      toolIds = JSON.parse(problem.tool_ids).filter(Boolean)
    }
    
    for tid in toolIds:
      entry.attempts += 1
      entry.scores.push(attempt.score || 0)
      if ((attempt.score || 0) >= 80) entry.correct_count += 1
  
  for entry: entry.avg_score = round(mean(scores))


topWeakTools(masteryMap, toolNameMap, n=5, minSamples=3) → Array
  - entry.attempts < minSamples 이면 skip
  - { tool_id, name, goal, attempts, avg_score, correct_count }
  - avg_score 오름차순으로 N 개

topStrongTools(masteryMap, toolNameMap, n=5, minScore=70, minSamples=3) → Array
  - minSamples 미달 또는 avg_score < minScore 이면 skip
  - avg_score 내림차순으로 N 개
```

> ★ gap_locations 의 tool_id 는 **사용 안 함** — error_locations 만 1순위 신호. (단 ResultView 의 매듭 보강 권유 카드는 error + gap 을 union 하므로 정합성 차이 있음.)

### 4.2 학생 — History 동작

| 조건 | 동작 |
| --- | --- |
| /history 진입 | 1. admin/teacher 면 navigate (`/admin`/`/teacher`).<br>2. mount useEffect 에서 4개 병렬: `StudentAttempt.filter({student_id}, '-submitted_at', 1000, 0)` + `Problem.list('-created_date', 1000, 0)` + `MathTool.list('name', 100)` + `Domain.list('name', 50)`.<br>3. attempts 0 면 stats {total:0,correct:0,avg:0} + masteryLoading false.<br>4. 그 외엔 stats 채움 + problemMap/toolNameMap 만듦 + masteryMap 만듦 + `topWeakTools(_,_,5,3)` + `topStrongTools(_,_,5,70,3)` set. |
| 시도 list 별도 fetch | 별도 useEffect (filters 변경 시): `StudentAttempt.filter({student_id, [correctness 옵션]}, '-submitted_at' 또는 '-score', 20, page*20)`. reset 일 때는 attempts 갱신, 아니면 끝에 추가 |
| client-side 추가 필터 (`History.jsx:134-145`) | tab (all / homework=assignment_id 있음 / practice=assignment_id 없음), score range, domain, search (problem_content / problem_domain) |
| 날짜 그룹화 | today / yesterday / thisWeek (7d) / thisMonth (30d) / older. 토글은 expandedDates state |
| 시도 카드 클릭 | `<Link to={'/result/${attempt.id}'}>` |

### 4.3 Admin — AdminDashboard 동작

| 조건 | 동작 |
| --- | --- |
| /admin 진입 | 4개 병렬: `StudentAttempt.list('-submitted_at', 200)` + `User.list('-created_date', 100)` + `Problem.list('-created_date', 1000)` + `MathTool.list('name', 100)` |
| stats | total / avg / correctRate (correctness==='correct') |
| domainData | attempts 를 problem_domain 으로 그룹 → 평균 + count → count 내림차순 Top 10 |
| weakToolChart | masteryMap 만들고 → `topWeakTools(_,_,10,5)` (Top 10, **minSamples=5**). Cell 색상: `<40 #ef4444 (red) / <60 #f97316 (orange) / 그 외 #eab308 (yellow)` |
| toolUsageChart | masteryMap 의 모든 entry 를 attempts 정렬 → Top 10 |
| hardestProblems | attempts 를 problem_id 별 그룹 → count >= 2 만 → 평균 점수 오름차순 Top 5. 클릭 시 `/admin/problems/${entity_id}` (snapshot UUID → entity id 매핑: `problemEntityMap.get(p.problem_id)`) |

### 4.4 Teacher — TeacherDashboard 동작

| 조건 | 동작 |
| --- | --- |
| /teacher 진입 | useTeacher() 로 data (TeacherProvider 가 5분 캐시). loading 시 InlineLoader. error 시 빨간 메시지 |
| stats Cards | my_classes.length / my_students.length / attempts_summary.avg_score / attempts_summary.correct_rate |
| weak_tools 차트 | server (teacherSummary) 가 직접 산출 (★ **minSamples=2**, Top 8 — `teacherSummary/entry.ts:160-171`). Cell: `<50 red / <70 amber / 그 외 emerald` |
| tool_distribution 차트 | server 에서 Top 10 by attempts |
| 차트 막대 onClick (`TeacherDashboard.jsx:78-89`) | `weak_tools.find(t=>t.name===data.name)` → setSelectedToolForAssignment(tool.tool_id) + setShowAssignmentForm(true) → AssignmentForm 열림 (`classId={my_classes[0]?.id}` + `preselectedToolId`) |

### 4.5 StudentDetail — server function

`base44/functions/studentDetailSummary/entry.ts`:

```
입력: { userId } (POST body)
권한: caller.role in ['admin', 'teacher'] 이면 통과.
       teacher 인 경우: target.class_id 가 caller 의 my_classes (main_teacher_id 또는 assistant_teacher_ids) 에 속해야 통과 (그 외 403).

처리:
1. User.list 9999 에서 target user 찾기 (없으면 404)
2. Class.list 500 으로 권한 체크
3. StudentAttempt.filter({student_id}, '-submitted_at', 1000)
4. MathTool.list 100
5. Problem.list 1000 후 unique problem_ids 만 filter
6. mastery 집계 (toolMastery 를 inline 재구현 — 같은 로직)
7. weak_tools / strong_tools 산출 (★ **minSamples=3**, Top 5):
   - masteryArr = entries 중 attempts >= 3
   - weak: avg_score 오름차순 Top 5
   - strong: avg_score >= 70 만 → 내림차순 Top 5
8. remediation_history:
   - attempts 중 attempt_type === 'remediation_retry' 또는 'remediation_practice' 만
   - target_tool_id 별 그룹화
   - retry_count + practice_count 누적
   - retry 일 때는 parent_attempt 의 score 를 before_scores 에 추가
   - practice 일 때는 attempt.score 를 after_scores 에 추가
   - improvement = round(after_avg - before_avg) (둘 다 1+ 일 때만)
   - 결과 filter (retry 또는 practice 1+)

응답:
  { student, attempts, weak_tools, strong_tools, remediation_history }
```

StudentDetail.jsx 는 1회 호출 (`base44.functions.invoke('studentDetailSummary', {userId})`) → res.data 구조 그대로 사용.

> 시도 카드 위쪽 보강 이력 카드의 "유사 문제 {practice_count * 3}개" 표시 (`StudentDetail.jsx:178`) — practice_count × 3 으로 계산되는데 실제로는 practice 1 회당 1 row 씩 쌓임 (×3 가정이 깨질 수 있음).

| /admin/students/:userId 또는 /teacher/students/:userId 진입 동작 | invoke → 응답 unwrap → student / attempts / weak_tools / strong_tools / remediation_history set. 실패 시 toast + navigate(-1) |
| 시도 카드 클릭 | `navigate('/result/${attempt.id}')` |
| 정렬 select | sortKey state — submitted_at / score_high / score_low |
| 페이지네이션 | pageIdx state, PAGE_SIZE=20, maxPage = ceil(sorted.length/20) |

### 4.6 ProblemSelect "오늘의 추천" 동작

`ProblemSelect.jsx:194-283`:

| 조건 | 동작 |
| --- | --- |
| /problems 진입 | useEffect (`!user` skip): 4 병렬 — `BookmarkedTool.filter({student_id})` + `StudentAttempt.filter({student_id}, '-submitted_at', 500)` + `Problem.list('-created_date', 1000, 0)` + `MathTool.list('name', 100)` |
| weak_tools 계산 (client-side, inline) | masteryMap 만듦 (toolMastery 와 동일하게 인라인 — error_locations 1순위 + problem.tool_ids fallback). 약점 도구 조건: `entry.attempts >= 3 && avg < 70` |
| 추천 도구 결합 | `[...new Set([...bookmarks.map(b=>b.tool_id), ...weakToolIds.slice(0,5)])]` (즐겨찾기 우선 + weak 5개) |
| 추천 문제 추출 (`ProblemSelect.jsx:259-271`) | recommendedToolIds 상위 3개를 순회 → 각 도구당 random shuffle 후 상위 2개 |
| 빈 결과 fallback | recProblems 가 0이면 allProblems.slice(0,5) 로 fallback (★ random 적용 X — 항상 최근 5개) |
| 추천 카드 클릭 | `<Link to={'/problem/${problem.id}'}>` — 자유 풀이 진입 |

### 4.7 teacherSummary 함수

`base44/functions/teacherSummary/entry.ts`:

```
입력: 없음 (caller 정보로 처리)
권한: role in ['teacher', 'admin'] 이면 통과 (Forbidden 403 그 외)

처리:
1. Class.list 500 + Academy.list 200 → academyMap, myClasses (main 또는 assistant 매칭)
2. myClasses 0 이면 빈 응답 (timing 도 함께)
3. 각 학급에 User.filter({class_id}, '-created_date', 500) 병렬 → unique my_students
4. 학생 0 명이면 동일하게 빈 응답
5. 학생별 StudentAttempt.filter (배치 20 으로 병렬) → allAttempts
6. unique problem_ids 추출 → Problem.list 5000 후 filter → problemMap
7. MathTool.list 100 → toolNameMap
8. aggregateToolMastery (서버-사이드 재구현 — lib 공유 X)
9. weak_tools: minSamples 2, avg_score 오름차순 Top 8
10. tool_distribution: attempts 내림차순 Top 10
11. 학생별 통계 (attempt_count, avg_score, correct_count) + 학급별 student_count
12. attempts_summary (total, avg_score, correct_rate)
13. timing 모든 단계 ms 기록

응답:
  { success, loaded_at, my_classes[], my_students[], attempts_summary, weak_tools, tool_distribution, timing }
```

TeacherProvider (`src/lib/TeacherContext.jsx:9-43`): 5분 캐시 (CACHE_TTL_MS = 5*60*1000). force=true 면 즉시 fetch, 그 외엔 5분 안에 재진입 시 skip. refresh = `() => load(true)`.

### 4.8 데이터 변경

- 모든 분석 / 대시보드 페이지는 read-only — 기존 데이터 변경 X.
- 신규 BookmarkedTool create 는 RemediationLesson 의 ⭐ 액션에서만.

## 5. 에러

| 조건 | 사용자 표시 | 시스템 처리 |
| --- | --- | --- |
| Teacher 가 학급 외 학생 (`/teacher/students/:id` URL 직접) | `toast.error('데이터를 불러오지 못해요')` (또는 e.message) | studentDetailSummary 가 403 → res.data.error → toast + `navigate(-1)` |
| 시도 데이터 부족 | "충분한 시도 데이터가 쌓이면 표시돼요" 또는 카드 자체 표시 X | 빈 카드 가드 |
| studentDetailSummary 함수 실패 (네트워크 등) | `toast.error(e.message \|\| '데이터를 불러오지 못해요')` | catch + `navigate(-1)` |
| TeacherDashboard 진입 — 담당 학급 0 | "담당 학급이 없어요" | render 단계 가드 |
| ProblemSelect 추천 fetch 실패 | (UX 표시 X — `console.error`) | recProblems 빈 배열 → recommendedProblems.length===0 이면 ComingSoonCard 또는 fallback |
| teacherSummary 자체 실패 (5xx 등) | "데이터를 불러오지 못했어요\n{error}" | TeacherContext 의 setError → TeacherDashboard 가 표시 |

## 6. 미결정 / 보류

- **mastery minSamples 값 불일치**: History (3), AdminDashboard (5), TeacherDashboard server (2), studentDetailSummary (3). 한 곳에서 일관되게 정의해서 공유하면 좋음.
- **claude_grade_json 의 tool_id 매핑 정확도**: LLM 이 매번 정확히 매핑하지는 않음 — `error_locations[].tool_id` 가 비어 있을 때 fallback 으로 problem.tool_ids 사용. 양쪽 결과의 신뢰도 차이 있음 — 한 문제에 도구 여러 개일 때 부정확 (gap_locations.tool_id 는 mastery 에 사용 X — Remediation 명세서 와 정합성 차이).
- **remediation_history before/after 정의**:
  - `before_scores` = parent_attempt 의 score 만 (retry 일 때만 추가, 1 회 retry 일 때 1 score)
  - `after_scores` = remediation_practice 의 score 만 (★ Remediation 명세서 의 알려진 버그 — practice 는 항상 score=0 으로 저장됨 → after_avg 가 항상 0)
  - improvement 가 항상 음수로 표시될 가능성 있음.
- **Teacher 시점 보강 이력 노출**: studentDetailSummary 가 산출은 하지만 — Teacher StudentDetail 에서도 보이는지 확인 필요.
- **기간별 분석**: 현재 기간 필터 X. 최근 7일 / 이번 달 / 전체 단위 분석 V2.
- **도구별 그룹화 / 정렬 옵션**: weak_tools / 시도 분포는 단일 정렬만. 도메인 / 학년 그룹은 V2.
- **점진적 향상 분석**: 학생이 시간이 지나면서 어떻게 향상되는지 시간 추이 분석 V2.
- **학급 간 비교**: 강사 입장에서 우리 학급 vs 다른 학급 평균 비교 V2.
- **ProblemSelect "오늘의 추천" 빈 결과 fallback**: random 적용 X — 항상 최근 5개. 더 다양한 노출을 위해 random 적용 검토.

## 7. 검증 (QA 체크리스트)

### 학생 — History
- [ ] /history 의 stats Card (총 풀이 / 정답 / 평균) 정상 표시
- [ ] 약점 / 강점 매듭 Card 표시 (해당 도구 시도 ≥ 3)
- [ ] 시도 < 3 의 도구는 표시 X
- [ ] avg_score / 시도 / 정답 수 정확
- [ ] Tabs (모든/숙제/자유) 의 client-side filter
- [ ] 검색 / 정렬 / correctness / 도메인 / 점수 범위 모두 동작
- [ ] 날짜 그룹화 (오늘/어제/이번 주/이번 달/그 이전) + 토글
- [ ] [더 보기] 로 다음 페이지 fetch

### Admin — Dashboard
- [ ] /admin 의 매듭별 약점 차트 표시 (도구당 시도 ≥ 5, Top 10)
- [ ] Cell 색상 분기 (<40 red / <60 orange / 그 외 yellow)
- [ ] 시도 분포 차트 (Top 10, attempts 내림차순)
- [ ] 단원별 평균 차트 (count 내림차순 Top 10)
- [ ] hardestProblems Card 클릭 → /admin/problems/{entity_id}

### Teacher — Dashboard
- [ ] /teacher 의 자기 학급 매듭 차트 (다른 학급 데이터 안 섞임 — server 측 매칭)
- [ ] 차트 막대 클릭 → AssignmentForm 노출 (preselectedToolId 적용)
- [ ] ★ classId 가 항상 my_classes[0] 으로 자동 잡힘 (알려진 이슈 — teacher-assignment 명세서 참조)
- [ ] 담당 학급 0 시 안내 메시지
- [ ] TeacherProvider 5분 캐시 적용

### StudentDetail (admin/teacher)
- [ ] /admin/students/:id 또는 /teacher/students/:id 정상 진입
- [ ] studentDetailSummary 1회 호출로 student / attempts / weak / strong / remediation_history 모두 받음
- [ ] 약점 / 강점 매듭 Card 표시 (시도 ≥ 3)
- [ ] 보강 이력 Card — retry/practice count, before/after, improvement (★ practice 가 score=0 인 알려진 버그 영향 가능)
- [ ] 시도 timeline + pageIdx 페이지네이션 (PAGE_SIZE=20)
- [ ] Teacher 가 자기 학급 외 학생 진입 시 차단 → toast + navigate(-1)

### ProblemSelect "오늘의 추천"
- [ ] 즐겨찾기 매듭 우선 → weak_tools (avg<70, attempts≥3) 보조 결합
- [ ] 각 도구당 random 1-2 문제 (상위 3 도구)
- [ ] 추천 카드 클릭 → /problem/:id (자유 풀이)
- [ ] 빈 상태 (recProblems 0) 일 때 allProblems.slice(0,5) fallback (random X)
