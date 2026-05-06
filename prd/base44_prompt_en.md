# Math Learning MVP — Base44 Build Specification

> **Critical**: Build a Korean K-12 math learning web application. ALL user-facing UI text MUST be in Korean (한국어). Internal code/comments may be in English.

## 1. Project Overview

A web application that helps Korean K-12 students learn mathematics through handwritten solution submission with LLM-based grading. The core differentiator is fast partial-credit grading with step-by-step feedback in Korean.

**Primary users**: students (K-12 in Korea)
**Secondary users**: administrators (content management, analytics)

**Core flow**: student selects a problem → writes solution by hand (canvas or photo upload) → solution is OCR'd by Gemini → graded by Claude → result with score + step-by-step feedback + alternative solutions is shown.

**Data source**: pre-downloaded JSON/JSONL snapshot of math problems and tools (read-only). Student attempts are stored in Base44 database.

## 2. Critical Constraints (must follow)

1. **Korean UI**: All user-facing strings (button labels, error messages, headings, placeholders, tooltips) must be in Korean. No English in UI.
2. **Math rendering**: All inline math `$...$` and block math `$$...$$` must render with KaTeX. Preserve LaTeX exactly.
3. **Mobile-first responsive**: Primary user flow is on mobile. Desktop is supported but mobile is the primary design target.
4. **Privacy**: Each student sees only their own data. Administrators see all students' data for analysis.
5. **API key security**: Anthropic and Gemini API keys must be stored server-side only. Never expose to client.
6. **Loading states**: Always show progress for async operations >1 second.
7. **Tone**: Encouraging, supportive (해요체 polite form). Never use negative phrasing like "틀렸어요". Use "이 부분 다시 살펴볼까요?" instead.

## 3. Tech Stack

Use Base44's built-in capabilities for:
- Authentication (email/password + Google SSO)
- Database
- Image storage
- Hosting

External integrations required:
- Anthropic Claude API (`api.anthropic.com`) — for grading
- Google Gemini API (`generativelanguage.googleapis.com`) — for OCR

Recommended libraries:
- KaTeX for math rendering
- Excalidraw or any HTML5 canvas library for handwriting input
- Image compression library (browser-side) before upload

## 4. Data Model

### 4.1 Imported snapshot data (read-only)

Import the following JSON/JSONL files from the project's `data/snapshot/` directory into Base44 read-only tables:

| File | Format | Rows | Purpose |
|---|---|---|---|
| `tools.json` | JSON | 24 | Math tools (used in 도구별 selection mode) |
| `achvmt_stds.json` | JSON | 311 | Korean curriculum standard codes |
| `problems.jsonl` | JSONL | 511 | Math problems (jsonb content with LaTeX) |
| `agent_answer_records.jsonl` | JSONL | 510 | Agent solutions (used as grading reference) |
| `usage_records.jsonl` | JSONL | 2286 | Tool application records (the correct solution paths) |
| `domain_catalog.json` | JSON | 19 | Domain (단원) classification with achvmt_prefix_patterns |

See `data/snapshot/README.md` for detailed schemas.

**problems.content schema** (jsonb): list of `{text: string, type: "human"}`. Concatenate `text` fields for display, render with KaTeX.

### 4.2 New tables (created by Base44)

**`students`** (extends Base44 built-in users)
- `id`, `email`, `name`, `grade` (integer 1-12), `created_at`

**`student_attempts`** (every submission persisted)
- `id` (PK)
- `student_id` (FK → students)
- `problem_id` (FK → problems snapshot)
- `canvas_image_url` or `photo_url` (Base44 storage)
- `ocr_text` (Gemini OCR result, full markdown_text)
- `ocr_corrected_text` (optional, if student fixed OCR)
- `claude_grade_json` (full GradingOutput as JSON)
- `score` (integer 0-100)
- `correctness` (enum: "correct" | "partial" | "wrong")
- `started_at`, `submitted_at`, `duration_sec`
- `admin_review_status` (enum: null | "ok" | "needs_correction" | "skipped")
- `admin_review_note` (optional admin comment)
- `created_at`

**`student_problem_status`** (cached aggregate or view)
- `student_id`, `problem_id`
- `last_score`, `last_attempt_at`, `attempt_count`, `best_score`
- `is_wrong` (boolean: true if last_score < 60 OR correctness = "wrong")

## 5. Student Features

