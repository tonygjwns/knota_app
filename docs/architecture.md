# KNOTA_app 시스템 한눈에

작업 재개 시 컨텍스트 회복용. 코드 변경 후 갱신 필요.

## 1. 사용자 / 권한

| role | 기본 영역 | 핵심 권한 |
|---|---|---|
| `admin` | `/admin/*` | KNOTA 운영자. 모든 학원/학급/사용자 관리. 어떤 학생 attempt 도 조회 가능 |
| `owner` | `/teacher/*` (학원장) | 본인 학원의 학급 생성/관리, 학생 학급 이동, 강사 배정 |
| `teacher` | `/teacher/*` | 본인 main_teacher_id 또는 assistant_teacher_ids 학급 한정. 학생 attempt 조회는 본인 학급 학생만 |
| `student` | `/home`, `/problems`, `/result/:id`, `/bookmarks` 등 | 본인 학습만. 학급 변경 불가 (InviteCode 가입 시만 자동 배정) |

소속 구조: `Academy → Class → User`. `User.class_id` 단일 필드 (이력 entity 없음 — 옵션 1).

## 2. 데이터 모델 (도구 기반, Sprint 2)

```
Domain (≈19 학년/단원)
   ↓ achvmt_std_code prefix
MathTool (162)
   ↑ tool_id
SolutionStep (1093, 평균 3.05/별해)
   ↑ solution_id
Solution (358, 평균 1.78/문제)
   ↑ problem_id
Problem (201)

학습 데이터:
StudentAttempt — problem_id, claude_grade_json (matched_solution_id, step_feedback, ...)
Assignment — class_id, problem_ids[]
BookmarkedProblem / BookmarkedTool — user_id (학생 + 강사 공용)
InviteCode — academy_id, class_id, role
(예정) RecommendationFeedback — user_id, attempt_id, reason_type, feedback
```

데이터 소스: GitHub `data/sprint2/{tools, problems, solutions, knots, achvmt_stds}.json[l]`
Import 함수: `base44/functions/importToolNetwork/entry.ts`

## 3. 핵심 흐름

### 3.1 채점 (Submission Pipeline)

```
학생 손글씨 풀이
  → Gemini OCR
  → LLM 채점 prompt (problem + N개 별해 path + 학생 풀이)
  → output: matched_solution_id + step_feedback[] (각 step 의 matched_solution_step_number)
  → StudentAttempt.create
  → /result/:id 이동
```

핵심 파일: `src/pages/ProblemSolve.jsx` (채점 prompt + schema)
재채점(OCR 수정 후): `src/pages/ResultView.jsx` 의 `REGRADE_PROMPT_TEMPLATE` (동일 흐름)

### 3.2 추천 (Recommendation)

```
학생 attempts (시간 가중치 반감기 30일)
  → masteryMap (toolId → weighted avg + last seen)
  → weak (avg<70) + bookmarked + stale (14일+ 미시도)
  → 추천 문제 5개 + reason 객체 (type / label / detail / strength)
  → ResultView 진입 시 ?from=recommend → 피드백 카드 → RecommendationFeedback
```

핵심 파일: `src/pages/ProblemSelect.jsx` 의 `ProblemModeView` 의 mode='recommended'

### 3.3 보강 (Remediation)

```
점수 낮음 → ResultView 의 "매듭 보강" 카드 → /remediation/:attemptId/retry
  → 다시 풀이 (RemediationRetry)
  → 도구 학습 (RemediationLesson — matched_solution_id 또는 priority=1 SolutionStep 의 application + appended_info)
  → 유사 문제 풀이 (RemediationPractice — findSimilarProblems)
  → 완료 (RemediationComplete)
```

### 3.4 강사 통계

```
/teacher/assignments/:id 의 문제별 accordion
  → 학생 attempts 의 matched_solution_id 분포 (별해 분포)
  → step_feedback 의 status 분포 (단계별 정답률 — correct/partial/wrong/missing)
  → 학생별 요약 표
```

핵심 컴포넌트: `src/components/AssignmentProblemStats.jsx`

### 3.5 학급 관리

```
학원장: AdminStudents → 학생별 학급 select dropdown (본인 학원 학급 옵션) → User.update(class_id)
강사: TeacherStudents → 본인 학급 옵션만 dropdown / TeacherClasses → 학급에서 학생 제거 (class_id=null)
학생 추가: InviteCodeManager (TeacherClasses 안) — 코드 발급 → 학생 가입 시 자동 배정
```

## 4. 화면 / 라우팅

### 학생 영역 (`<AppLayout>`)

