# 권한 분리 (Admin/Teacher/Student) + 학원/학급 기능 명세서

## 1. 개요

KNOTA 는 학원 운영 형태의 SaaS 로 3-tier 권한 모델을 사용합니다. 각 role 은 서로 다른 책임 / 화면 / 데이터 접근 권한을 가집니다. 학원(Academy) → 학급(Class) → 학생(Student) 계층 구조로 데이터를 조직하며, 학급에는 담당 강사(main_teacher_id) + 보조 강사(assistant_teacher_ids) 가 배정됩니다.

- **상위/관련 기능**: 모든 페이지의 진입 가드와 데이터 조회 권한의 기반. 회원가입 승인, 학원/학급 관리, 학생 배정, 숙제 출제, 분석 대시보드 등 모든 상위 기능이 이 권한 체계 위에서 동작.
- **대상 사용자**:
  - **admin** (KNOTA 운영): 시스템 전체. 데이터 import, 학원/학급 생성, 모든 학생/강사 관리, 마이그레이션 함수 실행.
  - **teacher** (학원 강사): 자기가 담당(main) 또는 보조(assistant)인 학급의 학생만 관리, 분석, 숙제 출제.
  - **student** (학습자): 자기 학습만. 숙제 받기, 자유 풀이, 자기 기록 조회.
- **영향 받는 파일 리스트**:
  - `base44/entities/User.jsonc` — `role` (default `student`) / `approval_status` (default `pending`) / `academy_id` / `class_id` / `grade`
  - `base44/entities/Academy.jsonc` — `name` (required) / `owner_id` / `join_code`
  - `base44/entities/Class.jsonc` — `name` / `academy_id` (required) / `main_teacher_id` / `assistant_teacher_ids` / `grade_range`
  - `base44/functions/migrateRoles/entry.ts` — `'user'` 또는 빈 role → `'student'` 일괄 마이그레이션
  - `base44/functions/migrateClassTeachers/entry.ts` — 구 `teacher_id` → `main_teacher_id` 마이그레이션
  - `base44/functions/seedApprovals/entry.ts` — approval_status 비어있는 user → `'approved'` + 첫 admin 자동 지정
  - `src/lib/AuthContext.jsx` — 인증 상태 / role 노출 (`base44.auth.me()`)
  - `src/components/PendingApprovalScreen.jsx` — 승인 대기/거절 전체 화면
  - `src/App.jsx` — `user.role !== 'admin' && approval_status !== 'approved'` 분기로 PendingApprovalScreen 강제 표시
  - `src/components/AppLayout.jsx` — 학생 사이드바/하단 nav (admin/teacher 는 nav 표시 없음)
  - `src/pages/Home.jsx` — admin/teacher 가 진입하면 자동 redirect
  - `src/pages/admin/AdminLayout.jsx` — `/admin/*` 진입 가드
  - `src/pages/teacher/TeacherLayout.jsx` — `/teacher/*` 진입 가드 (admin → /admin)
  - `src/pages/admin/AdminAcademies.jsx` — 학원/학급 CRUD UI
  - `src/pages/admin/AdminUsers.jsx` / `AdminTeachers.jsx` / `AdminStudents.jsx` — 사용자 관리 (3개 분리)
  - `src/pages/Profile.jsx` — 본인 정보 편집 (`base44.auth.updateMe`)
  - `src/pages/Landing.jsx` — 비로그인 진입점, 회원가입 폼

## 2. 화면 구상도 (텍스트 wireframe)

### 2.1 가입 / 승인 흐름

```
[비로그인]
  /  → Landing 페이지 (서비스 소개 + 회원가입 / 로그인 버튼)
  ├─ "로그인" → base44.auth.redirectToLogin('/home')
  └─ "회원가입" → 자체 폼 (role=student/teacher 선택, 이름, 이메일, 비번)
      └─ base44.auth.register → loginViaEmailPassword → updateMe({role, approval_status:'pending'}) → OTP 인증

[승인 대기]
  로그인 성공 → AuthContext.checkUserAuth() → base44.auth.me() → user 정보 fetch
  App.jsx: user.role !== 'admin' && approval_status !== 'approved'
  → <PendingApprovalScreen user={user}/> (전체 화면, 다른 라우트 렌더 차단)
    ├─ "관리자 승인 대기 중" 헤더 (amber 톤)
    ├─ 가입 정보 (이름/이메일/가입 일시)
    └─ [로그아웃] 버튼 → base44.auth.logout('/')

[거절됨]
  approval_status === 'rejected'
  → 동일 컴포넌트의 red 톤 변형
    ├─ "승인이 거절됐어요" + "사유: {rejected_reason}"
    └─ [로그아웃]

[승인됨 — 진입 분기]
  Landing 의 useEffect 가 isAuthenticated true 면 navigate('/home').
  Home.jsx 의 useEffect:
    user.role === 'admin'   → navigate('/admin', {replace:true})
    user.role === 'teacher' → navigate('/teacher', {replace:true})
    그 외 (student) 만 메인 화면 렌더
```