### S1. Login / Sign Up

**Screens**:
- Login: email + password input + "Google로 로그인" button
- Sign up: email + password + name + grade (1-12 dropdown) + terms checkbox

**Behavior**:
- On successful login → redirect to main screen (S2)
- Session timeout: 24 hours

**Korean UI strings**:
- Login button: "로그인"
- Sign up: "회원가입"
- Email field: "이메일"
- Password field: "비밀번호"
- Name field: "이름"
- Grade field: "학년"
- Error: "이메일 또는 비밀번호가 맞지 않아요"

### S2. Main Screen (home)

**Layout** (mobile-first):
- Top: greeting "안녕하세요, [name]님!"
- Center: "오늘의 문제" card (today's problem — auto-selected random problem)
  - For new users: welcome message "환영해요! 첫 문제를 풀어볼까요?" + start button
  - For existing users: random problem or last-attempted problem
- Sidebar (mobile: hamburger or bottom nav): 4 selection modes
- Bottom: "내 풀이 기록" link

**Korean UI strings**:
- "오늘의 문제", "랜덤", "단원별", "도구별", "틀렸던 문제", "내 풀이 기록"

### S3. Problem Selection (4 modes)

#### S3.1 Random Mode
- Action: "랜덤" button → fetches one random problem from `problems.jsonl`
- Direct navigation to S4

#### S3.2 Domain (단원별) Mode
- Action: "단원별" → list 19 domains from `domain_catalog.json` with Korean names (use `ko` field)
- Show problem count per domain (computed: tools whose `achvmt_std_code` matches domain prefix → problems via `usage_records`)
- Student selects domain → random problem from that domain
- Korean UI: "어떤 단원으로 연습할까요?"

#### S3.3 Tool (도구별) Mode
- Action: "도구별" → list 24+ tools from `tools.json` with name, brief goal, and problem count
- Student selects tool → random problem using that tool (filter `usage_records.tool_id`)
- Korean UI: "어떤 도구로 연습할까요?"

#### S3.4 Wrong Problems Mode
- Action: "틀렸던 문제" → list student's past attempts where `score < 60` or `correctness = "wrong"`
- Show problem with last score and date
- Empty state: "아직 틀린 문제가 없어요! 다른 모드로 연습해 볼까요?"

### S4. Problem Screen

**Layout**:
- Top: problem statement (KaTeX rendered from `problems.content`)
- Center: handwriting input area (tabs)
  - Tab 1: Canvas drawing (web — mouse/finger drawing, undo/clear buttons)
  - Tab 2: Photo upload (file input — accept JPEG/PNG/HEIC, max 10MB)
- Bottom: "제출" button + "메인으로" link

**Behavior**:
- Empty submission: show "풀이를 작성해 주세요" message, do not proceed
- On submit → S5 (loading screen)

**Korean UI strings**:
- "제출", "메인으로", "취소", "초기화", "되돌리기"
- Tab labels: "필기로 풀기", "사진으로 올리기"

### S5. Submission Pipeline (OCR + Grading)

This is a backend pipeline triggered on submission. Show loading UI to student.

**Stage 1: OCR (Gemini 2.5 Flash)**
- Loading message: "필기 인식 중..."
- API call: see § 7.1 for prompt and schema
- Expected latency: 3-5 seconds
- Output: `OCROutput` JSON

**Stage 2: Grading (Claude Sonnet 4.6)**
- Loading message: "채점 중..."
- API call: see § 7.2 for prompt and schema
- Expected latency: 5-10 seconds
- Output: `GradingOutput` JSON

**Error handling**:
- OCR failure: "필기 인식이 어려워요. 다시 시도해 주세요" + retry button
- Grading failure: "잠시 문제가 생겼어요. 다시 시도해 주세요" + retry button
- Network/timeout (>30s): "연결이 불안정해요. 다시 시도해 주세요"
- Auto-retry once on transient errors

**Persistence**: Save full record to `student_attempts` table including OCR text, grading JSON, score, correctness, timestamps.

### S6. Result Screen

**Layout**:
- Top: large score + traffic light color (green ≥80, amber 40-79, red <40) + summary text from `GradingOutput.summary`
- Middle: step-by-step feedback (collapsible cards)
  - Each step shows: student's step text + status badge (correct/partial/missing/wrong) + comment + correction (if any)
  - Gap locations shown separately as "여기에 단계가 빠졌어요" cards
  - Error locations shown with student wrote vs correct form
- Bottom:
  - **OCR result section**: collapsed by default, shows what Gemini extracted from handwriting
  - "OCR이 잘못됐어요" button → S7
  - Alternative solution section (if `GradingOutput.alternative_solution` is not null): "이런 방법도 있어요!"
  - If `GradingOutput.ocr_quality_concern` is not null: warning banner "필기 인식에 의문이 있어요. 의도하신 풀이가 맞는지 확인해 주세요"
- Footer actions: "다음 문제" / "다시 풀기" / "메인으로"

**Korean UI strings**:
- "정답이에요!", "거의 다 왔어요!", "다시 살펴볼까요?"
- "이 부분 다시 살펴볼까요?", "잘 풀었어요!"
- "OCR이 잘못됐어요", "이런 방법도 있어요!", "다음 문제", "다시 풀기"

### S7. OCR Correction → Re-grading

**Trigger**: student clicks "OCR이 잘못됐어요" on result screen.

**Layout**:
- Editable textarea pre-filled with OCR markdown text
- "수정해서 다시 채점" button + "취소" button

**Behavior**:
- On submit: send corrected text to Claude grading (skip Gemini OCR — saves cost)
- Update `student_attempts.ocr_corrected_text` and re-run grading
- Show new result on S6

### S8. Solution History

**Layout**:
- List of attempts (one card per attempt)
  - Card shows: problem title (or first 50 chars), score, date, domain, tool, traffic light color
- Filters: date range, score range, domain, tool, correct/partial/wrong
- Sort: most recent first (default), or by score
- Click card → show full result (S6 read-only view)

**Pagination**: 20 items per page, infinite scroll on mobile.

**Empty state**: "아직 푼 문제가 없어요. 첫 문제를 풀어볼까요?" + button to S2.

## 6. Administrator Features

Admin users (separate role from students) access these via a separate admin panel.

### A1. User List

- Table: email, name, grade, signup date, last activity, attempt count, average score
- Search by name/email, filter by grade, sort by any column
- Click row → student detail (attempts list, score history)

### A2. Problem List

- Table: problem_id, source, domain, tools used, attempt count, average score
- Filter by domain/tool, search
- Click row → problem detail showing `problems.content`, `verified_answer`, `agent_solution`, full solution path from `usage_records`

### A3. Grading Spot-Check Queue

- Queue of recent `student_attempts` where `admin_review_status` is null
- Detail view: student's image + OCR text + Claude grading result
- Actions: "OK" / "수정 필요" + note / "건너뛰기"
- Updates `admin_review_status` and `admin_review_note`

### A4. Analytics Dashboard (★ MVP critical)

Four sub-views:

**A4.1 Hardest Problems**
- Sorted list by lowest average score, with attempt count
- Columns: problem_id, domain, average score, attempt count, correct rate

**A4.2 Hardest Tools**
- Sorted list by tool difficulty (computed from `student_attempts` joined with `usage_records`)
- Columns: tool_id, name, average score, attempt count

**A4.3 Domain Average Scores**
- Bar chart: 19 domains × average score
- Filterable by grade, date range

**A4.4 Student Progress**
- List of students with: activity status, average score, attempt count, recent trend
- Identify inactive students or those struggling

**Performance**: cache aggregates with 1-hour TTL. Use background job to refresh.

## 7. External LLM Integration

### 7.1 Gemini OCR (Stage 1 of submission pipeline)

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**Configuration**:
- `response_mime_type`: `"application/json"`
- `response_schema`: see Pydantic schema below
- `system_instruction`: Korean prompt below

**Pydantic schema (Python reference, equivalent JSON Schema sent to Gemini)**:

```python
from typing import Literal
from pydantic import BaseModel, Field

class UnclearRegion(BaseModel):
    description: str
    best_guess: str | None = None
    reason: Literal["smudge", "out_of_frame", "ambiguous_handwriting", "overlap", "other"]

class OCROutput(BaseModel):
    schema_version: str = "v1"
    markdown_text: str  # full solution as markdown + LaTeX
    confidence: int  # 0-100
    unclear_regions: list[UnclearRegion]
    detected_content_types: list[Literal["korean_text", "math_expression", "diagram", "table", "mixed"]]
    notes: str | None = None
```

**System instruction (Korean — send as-is to Gemini)**:

```
당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.

학생의 손글씨 수학 풀이 이미지를 받아, 구조화된 markdown + LaTeX 양식으로 추출합니다.

## 추출 원칙
1. 양식 보존 — 학생이 쓴 그대로. 임의로 추가/변경하지 않음
2. 수식은 LaTeX — `$...$` (inline) 또는 `$$...$$` (block)
3. 행/단계 양식 보존 — `\n`으로 구분. enum marker (①②③) 그대로 보존
4. 할루시 방지 — 학생이 쓰지 않은 내용 추측 X. 명확하지 않으면 `unclear_regions`에 기록 + `confidence` 낮춤
5. 마크다운 양식 보존 — 들여쓰기/굵게 등 그대로

## 수식 표기
정확한 표기:
- 분수 `\frac{a}{b}`, 제곱 `a^{2}`, 제곱근 `\sqrt{x}`
- 등호/부등호 `=, \neq, \leq, \geq`
- 그리스 문자 `\alpha, \beta, \pi, \theta`
- 합/적분/극한 `\sum, \int, \lim`

## 한국어 + 수식 혼합
"양변에 $3$을 곱하면", "①의 양변: $$3A + 3B = 21x^2 - 6x + 15$$" 같은 양식을 그대로 보존.

## 출력 양식
OCROutput JSON으로 응답.
```

**User message**: send the image + brief text "다음 이미지는 학생의 손글씨 수학 풀이입니다. OCROutput 양식으로 추출해 응답해 주세요."

### 7.2 Claude Grading (Stage 2 of submission pipeline)

**Endpoint**: `https://api.anthropic.com/v1/messages`

**Configuration**:
- Model: `claude-sonnet-4-6`
- `max_tokens`: 4096
- `system`: list of `{type: "text", text: SYSTEM_PROMPT, cache_control: {type: "ephemeral"}}` (use prompt caching)
- `tools`: `[GRADING_TOOL]` (tool definition with `cache_control: ephemeral`)
- `tool_choice`: `{type: "tool", name: "report_grade"}` (force structured output)

**Pydantic schema (Python reference, schema sent to Claude as tool's input_schema)**:

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class StepFeedback(BaseModel):
    model_config = ConfigDict(extra="allow")
    step_number: int
    student_step: str
    status: Literal["correct", "partial", "missing", "wrong"]
    comment: str
    correction: str | None = None

class GapLocation(BaseModel):
    description: str
    expected_step: str

class ErrorLocation(BaseModel):
    description: str
    student_wrote: str
    correct_form: str
    error_type: Literal["calculation", "conceptual", "notation"]

class GradingOutput(BaseModel):
    model_config = ConfigDict(extra="allow")
    schema_version: str = "v1"
    score: int  # 0-100
    correctness: Literal["correct", "partial", "wrong"]
    summary: str
    step_feedback: list[StepFeedback]
    gap_locations: list[GapLocation] = []
    error_locations: list[ErrorLocation] = []
    alternative_solution: str | None = None
    confidence: int  # 0-100
    ocr_quality_concern: str | None = None
```

**System prompt (Korean — send as-is to Claude)**:

```
당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생의 손글씨 풀이 (OCR 추출 결과)를 받아, problem + verified_answer + agent_solution + 정답 풀이 path와 비교해 채점합니다. 출력은 GradingOutput 양식 — `report_grade` tool을 한 번 호출.

## 채점 원칙
1. 부분점수 일관성 — 비슷한 풀이는 비슷한 점수
2. 학생 친화 톤 — 격려 + 정정. "틀렸어요" 같은 부정적 표현 X. "이 부분 다시 살펴볼까요?" 양식
3. 다른 풀이 인지 (별해 인정) — 학생 풀이가 verified_answer와 다른 경로여도 정답 도달 시 정합으로 인정
4. 산수 vs 개념 오류 구분:
   - calculation = 산수/부호/정리 오류 (소소함 — 점수 약간 ↓)
   - conceptual = 개념/공식 오류 (큼 — 점수 많이 ↓)
   - notation = 표기 오류 (작음 — 점수 약간 ↓)
5. 할루시 방지 — 학생이 쓰지 않은 내용 추측 X. 확신 없으면 `confidence` 낮춤
6. OCR 자료 검증 — OCR 결과가 의심스러우면 `ocr_quality_concern`에 명시
7. Actionable feedback — "다시 살펴봐요" 같은 모호한 말 X. 어느 자리/왜를 명시

## 점수 양식
- 100 = 정답 + 풀이 완전 + 표기 정합
- 80-99 = 정답 + 풀이 정합 + 사소한 오류 (산수/표기)
- 60-79 = 정답 도달 + 풀이 일부 누락 (공백)
- 40-59 = 풀이 일부 정합 + 정답 X
- 20-39 = 풀이 일부 정합 + 다수 오류
- 1-19 = 풀이 양식 일부만 정합
- 0 = 풀이 없음 / 완전 오답

## 톤 양식 (학생 친화)
정합: "잘 풀었어요!", "여기까지 정합!", "이 부분 다시 살펴볼까요?", "별해도 가능해요"
금지: "틀렸어요", "X", "잘못했어요"

## 출력
`report_grade` tool 한 번 호출. summary, step_feedback, gap_locations, error_locations, alternative_solution (해당 시), confidence, ocr_quality_concern 채움.
```

**User message format**:

```xml
<problem>
{problems.content concatenated text}
</problem>

<verified_answer>
{problems.verified_answer or "(검증된 정답 없음)"}
</verified_answer>

<agent_solution>
{agent_answer_records.answer or "(agent 풀이 없음)"}
</agent_solution>

<correct_solution_path>
{from usage_records, ordered by sequence_order:
  Step {N}: 도구 = "{tool.name}"
    - 사유: {reason}
    - 적용: {application}
    - 결과: {appended_info}
}
</correct_solution_path>

<student_ocr_solution>
{ocr_text}
</student_ocr_solution>

위 학생 풀이를 채점해 주세요. `report_grade`를 호출해 주세요.
```

### 7.3 Cost and rate limits

- OCR per call: ~$0.001-0.003
- Grading per call: ~$0.02-0.05
- Total per submission: ~$0.02-0.05

Recommended rate limits per student:
- 50 submissions per day
- 1000 submissions per month

Implement these limits in Base44; show student message when exceeded: "오늘의 학습이 충분해요! 내일 다시 만나요"

## 8. UI/UX Design Principles

### 8.1 Visual design
- **Mobile-first responsive**: Primary breakpoint is mobile. Desktop is supported.
- **8px grid**: All spacing/margin/padding in multiples of 8 (8, 16, 24, 32, 40)
- **Soft rounded corners**: 8-12px border-radius for buttons, cards, modals
- **Subtle shadows**: Soft drop shadows on cards/modals (not harsh)

### 8.2 Color palette
- **Base**: white / light gray (#FAFAFA)
- **Primary**: calm blue (e.g., #3B82F6) for primary actions
- **Accent**: warm orange/yellow for highlights
- **Traffic light** (grading results):
  - Correct: green (#10B981)
  - Partial: amber (#F59E0B)
  - Wrong: red (#EF4444)
- **Text**: gray-900 (primary), gray-600 (secondary), gray-400 (placeholder)
- **WCAG AA compliance**: All text must meet 4.5:1 contrast ratio

### 8.3 Typography
- **Font family**: Pretendard (Korean readability) with fallback to Noto Sans KR / system fonts
- **Math rendering**: KaTeX (uses Latin Modern automatically)
- **Sizes**: body 16px, headings 20-24px, captions 14px
- **Line-height**: 1.5-1.6 (Korean readability)

### 8.4 Tone and voice
- **Encouraging, supportive** — never negative
- **Polite Korean (해요체)** — not 한다체
- **Friendly but professional** — like a kind tutor

**Always-OK phrases**: "잘 풀었어요!", "정답이에요!", "이 부분 다시 살펴볼까요?", "별해도 가능해요 — 이런 방법은 어떨까요?"

**Never-use phrases**: "틀렸어요", "X", "잘못했어요", imperative commands (use suggestion form "~해 볼까요?")

### 8.5 Loading states (mandatory for all async >1s)
- OCR: "필기 인식 중..." with spinner (~3-5s)
- Grading: "채점 중..." with spinner (~5-10s)
- Problem load: skeleton loader
- Image upload: progress bar
- Never show blank screen — always indicate progress

### 8.6 Error handling
- Friendly Korean messages, never technical
- Retry option for transient failures
- Don't expose error logs to students (log server-side for admin)

### 8.7 Accessibility (WCAG AA)
- Color contrast 4.5:1 minimum
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader support (ARIA labels)
- Visible focus indicators
- Touch target minimum 44x44px

### 8.8 Performance
- Page load <2s
- Image compression: canvas → JPEG 70% quality before upload
- Lazy load heavy data (problem list, history)
- Cache static data (tools, achvmt_stds, domain_catalog) in client

### 8.9 Component patterns
- **Buttons**: rounded, primary action prominent, disabled states clear
- **Forms**: labels above inputs, inline error messages
- **Cards**: 8px padding, soft shadow, used for problems/history items
- **Modals**: only for confirmations or detailed views (not main flow)
- **Toasts**: transient notifications (3-5s auto-dismiss)
- **Canvas**: undo/clear buttons always visible

## 9. Korean UI String Reference

### Navigation
- "홈", "메인으로", "내 풀이 기록", "관리자"

### Problem selection
- "오늘의 문제", "랜덤", "단원별", "도구별", "틀렸던 문제"
- "어떤 단원으로 연습할까요?", "어떤 도구로 연습할까요?"

### Problem screen
- "문제", "필기로 풀기", "사진으로 올리기", "되돌리기", "초기화", "제출", "취소"

### Submission flow
- "필기 인식 중...", "채점 중..."
- "필기 인식이 어려워요. 다시 시도해 주세요"
- "잠시 문제가 생겼어요. 다시 시도해 주세요"
- "연결이 불안정해요. 다시 시도해 주세요"

### Result screen
- "정답이에요!", "거의 다 왔어요!", "다시 살펴볼까요?"
- "잘 풀었어요!", "이 부분 다시 살펴볼까요?", "여기에 단계가 빠졌어요"
- "OCR이 잘못됐어요", "수정해서 다시 채점", "이런 방법도 있어요!"
- "다음 문제", "다시 풀기"
- "필기 인식에 의문이 있어요. 의도하신 풀이가 맞는지 확인해 주세요"

### History
- "내 풀이 기록", "필터", "최근 순", "점수 순"
- "아직 푼 문제가 없어요. 첫 문제를 풀어볼까요?"

### Auth
- "로그인", "회원가입", "이메일", "비밀번호", "이름", "학년"
- "Google로 로그인", "이메일 또는 비밀번호가 맞지 않아요"
- "이미 사용 중인 이메일이에요"
- "안녕하세요, [이름]님!"

### Onboarding
- "환영해요! 첫 문제를 풀어볼까요?"

## 10. Out of Scope (do not build)

These are explicitly excluded from MVP:
- **Multiple-choice questions**: All problems are open-ended; no multiple-choice support
- **Anonymous attempts**: All users must register before submitting

These are deferred to v2 or later (do not build now):
- Weakness analysis and problem recommendations
- Student progress dashboard
- Bookmarks/favorites
- Hint button during problem solving
- Per-step time tracking
- Native mobile app
- Gamification (streaks, badges)
- Friend/class features
- Push notifications
- Offline mode

## 11. Suggested Build Order

1. **Phase 1** — Auth + main screen + problem display (S1, S2, S4 read-only)
2. **Phase 2** — Problem selection (S3 — all 4 modes)
3. **Phase 3** — Submission pipeline (S4 input + S5 with OCR + grading)
4. **Phase 4** — Result screen (S6) + OCR correction (S7)
5. **Phase 5** — History (S8)
6. **Phase 6** — Admin panel (A1, A2, A3)
7. **Phase 7** — Analytics dashboard (A4)
8. **Phase 8** — Polish (animations, error states, accessibility audit)

## 12. Acceptance Criteria

MVP is complete when:
- [ ] A new student can sign up, log in, see main screen
- [ ] Student can select a problem in any of 4 modes
- [ ] Student can write a solution by canvas OR upload a photo
- [ ] Submission triggers OCR → Claude grading → result with score, feedback, alternative solution
- [ ] Student can correct OCR and re-grade
- [ ] All attempts are persisted and visible in history with filters
- [ ] Admin can see user list, problem list, grading queue, analytics dashboard
- [ ] All UI text is in Korean
- [ ] Math renders correctly with KaTeX
- [ ] Mobile and desktop both work responsively
- [ ] Loading states shown for all async operations
- [ ] No API keys exposed to client
- [ ] Each student sees only own data
