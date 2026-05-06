# Base44 Global Instructions (English)

App-wide directives that apply to every screen and interaction. These are separate from the feature specification — they govern HOW the app should look, sound, and behave, not WHAT it should do.

The application is a Korean K-12 math learning web app (MVP). Two user types: students (primary) and administrators (secondary). Data sources: pre-downloaded JSON snapshot of math problems and tools (read-only) + Base44 database (student attempts) + external LLM APIs (Gemini for OCR, Claude for grading).

## 1. Language (CRITICAL)

| Surface | Language |
|---|---|
| All user-facing UI strings (button labels, headings, placeholders, error messages, tooltips, toasts) | **Korean (한국어) — mandatory** |
| Code comments | English OK |
| LLM prompts sent to Claude/Gemini APIs (handled by backend, not Base44 UI) | Korean (preserve as-is) |

Never use English text in any user-facing UI element.

## 2. Visual Design

### 2.1 Layout
- **Mobile-first responsive**: Primary user flow is on mobile. Desktop is supported but mobile is the primary design target.
- **8px grid system**: All spacing, margin, padding must be multiples of 8 (8, 16, 24, 32, 40, etc.)
- **Soft rounded corners**: All buttons, cards, modals, inputs use `border-radius: 8-12px` for a friendly feel
- **Subtle shadows**: Soft drop shadows on cards and modals (never harsh)

