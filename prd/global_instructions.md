# Base44 Global Instructions (v0.1 — 한국어 draft)

본 문서 = Base44 의 *전체 앱 자료 적용* 자료 양식. v0.9 자료 양식 영문 번역 자료 양식 → Base44 자료 양식.

전체 앱 = 한국 K-12 수학 학습 웹 서비스 MVP. 두 사용자 = 학생 + 관리자. 자료 양식 = `data/snapshot/` 자료 (read-only) + Base44 의 자료 양식 (학생 시도 자료) + 외부 LLM API (Gemini OCR + Claude 채점).

## 1. Language (★ 강제 자료)

| 자리 | 언어 |
|---|---|
| **모든 user-facing UI string** (버튼 / 라벨 / 메시지 / 헤더 / placeholder 자료) | **한국어 (한국어 자료)** |
| 코드 주석 | 영문 OK |
| LLM 호출 prompt (Claude / Gemini) | 한국어 (Base44 외 자료 — 직접 API 호출) |

→ 영문 UI string 자료 자료 — 모든 자료 양식 한국어 자료 양식.

## 2. Visual design

### 2.1 layout
- **mobile-first responsive** — 학생 의 자료 양식 = 모바일 자료. desktop 양식 자료 양식 — 단 모바일 의 자료 양식 우선.
- **8px grid system** — spacing / margin / padding 모든 자료 양식 8 의 자료 양식 자료 양식 (8 / 16 / 24 / 32 / 40 등).
- **soft rounded corners** — button / card / modal 자료 = `border-radius: 8-12px`. 자료 양식 양식 양식 자료 친근감.
- **subtle shadow** — card / modal 자료 = soft drop shadow (자료 양식 자료 자료 양식 X).

