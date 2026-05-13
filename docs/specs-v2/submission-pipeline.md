# 문제 풀이 + 채점 (Submission Pipeline)

학생이 손으로 푼 수학 풀이를 OCR + LLM 으로 채점하는 핵심 흐름.

KNOTA 앱의 모든 학습 활동(자유 풀이 / 숙제 / 매듭 보강)이 결국 이 흐름으로 모입니다.

---

## 1. 큰 그림 — 학생이 직접 보는 모습

### 1.1 한 문장으로

> 문제 보고 → 손으로 풀고 → 제출 → 잠시 기다리면 → 채점 결과 화면

### 1.2 화면별 사용자 경험

#### 진입

학생은 다음 중 하나를 거쳐 문제 화면에 도착합니다.

```
┌─ 메인 화면 ─────────────┐    ┌─ 받은 숙제 ────────┐    ┌─ 오늘의 추천 ─────┐
│ "오늘의 문제" 카드 클릭   │    │ 숙제 → 안 푼 문제   │    │ 추천 카드 클릭     │
└────────┬────────────┘    └──────┬──────────┘    └────────┬────────┘
         │                         │                          │
         └─────────────┬───────────┴──────────────────────────┘
                       ↓
              ┌────────────────┐
              │ /problem/:id   │
              └────────────────┘
```

#### 문제 화면 (ProblemSolve)

학생이 보는 것:

```
┌──────────────────────────────────┐
│ ← 도메인 배지                       │
│                                    │
│ 문제                                │
│ ┌─ 문제 본문 (LaTeX 수식 포함) ──┐  │
│ │  x^2 - 5x + 6 = 0 의 해는?     │  │
│ └────────────────────────┘  │
│                                    │
│ ✍️ 필기로 풀기  │  📷 사진으로 올리기  │
│                                    │
│ ┌─ 캔버스 ──────────────────┐    │
│ │                              │    │
│ │   (여기에 풀이를 적어 주세요)  │    │
│ │                              │    │
│ └────────────────────────┘    │
│                                    │
│ [되돌리기] [초기화]                  │
│                                    │
│ [메인으로]    [제출 →]              │
└──────────────────────────────────┘
```

학생이 할 수 있는 것:

- **펜 / 지우개** 토글로 캔버스에 그리기
- 잘못 그렸으면 **되돌리기** 또는 **초기화**
- **사진으로 올리기** 탭으로 전환해서 종이 풀이 사진 업로드
- 제출 전에 **메인으로** 빠져나가기

#### 제출 후 — 로딩 화면

제출 버튼을 누르면 두 단계의 로딩이 차례로 보입니다.

```
1단계 (3~5초)                   2단계 (5~10초)
┌─────────────────┐         ┌─────────────────┐
│      ✍️           │         │      🧮           │
│                  │   →    │                  │
│  필기 인식 중...   │         │   채점 중...      │
│                  │         │                  │
│  Gemini가 손글씨를 │         │  AI가 풀이를      │
│  읽고 있어요       │         │  꼼꼼히 확인하고   │
│                  │         │  있어요            │
└─────────────────┘         └─────────────────┘
```

#### 결과 화면

자동으로 `/result/:attemptId` 로 이동.

ResultView 명세 참조 (점수, 단계별 피드백, 매듭 보강 권유 등).

### 1.3 학생이 마주치는 에러 상황

| 상황 | 학생이 보는 것 |
|---|---|
| 빈 화면에서 제출 | 토스트: "풀이를 작성해 주세요" |
| 사진이 너무 큼 (10MB 초과) | 토스트: "파일 크기는 10MB 이하여야 해요." |
| 인터넷 / 서버 문제 | 빨간 카드: "잠시 문제가 생겼어요. 다시 시도해 주세요" + [다시 시도] 링크 |
| OCR 결과가 비어있음 | 위와 동일한 에러 카드 |
| 잘못된 URL (없는 문제) | "문제를 찾을 수 없어요." |

학생은 모든 에러에서 **수동으로 다시 시도** 할 수 있고, 이 시점에 자동 재시도는 없습니다.

---

## 2. 알고리즘 / 로직

### 2.1 전체 흐름도

