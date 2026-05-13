# 권한 분리 + 학원 / 학급 관리

KNOTA 의 모든 기능은 사용자의 **role** 과 **소속(학원/학급)** 위에서 동작합니다.

이 문서는 가입부터 권한 분리, 학원/학급 구조까지 다룹니다.

---

## 1. 큰 그림

### 1.1 전체 사용자 구조

```
┌─────────────────────────────────────────────────────┐
│                  KNOTA 시스템                        │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │  admin (KNOTA 운영자)                          │  │
│   │  - 학원/학급 생성, 모든 사용자 관리              │  │
│   └──────────────────────────────────────────────┘  │
│                                                      │
│   ┌────────── 학원 (Academy) ─────────┐              │
│   │                                    │              │
│   │   학원장 (admin/teacher 중 1)      │              │
│   │                                    │              │
│   │   ┌──── 학급 (Class) ────┐         │              │
│   │   │                       │         │              │
│   │   │  담당 강사 (1명)       │         │              │
│   │   │  보조 강사 (N명)       │         │              │
│   │   │                       │         │              │
│   │   │  학생들 (N명)          │         │              │
│   │   │  ↓                    │         │              │
│   │   │  - 자유 풀이           │         │              │
│   │   │  - 받은 숙제           │         │              │
│   │   │  - 매듭 보강           │         │              │
│   │   └────────────────┘         │              │
│   │                                    │              │
│   └────────────────────────────┘              │
└─────────────────────────────────────────────────────┘
```

### 1.2 가입 → 승인 흐름 (role 무관 공통)

```
[비로그인]
    │
    ↓ Landing 페이지 진입 (/)
    │
    ├─→ "회원가입" 버튼
    │      ↓
    │  [회원가입 폼]
    │   - 가입 유형 선택 (학생 / 강사)
    │   - 이름 / 이메일 / 비밀번호
    │      ↓
    │  [OTP 인증 화면]
    │   - 이메일로 받은 6자리 코드 입력
    │      ↓
    └─→ "로그인" 버튼
           ↓
       [Google OAuth 또는 자체 로그인]
           ↓
       ┌────────────────────────────┐
       │  로그인 성공                  │
       │  approval_status = 'pending' │
       │  role = 'student'/'teacher'  │
       └────────────────────────────┘
                    ↓
           ┌────────────────────┐
           │ admin이 승인했나?    │
           └────────┬───────────┘
                    │
       ┌────────────┼─────────────┐
       │            │             │
   pending      approved      rejected
       ↓            ↓             ↓
  ┌────────┐  ┌─────────┐  ┌────────────┐
  │ 승인 대기 │  │  진입    │  │ 거절됨 화면 │
  │  화면    │  │   →     │  │ + 거절 사유 │
  │         │  │ role별   │  │            │
  │ [로그아웃]│  │ 분기     │  │ [로그아웃]  │
  └────────┘  └─────────┘  └────────────┘
```

### 1.3 role 별 진입 분기

승인된 사용자는 자신의 role 에 따라 **다른 첫 화면** 으로 갑니다.

```
승인됨
   │
   ├─ admin   → /admin    (관리자 패널 — slate 톤)
   │
   ├─ teacher → /teacher  (강사 패널 — violet 톤)
   │
   └─ student → /home     (학생 메인 — primary 톤)
```

만약 잘못된 영역에 들어가면 **자동으로 자기 영역으로 redirect** + 토스트 안내.

---

## 1.A admin 입장에서 보는 모습

### 진입 시 화면

```
┌─ slate-900 헤더 ───────────────────────────────┐
│ [관] 관리자 패널                  [내 메뉴 ▼]   │
├──────────────┬───────────────────────────────┤
│ Sidebar       │  Outlet (현재 메뉴의 내용)       │
│               │                                │
│ • 대시보드     │                                │
│ • 학원/학급    │                                │
│ • 강사 목록    │                                │
│ • 학생 목록    │                                │
│ • 문제 목록    │                                │
│ • 채점 검토    │                                │
└──────────────┴───────────────────────────────┘
```

