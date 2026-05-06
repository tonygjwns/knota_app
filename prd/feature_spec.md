# Feature Spec (v0.1)

본 문서 = MVP 의 *자세한 feature 양식*. 학생 8 자리 + 관리자 4 자리. 매 자리 = 화면 / input / output / data flow / error / 자료 양식.

PRD 의 자료:
- vision / data model / tech stack = `mvp_outline.md`
- LLM prompt = `grading_prompt.md` / `ocr_prompt.md`
- 전체 자료 (style / tone) = `global_instructions.md`

## 학생 자리 (Student-facing)

### S1. 로그인 / 회원가입

**목적**: 학생 인증 + 학년 정보 수집.

**화면**:
- 로그인 화면 = email + password 입력 + "Google 로 로그인" 버튼
- 회원가입 화면 = email + password + 이름 + **학년 (1-12)** + 약관 동의

**input**: email / password (또는 Google SSO token) / 신설 시 이름 + 학년
**output**: 로그인 자료 양식 (Base44 의 자료 양식 자료) → 메인 화면 redirect

**data flow**:
```
회원가입 → Base44 users table 자료 (email, name, grade, created_at)
로그인 → Base44 auth → session 자료 양식 → 메인 화면
```

**error**:
- email 자료 양식 X / password 자료 양식 X = friendly Korean ("이메일 또는 비밀번호 자료 양식 자료")
- 회원가입 시 email 자료 양식 자료 = "이미 자료 양식 양식 이메일 자료 양식"
- 학년 자료 양식 X = "학년 자료 양식 양식 (1-12)"

**자료 양식**:
- 학년 = 추천 문제 의 자료 양식 양식. 후 v2 의 자료 양식 자료
- session timeout = 24 시간 자료 양식

### S2. 메인 화면

**목적**: 학생 의 자료 양식 양식 자료 양식 양식 자료 양식 양식 (홈 화면 자료).

**화면**:
- 상단 = 인사 ("안녕하세요, [이름]님!")
- 중앙 자료 = "오늘의 문제" card (랜덤 1 자료 자료 양식)
  - 신규 사용자 = 환영 메시지 + "첫 문제 풀어볼까요?" 버튼
  - 기존 사용자 = 어제 자료 양식 양식 양식 또는 자료 양식 자료 양식
- sidebar = 4 mode 자료 양식 양식 양식 (랜덤 / 단원별 / 도구별 / 틀렸던 문제)
- 하단 = "내 풀이 history" 자료 양식 양식 + "관리자" 자료 (관리자 자료)

**input**: 학생 의 자료 양식 양식 양식 (sidebar 자료 / 자료 양식 양식 자료 양식)
**output**: 자료 양식 양식 자료 양식 (S3) 또는 history (S8) 자료 양식

**자료 양식**:
- 모바일 자료 양식 = sidebar 양식 양식 자료 양식 (hamburger menu 또는 bottom navigation)
- 신규 사용자 의 자료 양식 = 환영 페이지 + 첫 문제 자동 시작 (onboarding 자료 양식 자료 양식)

### S3. 문제 선택 — 4 mode

**목적**: 학생 의 자료 양식 자료 양식 양식 자료 양식 양식.

#### S3.1 랜덤
- 행동: "랜덤" 버튼 자료 양식
- 자료 양식: `problems.jsonl` 안 random sample 1 자료 → S4 자료 양식
- 단순 양식

#### S3.2 단원별
- 행동: "단원별" 자료 양식 → 19 domain 자료 양식 양식 (`domain_catalog.json` 자료) → 학생 자료 양식 → 자료 양식 의 problem 자료 양식 random
- 단원 → problem 매핑: `tools.achvmt_std_code` prefix → domain → `usage_records.tool_id` → problem
- 자료 양식 양식: 단원 별 표시 = ko 이름 (예: "대수 — 다항식·인수분해") + problem 수 자료 양식

#### S3.3 도구별 (구 매듭)
- 행동: "도구별" 자료 양식 → 24+ tool 자료 양식 양식 (`tools.json` 자료) → 학생 자료 양식 → 자료 양식 의 problem 자료 양식 random
- 도구 → problem: `usage_records.tool_id` 자료 → problem
- 자료 양식 양식: 도구 별 = 이름 (예: "등식의 가감법을 이용한 미지수 소거") + 자료 양식 자료 (자료 양식 자료) + problem 수

#### S3.4 틀렸던 문제
- 행동: "틀렸던 문제" 자료 양식 → 학생 의 history 안 score < 60 또는 correctness=wrong 자료 양식
- 자료 양식: `student_attempts` 자료 양식 query
- 자료 양식: 자료 양식 자료 양식 양식 자료 양식 = "아직 자료 양식 양식 자료 양식 자료 양식! 다른 mode 자료 양식?" + S3.1 자료

**input**: 학생 자료 양식 양식 (mode + 자료 양식 자료 양식)
**output**: 1 problem 자료 양식 → S4 자료 양식

**error**:
- problem 자료 양식 X 자료 양식 (예: 단원 양식 자료 양식 X) = "자료 양식 양식 자료 양식 자료 양식 — 다른 자료 양식?"