### 2.2 Admin Layout

```
┌─ slate-900 헤더 ──────────────────────────────┐
│ [관] 관리자 패널          [UserMenuDropdown ▼] │
├─────────────────┬─────────────────────────────┤
│ Sidebar (slate)  │ Outlet                       │
│  - 대시보드      │                              │
│  - 학원/학급     │                              │
│  - 강사 목록     │                              │
│  - 학생 목록     │                              │
│  - 문제 목록     │                              │
│  - 채점 검토     │                              │
└─────────────────┴─────────────────────────────┘
모바일: 하단 고정 nav (slate-800)
```

진입 가드 (`AdminLayout.jsx:23-31`): `user.role !== 'admin'` 이면 `toast.error('관리자 권한이 필요해요')` + `navigate('/home', {replace:true})`. 로딩 중이거나 user 없으면 null 반환.

> 사이드바 메뉴에 `/admin/users` 항목은 없음. URL 직접 진입만 가능.

### 2.3 Teacher Layout

```
┌─ violet-900 헤더 ──────────────────────────┐
│ [강] 강사 패널  [↻ 새로고침] [UserMenu ▼]   │
├─────────────────┬─────────────────────────────┤
│ Sidebar (violet) │ Outlet                       │
│  - 대시보드      │                              │
│  - 내 학생들     │                              │
│  - 내 학급       │                              │
│  - 숙제          │                              │
└─────────────────┴─────────────────────────────┘
```

진입 가드 (`TeacherLayout.jsx:35-44`):
- `user.role === 'admin'` → `toast.error('강사만 접근 가능해요')` + `navigate('/admin', {replace:true})`
- `user.role !== 'teacher'` (student 등) → `toast.error('강사 권한이 필요해요')` + `navigate('/home', {replace:true})`

`<TeacherProvider>` 가 Outlet 을 감싸 학급/학생 데이터를 공유.

### 2.4 학원/학급 관리 (AdminAcademies)

```
[ 학원 / 학급 관리 ]
─────────────────────────────────────────────
좌 50% : 학원 리스트              우 50% : 선택된 학원의 학급
                "+ 학원 추가"               "+ 학급 추가"

┌─ 학원 카드 ──────────┐       ┌─ 학급 카드 ──────────────────────┐
│ [🏢] KNOTA 학원       │       │ [👥] 중3-A반                       │
│ 학원장: 홍길동         │       │ 담당: 김선생 (또는 amber "담당 미배정") │
│ 학급 3개              │       │ 보조: 이선생, 박선생                 │
│ [✏️] [🗑️] [▸]         │       │ 중3 · 학생 12명                     │
└──────────────────┘       │ [✏️] [🗑️] [▸]                       │
                                  │ (펼침 시) 학생 리스트 — 클릭 시       │
                                  │ /admin/students/{id}                 │
                                  └────────────────────────────────────┘
```

- 학원 카드 클릭 → 우측에 그 학원의 Class 만 필터링 표시 (selectedAcademy state).
- 학급 카드 클릭 → expandedClass 토글 → 그 학급의 학생 리스트 펼침 (`User.list` 후 `class_id===cls.id && role==='student'` 필터).
- 학원 삭제 → confirm → 그 학원 소속 모든 Class 도 cascade delete (`AdminAcademies.jsx:243-250`).

### 2.5 사용자 관리 페이지 (3개 분리)