(모바일에서는 사이드바 → 하단 고정 nav 로 바뀜)

### admin 이 자주 하는 일

#### A. 학원 / 학급 만들기 (`/admin/academies`)

```
[ 학원 / 학급 관리 ]

┌── 좌측: 학원 리스트 ──┐    ┌── 우측: 선택 학원의 학급 ──┐
│  [+ 학원 추가]         │    │  [+ 학급 추가]              │
│                        │    │                            │
│  ┌─ KNOTA 학원 ─────┐ │    │  ┌─ 중3-A반 ────────────┐ │
│  │ 학원장: 홍길동     │ │    │  │ 담당: 김선생             │ │
│  │ 학급 3개          │ │    │  │ 보조: 이선생, 박선생      │ │
│  │ [✏️] [🗑️]         │ │    │  │ 학생 12명                │ │
│  └─────────────┘ │    │  │ [✏️] [🗑️]                │ │
│  ...                  │    │  └────────────────┘ │
└────────────────┘    │  (클릭 시 학생 리스트 펼침)   │
                            └────────────────────┘
```

학원 카드를 클릭하면 우측에 그 학원의 학급들이 표시됩니다.

학급 카드를 펼치면 학생 리스트가 보이고, 학생 행을 클릭하면 학생 상세 페이지로 이동합니다.

학원 삭제는 cascade — 그 학원의 모든 학급도 함께 삭제됩니다 (확인 팝업 있음).

#### B. 사용자 승인 / 관리

3 개의 분리된 페이지가 있습니다.

```
/admin/users      — 전체 (메뉴에 없음, URL 직접)
/admin/teachers   — 강사만
/admin/students   — 학생만 (학급 필터 칩 추가)
```

세 페이지 모두 공통으로 **승인 상태 필터 칩** 을 가집니다:

```
[ 전체 ] [ 승인 대기 ] [ 승인됨 ] [ 거절됨 ]
```

칩 클릭 시 그 상태인 사용자만 표시. 학생 페이지에서는 학급 필터 칩과도 결합됩니다 (학원/학급 + 승인 상태 모두 필터).

각 사용자 카드는 이렇게 생겼습니다:

```
┌─ [👤] 홍길동                                    ┐
│      [Badge 승인 대기] [Badge student]           │
│      hong@example.com                           │
│      KNOTA 학원 › 중3-A반                        │
│                              시도 12회 / 평균 75점│
│ ─────────────────────────────────────────── │
│  [ ✓ 승인 ]  [ ✗ 거절 ]  [ ⚙️ 관리 ]              │
└────────────────────────────────────────────┘
```

승인 버튼을 누르면 상태가 'approved' 가 되고, 거절 시 prompt 로 사유를 입력받습니다.

[관리] 버튼을 누르면 모달이 열려서 role / 소속 학원 / 소속 학급을 한 번에 변경할 수 있습니다.

#### C. 마이그레이션 함수 실행 (1회성)

DataImportPanel 등을 통해 다음 함수를 실행합니다.

| 함수 | 역할 |
|---|---|
| `migrateRoles` | 옛날 `'user'` 또는 빈 role → `'student'` 일괄 변환 |
| `migrateClassTeachers` | 옛 `teacher_id` → `main_teacher_id` 로 복사 |
| `seedApprovals` | approval_status 비어있는 사용자 → `'approved'`, admin 0명이면 자동 지정 |

---

## 1.B teacher 입장에서 보는 모습

### 진입 시 화면

```
┌─ violet-900 헤더 ─────────────────────────────┐
│ [강] 강사 패널           [↻ 새로고침] [내 메뉴 ▼] │
├──────────────┬──────────────────────────────┤
│ Sidebar       │  Outlet                       │
│               │                                │
│ • 대시보드     │                                │
│ • 내 학생들    │                                │
│ • 내 학급      │                                │
│ • 숙제         │                                │
└──────────────┴──────────────────────────────┘
```

### teacher 가 보는 학급 / 학생