| 라우트 | 화면 |
|---|---|
| `/` | Landing — 가입 / 로그인 |
| `/home` | Home — 메인 |
| `/problems` | ProblemHub — 받은 숙제 + 즐겨찾기 + 자유 연습 5카드 |
| `/problems?mode=random` | 즉시 random 문제로 redirect |
| `/problems?mode=recommended` | 추천 문제 5개 (이유 표시) |
| `/problems?mode=domain` | 학년 → 단원 → 문제 drill-down |
| `/problems?mode=tool` | 학년/단원 필터 + 도구 카드 (숙련도 역순) |
| `/problems?mode=wrong` | 틀렸던 문제 — 학년/단원 필터 + 정렬 |
| `/problem/:id` | ProblemSolve — DrawingCanvas (signature_pad) + 채점 |
| `/result/:id` | ResultView — 매칭 별해 + step_feedback 그룹화 + 다른 풀이 |
| `/history` | History |
| `/assignment/:id` | StudentAssignment — 숙제 문제들 |
| `/remediation/:attemptId/*` | 보강 흐름 4단계 |
| `/bookmarks` | 즐겨찾기 (학생 + 강사 공용) |
| `/profile` | 내 정보 관리 |

### 강사 영역 (`<TeacherLayout>`)

| 라우트 | 화면 |
|---|---|
| `/teacher` | TeacherDashboard |
| `/teacher/students` | TeacherStudents — 학생 목록 + 학급 이동 (제한적) |
| `/teacher/students/:userId` | StudentDetail mode='teacher' |
| `/teacher/classes` | TeacherClasses — 학급 + 학생 관리 + InviteCode |
| `/teacher/assignments` | TeacherAssignments |
| `/teacher/assignments/:id` | AssignmentDetail — 문제별 통계 accordion |
| `/teacher/problems` | TeacherProblems — 단원/도구 drill-down + 즐겨찾기 |
| `/teacher/problems/:id` | ProblemDetail mode='teacher' — 별해 + step + 학생 풀이 |
| `/teacher/review` | TeacherReview — 채점 검토 큐 |
| `/teacher/bookmarks` | 즐겨찾기 |

### 관리자 영역 (`<AdminLayout>`)

| 라우트 | 화면 |
|---|---|
| `/admin` | AdminDashboard |
| `/admin/academies` | AdminAcademies |
| `/admin/teachers` | AdminTeachers |
| `/admin/students` | AdminStudents — 학생 학급 변경 |
| `/admin/problems` | AdminProblems — 단원 선택 → 문제 목록 |
| `/admin/invite-codes` | AdminInviteCodes |

## 5. 코드 위치 빠른 참조

| 작업 | 파일 |
|---|---|
| 채점 prompt + schema | `src/pages/ProblemSolve.jsx` |
| 재채점 prompt + schema | `src/pages/ResultView.jsx` (REGRADE_*) |
| 추천 알고리즘 | `src/pages/ProblemSelect.jsx` ProblemModeView |
| 보강 도구 학습 | `src/pages/remediation/RemediationLesson.jsx` |
| 강사 숙제 통계 | `src/components/AssignmentProblemStats.jsx` |
| 별해 + 단계 표시 (공용) | `src/components/SolutionCard.jsx` |
| 데이터 import | `base44/functions/importToolNetwork/entry.ts` |
| 권한 / 라우팅 헬퍼 | `src/lib/auth-utils.js` (`redirectByRole`) |
| 학년 라벨 헬퍼 | `src/lib/grade-labels.js` (`gradeLabel`, `extractGradeOptions`) |
| 손글씨 캔버스 | `src/components/DrawingCanvas.jsx` (signature_pad 기반) |
| 강사 컨텍스트 (my_classes, my_students) | `src/lib/TeacherContext.jsx` |

## 6. entity 목록

`base44/entities/`:

- `User`, `Academy`, `Class`
- `Problem`, `Solution`, `SolutionStep`, `MathTool`, `Domain`
- `StudentAttempt`, `Assignment`
- `BookmarkedProblem`, `BookmarkedTool`
- `InviteCode`
- (예정) `RecommendationFeedback`

## 7. 외부 통합

- **base44 SDK** — 인증, entity CRUD, GitHub raw fetch, LLM 호출 (Claude / Gemini)
- **Sprint 2 RDS** — 데이터 출처. 운영 시 직접 접근 없음 (data/sprint2/ 로 정적 import)
- **base44 플랫폼** — private 모드면 / 진입 시 자동 로그인 페이지 redirect (이 영향이 Landing 진입 막던 원인). public 모드로 토글 권장.
