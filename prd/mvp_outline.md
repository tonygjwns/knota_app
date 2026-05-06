# 수학 학습 MVP — PRD Outline (v0.2)

본 문서 = MVP 의 high-level outline. *Base44 의 자료 양식 자료 양식*. 자세한 자료 = 별 file:

| file | 자료 |
|---|---|
| `mvp_outline.md` (본 자료) | high-level vision / flow / data model / tech stack |
| `feature_spec.md` | 자세한 feature 양식 (학생 + 관리자) |
| `grading_prompt.md` | Claude 채점 prompt + Pydantic schema |
| `ocr_prompt.md` | Gemini OCR prompt + Pydantic schema |
| `global_instructions.md` | Base44 의 *전체 적용* 자료 (style / tone / accessibility 자료) |
| `internal_notes.md` | 내부 자료 — open questions / decision log / TBD (Base44 자료 X) |
| `roadmap.md` | v2 / v3+ 자료 양식 (Base44 자료 X) |

## 1. Product Vision

한국 K-12 학생을 위한 수학 자기주도 학습 웹 서비스. 학생이 손글씨로 풀이를 작성 → OCR + LLM 채점 → 빠른 부분점수 + 단계별 피드백 + 별해 제안.

차별화 자리:
- **빠른 자동 채점** (~10-15초 — OCR + LLM 의 자료 양식 양식)
- **부분점수 + 단계별 피드백** — 단순 정/오답 X. 풀이 의 어느 단계 가 정합 / 어느 단계 가 공백 / 어느 단계 가 오류
- **별해 제안** — 학생 풀이 와 다른 자료 양식 의 자료 자료 발견 시 제안
- **누적 자료 → 약점 분석 (v2)** — 학생 의 풀이 패턴 누적 → 단원/도구 별 자료 양식 발견 → 추천

## 2. Target Users

### 학생 (primary user)
- 한국 K-12 (초/중/고)
- 자기주도 학습 의 자료
- 모바일 우선 / 태블릿 / PC 모두 지원

### 관리자 (secondary user)
- 콘텐츠 / 사용자 관리
- 학습 데이터 분석
- 채점 결과 spot-check (LLM 의 자료 양식 검증)

## 3. Core Flow

### 학생 (MVP)

```
1. 로그인
   - Google SSO 또는 email/password (Base44 built-in)
   - 학년 받음 (회원가입 시 1회)
   ↓
2. 메인 화면
   - (신규) 환영 페이지 + 첫 문제 자동 시작
   - (기존) "오늘의 문제" default + sidebar (다른 mode)
   ↓
3. 문제 선택 — 4 mode
   - 랜덤
   - 단원별 (19 domain — domain_catalog.json)
   - 도구별 (24+ tool — tools.json. 신설 시 자동 갱신)
   - 틀렸던 문제 (학생 history 의 오답)
   ↓
4. 문제 표시
   - problems.content (jsonb) → KaTeX rendered
   - 학생 view 안 verified_answer / source 표시 X
   ↓
5. 손글씨 풀이 입력 (둘 다)
   - Canvas drawing (web — 마우스/손가락)
   - 사진 업로드 (모바일 — 카메라)
   ↓
6. 제출 → OCR
   - Gemini 2.5 Flash API
   - 손글씨 → markdown text + LaTeX
   - latency ~3-5초 (loading state 표시)
   ↓
7. Claude 채점
   - Claude Sonnet 4.6 API
   - input: problem + verified_answer + agent_answer + 정답 풀이 path + 학생 OCR
   - output: structured (Pydantic) — 점수 + 단계별 피드백 + 별해
   - latency ~5-10초 (loading state 표시)
   ↓
8. 결과 화면
   - 점수 + 색상 (정답=green / 부분=yellow / 오답=red)
   - 단계별 피드백 (각 step 의 status + comment)
   - OCR 추출 결과 함께 표시
   - "OCR 잘못됨" 버튼 → 학생 수정 → 재채점
   - 별해 자리 (있으면) — "이런 방법도 있어요"
   ↓
9. 자동 저장 (student_attempts table 안)
   - 매 시도 = 영구 저장 (재시도 자료 별 row)
   ↓
10. 다음 자리
    - "다음 문제" 버튼 → 같은 mode 의 다음 문제
    - "review" → 풀이 history
    - "메인" → 메인 화면
```

### 관리자 (MVP)

```
- 사용자 list — 가입 / 활성도 / 진도 자료
- 문제 list — snapshot 자료 read (511 문제)
- 채점 결과 spot-check
   - 최근 채점 list (학생 + LLM 결과)
   - 검토 후 OK / 수정 마커 자료
- 분석 dashboard (★ MVP 자리)
   - 어려운 문제 (정답률 낮은 자리)
   - 어려운 도구 (학생 dd/cd 평균 ↑ 자료)
   - 단원별 평균 점수
   - 학생 진도 자료 (활성도 + 평균 점수)
```

## 4. Data Model

### Snapshot 자료 (read-only — Base44 안 import)

snapshot 자료 의 자료 양식 = `data/snapshot/` 자리 의 자료 (별 README 자료 양식).