### 2.2 Color Palette
- **Base**: white / light gray (#FAFAFA) for clean learning environment
- **Primary**: calm blue (around #3B82F6) for main CTAs and links
- **Accent**: warm orange/yellow for highlights and secondary CTAs
- **Traffic light** (grading results — must be consistent):
  - Correct: green (#10B981)
  - Partial: amber (#F59E0B)
  - Wrong: red (#EF4444)
- **Text**: gray-900 (primary text), gray-600 (secondary text), gray-400 (placeholders, disabled)
- **WCAG AA compliance**: All text must meet 4.5:1 contrast ratio against background

### 2.3 Typography
- **Font family**: Pretendard (best Korean readability) with fallback to Noto Sans KR / system fonts
- **Math rendering**: KaTeX (uses Latin Modern automatically — do not override)
- **Sizes**:
  - Body: 16px (mobile-friendly)
  - Headings: 20-24px
  - Captions: 14px
- **Line-height**: 1.5-1.6 (improves Korean readability)

## 3. Math Rendering

| Pattern | Behavior |
|---|---|
| Inline math `$...$` | Render with KaTeX inline mode |
| Block math `$$...$$` | Render with KaTeX block mode |
| LaTeX content | Preserve exactly as provided. Never auto-convert or modify |
| Unknown LaTeX commands | Fall back to raw text + show subtle indicator |

## 4. Tone and Voice (Korean — student-facing)

### 4.1 Style Rules
- **Encouraging and supportive** — never negative or harsh
- **Polite Korean (해요체 form)** — use "잘 풀었어요!" not "잘 풀었다"
- **Friendly but professional** — like a kind tutor, not a robot

### 4.2 Always-OK phrases
- "잘 풀었어요!"
- "정답이에요!"
- "이 부분 다시 살펴볼까요?"
- "여기까지 정합! 다음 step도 잘 풀었어요"
- "별해도 가능해요 — 이런 방법은 어떨까요?"
- "다음 문제 풀어볼까요?"

### 4.3 Never-use phrases
- "틀렸어요" — too negative
- "X" — too harsh
- "잘못했어요" — too negative
- "다시 해라" — imperative, too commanding
- Imperative commands in general — use suggestion form ("~해 볼까요?")

## 5. Loading States (MANDATORY)

For every async operation longer than 1 second, show a loading state. Never leave a blank screen.

| Operation | Loading message | Indicator |
|---|---|---|
| OCR (Gemini, ~3-5s) | "필기 인식 중..." | Spinner |
| Claude grading (~5-10s) | "채점 중..." | Spinner |
| Problem load | (no message) | Skeleton loader |
| Image upload | (no message) | Progress bar |

Show step labels when there are multiple stages so the user knows where they are in the pipeline.

## 6. Error Handling

### 6.1 Style
- **Friendly Korean messages** — never technical jargon
- **Provide retry option** for transient failures
- **Hide error details from students** — log them server-side for admin review

### 6.2 Standard messages
- OCR failure: "필기 인식이 어려워요. 다시 시도해 주세요"
- Network failure: "잠시 연결이 불안해요. 잠시 후 다시 시도해 주세요"
- LLM API failure: "잠시 문제가 생겼어요. 다시 시도해 주세요"
- Generic unknown error: "예상치 못한 문제가 생겼어요. 잠시 후 다시 시도해 주세요"

## 7. Accessibility (WCAG AA)

| Requirement | Standard |
|---|---|
| Color contrast | 4.5:1 minimum for all text |
| Keyboard navigation | All interactive elements reachable via Tab; activate with Enter/Space; close modals with Esc |
| Screen reader | ARIA labels on all buttons, links, form inputs |
| Focus indicators | Visible focus outline (do not remove default outline without replacement) |
| Touch targets | Minimum 44x44px on mobile |
| Alt text | Required on all images |

## 8. Performance

| Metric | Target |
|---|---|
| Page load time | <2 seconds |
| Image compression | Canvas drawing → JPEG 70% quality before upload (reduce bandwidth) |
| Lazy loading | Problem lists, history pages |
| Static data caching | Cache `tools`, `achvmt_stds`, `domain_catalog` data on first load |
| Bundle size | Minimize and code-split where possible |

## 9. Privacy and Security

### 9.1 Data isolation
- **Students**: Each student sees ONLY their own data. Never expose other students' attempts, scores, or info.
- **Administrators**: Can see all students' data, but only through the dedicated admin panel (separate role).

### 9.2 API key handling
- **Anthropic and Gemini API keys must be server-side only**. Never expose to the client (browser).
- Use Base44's environment variables / secrets management.

### 9.3 Image storage
- Student handwriting images (canvas or photo) are private to that student's session.
- Stored via Base44 storage with proper access control.
- Never share images between students.

## 10. Component Patterns (consistency across the app)

| Component | Style |
|---|---|
| Button | Rounded (8-12px). Primary action prominent. Disabled state clearly distinguished. |
| Form | Labels above inputs. Placeholders for examples. Error messages inline below input. |
| Card | Used for problems and history items. Soft shadow. 8px padding. |
| Modal | Only for confirmations or detailed views. Not for primary user flow. |
| Toast | Transient notifications (success / info). Auto-dismiss in 3-5 seconds. |
| Canvas | Always show undo and clear buttons. Allow zoom on mobile. |

## 11. Data Persistence

- All student actions (attempts, OCR results, grading results) are persisted permanently in the Base44 database (`student_attempts` table).
- Do NOT rely on session storage or local storage for important data — always go through server.
- Session timeout: 24 hours of inactivity → require re-login.

## 12. LLM API Integration Pattern

The app integrates with two external LLM APIs. Both are called from the backend (server-side), never from the client.

### 12.1 Gemini 2.5 Flash (OCR)
- Endpoint: Google Generative AI API
- Input: image (canvas drawing PNG or photo JPEG)
- Output: structured JSON (OCROutput schema — see grading prompt spec)
- Use Gemini's `response_mime_type: "application/json"` with `response_schema`

### 12.2 Claude Sonnet 4.6 (Grading)
- Endpoint: Anthropic Messages API
- Input: problem + verified_answer + agent_solution + correct_solution_path + student OCR text
- Output: structured JSON via tool_use forced (GradingOutput schema)
- Use `tool_choice: {type: "tool", name: "report_grade"}` to force structured output
- Use prompt caching (`cache_control: {type: "ephemeral"}`) on system prompt and tool definition for cost reduction

### 12.3 Pipeline order
```
canvas/photo → Gemini OCR → markdown_text → Claude grading → GradingOutput → student view
```

## 13. UI/UX Conventions (student view)

### 13.1 Main screen pattern
- Top: greeting "안녕하세요, [name]님!"
- Center: featured problem card (today's problem)
- Sidebar (mobile: hamburger or bottom nav): 4 selection modes
- Bottom: history link

### 13.2 Problem screen pattern
- Top: problem statement (KaTeX rendered)
- Middle: handwriting input area (tab between canvas / photo upload)
- Bottom: submit button

### 13.3 Result screen pattern
- Top: large score + traffic light color + summary
- Middle: step-by-step feedback (collapsible)
- Bottom: OCR result (collapsible) + "OCR이 잘못됐어요" button + alternative solution (if any)
- Footer: next problem / retry / main

## 14. UI/UX Conventions (admin view)

- Tabular lists for users, problems, attempts
- Search and filter on every list
- Click row → detail view
- Charts (bar, line) for analytics dashboard

## 15. Brand Voice (placeholder)

Brand name, logo, and color identity not yet finalized. Use neutral/calming defaults until decided. Be ready to swap in a custom palette and logo when provided.
