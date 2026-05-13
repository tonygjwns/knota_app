# Decisions Log

KNOTA_app 의 주요 설계 / 기능 결정 기록 (ADR 스타일).
시간순 누적. 옛 결정이 번복되면 *새 항목* 으로 추가하고 옛 항목은 그대로 둠 (이력 보존).

각 항목 양식:
> [날짜] [카테고리] **결정** — 간단한 근거 / 관련 파일

---

## 2026-05-11 — Sprint 2 데이터 모델 전환

- **[데이터]** 데이터 소스를 KNOTA Sprint 2 RDS `KNOTA_2604_APPROVED_ONLY.jaemin_math_tool` 스키마로 전환. 0423 데이터(UUID 기반) 폐기. ID 체계도 달라 합치기 불가, 전면 교체. `knots` 테이블은 *0423 usage_records 와 동일 역할* (도구 적용 step) — 추상 매듭(`joon_decomposer.proposed_knots`)과 다른 개념.
  - 출처: `KNOTA_2604_APPROVED_ONLY.jaemin_math_tool` 스키마의 5개 테이블 (tools 162, problems 201, solutions 358, knots 1093, achvmt_stds 311). `problems.answer` 는 `public.problems` 와 LEFT JOIN 으로 보강.

- **[데이터 모델]** 단일 정해 → **3-level (Problem → Solution[N] → SolutionStep[N])**. 평균 1.78 별해/문제, 3.05 step/별해. Problem.agent_solution / solution_path 필드 제거.
  - 신규 entity: `Solution`, `SolutionStep`
  - 영향: 채점 / 보강 / ResultView 모두 N개 별해 매칭 흐름으로 변경

- **[Import]** `importKnotaData` 폐기, **`importToolNetwork`** 신설.
  - 데이터 위치: GitHub `tonygjwns/knota_app/main/data/sprint2/` (raw fetch)
  - mode: `check / reset / init / problems / all`

- **[Bookmark]** `BookmarkedProblem.student_id / BookmarkedTool.student_id` → **`user_id`** 일반화 (학생 + 강사 공용).

- **[운영 데이터]** 전면 클리어 (테스트 단계라 운영 데이터 보존 불필요). `mode='reset'` 으로 처리.

---

## 2026-05-11~12 — UI / UX 보강

- **[채점]** 채점 prompt 를 **N개 별해 path 매칭** 으로 교체.
  - output 에 `matched_solution_id` + `matched_solution_priority` 추가
  - `alternative_solution` 필드(즉석 생성) 제거
  - LLM 즉석 별해 → DB 큐레이션된 별해 표시로 전환
  - 파일: `src/pages/ProblemSolve.jsx`, `src/pages/ResultView.jsx` (REGRADE 동일)

- **[채점 step 매핑 입도]** `step_feedback[].matched_solution_step_number` 필드 추가. 학생 풀이의 여러 step 이 정해 step 1 개에 매핑 가능 (N:1). UI 에서 같은 정해 step 묶음으로 그룹 표시.
  - 파일: `src/pages/ResultView.jsx` 단계별 피드백 그룹화 (`📍 정해 Step N — 도구명 (학생 풀이 N줄에 해당)`)

- **[결과 화면]** 매칭 별해 배너 (`🎯 풀이 #N 방식으로 푸셨네요!`) + "다른 풀이도 있어요" 섹션. 옛 LLM-생성 *이런 방법도 있어요* 배너 제거.
  - 컴포넌트: `src/components/SolutionCard.jsx` (ProblemDetail / ResultView 공용)

- **[보강]** `RemediationLesson` 이 `matched_solution_id` 우선 사용, fallback 으로 priority=1 별해의 `SolutionStep`. `Problem.solution_path` 의존 제거. application / appended_info 표시.

- **[강사 페이지]** 추가:
  - `/teacher/problems` — 단원 → 도구 → 문제 drill-down + 즐겨찾기 토글 (`TeacherProblems`)
  - `/teacher/problems/:id` — 별해 N개 + 단계별 도구 흐름 표시 (`ProblemDetail` 확장)
  - `/teacher/review` — 학생 채점 검토 (`TeacherReview`)
  - `/teacher/assignments/:id` — 문제별 accordion + 별해 분포 차트 + 단계별 정답률 + 학생 표 (`AssignmentProblemStats`)

- **[라우팅 권한]** `ResultView` 에 teacher 본인 학생 attempt 조회 허용. 옛 코드는 본인 또는 admin 만 허용 → /home redirect 체인 발생.
  - 헬퍼: `src/lib/auth-utils.js` 의 `redirectByRole(user)` (admin → /admin, teacher → /teacher, else → /home)
  - `viewerIsOwner` 플래그로 학생 전용 액션(다시 풀기 / 보강 / 북마크) 강사 화면에서 숨김

- **[Landing]** auth_required 시 경로 무관 `<Landing />` 즉시 렌더. `window.location.replace('/')` 제거 — redirect 체인 단순화. private/public 앱 정합성은 base44 콘솔 설정 영역.

---

## 2026-05-13 — 운영 흐름 + 학급 관리