### S4. 문제 화면

**목적**: 문제 표시 + 학생 풀이 입력 양식.

**화면**:
- 상단 = 문제 본문 자료 양식 (KaTeX 양식)
- 중앙 = **손글씨 입력 자료 양식**
  - tab 1 = canvas drawing (web)
  - tab 2 = 사진 업로드 (모바일 양식 자료 양식)
- 하단 = "제출" 버튼 + "메인 으로" 버튼

**input**:
- 문제 자료 = `problems.content` (jsonb 양식)
- 학생 자료 = canvas drawing 의 PNG 또는 사진 의 JPEG

**output**: 학생 양식 자료 양식 → S5 자료 양식

**data flow**:
```
problems.jsonl 자료 양식 → 본 화면 자료 양식 양식 양식 (KaTeX rendered)
학생 손글씨 → image (canvas / 사진) → S5 자료 양식 양식
```

**error**:
- 빈 양식 자료 양식 = "풀이 자료 양식 자료 양식" 자료 양식 (학생 친화)

**자료 양식**:
- canvas = undo / clear 자료 양식 양식 자료 양식
- 사진 업로드 = 자료 양식 양식 (HEIC / PNG / JPEG) + size limit (10MB)

### S5. 제출 → OCR → 채점 양식

**목적**: 학생 손글씨 → markdown text → 채점 결과.

**화면**:
- loading 화면 = 단계 표시
  - 단계 1 = "필기 인식 중..." (Gemini OCR ~3-5 초)
  - 단계 2 = "채점 중..." (Claude 채점 ~5-10 초)
- spinner 또는 progress bar

**input**: 학생 image (S4 의 자료 양식)
**output**: GradingOutput → S6 자료 양식 양식

**data flow**:
```
image → Gemini 2.5 Flash OCR (ocr_prompt.md 자료) → OCROutput
OCROutput.markdown_text + problem 자료 → Claude Sonnet 4.6 채점 (grading_prompt.md 자료) → GradingOutput
```

**error**:
- OCR 실패 = "필기 인식이 어려워요. 다시 시도해 주세요" + 재시도 버튼
- LLM API 실패 = "잠시 자료 양식 양식 — 다시 시도해 주세요" + 재시도
- timeout (>30 초) = "자료 양식 양식 자료 양식 — 다시 시도해 주세요"

**자료 양식**:
- OCR confidence < 70 자료 양식 자료 양식 = 결과 화면 안 의문 자리 자료 양식 (S6 자료)
- 자료 양식 양식 자료 양식 (timeout / network) = 자동 retry (1 회)

### S6. 결과 화면

**목적**: 채점 결과 자료 양식 + 자료 양식 자료.

**화면**:
- 상단 = 점수 + traffic light (green/amber/red) + summary
- 중앙 = step-by-step feedback (collapse / expand)
- 하단:
  - **OCR 결과** 자료 양식 (학생 의 자료 양식 자료 양식)
  - "OCR 잘못됨" 버튼 → S7 양식
  - 별해 (있으면) — "이런 방법도 있어요" 자료 양식
- 자료 양식 = "다음 문제" / "메인 으로" / "다시 풀기" 자료 양식

**input**: GradingOutput (S5 의 자료)
**output**: 학생 자료 양식 (다음 문제 / 메인 / 다시) → 자료 양식 자료 양식 자료 양식

**data flow**:
```
GradingOutput.score + correctness + summary → 상단
GradingOutput.step_feedback → 중앙
OCROutput.markdown_text → 하단 (학생 자료 양식 양식)
GradingOutput.alternative_solution → 별해 자료 (있으면)
GradingOutput.ocr_quality_concern → 자료 양식 양식 (있으면)
```

**자료 양식**:
- 점수 색상 = traffic light (green ≥ 80 / amber 40-79 / red <40 양식 양식)
- 자동 저장 = student_attempts table 자료 (S5 의 자료 양식 자료 양식 양식 자료 양식)

### S7. OCR 잘못됨 → 재채점

**목적**: 학생 가 OCR 자료 양식 자료 양식 양식 자료 양식 양식 → 정정 후 재채점.

**화면**:
- OCR 결과 텍스트 = 자료 양식 양식 자료 양식 (textarea 자료)
- 학생 자료 양식 양식 → "수정 자료 양식 채점" 버튼

**input**: 학생 의 자료 양식 양식 양식 (markdown text)
**output**: GradingOutput → S6 자료 양식 양식

**data flow**:
```
ocr_corrected_text → Claude 채점 (Gemini OCR 양식 X — 비용 절감)
→ GradingOutput → S6 자료 양식 자료 양식
```

**자료 양식**:
- 양식 양식 = student_attempts 의 `ocr_corrected_text` field 자료
- "OCR 잘못됨" 자료 양식 양식 = admin 의 자료 양식 자료 양식 (OCR 양식 양식 자료 양식)

### S8. 풀이 history (review)

**목적**: 학생 의 자료 양식 자료 양식 자료 양식 자료 양식.