| table | row | 자료 |
|---|---|---|
| problems | 511 | 문제 본문 + verified_answer |
| tools | 24 | 도구 정의 (도구별 mode 의 자료) |
| achvmt_stds | 311 | 교과 표준 코드 |
| usage_records | 2286 | 도구 적용 기록 (정답 풀이 path) |
| agent_answer_records | 510 | agent 풀이 자료 (Claude 채점 의 자료 양식) |
| domain_catalog.json | 19 | 단원 분류 (단원별 mode 의 자료) |

### Base44 안 신설 자료

**students** (Base44 built-in auth + extended)
- `id`, `email`, `name`, `grade` (학년 — 회원가입 시), `created_at`

**student_attempts** (학생 매 시도 영속 자료)
- `id`, `student_id` (FK)
- `problem_id` (FK to problems snapshot)
- `canvas_image_url` 또는 `photo_url` (Base44 storage)
- `ocr_text` (Gemini 결과)
- `ocr_corrected_text` (학생 수정 자료, optional)
- `claude_grade_json` (전체 채점 결과 — Pydantic structured)
- `score` (0-100)
- `correctness` (correct / partial / wrong)
- `시작_at`, `submit_at`, `duration_sec`
- `created_at`

**student_problem_status** (view 또는 cached table — review filter 의 자료)
- `student_id`, `problem_id`
- `last_score`, `last_attempt_at`, `attempt_count`, `best_score`
- `is_wrong` (last_score < 60 또는 correctness=wrong)

## 5. Tech Stack

| layer | 자료 |
|---|---|
| Platform | Base44 (no-code app builder — 자료 자료 의 자료 양식 의 자료 의 결정) |
| Auth | Base44 built-in |
| DB | Base44 built-in |
| Storage (image) | Base44 built-in |
| OCR | Gemini 2.5 Flash API (`generativelanguage.googleapis.com`) |
| Grading | Claude Sonnet 4.6 API (`api.anthropic.com`) |
| Math rendering | KaTeX |
| Canvas | Base44 built-in 또는 Excalidraw 양식 |
| Hosting | Base44 (web first) |

API key 의 자료 양식 = Base44 의 server-side env (client 노출 X).

## 6. UX Principles (Base44 global instructions 와 정합)

자세한 자료 = `docs/prd/global_instructions.md` (별 작업 자료 자리).

핵심 자료:
- 한국어 우선
- Mobile-first responsive
- 학생 친화 톤 (격려 + 정정)
- 8px grid + soft rounded corners
- Traffic light 채점 결과 (green/yellow/red)
- Loading state 자료 양식 (OCR ~3-5초, Grading ~5-10초)
- Friendly error handling
- WCAG AA accessibility

## 7. Explicit Exclusion (Base44 가 자료 자료 X 자리)

본 자리 = MVP 안 절대 자료 자료 X 자리 — Base44 의 자료 양식 자료 강제.

| 자리 | 자료 |
|---|---|
| 객관식 문제 | 자료 의 자료 양식 X (problems table 안 객관식 자료 X) — 자료 자료 X |
| 익명 시도 | 자료 누적 X 양식 — 자료 자료 X. 모든 학생 = 회원가입 후 사용 |

(v2 / v3+ 자리 = `docs/prd/roadmap.md` 자료 — 본 PRD 의 자료 X. Base44 = MVP 만 자료)

## 8. 관리자 분석 dashboard (MVP — 자세한 자료)

| metric | source | 자료 |
|---|---|---|
| 어려운 문제 list | student_attempts aggregate | 학생 평균 점수 ↓ 자료 — 자료 양식 자료 양식 |
| 어려운 도구 list | usage_records.dd / cd + student_attempts | 자료 의 자료 양식 자료 |
| 단원별 평균 점수 | student_attempts × problem.domain | bar chart |
| 학생 진도 list | student_attempts.count + 평균 점수 | 활성 / 정체 자료 |
| 채점 spot-check queue | student_attempts (검토 미실시) | 사람 검토 자료 |
| 신설 도구 / entity / predicate (Tab B 의 자료) | data/diff_log_*.jsonl | 자료 양식 자리 |

## 9. Language (★ Base44 한글 지원 X 자리 정합)

| 자리 | 자료 |
|---|---|
| **본 PRD outline** (현재 자료) | 한국어 — 사용자 와 자료 양식 양식 |
| **Base44 의 자료 PRD** (final 자료) | **영문 자료 — Base44 의 자료 양식 정합 자료** (한글 자료 X) |
| App UI / user-facing string | **한국어 자료** — 실 사용자 (학생 / 관리자) 의 자료 |
| LLM 의 prompt (Claude / Gemini API 직접 호출) | 한국어 가능 자료 — Base44 외 자료 |
| Pydantic schema 자료 | 영문 (코드) + 한국어 description 가능 자료 |

→ **PRD v1.0 (Base44 의 자료 진입 자료) = 영문 자료**. App UI 의 자료 한국어 양식 = PRD 안 명시 ("All user-facing UI strings must be in Korean").

## 10. Versioning

- v0.1 (현재) = outline (한국어)
- v0.2 = + Claude 채점 prompt + Pydantic schema (별 micro-step 후)
- v0.3 = + Gemini OCR prompt + UX detail (별 micro-step 후)
- **v0.9 = 영문 번역 자료 (Base44 진입 직전 자료)**
- v1.0 = Base44 build 진입 자료 — 영문 자료 양식 (모든 자료 통합)