teacher 는 **본인이 main_teacher_id 또는 assistant_teacher_ids 인 학급의 학생만** 볼 수 있습니다.

다른 학급의 학생을 URL 로 직접 접근해도 server function 이 권한 체크 후 403 으로 차단됩니다.

### 진입 가드

| 시도 | 결과 |
|---|---|
| admin 이 `/teacher` 진입 | "강사만 접근 가능해요" 토스트 + `/admin` 으로 |
| student 가 `/teacher` 진입 | "강사 권한이 필요해요" 토스트 + `/home` 으로 |

### 데이터 새로고침

헤더의 [↻] 버튼으로 수동 새로고침 가능. 그 외에는 5분 캐시가 자동으로 동작 (페이지 간 이동 시 fetch 생략).

---

## 1.C student 입장에서 보는 모습

### 진입 시 화면 (`/home`)

```
┌──────────────────────────────────┐
│ 안녕하세요, {이름}님!                │
│ 오늘도 열심히 해볼까요? 💪          │
│                                    │
│ ⭐ 오늘의 문제                       │
│ ┌─ 랜덤 1 문제 카드 ────────────┐  │
│ │ {도메인}                        │  │
│ │ {본문 200자}                    │  │
│ │ [ 풀기 시작 → ]                  │  │
│ └────────────────────────┘  │
│                                    │
│ 문제 선택                           │
│ ┌─ 4 모드 그리드 ────────────────┐ │
│ │ [랜덤] [단원별] [도구별] [틀린문제]│ │
│ └────────────────────────┘ │
└──────────────────────────────────┘
```

### admin 이거나 teacher 인 학생

학생 화면에 직접 들어가도 `useEffect` 가 자동으로 `/admin` 또는 `/teacher` 로 보냅니다.

→ 학생 화면은 정말 student role 만 봅니다.

### 본인 정보 편집 (`/profile`)

```
┌─ 내 정보 관리 ─────────────────┐
│  [편집 가능 영역]                 │
│   - 이름 (input)                  │
│   - 학년 (select, admin 은 X)     │
│   [저장]                         │
│                                 │
│  [읽기 전용 영역]                  │
│   - 이메일 (Google 계정)          │
│   - 역할                          │
│   - 학원                          │
│   - 학급 (학생만)                  │
│   - 승인 상태 (학생만)             │
│   - 가입일                         │
│                                 │
│  [로그아웃]                       │
└────────────────────────────┘
```

학생은 이름과 학년만 자유롭게 바꿀 수 있고, role / 학원 / 학급 / 승인 상태는 admin 만 변경 가능합니다.

---

## 2. 알고리즘 / 로직

### 2.1 인증 / 진입 가드의 위계

```
┌──────────────────────────────────────────────────┐
│  Layer 1: AuthContext.checkUserAuth()            │
│  - base44.auth.me() 호출                          │
│  - 401 / 403 → authError = 'auth_required'       │
└────────────────────┬───────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Layer 2: App.jsx 의 분기                         │
│  - authError 가 'auth_required'                  │
│    → navigateToLogin (현재 URL 보존)              │
│  - user.role !== 'admin' && approval !== 'approved'│
│    → <PendingApprovalScreen />                   │
└────────────────────┬───────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Layer 3: 페이지별 가드 (useEffect 안)            │
│  - AdminLayout: role !== 'admin' → /home          │
│  - TeacherLayout: role === 'admin' → /admin      │
│                   role !== 'teacher' → /home     │
│  - Home / ProblemSelect / History:                │
│    role === 'admin' → /admin                     │
│    role === 'teacher' → /teacher                 │
└────────────────────┬───────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Layer 4: server function 단의 권한 체크          │
│  - studentDetailSummary: teacher 면 자기 학급 만  │
│  - teacherSummary: role in [teacher, admin]      │
│  - migrateRoles 등: role === 'admin' 만           │
└──────────────────────────────────────────────────┘
```

### 2.2 entity 구조

**User**

```
{
  email, full_name,
  role: 'admin' | 'teacher' | 'student' (default 'student'),
  approval_status: 'pending' | 'approved' | 'rejected' (default 'pending'),
  academy_id: ?,
  class_id: ?,
  grade: ?
}
```