```
┌─────────────────────┐
│  /problem/:id 진입   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Problem 데이터 fetch │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  학생 입력 대기       │
│  (캔버스 / 사진)      │
└──────────┬──────────┘
           ↓
       [제출 클릭]
           ↓
   ┌───────────────┐
   │ 입력 비어있음? ├─ Yes ─→ 토스트 → 대기로 복귀
   └───────┬───────┘
           No
           ↓
┌─────────────────────┐
│ 이미지 압축          │
│ (1280px, JPEG 70%)  │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ UploadFile          │
│ → file_url 받음      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Gemini OCR 호출      │  ← stage='ocr' 로딩 표시
│ (이미지 → 텍스트)    │
└──────────┬──────────┘
           ↓
   ┌───────────────┐
   │ OCR 결과 비어? ├─ Yes ─→ 에러 throw
   └───────┬───────┘
           No
           ↓
┌─────────────────────┐
│ Claude 채점 호출     │  ← stage='grading' 로딩 표시
│ (문제+정답+학생풀이  │
│  → 점수+피드백)      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ StudentAttempt      │
│ 저장 (DB insert)    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ /result/:id 로 이동  │
└─────────────────────┘

(어느 단계든 throw 발생 시)
           ↓
┌─────────────────────┐
│ 에러 카드 + 다시시도  │
└─────────────────────┘
```

### 2.2 외부 의존성

이 흐름은 외부 서비스 3 개에 의존합니다.

```
┌──────────────────────┐
│ Base44 Storage       │  ← 이미지 업로드
│ (UploadFile)          │
└──────────────────────┘

┌──────────────────────┐
│ Gemini 2.5 Flash     │  ← OCR (이미지 → markdown)
│ (gemini_3_flash)     │
└──────────────────────┘

┌──────────────────────┐
│ Claude Sonnet 4.6    │  ← 채점 (텍스트 → 구조화된 JSON)
│ (claude_sonnet_4_6)  │
└──────────────────────┘
```

세 호출 모두 `base44.integrations.Core` 를 통한 wrapping API로 들어가고, base44 의 환경 변수가 실제 API key 를 들고 있습니다.

### 2.3 매듭(도구) 매핑 정확도 보장

채점 prompt 에 **사용 가능한 도구 목록을 직접 주입** 합니다. 그렇지 않으면 LLM 이 자기가 만든 tool_id 나 한국어/영문 이름을 채워서 다운스트림 분석 (mastery, 보강 흐름 등) 이 모두 깨집니다.

흐름:

```
Problem.tool_ids 파싱
   ↓
MathTool.list 100 → 해당 tool 만 추출 (relevantTools)
   ↓
<available_tools> 블록 만들어 채점 prompt 에 주입
   ↓
Claude 가 error_locations / gap_locations 의 tool_id 채울 때
이 목록의 ID 만 사용 (그 외엔 null) — 시스템 프롬프트에서 강제
   ↓
응답 받은 후 sanitize:
  validIds = Set(relevantTools.tool_id)
  유효하지 않은 tool_id → null 로 교체
   ↓
StudentAttempt.create
```

이 sanitize 안전망 덕분에 LLM 이 실수해도 DB 에는 늘 깨끗한 데이터만 들어갑니다.

### 2.4 채점 결과의 구조

Claude 가 돌려주는 JSON 의 핵심 필드:

```
{
  score: 0~100,
  correctness: 'correct' | 'partial' | 'wrong',
  summary: "한 문장 격려+정정 메시지",
  step_feedback: [
    { step_number, student_step, status, comment, correction }
  ],
  gap_locations: [
    { description, expected_step, tool_id }
  ],
  error_locations: [
    { description, student_wrote, correct_form, error_type, tool_id }
  ],
  alternative_solution: "...",
  confidence: 0~100,
  ocr_quality_concern: "..."
}
```

핵심 포인트:

- **부분 점수가 가능** — correctness 가 'partial' 일 수 있음
- **단계별로 평가** — step_feedback 의 각 step 마다 상태(correct/partial/missing/wrong)
- **매듭(도구) 매핑** — error / gap 의 각 항목에 tool_id 가 붙음 (가능할 때, `<available_tools>` 안의 ID 만 허용 — 2.3 참조) → 매듭 보강 흐름의 신호
- **OCR 신뢰도 자기 평가** — confidence 와 ocr_quality_concern 으로 채점 자체의 자신감 표현

### 2.5 저장되는 데이터

`StudentAttempt` 1 행이 새로 만들어집니다.

```
{
  student_id, student_email,
  problem_id, problem_content (500자 잘라서), problem_domain,
  canvas_image_url 또는 photo_url,    ← 입력 방식에 따라
  ocr_text,                            ← OCR 원본 결과
  ocr_corrected_text: null,            ← 학생이 나중에 수정하면 채움
  claude_grade_json: '{...}',          ← 채점 전체 JSON
  score, correctness,                  ← 빠른 조회용 캐시
  started_at, submitted_at, duration_sec,
  assignment_id: ?,                    ← 숙제면 채워짐
  attempt_type: 'practice' (default)
}
```

기존 데이터는 어떤 것도 변경되지 않습니다. Problem, Assignment 는 read-only.

---

## 3. 실구현 디테일

> 여기부터는 실제로 코드를 만지거나 디버깅할 사람을 위한 부분.

### 3.1 파일 구조

