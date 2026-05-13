# 즐겨찾기 매듭 (Bookmarks)

학생이 매듭 보강 중에 ⭐ 로 표시한 매듭들을 모아 보고, 그 매듭의 문제를 풀거나 해제할 수 있는 학생 전용 페이지.

(즐겨찾기를 추가하는 흐름은 `remediation-flow.md` 의 단계 2 참조)

---

## 1. 큰 그림 — 학생이 직접 보는 모습

> 이 페이지는 student 만 사용. admin / teacher 는 진입 시 자동 redirect.

### 1.1 한 문장으로

> 즐겨찾기한 매듭들을 한 곳에 모아서 → 그 매듭의 문제를 자유 풀이로 풀거나, 더 이상 필요 없으면 해제.

### 1.2 진입 동선

```
[/problems (학습 경로 허브)]
   │
   ├─→ "내 즐겨찾기 매듭 (N)" 카드 클릭
   │
   └─→ AppLayout 사이드바의 [즐겨찾기] (있으면)
              ↓
       [/bookmarks]
              ↓
       각 매듭 카드:
         ├─→ [이 매듭의 문제 풀기] → /problem/:randomId (자유 풀이)
         └─→ [즐겨찾기 해제] → DB delete + 카드 사라짐
```

### 1.3 화면

```
┌─ 내 즐겨찾기 매듭 ─────────────────┐
│ 나중에 다시 공부하려고 표시한 매듭들이에요│
├──────────────────────────────────┤
│ ┌─ 매듭 카드 ──────────────────┐  │
│ │ 🔧 [등식의 가감법]               │  │
│ │ 방정식의 양변에 같은 값을 더하거나 │  │
│ │ 빼서 미지수를 분리...             │  │
│ │                                │  │
│ │ 5월 3일에 풀던 문제에서 추가했어요 │  │
│ │                                │  │
│ │ [ 이 매듭의 문제 풀기 → ]          │  │
│ │ [ 즐겨찾기 해제 ]                 │  │
│ └────────────────────────┘  │
│ ...                                │
└──────────────────────────────────┘
```

### 1.4 빈 상태

```
┌──────────────────────────────────┐
│                                    │
│ 아직 즐겨찾기한 매듭이 없어요          │
│                                    │
│ 매듭 보강 중에 ⭐ 버튼으로            │
│ 추가할 수 있어요                     │
│                                    │
│ [ 자유 풀이로 → ]                    │
│                                    │
└──────────────────────────────────┘
```

### 1.5 진입점 — `/problems` 허브의 카드

bookmarks.length > 0 일 때만 표시:

```
┌─ 내 즐겨찾기 매듭 (N) ──────────────┐
│ 나중에 다시 공부하려고 표시한 매듭들  │
│                       [전체 보기 →] │
└─────────────────────────────────┘
```

`/problems` 의 "받은 숙제" 와 "오늘의 추천" 사이에 배치.

### 1.6 학생이 마주치는 에러

| 상황 | 학생이 보는 것 |
|---|---|
| 즐겨찾기 0건 | 빈 상태 placeholder |
| [이 매듭의 문제 풀기] 했는데 그 매듭 문제가 없음 | 토스트: "이 매듭의 문제가 아직 없어요" |
| 해제 실패 (네트워크) | 토스트: "해제 실패" |

---

## 2. 알고리즘 / 로직

### 2.1 데이터 fetch

```
[/bookmarks 진입]
   ↓
3 병렬:
  BookmarkedTool.filter({ student_id: user.id }, '-created_date', 100)
  MathTool.list('name', 100)
  StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200)
   ↓
각 bookmark 별:
  - tool = MathTool 에서 tool_id 매칭
  - context = StudentAttempt 에서 context_attempt_id 매칭 (날짜 라벨용)
   ↓
카드 리스트 렌더
```

### 2.2 [이 매듭의 문제 풀기] 동작

```
Problem.list('-created_date', 1000)
   ↓
filter: tool_ids 에 bookmark.tool_id 포함하는 것만
   ↓
match 0개 → toast 안내, return
match 1+ → random pick → /problem/:id (자유 풀이)
```

### 2.3 [즐겨찾기 해제] 동작

```
BookmarkedTool.delete(bookmark.id)
   ↓
list 재 fetch (또는 client state 에서 그 row 만 제거)
   ↓
0건 되면 빈 상태로 전환
```

### 2.4 데이터 변경

- **Delete**: BookmarkedTool 1행 (해제 시)
- 그 외 데이터는 read-only

(추가는 RemediationLesson 의 ⭐ 액션에서만 발생 — `remediation-flow.md` 참조)

---

## 3. 실구현 디테일

### 3.1 파일 구조

```
src/pages/Bookmarks.jsx          ← 새 페이지

src/App.jsx                       ← 라우트 등록
  /bookmarks → <Bookmarks />

src/pages/ProblemSelect.jsx
  └─ ProblemHub 안에 즐겨찾기 진입 카드 추가

src/components/AppLayout.jsx
  └─ NAV_ITEMS 에 [즐겨찾기] 추가 (선택)

base44/entities/BookmarkedTool.jsonc
base44/entities/MathTool.jsonc
```