| URL | 표시 | 메뉴 노출 |
|---|---|---|
| `/admin/users` | 전체 user (search / filter (전체/승인 대기/승인됨/거절됨) / 페이지네이션) | ❌ (URL 직접) |
| `/admin/teachers` | role=teacher 만 | ✅ "강사 목록" |
| `/admin/students` | role=student 만 + 학급 필터 칩 | ✅ "학생 목록" |

각 페이지 카드에는 [승인] [거절] [관리] 3개 버튼. 학생 카드 본체 클릭 → `/admin/students/:id` (StudentDetail). [관리] 버튼 클릭 시 모달 (role / academy / class 변경, e.stopPropagation 으로 카드 클릭과 분리).

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| 비로그인 + `/` 진입 | Landing 표시. useEffect 가 `base44.auth.isAuthenticated()` 체크 후 인증 상태면 `/home` 으로 리다이렉트 |
| 비로그인 + 인증 필요 페이지 진입 | AuthContext 가 `auth_required` 에러 → `navigateToLogin(현재 URL)` (App.jsx:62-66) |
| 로그인 + `approval_status === 'pending'` (admin 아닌 경우) | PendingApprovalScreen 전체 화면. 다른 라우트 렌더 차단 |
| 로그인 + `approval_status === 'rejected'` | 동일 컴포넌트의 red 변형 + rejected_reason 표시 |
| `role === 'admin'` (approval 무관) | App.jsx 가 PendingApprovalScreen 우회 → 모든 라우트 진입 가능 |
| `role === 'teacher' + approved` | `/teacher/*` 진입, `/admin/*` 진입 시 차단 + `/home` |
| `role === 'student' + approved` | 학생 라우트 진입, `/admin` `/teacher` 차단 |
| Admin 이 학생 페이지 (`/home`) 진입 | Home.jsx useEffect 자동 redirect → `/admin` |
| Teacher 가 학생 페이지 진입 | Home.jsx useEffect 자동 redirect → `/teacher` |
| Student 가 미배정 (academy_id, class_id 비어있음) | 정상 진입, AppLayout 사이드바에 "수학 학습 / K-12 수학" placeholder, 받은 숙제 0 |
| 학급의 main_teacher_id 비어있음 | 학급 카드에 amber 색 "담당 미배정" 표시 (AdminAcademies.jsx:372) |

## 4. 동작

| 조건 (액션) | 동작 |
| --- | --- |
| 회원가입 (Landing 자체 폼) | `base44.auth.register({email,password})` → `loginViaEmailPassword` → `updateMe({full_name, role, approval_status:'pending'})` → OTP 인증 → `/home` (Landing.jsx:43-72) |
| Google OAuth 로그인 | "로그인" 버튼 → `base44.auth.redirectToLogin('/home')` |
| AuthContext.checkUserAuth() | `base44.auth.me()` 호출 → setUser. 별도 update 호출 없음 (entity default 의존). 401/403 시 `auth_required` 에러 set |
| App.jsx 분기 | `if (user && user.role !== 'admin' && user.approval_status !== 'approved')` → PendingApprovalScreen. admin 은 자기 승인 안 돼 있어도 우회 (혼선 방지) |
| Home.jsx 자동 redirect | `useEffect`: admin → `/admin`, teacher → `/teacher`. 그 외에만 `loadData()` (Home.jsx:26-33) |
| Admin이 사용자 카드 [승인] 클릭 | confirm → `User.update(id, {approval_status:'approved', approved_by:me.id, approved_at:now, rejected_reason:''})` → loadAll 재실행 |
| Admin이 [거절] 클릭 | `prompt` 으로 사유 입력 → `User.update(id, {approval_status:'rejected', approved_at:now, rejected_reason:reason})` |
| Admin이 [관리] 클릭 | UserManageModal — role / academy / class select 변경 후 `User.update(id, {role, academy_id, class_id})`. 학급 select 은 학원 선택 시에만 활성 |
| Admin이 학원 추가 ("+ 학원 추가") | AcademyModal — name (필수) + owner_id (admin/teacher 필터링된 검색·드롭다운). 저장 → `Academy.create({name, owner_id||null})` |
| Admin이 학급 추가 ("+ 학급 추가") | ClassModal — name (필수) + grade_range + main_teacher_id (teacher 만 select, "— 미배정 —" 옵션 포함) + assistant_teacher_ids (체크박스, main_teacher 와 중복 시 disabled+strikethrough). 저장 → `Class.create({name, academy_id, main_teacher_id||null, assistant_teacher_ids, grade_range})` |
| Admin이 학원 삭제 | confirm → 그 학원 소속 모든 `Class.delete` 병렬 실행 후 `Academy.delete`. selectedAcademy 였으면 null 로 |
| Admin이 학급 삭제 | confirm → `Class.delete(id)` |
| 학원/강사 드롭다운 데이터 | AdminAcademies 에서 페이지 진입 시 `Academy.list('name',200)` + `Class.list('name',500)` + `User.list('-created_date',1000)` 3개 병렬 fetch. 강사 드롭다운은 `users.filter(u=>u.role==='teacher')` |
| migrateRoles 실행 (admin only) | POST 시 `role==='user'` 또는 비어있는 user 만 `'student'` 으로 update. admin/teacher skip. `dry_run:true` 면 결과만 반환. body 에 `set_role + user_id` 있으면 단건 변경 모드 |
| migrateClassTeachers 실행 (admin only) | Class 전체 순회. `teacher_id` 있고 `main_teacher_id` 비어있으면 `main_teacher_id ← teacher_id` + `assistant_teacher_ids ← 기존 또는 []`. 그 외엔 skip 카운트 |
| seedApprovals 실행 (admin only) | approval_status 비어있는 user 에 `'approved'` 채움. admin 0 명이면 `mathnet.common@gmail.com` 우선, 없으면 가장 오래된 user 를 `role:'admin'` 으로 promote |
| 학생이 본인 Profile 편집 | `/profile` → `full_name` 와 `grade` 수정 (admin 은 grade 칸 미표시). 저장 → `base44.auth.updateMe({full_name, grade})` → `checkUserAuth()` 으로 user 갱신. role / academy / class / approval_status / 가입일 / 이메일 은 read-only InfoRow |
| Profile 진입 시 학원/학급 표시 | `Academy.list` + `Class.list` 후 user.academy_id / class_id 매칭. 학생만 학급 필드 표시 (Profile.jsx:117-118) |