```
src/pages/ProblemSolve.jsx              ← 메인 페이지 (전체 흐름)
src/components/DrawingCanvas.jsx        ← 캔버스 컴포넌트
src/components/LoadingOverlay.jsx       ← 로딩 오버레이 + InlineLoader
src/components/MathRenderer.jsx         ← 문제 본문 LaTeX 렌더

base44/entities/Problem.jsonc           ← 문제 entity
base44/entities/StudentAttempt.jsonc    ← 시도 entity
```

### 3.2 페이지 진입 시 처리

`ProblemSolve.jsx:77-96`

```js
useEffect(() => {
  loadProblem();
  startedAt.current = new Date().toISOString();
}, [id]);

const loadProblem = async () => {
  const p = await base44.entities.Problem.filter({ id }, '-created_date', 1);
  if (p.length > 0) setProblem(p[0]);
  else setError('문제를 찾을 수 없어요.');
};
```

Query 파라미터:

- `?assignment_id=X` — `useSearchParams().get('assignment_id')` 로 추출 (라인 62)
- `?remediation_for=X` — 추출은 됨 (라인 64) **그러나 어디서도 사용 안 함** (알려진 이슈)

### 3.3 DrawingCanvas

prop 시그니처: `<DrawingCanvas onImageReady={fn} penColor='#1e293b' penSize={3} />`

stroke 종료 시 (`mouseup` / `touchend` / `mouseleave`):

```js
canvas.toBlob(blob => onImageReady(blob), 'image/jpeg', 0.7);
```

→ 부모(ProblemSolve)의 `setCanvasBlob` 호출됨.

지우개 모드는 `globalCompositeOperation = 'destination-out'` 으로 픽셀을 지움. stroke 끝나면 `'source-over'` 로 복원 (라인 67-69).

undo: `history` 배열의 마지막 dataURL 을 `<Image>` 로 다시 그림 (최근 20개만 유지).

### 3.4 사진 업로드

```html
<input type="file" accept="image/jpeg,image/png,image/heic,image/*" />
```

크기 검증: `file.size > 10 * 1024 * 1024` 면 토스트 + return (라인 111-114).

미리보기: `URL.createObjectURL(file)` 로 blob URL 만들어 `<img>` 에 표시.

### 3.5 handleSubmit 의 전체 처리 (`ProblemSolve.jsx:153-343`)

```
1. 빈 입력 가드: imageSource 없으면 토스트 후 return
2. submittedAt 기록 + durationSec 계산
3. setStage('ocr') → LoadingOverlay 표시
4. compressImage(blob)
5. UploadFile → file_url
6. OCR (Gemini) → ocrText (unwrap)
7. setStage('grading')

8. relevantTools 추출:
   toolIds = JSON.parse(problem.tool_ids || '[]')
   allTools = await MathTool.list('name', 100)
   relevantTools = allTools.filter(t => toolIds.includes(t.tool_id))

9. toolsBlock 빌드:
   relevantTools.map(t => `- tool_id: "${t.tool_id}"
     name: "${t.name}"
     goal: "${t.goal || ''}"`).join('\n')

10. gradingPrompt 에 <available_tools>${toolsBlock}</available_tools> 주입
    + 시스템 프롬프트의 #8 매듭 매핑 원칙이 "이 목록의 ID 만 사용" 강제

11. Claude 채점 호출 → gradeResult (unwrap)

12. sanitize tool_id:
    validIds = new Set(relevantTools.map(t => t.tool_id))
    error_locations / gap_locations 의 tool_id 가 validIds 에 없으면 null

13. StudentAttempt.create({
      ..., claude_grade_json: JSON.stringify(gradeResult),
      score, correctness,
      assignment_id: assignmentId || null
    })

14. setStage(null) + navigate(`/result/${attempt.id}`)

catch:
  - setStage(null)
  - console.error
  - setError('잠시 문제가 생겼어요. 다시 시도해 주세요')
```

### 3.6 채점 prompt

System prompt 의 8가지 원칙 (`ProblemSolve.jsx:204-219`):

1. 부분점수 일관성
2. 학생 친화 톤 (해요체, "틀렸어요" 금지)
3. 별해 인정
4. 오류 분류 (calculation / conceptual / notation)
5. 할루시 방지
6. OCR 검증 → ocr_quality_concern 명시
7. Actionable feedback
8. **매듭 매핑 (엄격)** — error_locations 와 gap_locations 의 각 항목에서 tool_id 를 채울 때 반드시 `<available_tools>` 안에 있는 tool_id 중 하나만 사용. 어느 것도 맞지 않으면 null. 새 ID 를 만들거나 자유 문자열 금지. `<available_tools>` 가 비어있으면 모두 null.

User message — XML 형태:

```
<problem>{problemText}</problem>
<verified_answer>{problem.verified_answer}</verified_answer>
<agent_solution>{problem.agent_solution}</agent_solution>
<correct_solution_path>{formatSolutionPath(problem.solution_path)}</correct_solution_path>
<available_tools>
- tool_id: "tool_등식의_가감법"
  name: "등식의 가감법"
  goal: "..."
- ...
</available_tools>
<student_ocr_solution>{ocrText}</student_ocr_solution>
```

`formatSolutionPath` 는 JSON 배열을 받아서 `Step N: 도구 = "..."` 형태로 sequence_order 기준 정렬해 직렬화.

`<available_tools>` 는 `problem.tool_ids` 에 들어있는 도구만 추려서 만듦 (위 3.5 의 9단계 참조).

### 3.7 알려진 이슈 / 미결정

- **재시도 자동화 없음** — 명세는 "OCR 실패 시 자동 1회 재시도" 라고 적혀 있지만 코드는 단순 catch. 학생이 수동으로 다시 시도해야 함.
- **`?remediation_for=X` 사용 안 됨** — query 추출만 하고 `remediationFor` 변수를 어디에도 안 씀. StudentAttempt.create payload 에 attempt_type / parent_attempt_id / target_tool_id 가 빠짐. 결과: 단계 1 재풀이가 일반 자유 풀이로 처리됨.
- **이미지 압축 한도** — 1280px max + 0.7 quality. 4K 사진은 압축 후 OCR 정확도 저하 가능.
- **OCR confidence 미활용** — schema 에 confidence 필드는 있지만 ResultView 에서 표시 X (ocr_quality_concern 만 표시).
- **attempt_type 명시 미적용** — 현재 코드는 attempt_type 을 채우지 않음 → entity default 'practice' 로만 저장. 숙제도 'practice' 로 기록.
- **ProblemSolve 자체 가드 없음** — Home / ProblemSelect / History 만 admin/teacher 자동 redirect 함. /problem/:id 직접 진입은 가드 없음.
- **step_feedback 의 tool_id 미정** — 현재 schema 의 step_feedback 항목에는 tool_id 가 없음. error_locations / gap_locations 만 도구 매핑이 됨. 정답 단계 (correct/partial) 가 어떤 도구를 사용했는지 표시 안 됨 → 후속 작업 예정.

### 3.8 QA 체크리스트

#### 정상 흐름

- [ ] /problem/:id 진입 시 문제 본문 LaTeX 까지 정상 렌더
- [ ] 캔버스 → 펜으로 그리기 → 제출 → ResultView 도착
- [ ] 사진 업로드 → 제출 → 동일하게 동작
- [ ] StudentAttempt 1 행 생성 + score / correctness / claude_grade_json 채워짐

#### 입력 동작

- [ ] 펜 / 지우개 토글
- [ ] 펜 stroke 시작점에 작은 점이 찍힘 (arc fill)
- [ ] 지우개 stroke 시 픽셀이 지워짐
- [ ] 되돌리기 — history 빈 경우 disabled
- [ ] 초기화 — 빈 상태 부모에 알림 (`onImageReady(null)`)
- [ ] 사진 미리보기 + "다른 사진 선택"
- [ ] 빈 입력 제출 → 토스트
- [ ] 10MB 초과 사진 → 토스트
- [ ] 캔버스 resize 시 그린 내용 유지

#### 로딩 / 에러

- [ ] OCR 단계 LoadingOverlay (✍️ "필기 인식 중...")
- [ ] 채점 단계 LoadingOverlay (🧮 "채점 중...")
- [ ] 어느 단계든 실패 → 에러 카드 + 다시 시도 링크
- [ ] 잘못된 problem id → "문제를 찾을 수 없어요"

#### 데이터

- [ ] OCR 응답 unwrap (`response ?? raw`) 후 markdown_text 추출
- [ ] 채점 응답 unwrap 후 JSON.stringify 해서 저장
- [ ] `?assignment_id=X` 진입 → assignment_id 채움
- [ ] `?remediation_for=X` 진입 → ★ 현재 무반응 (알려진 이슈)
- [ ] started_at / submitted_at / duration_sec 양수
- [ ] canvas 탭은 canvas_image_url, 사진 탭은 photo_url

#### 채점 정합성

- [ ] step_feedback / gap_locations / error_locations 배열로 도착
- [ ] error / gap 의 tool_id 채워짐 (LLM 매핑 가능 시)
- [ ] correctness 와 score 의 관계 (≥80 correct / 40-79 partial / <40 wrong) — LLM 자체 판단

#### 보안 / 권한

- [ ] 학생은 본인 시도만 ResultView 진입 (다른 학생 시도 차단 — ResultView 가드)
- [ ] Admin / Teacher 는 모든 시도 조회 가능