### 3.2 라우팅

```jsx
<Route path="/bookmarks" element={<Bookmarks />} />
```

### 3.3 진입 가드 (학생 전용)

`Bookmarks.jsx` 의 useEffect 에서 Home / ProblemSelect / History 와 동일한 패턴:

```js
useEffect(() => {
  if (!user) return;
  if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
  if (user.role === 'teacher') { navigate('/teacher', { replace: true }); return; }
  loadData();
}, [user]);
```

### 3.4 데이터 fetch (`Bookmarks.jsx`)

```js
const loadData = async () => {
  setLoading(true);
  try {
    const [bookmarks, tools, attempts] = await Promise.all([
      base44.entities.BookmarkedTool.filter(
        { student_id: user.id }, '-created_date', 100
      ),
      base44.entities.MathTool.list('name', 100),
      base44.entities.StudentAttempt.filter(
        { student_id: user.id }, '-submitted_at', 200
      ),
    ]);

    const toolMap = new Map(tools.map(t => [t.tool_id, t]));
    const attemptMap = new Map(attempts.map(a => [a.id, a]));

    const enriched = bookmarks.map(b => ({
      ...b,
      tool: toolMap.get(b.tool_id),
      context: b.context_attempt_id ? attemptMap.get(b.context_attempt_id) : null,
    })).filter(b => b.tool); // 매핑 실패한 것 제외

    setBookmarks(enriched);
  } finally {
    setLoading(false);
  }
};
```

### 3.5 [이 매듭의 문제 풀기] 핸들러

```js
const handlePractice = async (bookmark) => {
  const candidates = await base44.entities.Problem.list('-created_date', 1000);
  const matching = candidates.filter(p => {
    try {
      const ids = JSON.parse(p.tool_ids || '[]');
      return ids.includes(bookmark.tool_id);
    } catch {
      return false;
    }
  });

  if (matching.length === 0) {
    toast.error('이 매듭의 문제가 아직 없어요');
    return;
  }

  const pick = matching[Math.floor(Math.random() * matching.length)];
  navigate(`/problem/${pick.id}`);
};
```

### 3.6 [즐겨찾기 해제] 핸들러

```js
const handleUnbookmark = async (bookmark) => {
  try {
    await base44.entities.BookmarkedTool.delete(bookmark.id);
    setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));
    toast.success('해제했어요');
  } catch (e) {
    toast.error('해제 실패');
  }
};
```

### 3.7 ProblemSelect 의 진입 카드

`ProblemSelect.jsx` 의 `ProblemHub` 안, "받은 숙제" 와 "오늘의 추천" 사이에 추가:

```jsx
{bookmarkCount > 0 && (
  <section>
    <Link to="/bookmarks">
      <Card className="p-4 card-hover cursor-pointer">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold">내 즐겨찾기 매듭 ({bookmarkCount})</p>
            <p className="text-xs text-muted-foreground">
              나중에 다시 공부하려고 표시한 매듭들
            </p>
          </div>
          <ChevronRight className="w-4 h-4" />
        </div>
      </Card>
    </Link>
  </section>
)}
```

`bookmarkCount` 는 ProblemHub 진입 시 `BookmarkedTool.filter({ student_id: user.id })` 의 length.

### 3.8 알려진 이슈 / 미결정

- **즐겨찾기 추가 진입점이 매듭 보강 흐름에만 있음** — 일반 결과 화면에서 직접 즐겨찾기 추가 불가. 후속 작업으로 ResultView 의 도구 chip 옆에 ⭐ 버튼 추가 검토.
- **bookmark 의 정렬 옵션 없음** — 항상 최신순. 도구별 / 추가 일자별 정렬은 V2.
- **bookmark 끼리 같은 도구 중복 가능** — DB 제약 없음. 같은 도구를 여러 번 즐겨찾기 추가하면 같은 카드가 여러 개. handler 에서 unique 체크 검토.
- **즐겨찾기 문제 (BookmarkedProblem)** — 도구만 즐겨찾기 가능. 문제 자체 즐겨찾기는 V2.

### 3.9 QA 체크리스트

#### 정상 흐름

- [ ] 매듭 보강 ⭐ 추가 후 `/problems` 에 "내 즐겨찾기 매듭 (1)" 카드 표시
- [ ] 카드 클릭 → `/bookmarks` 진입
- [ ] 즐겨찾기한 매듭이 카드로 표시
- [ ] [이 매듭의 문제 풀기] → 그 도구의 문제가 열림
- [ ] [즐겨찾기 해제] → 카드 사라짐, DB row 삭제
- [ ] 0건 되면 빈 상태 placeholder

#### 빈 상태

- [ ] 즐겨찾기 0건일 때 ProblemHub 의 진입 카드 안 보임
- [ ] /bookmarks 직접 진입 시 빈 상태 안내 + [자유 풀이로]

#### 권한

- [ ] admin / teacher 가 /bookmarks 진입 시 자동 redirect

#### 에러

- [ ] 그 매듭의 문제가 0개일 때 toast 안내
- [ ] 해제 실패 시 toast.error