**Academy**

```
{
  name (필수),
  owner_id: User.id (admin 또는 teacher),
  join_code: ?  ← 필드는 정의됐지만 UI 미구현
}
```

**Class**

```
{
  name (필수),
  academy_id (필수),
  main_teacher_id: User.id  ← 담당 강사 (1명, 미배정 가능)
  assistant_teacher_ids: [User.id, ...]  ← 보조 강사들
  grade_range: ?
}
```

학생 1명은 단 하나의 class_id 만 가질 수 있습니다 (다중 학급 소속은 V2).

### 2.3 학원/학급 데이터 흐름

```
[admin]
   ↓ Academy.create
[Academy 1행]
   ↓
[admin]
   ↓ Class.create (academy_id 명시)
[Class 1행 with main_teacher_id, assistant_teacher_ids]
   ↓
[admin이 학생을 학급에 배정 — UserManageModal로]
   ↓ User.update({ academy_id, class_id })
[학생이 자기 학급의 숙제를 받을 수 있게 됨]
```

### 2.4 teacher 의 학급 매칭 로직

server function 들이 사용:

```
teacher 의 my_classes =
  Class.list 전체 중에서
  c.main_teacher_id === teacher.id
  || c.assistant_teacher_ids.includes(teacher.id)
```

→ 두 강사 (main 1, assistant N) 모두 같은 학급 데이터에 접근 가능.

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/lib/AuthContext.jsx                    ← 인증 상태 / role 노출
src/App.jsx                                ← 라우트 + 승인 가드 분기
src/components/PendingApprovalScreen.jsx   ← 승인 대기 / 거절 화면

src/components/AppLayout.jsx               ← 학생 양식 nav
src/pages/Home.jsx                         ← admin/teacher 자동 redirect

src/pages/admin/AdminLayout.jsx            ← /admin 가드
src/pages/admin/AdminAcademies.jsx         ← 학원/학급 CRUD
src/pages/admin/AdminUsers.jsx             ← 전체 사용자
src/pages/admin/AdminTeachers.jsx          ← 강사만
src/pages/admin/AdminStudents.jsx          ← 학생만

src/pages/teacher/TeacherLayout.jsx        ← /teacher 가드 + TeacherProvider
src/pages/Profile.jsx                      ← 본인 정보 편집

src/pages/Landing.jsx                      ← 비로그인 진입점

base44/entities/User.jsonc
base44/entities/Academy.jsonc
base44/entities/Class.jsonc

base44/functions/migrateRoles/entry.ts
base44/functions/migrateClassTeachers/entry.ts
base44/functions/seedApprovals/entry.ts
```

### 3.2 AuthContext.checkUserAuth (`AuthContext.jsx:92-116`)

```js
const checkUserAuth = async () => {
  setIsLoadingAuth(true);
  try {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    setIsAuthenticated(true);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      setAuthError({ type: 'auth_required', ... });
    }
    setIsAuthenticated(false);
  } finally {
    setIsLoadingAuth(false);
    setAuthChecked(true);
  }
};
```

별도 `User.update` 호출은 없음 — entity 의 default 값 (`role='student'`, `approval_status='pending'`) 에 의존.

### 3.3 App.jsx 의 핵심 분기 (`App.jsx:42-76`)

```js
if (isLoadingPublicSettings || isLoadingAuth) return <로딩 화면>;

if (authError?.type === 'auth_required' && pathname !== '/') {
  navigateToLogin();
  return null;
}

// admin은 자기 승인 안 돼 있어도 우회 (혼선 방지)
if (user && user.role !== 'admin') {
  if (user.approval_status !== 'approved') {
    return <PendingApprovalScreen user={user} />;
  }
}