## 5. 에러

| 조건 | 사용자에게 표시 | 시스템 처리 |
| --- | --- | --- |
| 비-admin 이 `/admin` 진입 | `toast.error('관리자 권한이 필요해요')` | `navigate('/home', {replace:true})` (AdminLayout useEffect) |
| admin 이 `/teacher` 진입 | `toast.error('강사만 접근 가능해요')` | `navigate('/admin', {replace:true})` |
| 학생 등 비-teacher / 비-admin 이 `/teacher` 진입 | `toast.error('강사 권한이 필요해요')` | `navigate('/home', {replace:true})` |
| Pending / Rejected 사용자가 인증 필요 페이지 진입 | PendingApprovalScreen 전체 화면 | App.jsx 의 분기에서 차단 |
| 회원가입 비밀번호 불일치 / 6자 미만 | "비밀번호가 일치하지 않아요." 또는 "비밀번호는 6자 이상이어야 해요." | Landing.jsx form validation, register 호출 차단 |
| 회원가입 register 실패 | err.detail / err.message 또는 "회원가입에 실패했어요. 다시 시도해 주세요." | catch + setError |
| OTP 인증 실패 | "인증 코드가 올바르지 않아요. 다시 확인해 주세요." | catch + setError |
| Profile 저장 실패 | `toast.error('저장에 실패했어요')` | catch |
| 자기 자신을 [승인]/[거절]/[관리] 시도 | 버튼 자체가 노출 안 됨 (`isSelf` 체크, AdminUsers.jsx:282,320) | UI 레벨 차단 |
| User.full_name / role 미설정 (가입 미완료) | "(이름 없음)" 또는 fallback | UI fallback 다수 |

> 일반 student 가 본인 role / academy_id / approval_status 를 update 시도하는 경로는 UI 에 없음 (Profile 에서 read-only). FLS 설정 자체는 base44 entity-level 정책에 위임.

## 6. 미결정 / 보류