**화면**:
- list = 매 시도 자료 (problem 이름 / 점수 / 날짜 / 단원 / 도구)
- filter = 날짜 / 점수 범위 / 단원 / 도구 / 정답/오답
- 자료 양식 자료 양식 = 결과 화면 (S6) 양식 양식

**input**: 학생 자료 양식 양식 (filter 자료)
**output**: 양식 자료 양식 list

**data flow**:
```
student_attempts table 자료 양식 → list rendering
filter 자료 양식 → SQL where clause
```

**자료 양식**:
- pagination — 20 자료 양식 양식
- 자료 양식 자료 양식 = 결과 화면 자료 양식 (재 양식 X)

## 관리자 자리 (Admin-facing)

### A1. 사용자 list

**목적**: 가입 / 활성 학생 자료 양식.

**화면**:
- table = 학생 자료 (email / 이름 / 학년 / 가입일 / 마지막 활동 / 시도 수 / 평균 점수)
- search / filter / sort 자료 양식

**input**: 자료 양식 자료 양식
**output**: 학생 자료 양식 list

**data flow**:
```
users + student_attempts (aggregate) → admin view
```

**자료 양식**:
- 자료 양식 양식 자료 양식 = 학생 자료 양식 자료 양식 (자료 양식 양식)

### A2. 문제 list

**목적**: snapshot 자료 양식 자료 양식 양식.

**화면**:
- table = problem (id / source / 단원 / 도구 / 채점 통계)
- search / filter (단원 / 도구) 자료 양식
- 자료 양식 자료 양식 = 자료 양식 양식 (problem.content + verified_answer + agent_solution + 정답 풀이 path)

**input**: 자료 양식 자료
**output**: problem 자료 양식 list

**자료 양식**:
- read-only — MVP 의 자료 양식 자료 양식 X
- v2 의 자료 양식 자료 양식 자료 양식 양식 자료 양식

### A3. 채점 spot-check queue

**목적**: LLM 채점 결과 의 *사람 검토* 양식.

**화면**:
- queue = 최근 채점 list (검토 미실시 자료 양식)
- 자료 양식 자료 양식 = 학생 자료 + LLM 채점 결과 자료 양식
- 자료 양식 자료 = "OK" (정합) / "수정 자료 양식" (정정 자료 양식) / "건너뛰기"

**input**: 검토 자료 양식
**output**: spot_check 자료 (student_attempts 의 `admin_review_status` field 자료)

**data flow**:
```
student_attempts (admin_review_status = null) → queue
admin 자료 양식 → student_attempts 자료 양식 양식 양식
```

**자료 양식**:
- LLM 자료 양식 자료 양식 자료 양식 = admin 자료 양식 양식 자료 양식 → prompt 자료 양식 자료 양식

### A4. 분석 dashboard (★ MVP 자리)

**목적**: 자료 양식 자료 양식 — 어려운 문제 / 도구 / 단원 / 학생 자료 양식.

**화면 — 4 자료 양식**:

#### A4.1 어려운 문제 list
- metric = 학생 평균 점수 ↓ + 시도 수 ↑
- list = problem (id / 단원 / 평균 점수 / 시도 수 / 정답률)
- 자료 양식 자료 양식 = 학생 풀이 의 자료 양식 자료 양식 양식

#### A4.2 어려운 도구 list
- metric = 학생 의 자료 양식 양식 자료 양식 (dd / cd 자료 양식)
- list = tool (id / name / 평균 점수 / 시도 수)

#### A4.3 단원별 평균 점수
- bar chart = 19 domain × 평균 점수
- 학생 자료 양식 양식 자료 양식 (필터)

#### A4.4 학생 진도 자료
- list = 학생 (활성 / 평균 점수 / 시도 수 / 진척)
- 자료 양식 양식 = 학생 자료 양식 자료 양식 (활성 ↑ / ↓ 자료)

**input**: 관리자 자료 양식 (filter / 자료 양식)
**output**: 자료 양식 / 양식 / list

**data flow**:
```
student_attempts × problems × tools × domain_catalog → aggregate query → dashboard rendering
```

**자료 양식**:
- 자료 양식 양식 = 매 시간 cache 자료 양식 (성능)
- v2 의 자료 양식 자료 양식 자료 양식 양식

## 자료 양식 양식 (Cross-cutting)

### Performance
- page load <2 초
- OCR + 채점 = ~10-15 초 (loading state 자료 양식)
- list page (history / dashboard) = pagination + lazy load

### Privacy
- 학생 자료 자료 양식 — 자기 자료 만 view
- 관리자 = 모든 학생 자료 view (분석 자료 양식)
- API key = server side 만

### Error handling
- friendly Korean
- 재시도 자료 양식 양식 자료 양식 (transient)
- 자료 양식 양식 양식 자료 양식 (admin 자료 양식)

## Versioning

- v0.1 (현재) = 학생 8 자리 + 관리자 4 자리 자료 양식
- v0.2 = 자료 양식 (자료 양식 자료 양식 자료) + 자료 양식 자료 양식
- v1.0 = MVP build 진입 양식