return <Routes>...</Routes>;
```

### 3.4 자체 회원가입 (Landing.jsx)

```js
await base44.auth.register({ email, password });
await base44.auth.loginViaEmailPassword(email, password);
await base44.auth.updateMe({ full_name, role, approval_status: 'pending' });
setOtpMode(true);  // OTP 인증 화면으로
```

비밀번호 검증:
- 길이 6자 이상
- 확인 비밀번호 일치

### 3.5 AdminLayout / TeacherLayout 의 가드

**AdminLayout.jsx:23-31**

```js
useEffect(() => {
  if (!isLoadingAuth && user && user.role !== 'admin') {
    toast.error('관리자 권한이 필요해요');
    navigate('/home', { replace: true });
  }
}, [user, isLoadingAuth, navigate]);
```

**TeacherLayout.jsx:35-44**

```js
useEffect(() => {
  if (isLoadingAuth || !user) return;
  if (user.role === 'admin') {
    toast.error('강사만 접근 가능해요');
    navigate('/admin', { replace: true });
  } else if (user.role !== 'teacher') {
    toast.error('강사 권한이 필요해요');
    navigate('/home', { replace: true });
  }
}, [user, isLoadingAuth, navigate]);
```

### 3.6 Home.jsx 의 학생 페이지 가드

```js
useEffect(() => {
  if (!user) return;
  if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
  if (user.role === 'teacher') { navigate('/teacher', { replace: true }); return; }
  loadData();
}, [user]);
```

ProblemSelect 와 History 도 같은 패턴.

(주의: ProblemSolve 는 이 가드 없음 — 직접 URL 접근 시 admin/teacher 도 진입됨. 알려진 일관성 문제.)

### 3.7 학원 / 학급 CRUD (AdminAcademies.jsx)

**학원 추가**

```js
saveAcademy = async (data) => {
  await base44.entities.Academy.create({ name, owner_id: ownerId || null });
  // 또는 update (수정)
};
```

**학원 삭제 (cascade)**

```js
deleteAcademy = async (academy) => {
  if (!confirm(`...`)) return;
  const related = classes.filter(c => c.academy_id === academy.id);
  await Promise.all(related.map(c => Class.delete(c.id)));
  await Academy.delete(academy.id);
};
```

**학급 추가**

```js
saveClass = async (data) => {
  await Class.create({
    name, academy_id,
    main_teacher_id: mainTeacherId || null,
    assistant_teacher_ids: assistantIds,  // 배열, 빈 배열 가능
    grade_range
  });
};
```

main_teacher_id 와 assistant_teacher_ids 가 겹치면 보조 강사 체크박스가 disabled+strikethrough (UI 가드).

### 3.8 Profile.jsx 의 편집 가능 / 읽기 전용

```js
// 편집 가능
await base44.auth.updateMe({ full_name, grade });
await checkUserAuth();  // 갱신
toast.success('저장됐어요');
```

읽기 전용 필드 (InfoRow 컴포넌트):
- 이메일, 역할, 학원, 학급, 승인 상태, 가입일

### 3.9 마이그레이션 함수들

**migrateRoles** (`base44/functions/migrateRoles/entry.ts`)

```
권한: caller.role === 'admin' (Forbidden 외)

기본 모드:
  - User.list 전체에서 role === 'user' || !role 인 것들 → 'student'
  - admin / teacher 는 skip

단건 모드 (body.set_role + body.user_id):
  - 그 user 만 set_role 로 update
  - target.email, old_role, new_role 응답

dry_run=true:
  - 결과만 리포트, 실제 update 없음
```

**migrateClassTeachers** (`base44/functions/migrateClassTeachers/entry.ts`)

```
권한: admin 만

처리:
  for cls in Class.list:
    if cls.teacher_id && !cls.main_teacher_id:
      Class.update(cls.id, {
        main_teacher_id: cls.teacher_id,
        assistant_teacher_ids: cls.assistant_teacher_ids || []
      })
    else if !cls.assistant_teacher_ids:
      assistant_teacher_ids 만 [] 로 초기화
```

**seedApprovals** (`base44/functions/seedApprovals/entry.ts`)

```
권한: admin 만

처리:
  - approval_status 비어있는 user → 'approved' 채움
  - admin 0명이면:
      'mathnet.common@gmail.com' 우선
      없으면 가장 오래된 user 를 admin 으로 promote