### 2.2 color palette
- **base**: white / light gray (#FAFAFA) — 학습 의 자료 양식 자료
- **primary**: 차분 자료 (blue-500 자료 양식 — 자료 양식 자료 자료)
- **accent**: warm 자료 (orange / yellow 자료 — 자료 양식 자료 양식)
- **traffic light (채점 결과 자료)**:
  - 정답 (correct) = green-500 (#10B981 자료)
  - 부분 (partial) = amber-500 (#F59E0B 자료)
  - 오답 (wrong) = red-500 (#EF4444 자료)
- **text**: gray-900 (자료 양식) / gray-600 (자료 양식) / gray-400 (placeholder)
- **WCAG AA 자료** — 모든 text 의 자료 양식 자료 양식 4.5:1 자료 양식.

### 2.3 typography
- **font family**: Pretendard 자료 양식 (한국어 가독성 우선). fallback = Noto Sans KR / system 자료 양식.
- **수식 (math) rendering**: KaTeX (Latin Modern 자동 — 자료 양식 자료 양식 X).
- **font size**:
  - body = 16px (모바일 자료 — 자료 양식 자료 양식 자료)
  - heading = 20-24px
  - caption = 14px
- **line-height**: 1.5-1.6 자료 양식 (한국어 가독성 자료 양식).

## 3. 수식 (math) rendering

| 자리 | 자료 |
|---|---|
| **inline math** | `$...$` 양식 → KaTeX 자료 양식 |
| **block math** | `$$...$$` 양식 → KaTeX block 자료 양식 |
| **LaTeX 양식 그대로 보존** | 자료 양식 변경 X. 학생 / 시스템 의 자료 양식 = 그대로 자료 양식. |
| **자료 양식 양식 X 시** | KaTeX 자료 양식 자료 양식 X 자료 (예: `\unknown` 등) = raw text 양식 자료 양식 + 자료 양식 자료 양식 양식. |

## 4. Tone / Voice (한국어 — 학생 친화 자료)

### 4.1 양식 양식 자료
- **격려 자료 양식** — 학생 의 자료 양식 양식 양식 양식 자료 양식.
- **정중 자료 (해요체 자료)** — "잘 풀었어요!" / "다시 살펴볼까요?". 한다체 X.
- **친근 + 전문** — 친구 같은 자료 양식 + 자료 양식 자료 양식.

### 4.2 정합 양식 (자료 양식 양식)
- "잘 풀었어요!" / "정답이에요!"
- "이 부분 다시 살펴볼까요?"
- "여기까지 정합! 다음 step 도 자료 양식 자료 자료."
- "별해도 가능해요 — 이런 방법은 어떨까요?"
- "다음 문제 자료 양식 양식 자료 양식?"

### 4.3 자료 양식 X 양식 (자료 자료 양식)
- "틀렸어요" / "X" / "잘못했어요" / "다시 자료 양식"
- "X 의 자료" / "자료 양식 X 자료"
- 명령 자료 양식 ("자료 양식 양식") — 권유 자료 양식 양식 ("~해 볼까요?")

## 5. Loading states (★ 강제 자료)

모든 async 자료 양식 (>1 초) 자리 = loading state 자료 양식 자료 양식. 학생 의 자료 양식 자료 양식 자료 양식.

| 자료 | 자료 양식 양식 |
|---|---|
| OCR 양식 (Gemini ~3-5 초) | "필기 인식 중..." + spinner / progress |
| Claude 채점 (~5-10 초) | "채점 중..." + spinner |
| 문제 load | skeleton loader |
| 이미지 upload | progress bar |

→ 빈 화면 자료 양식 자료 양식 자료 양식 X. 학생 의 자료 양식 자료 양식 자료 양식 자료 양식 자료 양식.

## 6. Error handling

### 6.1 자료 양식
- **friendly Korean** — 기술 자료 양식 X. 학생 의 자료 양식 자료 양식.
- **재시도 자리** 자료 양식 (transient 자료 양식 시).
- **자료 양식 자료 양식** — 학생 view 안 자료 양식 X (admin 자료 양식 자료).

### 6.2 자료 양식 양식
- OCR 자료 양식 자료 시: "필기 인식이 어려워요. 다시 시도해 주세요"
- network 자료 양식 자료 시: "잠시 연결이 불안해요. 잠시 후 다시 시도해 주세요"
- LLM API 자료 양식 자료 시: "잠시 자료 양식 양식 — 다시 시도해 주세요"
- 자료 양식 양식 자료 양식: "예상치 못한 자료 양식 양식 — 자료 양식 자료 양식 자료 양식"

## 7. Accessibility (WCAG AA 자료)

| 자리 | 자료 |
|---|---|
| color contrast | 모든 text = 4.5:1 자료 양식 |
| keyboard navigation | Tab / Enter / Esc 자료 양식 자료 양식 |
| screen reader | ARIA label 자료 양식 (button / link / form 자료) |
| focus indicator | 자료 양식 자료 양식 (outline 또는 자료 양식 변화 자료 양식) |
| touch target | minimum 44x44px (모바일 자료) |
| alt text | image (이미지 자료) 자료 양식 자료 양식 |

## 8. Performance

| 자리 | 자료 |
|---|---|
| page load | <2 초 자료 양식 |
| 이미지 압축 | canvas drawing → JPEG 70% 자료 양식 후 upload (band 자료 양식) |
| lazy load | 문제 list / history 자료 양식 — 자료 양식 자료 양식 자료 양식 자료 |
| static data cache | tools / achvmt_stds / domain_catalog 자료 = 1 회 load + cache 자료 양식 |
| 자료 양식 양식 양식 | 자료 양식 자료 양식 자료 양식 (예: 자료 양식 양식 자료 양식 자료 양식) |

## 9. Privacy / Security

### 9.1 자료 양식 자료
- **학생 자료 자료 양식**: 자기 자료 만 view 자료 양식. 다른 학생 의 자료 X.
- **관리자**: 모든 학생 의 자료 view 자료 양식. 단 자료 양식 자료 양식 자료 양식 (예: spot-check / 분석 자료).

### 9.2 API key 자료
- **API key (Anthropic / Gemini)** = server side 자료 양식. client (브라우저) 의 자료 양식 X. 자료 양식 자료 양식 양식.
- 자료 양식 자료 양식 = Base44 의 환경 변수 자료 양식 자료 (자료 양식 자료 양식 자료).

### 9.3 자료 양식 자료 양식
- 학생 의 손글씨 이미지 = 자기 의 자료 양식 만 양식. 자료 양식 자료 양식 자료 양식 (Base44 storage 의 자료 양식).
- 모든 학생 의 자료 양식 자료 자료 양식 X — 자료 양식 자료 양식 자료 양식.

## 10. Component patterns (자료 양식)

| component | 자료 |
|---|---|
| **button** | rounded (8-12px) / primary 자료 양식 prominent / disabled 자료 양식 자료 양식 |
| **form** | label 자료 위 자료 양식 / placeholder 자료 / error 자료 양식 inline 자료 양식 |
| **card** | 문제 / history item 자료 양식 / soft shadow / 8px padding |
| **modal** | 확인 / 자료 양식 자료 양식 자료 양식 양식 자료 양식 양식 (자료 양식 자료 양식 자료 양식) |
| **toast** | transient 자료 양식 자료 (성공 / 자료 양식 자료) — 3-5 초 자료 양식 자료 양식 |
| **canvas** | 손글씨 입력 — 자료 양식 자료 양식 자료 양식 / undo / clear 자료 |

## 11. Data persistence

- 모든 학생 의 자료 양식 (시도 / 채점 / OCR) = 영구 자료 양식 (Base44 DB — student_attempts table).
- session storage 자료 양식 자료 양식 자료 양식 자료 양식 양식 자료 X — 모든 자료 양식 server 자료.
- session timeout = 24 시간 자료 양식 (재로그인 자료 양식 자료).

## 12. LLM API integration

### 12.1 Gemini 2.5 Flash (OCR)
- 양식: 자료 양식 양식 자료 양식 (`docs/prd/ocr_prompt.md` 자료 양식 양식)
- input: image (canvas 자료 / 사진 자료)
- output: OCROutput JSON (Pydantic 자료 양식)
- 양식 자료 양식 양식 양식 (`response_mime_type: application/json`)

### 12.2 Claude Sonnet 4.6 (채점)
- 양식: 자료 양식 양식 자료 양식 (`docs/prd/grading_prompt.md` 자료 양식 양식)
- input: problem + verified_answer + agent_solution + 정답 풀이 path + 학생 OCR
- output: GradingOutput JSON (Pydantic 자료 양식)
- 양식 자료 양식 양식 (`tool_choice` 강제)
- prompt cache 자료 양식 양식 자료

### 12.3 호출 chain
```
canvas 자료 / 사진 → Gemini OCR → markdown_text → Claude 채점 → GradingOutput → 학생 view
```

## 13. UI / UX 양식 양식 (학생 view 자료)

### 13.1 메인 화면 자료
- 상단 = 인사 ("안녕하세요, [이름]님!" — 한국어 자료 양식)
- 중앙 = "오늘의 문제" 자료 양식 (default — 신규 사용자 자료)
- sidebar = 4 mode (랜덤 / 단원별 / 도구별 / 틀렸던 문제)
- 하단 = "내 풀이 history" 자료 양식

### 13.2 문제 화면 자료
- 문제 본문 자료 양식 (KaTeX 양식)
- 손글씨 입력 자료 양식 (canvas 또는 사진 업로드 자료 자료)
- "제출" 자료 양식

### 13.3 결과 화면 자료
- 점수 + traffic light 자료 양식
- 단계별 피드백 자료 양식 (collapse / expand 자료)
- OCR 결과 함께 자료 양식 + "OCR 잘못됨" 버튼 (자료 양식 자료)
- 별해 (있으면) — "이런 방법도 있어요" 자료 양식
- "다음 문제" / "메인" 자료 양식

## 14. UI / UX 양식 양식 (관리자 view 자료)

- 사용자 list 자료 양식 (table / search 자료)
- 문제 list 자료 양식 (snapshot read 자료)
- 채점 spot-check queue 자료 양식 (검토 자료 자료 자료 양식)
- 분석 dashboard 자료 양식 (chart / metric 자료 양식)

## 15. Versioning

- v0.1 (현재) = 한국어 draft
- v0.9 = 영문 번역 자료 (Base44 자료 양식 자료)
- v1.0 = Base44 자료 양식 자료 (자료 양식 자료 양식)