- **학원 코드 (Academy.join_code)**: 필드는 정의돼 있지만 학생 가입 시 입력하는 UI 가 없음. 현재는 admin 이 학생 가입 후 수동 배정.
- **Teacher 가 학생 추가 / 제거**: V2. 현재 admin 만 가능.
- **학생 자동 배정**: 학원 코드 입력으로 자동 배정 V2.
- **다중 학급 소속**: 학생은 단일 `class_id` 만. multi-class V2.
- **학원장 (Academy.owner_id) 의 권한 범위**: 학원장이 자기 학원의 학급 자체 관리 권한을 갖는지 RLS 미정.
- **거절 후 재신청**: 한 번 거절된 user 가 재신청하는 흐름 미정 (현재는 admin 이 다시 approval_status 변경해 줘야 함).
- **자체 회원가입과 Google OAuth 의 공존**: Landing 에 둘 다 있는데 데이터 모델은 동일하므로 큰 이슈는 없으나, 비번 가입자와 OAuth 가입자의 조정 (예: 같은 이메일) 정책 미정.

## 7. 검증 (QA 체크리스트)

### 가입 / 승인 흐름
- [ ] 비로그인 상태에서 `/` 진입 시 Landing 페이지 표시
- [ ] "회원가입" → 자체 폼 → register + updateMe → OTP 입력 → `/home`
- [ ] "로그인" → `base44.auth.redirectToLogin('/home')` 동작
- [ ] 신규 가입 user 가 `approval_status='pending'` (`updateMe` 에서 명시), `role='student'` 또는 `'teacher'` (가입 폼 선택값)
- [ ] Pending user 로그인 시 PendingApprovalScreen 표시 + [로그아웃]
- [ ] Rejected user 로그인 시 red 변형 + rejected_reason 표시
- [ ] Admin 이 AdminUsers / AdminTeachers / AdminStudents 카드에서 [승인] / [거절] 가능
- [ ] 승인 후 학생 다시 로그인 → 정상 학생 화면 진입

### 권한 분리
- [ ] Admin → `/admin` 정상, `/teacher` 진입 시 차단 + `/admin` 리다이렉트
- [ ] Teacher → `/teacher` 정상, `/admin` 진입 시 `'관리자 권한이 필요해요'` 토스트 + `/home`
- [ ] Student → 학생 페이지만 정상, `/admin` `/teacher` 둘 다 차단
- [ ] Admin / Teacher 가 `/home` 진입 시 useEffect 로 자기 패널로 자동 redirect
- [ ] AppLayout 의 사이드바/하단 nav 가 `isStudent` 일 때만 표시

### 학원/학급 관리
- [ ] Admin 이 `/admin/academies` 에서 학원 추가 (name 필수)
- [ ] 학원 카드 클릭 → 우측 그 학원의 학급 리스트만 필터링
- [ ] 학급 추가 — main_teacher 미배정 가능 (`option value=""`), assistant_teacher 복수 선택 가능
- [ ] main_teacher 와 assistant_teacher 중복 시 disabled+strikethrough
- [ ] 학급 삭제 confirm + 학원 삭제 시 학급 cascade
- [ ] Owner 검색에서 admin/teacher 만 결과 (학생 X)
- [ ] 학급 카드 펼침 시 그 학급의 student 리스트 → 클릭 시 `/admin/students/:id`

### Teacher 시점
- [ ] Teacher 가 `/teacher` 에서 본인이 main 또는 assistant 인 학급의 학생 데이터만 표시
- [ ] TeacherProvider 가 Outlet 을 감싸 데이터 공유
- [ ] [↻ 새로고침] 버튼이 TeacherContext.refresh 호출

### Profile / 사용자 정보
- [ ] 학생이 `/profile` 에서 full_name / grade 수정 가능
- [ ] admin 은 grade 입력 칸 미표시
- [ ] 이메일 / 역할 / 학원 / 학급 / 승인 상태 / 가입일 모두 read-only InfoRow
- [ ] 저장 → `base44.auth.updateMe` + `checkUserAuth` 로 user state 갱신

### 마이그레이션 함수
- [ ] migrateRoles 실행 후 `'user'` / 빈 role → `'student'`, admin/teacher 보존, `dry_run:true` 시 미적용
- [ ] migrateRoles `set_role + user_id` 단건 모드 동작
- [ ] migrateClassTeachers 실행 후 `teacher_id` → `main_teacher_id` 복사, `assistant_teacher_ids` 빈 배열 초기화
- [ ] seedApprovals 실행 후 비어있는 approval_status → `'approved'`, admin 0 명일 때 `mathnet.common@gmail.com` 또는 가장 오래된 user 를 admin 으로 promote