- **[학급 권한 — B 옵션]** 학생 학급 이동 권한:
  - 학원장: 본인 학원 모든 학생 가능
  - 강사: 본인 main_teacher_id 또는 assistant_teacher_ids 학급 *한정* (강사가 다른 학급으로 학생을 보낼 수는 없음)
  - 학생: 불가 (InviteCode 가입 시만 자동 배정)
  - UI: `AdminStudents` (학원장), `TeacherStudents` / `TeacherClasses` (강사)

- **[학급 모델 — 옵션 1]** 단순 모델 유지. `User.class_id` 단일 필드, 이력 entity 없음.
  - 이유: 운영 데이터 부족 / 학기 시스템 미정. 데이터 쌓이면 추후 `ClassEnrollment` 등으로 확장
  - 졸업 / 휴원 / 학기 이동은 학원장이 그때그때 변경

- **[Class.grade_range]** Class entity 에 학년 필드 추가. Domain.grade_range 와 동일 코드 체계 (`'1'` ~ `'12'`).
  - UI 에서 학급 생성 시 필수 입력 (entity required 는 미설정 — 기존 학급 호환)
  - 라벨 헬퍼: `src/lib/grade-labels.js` (`gradeLabel(g)`, `extractGradeOptions(domains)`)

- **[AssignmentForm 개편]** 학년 / 단원 *상위 필터* + 도구별 단일 모드. 기존 "도구별 / 단원별" 탭 제거.
  - 학년 default = 학급 `grade_range`. 다른 학년 선택 가능 (선행학습 대비)
  - 단원까지 필수 선택
  - 학년 옵션은 실데이터 기준 (`Domain.list` 의 unique `grade_range`)

- **[탈퇴 데이터 정책]** 모든 `StudentAttempt` 보존 + 시간 가중치 (반감기 30일) 로 실력 향상 자연 반영. hard delete 안 함.
  - 사용자 우려("실력 늘었는데 과거 점수 때문에 평균 깎임") 는 추천 알고리즘의 시간 가중치로 해결.

---

## 2026-05-13 — 학생 화면 + 추천 시스템 (그룹 A)

- **[학생 자유 연습]** 자유 연습 카드 5개로 재구성:
  - 추천 / 랜덤 / 단원별 / 도구별 / 틀렸던 문제
  - "복습" 별도 섹션 → "틀렸던 문제" 카드로 흡수
  - 별도 "추천 문제" 섹션 → "추천" 카드로 흡수
  - 별도 "진단 평가" 섹션 → "받은 숙제" 안으로 이동

- **[랜덤 즉시 진입]** "랜덤" 카드 클릭 시 중간 "랜덤 문제" 모드 페이지 스킵 → 즉시 `/problem/:id` navigate. `/problems?mode=random` 직접 URL 진입 시도 자동 navigate.

- **[단원별 drill-down]** mode=`domain` 흐름: 학년 카드 → 학년 선택 → 단원 카드 → 단원 선택 → 그 단원 랜덤 문제.

- **[도구별 — 숙련도 역순]** mode=`tool` 흐름: 상단 학년/단원 *필터* (선택사항) + 도구 카드 (숙련도 역순 정렬, 미경험 우선).
  - 숙련도 = 시간 가중치 적용한 학생 attempts 평균 점수

- **[틀렸던 문제]** mode=`wrong` 흐름: 상단 학년/단원 필터 + 정렬 옵션 (날짜 ↕ / 점수 ↕).

- **[추천 시스템 — 신뢰도 개선]**
  - 알고리즘: 시간 가중치 (반감기 30일) + weak tool (가중평균 < 70) + bookmarked + stale (14일+ 미경험)
  - 추천 이유 표시: `🎯 약점 매듭` / `⭐ 즐겨찾기` / `⏰ 복습 시점` + 상세 + 별점
  - 시각 차별화: 이유별 좌측 색상 보더 + 배경색
  - fallback 안내: 데이터 부족 시 "5문제 이상 풀면 맞춤 추천 시작" 메시지 (random 5개 fallback 제거)
  - 피드백 루프: `/result/:id?from=recommend` 진입 시 👍/👎 버튼 → `RecommendationFeedback` entity 저장 (분석 / 알고리즘 반영은 후속)
  - 진단 시각화 페이지는 *후속* (학생 홈에서 진단 페이지로 진입)

---

## 2026-05-13 — 기타 UX

- **[InviteCode]** base44 가 별도로 진행. 학원장이 학급별로 초대 코드 발급, 학생이 코드로 가입 시 학급 자동 배정.

- **[UserMenuDropdown]** (대기) 사용자 이름 클릭 = "내 정보 관리" 클릭 = 같은 navigate → 이름 클릭 비활성화 예정.
- **[Profile / 탈퇴]** (대기) `/withdraw` 페이지 신설 예정. Profile 에 탈퇴 버튼 추가.

---

## 미결정 / 후속 작업

- 진단 시각화 페이지 (학생 홈 — 단원별 / 도구별 mastery 차트)
- ClassEnrollment 학기 모델 (데이터 쌓이면)
- 별해 큐레이션 직접 작성 UI (현재는 import 만)
- 채점 prompt 헬퍼 추출 (`src/lib/grading.js`) — ProblemSolve / ResultView REGRADE 중복 해소
- 학년 필드 마이그레이션: 기존 학급들 `grade_range` 빈 값 → 학원장이 채워 넣기
- `RecommendationFeedback` 데이터 누적 후 분석 / 알고리즘 반영