```

### 3.10 알려진 이슈 / 미결정

- **Academy.join_code 미구현** — 필드는 있지만 학생 가입 시 입력 UI 없음. 현재는 admin 이 수동 배정.
- **다중 학급 소속 안 됨** — class_id 가 단일 필드. 한 학생이 여러 학급에 속할 수 없음.
- **Teacher 가 학생 추가 / 제거 못함** — admin 만 가능.
- **학원장 (owner_id) 의 권한 범위 미정** — 현재 owner_id 는 표시용. 자기 학원의 학급 자체 관리 권한 같은 건 정의 안 됨.
- **거절 후 재신청** — 거절된 학생이 재신청하는 흐름 없음. admin 이 다시 승인 상태를 바꿔줘야 함.
- **자체 회원가입 vs Google OAuth 공존** — Landing 에 둘 다 있음. 같은 이메일이 양쪽으로 들어왔을 때의 정책 미정.
- **ProblemSolve 가드 부재** — admin/teacher 가 `/problem/:id` 직접 접근 가능 (Home/ProblemSelect/History 만 가드).

### 3.11 QA 체크리스트

#### 가입 / 승인

- [ ] 비로그인 + `/` → Landing 표시
- [ ] "회원가입" → 폼 → register → updateMe → OTP → /home
- [ ] "로그인" → `redirectToLogin('/home')`
- [ ] 신규 가입 user 가 `approval_status='pending'`
- [ ] Pending 사용자 로그인 → PendingApprovalScreen + [로그아웃]
- [ ] Rejected 사용자 → red 변형 + rejected_reason 표시
- [ ] admin 의 [승인] 버튼 → approved 로 변경
- [ ] [거절] 버튼 → prompt → rejected + 사유 저장
- [ ] 승인 후 학생 재로그인 → 정상 진입

#### 권한 분리

- [ ] admin → /admin 정상, /teacher 진입 시 /admin 으로 리다이렉트
- [ ] teacher → /teacher 정상, /admin 진입 시 /home 으로 리다이렉트
- [ ] student → 학생 페이지만 정상, /admin / /teacher 모두 차단
- [ ] admin / teacher 가 /home / /problems / /history 진입 시 자기 패널로 자동 redirect
- [ ] AppLayout 의 nav 가 student 일 때만 표시

#### 학원 / 학급 관리

- [ ] /admin/academies — 학원 추가 가능
- [ ] 학원 카드 클릭 → 우측에 그 학원의 학급만 필터링
- [ ] 학급 추가 — main_teacher 미배정 (`""`) 가능
- [ ] main / assistant 중복 시 disabled + strikethrough
- [ ] 학급 삭제 confirm + 학원 삭제 시 학급 cascade
- [ ] owner / teacher 검색에 admin/teacher 만 (학생 X)
- [ ] 학급 카드 펼침 시 그 학급 학생 리스트 → /admin/students/:id

#### Teacher 시점

- [ ] /teacher 의 my_classes 가 main 또는 assistant 매칭으로만 채워짐
- [ ] [↻] 버튼 → TeacherContext.refresh 호출
- [ ] 다른 학급 학생을 URL 로 직접 진입 → 403 차단

#### Profile

- [ ] 학생이 /profile 에서 full_name / grade 수정 가능
- [ ] admin 은 grade input 미표시
- [ ] 이메일 / 역할 / 학원 / 학급 / 승인 / 가입일 read-only
- [ ] 저장 → updateMe + checkUserAuth 로 user state 갱신

#### 마이그레이션

- [ ] migrateRoles 후 'user' / 빈 role → 'student', admin/teacher 보존
- [ ] migrateRoles 단건 모드 (set_role + user_id) 동작
- [ ] migrateClassTeachers 후 teacher_id → main_teacher_id 복사 + assistant_teacher_ids 빈 배열 초기화
- [ ] seedApprovals 후 비어있는 approval_status → 'approved', admin 0명일 때 자동 promote
