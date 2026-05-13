# 문제 풀이 + 채점 (Submission Pipeline) 기능 명세서

## 1. 개요

학생이 수학 문제를 손으로 풀고 (canvas 또는 사진 업로드), 제출하면 OCR(Gemini 2.5 Flash) → 채점(Claude Sonnet 4.6) → 결과 저장 → ResultView 이동의 파이프라인이 자동 실행됩니다. 이 흐름이 KNOTA 의 핵심으로 자유 풀이 / 숙제 풀이 / (계획) 매듭 보강 재풀이 등 모든 학습의 진입점입니다.

- **상위/관련 기능**: ProblemSolve (이 명세서) → ResultView (별도 명세서) → 매듭 보강 / 숙제 흐름 / 내 기록.
- **대상 사용자**: 학생만. (admin/teacher 는 Home / ProblemSelect / History 진입 시 자동 redirect 되지만 ProblemSolve 자체는 명시적 가드 없음.)
- **영향 받는 파일 리스트**:
  - `src/pages/ProblemSolve.jsx` — 문제 풀이 페이지 (전체)
  - `src/components/DrawingCanvas.jsx` — 캔버스 (펜/지우개, history, 빈 안내)
  - `src/components/LoadingOverlay.jsx` — OCR / 채점 진행 표시 (LoadingOverlay + InlineLoader export)
  - `src/components/MathRenderer.jsx` — 문제 본문 LaTeX 렌더
  - `base44/entities/Problem.jsonc` — 문제 entity (verified_answer, agent_solution, solution_path, tool_ids, content)
  - `base44/entities/StudentAttempt.jsonc` — 시도 entity (assignment_id, attempt_type default `practice`, parent_attempt_id, target_tool_id 등)
  - 외부 LLM: Gemini 2.5 Flash (OCR, model id `gemini_3_flash`), Claude Sonnet 4.6 (채점, model id `claude_sonnet_4_6`) — `base44.integrations.Core.InvokeLLM`

## 2. 화면 구상도 (텍스트 wireframe)

- **URL**: `/problem/:id`
- **Query 파라미터**:
  - `?assignment_id=X` — 숙제 풀이 진입 (StudentAttempt.assignment_id 채움)
  - `?remediation_for=X` — 매듭 보강 재풀이 진입. **현재 query 추출만 하고 사용 안 함** (`ProblemSolve.jsx:64`, 6번 미결정 참조)

### 화면 영역 구조

```
┌──────────────────────────────────────────────────┐
│ [←] [{domain_name}] 배지                            │  ProblemSolve.jsx:355-367
│ 문제                                               │
├──────────────────────────────────────────────────┤
│ [영역 1] 문제 본문 카드 (blue-50/50 톤)             │  ProblemSolve.jsx:370-374
│   - MathRenderer (LaTeX 렌더)                      │
├──────────────────────────────────────────────────┤
│ [영역 2] 에러 카드 (제출 실패 시)                    │  ProblemSolve.jsx:376-386
│   - "잠시 문제가 생겼어요. 다시 시도해 주세요"        │
│   - "다시 시도" link Button (handleSubmit 재실행)    │
├──────────────────────────────────────────────────┤
│ [영역 3] 입력 영역 Tabs                             │  ProblemSolve.jsx:388-432
│   ┌─[✍️ 필기로 풀기]─┬─[📷 사진으로 올리기]─┐         │
│   │ 캔버스 탭 — DrawingCanvas              │
│   │   ─ 펜 / 지우개 토글 (Button group)     │
│   │   ─ 흰 캔버스 (border-dashed, h=280)   │
│   │   ─ "여기에 풀이를 적어 주세요" placeholder │
│   │   ─ [되돌리기] [초기화]                  │
│   │                                       │
│   │ 사진 탭 (TabsContent value='photo')    │
│   │   ─ 점선 박스 — 클릭 시 file input     │
│   │   ─ 미리보기 이미지 (선택 후)            │
│   │   ─ [Upload 다른 사진 선택] 버튼        │
└──────────────────────────────────────────────────┤
│ [영역 4] 액션 버튼                                  │  ProblemSolve.jsx:435-443
│   [메인으로]  [Send 제출]                            │
└──────────────────────────────────────────────────┘

[로딩 오버레이 — stage state 에 따라 표시]
  stage='ocr'     → "필기 인식 중..." + sub "Gemini가 손글씨를 읽고 있어요" + ✍️ 아이콘
  stage='grading' → "채점 중..." + sub "AI가 풀이를 꼼꼼히 확인하고 있어요" + 🧮 아이콘
  (LoadingOverlay.jsx STAGES 참조)
```

### 데이터 출처

- 문제: `Problem.filter({id: params.id}, '-created_date', 1)` → 첫 row (`ProblemSolve.jsx:85-86`)
- 사용자: `useAuth().user`
- query: `useSearchParams()` 으로 `assignment_id` / `remediation_for` 추출 (`ProblemSolve.jsx:62-64`)

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| 진입 직후 — 문제 fetch 중 | `<InlineLoader message="문제 불러오는 중..."/>` (`ProblemSolve.jsx:345`) |
| 문제 fetch 실패 (catch) | "문제를 불러오지 못했어요." 에러 카드 (setError) |
| 잘못된 problem id (filter 0건) | "문제를 찾을 수 없어요." 에러 카드 |
| 입력 — canvas 탭, 빈 화면 | 캔버스 위 "여기에 풀이를 적어 주세요" 안내 + ✏️ 아이콘 (history.length===0 일 때) |
| 입력 — canvas 탭, 그리는 중 | stroke 그려짐. history 누적 (최근 20개, slice(-19)). saveState 매 startDraw + clear 시 호출 |
| 입력 — 사진 탭, 미선택 | 점선 박스 + Image 아이콘 + "사진을 탭해서 업로드하세요\nJPEG, PNG, HEIC (최대 10MB)" |
| 입력 — 사진 탭, 선택 후 | photoPreview 이미지 (URL.createObjectURL) + [Upload 다른 사진 선택] 버튼 |
| 제출 — OCR 단계 | stage='ocr' → `<LoadingOverlay stage="ocr"/>` 전체 화면 |
| 제출 — 채점 단계 | stage='grading' → `<LoadingOverlay stage="grading"/>` 전체 화면 |
| 제출 성공 | `navigate('/result/${attempt.id}')` |
| 제출 실패 | LoadingOverlay 사라짐 (`setStage(null)`), error 카드 표시. 학생이 "다시 시도" link 로 재시도 가능 |

## 4. 동작

### 4.1 화면 로드

| 조건 | 동작 |
| --- | --- |
| `/problem/:id` 진입 | 1. useEffect 에서 `loadProblem()` + `startedAt.current = new Date().toISOString()` 기록.<br>2. `Problem.filter({id}, '-created_date', 1)` → 첫 row 를 setProblem.<br>3. `useSearchParams()` 로 assignment_id / remediation_for 추출. |
| Admin / Teacher 가 ProblemSolve 직접 진입 | 가드 없음. Home / ProblemSelect / History 만 useEffect 로 자동 redirect 함. (가드 일관성 부재 — 점검 필요.) |

### 4.2 입력 — DrawingCanvas

DrawingCanvas prop: `onImageReady` (필수), `penColor` (default `#1e293b`), `penSize` (default 3). RemediationPractice 는 `value`/`onChange` prop 으로 호출 — 그건 잘못된 사용 (Remediation 명세서 참조).

| 조건 (액션) | 동작 |
| --- | --- |
| 펜 모드 stroke 시작 (mousedown / touchstart) | saveState() (history 에 dataURL push, 최근 20개만 유지). 시작점에 `arc(pos, penSize/2)` 로 fill (점 하나라도 찍히게). isDrawing=true |
| 펜 모드 stroke (mousemove / touchmove) | `globalCompositeOperation='source-over'`, `strokeStyle=penColor (#1e293b)`, `lineWidth=penSize (3)`, `lineCap='round'`, `lineJoin='round'`. lineTo + stroke |
| 지우개 모드 stroke | `globalCompositeOperation='destination-out'`, `lineWidth=eraserSize (20)`, strokeStyle 은 임의 (destination-out 이라 픽셀이 지워짐). stroke 후 globalCompositeOperation 을 'source-over' 로 복원 |
| stroke 종료 (mouseup / touchend / mouseleave) | `setIsDrawing(false)`. `canvas.toBlob(b => onImageReady(b), 'image/jpeg', 0.7)` 으로 부모에 blob 전달 |
| [되돌리기] 클릭 | history 의 마지막 dataURL pop → Image.onload 에서 clearRect + drawImage. 그 후 `canvas.toBlob` 으로 onImageReady 갱신. history 빈 경우 disabled |
| [초기화] 클릭 | saveState() → clearRect → `onImageReady(null)` (빈 상태를 부모에 알림) |
| 화면 resize | ResizeObserver 가 `canvas.parentElement` 관찰. resize 시 dataURL 백업 → canvas.width/height 를 `offsetWidth*devicePixelRatio` 로 갱신 → 백업 이미지 redraw |

### 4.3 입력 — 사진 업로드

| 조건 | 동작 |
| --- | --- |
| 점선 박스 클릭 | 숨겨진 file input 클릭 (`accept="image/jpeg,image/png,image/heic,image/*"`) |
| 파일 선택 (`ProblemSolve.jsx:108-118`) | 1. `file.size > 10*1024*1024` 면 `toast.error('파일 크기는 10MB 이하여야 해요.')` + return.<br>2. `setPhotoFile(file)` + `setPhotoPreview(URL.createObjectURL(file))` |

### 4.4 제출 흐름 (handleSubmit) (`ProblemSolve.jsx:153-343`)

| 조건 | 동작 |
| --- | --- |
| 빈 입력 (canvas blob / photo file 모두 null) | `toast.error('풀이를 작성해 주세요')` + return |
| problem 또는 user null | 조용히 return |
| 정상 제출 | 1. `setError(null)` + submittedAt 기록 + `durationSec = round((submitted - started) / 1000)`.<br>2. `setStage('ocr')` → LoadingOverlay 표시.<br>3. **compressImage**: blob 을 ImageElement 로 그려서 maxSize=1280px (긴 쪽 기준 비율 유지) + JPEG 0.7 quality 로 변환. 실패 시 원본을 File 로 wrap.<br>4. `base44.integrations.Core.UploadFile({file: compressed})` → `imageUrl`.<br>5. **OCR 호출**: `InvokeLLM({prompt: ocrPrompt, file_urls:[imageUrl], model:'gemini_3_flash', response_json_schema:{markdown_text, confidence, notes}})`.<br>&nbsp;&nbsp;&nbsp;응답 unwrap: `ocrRaw?.response ?? ocrRaw` → `ocrText = result.markdown_text \|\| ''`.<br>&nbsp;&nbsp;&nbsp;빈 문자열이면 throw 'OCR 결과가 없어요'.<br>6. `setStage('grading')`.<br>7. **채점 호출**: `InvokeLLM({prompt: gradingPrompt, model:'claude_sonnet_4_6', response_json_schema: GradingOutput})`.<br>&nbsp;&nbsp;&nbsp;응답 unwrap: `gradeRaw?.response ?? gradeRaw`.<br>8. **StudentAttempt.create** payload (`ProblemSolve.jsx:318-334`):<br>&nbsp;&nbsp;&nbsp;{ student_id, student_email, problem_id, problem_content (slice(0,500)), problem_domain,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[activeTab==='canvas' ? 'canvas_image_url' : 'photo_url']: imageUrl,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ocr_text, ocr_corrected_text: null,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;claude_grade_json: JSON.stringify(gradeResult), score: gradeResult.score \|\| 0, correctness: gradeResult.correctness \|\| 'wrong',<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;started_at: startedAt.current, submitted_at, duration_sec,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;assignment_id: assignmentId \|\| null }<br>9. `setStage(null)` + `navigate('/result/${attempt.id}')`. |
| 어느 단계든 throw | catch 에서 `setStage(null)` + `console.error(err)` + `setError('잠시 문제가 생겼어요. 다시 시도해 주세요')`. error 카드 표시. 학생이 "다시 시도" 로 handleSubmit 재호출 가능 |

> ★ create payload 에 `attempt_type`, `parent_attempt_id`, `target_tool_id` 필드 빠짐 — entity default 로 attempt_type='practice'. remediation_for query 가 있어도 그 필드가 채워지지 않음.

### 4.5 채점 (Grading Prompt + Schema)

**System prompt** (한국어, `ProblemSolve.jsx:204-219`):
- 채점 원칙 8가지: (1) 부분점수 일관성, (2) 학생 친화 톤 (해요체, "틀렸어요" 금지), (3) 별해 인정, (4) 오류 분류 (calculation/conceptual/notation), (5) 할루시 방지, (6) OCR 검증 (`ocr_quality_concern` 명시), (7) Actionable feedback, (8) **매듭(도구) 매핑** — error_locations / gap_locations 의 각 항목에 `tool_id` 명시.
- 점수 기준 7단계 (100 / 80-99 / 60-79 / 40-59 / 20-39 / 1-19 / 0).
- 톤 — 정합 표현 / 금지 표현.

**User message** — XML 형태:
```
<problem>{problemText}</problem>
<verified_answer>{problem.verified_answer || '(검증된 정답 없음)'}</verified_answer>
<agent_solution>{problem.agent_solution || '(agent 풀이 없음)'}</agent_solution>
<correct_solution_path>{formatSolutionPath(problem.solution_path)}</correct_solution_path>
<student_ocr_solution>{ocrText}</student_ocr_solution>
```

`formatSolutionPath` — JSON 또는 array 를 받아 `Step N: 도구 = "..."` 형태로 sequence_order 정렬해 직렬화.

**GradingOutput schema** — `response_json_schema` 로 강제 (`ProblemSolve.jsx:259-312`):
- `schema_version`: enum `['v1']`
- `score`: int 0-100
- `correctness`: enum `correct` / `partial` / `wrong`
- `summary`: 1-2 문장 한국어 격려+정정 요약 (해요체)
- `step_feedback[]`: { step_number, student_step, status (correct/partial/missing/wrong), comment, correction }
- `gap_locations[]`: { description, expected_step, **tool_id** (불명확 시 null) }
- `error_locations[]`: { description, student_wrote, correct_form, error_type (calculation/conceptual/notation), **tool_id** (불명확 시 null) }
- `alternative_solution`: string
- `confidence`: int 0-100
- `ocr_quality_concern`: string

required: `schema_version, score, correctness, summary, step_feedback, gap_locations, error_locations, confidence`.

→ 채점 후 unwrap (`gradeRaw?.response ?? gradeRaw`) → StudentAttempt 에 `JSON.stringify` 해서 저장.

### 4.6 데이터 변경

- **Create**: `StudentAttempt` 1 row.
- **Update / Delete**: 없음.
- Problem entity / Assignment entity 는 read-only.

## 5. 에러

| 조건 | 사용자 표시 | 시스템 처리 |
| --- | --- | --- |
| 문제 fetch 실패 (API / 네트워크) | "문제를 불러오지 못했어요." | `loadProblem` catch → setError + setLoading(false) |
| 잘못된 problem id (filter 0건) | "문제를 찾을 수 없어요." | filter 결과 0 일 때 setError |
| 빈 입력 제출 | `toast.error('풀이를 작성해 주세요')` | handleSubmit 초기 가드 |
| 사진 파일 > 10MB | `toast.error('파일 크기는 10MB 이하여야 해요.')` | handlePhotoSelect 의 검증 |
| UploadFile / OCR / 채점 / Create 실패 | error 카드 + "다시 시도" link Button | handleSubmit catch → `setStage(null)` + setError |
| OCR 결과 빈 문자열 | error 카드 | `throw new Error('OCR 결과가 없어요')` → catch |
| 채점 응답 schema 위반 (score / correctness undefined) | StudentAttempt.create 시 fallback (`score: 0`, `correctness: 'wrong'`) 으로 저장. 학생은 결과 보지만 0점 wrong 으로 표시 | base44 `response_json_schema` 가 어느 정도 강제하긴 하지만 — fallback 처리는 의도된 안전망 |

## 6. 미결정 / 보류

- **재시도 자동화**: 명세는 "OCR 실패 시 자동 1회 retry" 라고 적혀있지만 코드는 단순 catch. 학생이 수동으로 "다시 시도" 눌러야 함.
- **`?remediation_for=X` query 처리**: query 추출 (`ProblemSolve.jsx:64` `remediationFor`) 은 하지만 그 변수를 어디서도 사용 안 함. StudentAttempt.create 에 `attempt_type / parent_attempt_id / target_tool_id` 가 빠져 있음. 단계 1 재풀이가 일반 자유 풀이로 처리됨 — ResultView 의 `remediation_retry` 분기 발동 X. **점검 필요**.
- **이미지 압축 한도**: maxSize=1280px + 0.7 quality. 큰 4K 사진은 압축 후 OCR 정확도 저하 가능. 한도 조정 검토.
- **OCR confidence 활용**: schema 의 confidence 가 있고 ocr_quality_concern 만 ResultView 에 표시 — confidence 값 자체는 화면에 노출 안 됨 (예: confidence < 70 일 때 별도 안내 등).
- **자유 풀이 vs 숙제 의 attempt_type**: 현재 코드는 attempt_type 을 명시적으로 채우지 않음 — entity default `'practice'` 로만 저장. 숙제 풀이를 `'homework'` 로 구분하는 의도 같지만 — 현재 모든 자유/숙제 시도가 'practice' 로 기록.
- **rate limit (학생당 제출 한도)**: 별도 정책 명시 안 됨 — base44 자체의 InvokeLLM 한도에 의존.

## 7. 검증 (QA 체크리스트)

### 정상 흐름
- [ ] `/problem/:id` 진입 시 문제 본문이 LaTeX 까지 정상 렌더
- [ ] 캔버스에서 펜 그리기 → 제출 → OCR → 채점 → ResultView 이동
- [ ] 사진 업로드 → 제출 → 동일 흐름
- [ ] StudentAttempt 1 row create + score / correctness / claude_grade_json / canvas_image_url(또는 photo_url) 채워짐

### 입력 동작
- [ ] 펜 / 지우개 토글 동작
- [ ] 펜 stroke 시작 시 시작점에 작은 점 fill 표시
- [ ] 지우개 stroke 시 픽셀이 지워짐 (destination-out)
- [ ] 되돌리기 / 초기화 동작 (history.length===0 일 때 되돌리기 disabled)
- [ ] 사진 미리보기 + "다른 사진 선택"
- [ ] 빈 입력 제출 toast + 중단
- [ ] 10MB 초과 사진 toast + 중단
- [ ] 캔버스 resize 시 그린 내용 유지 (ResizeObserver)

### 로딩 / 에러
- [ ] 제출 시 LoadingOverlay 의 stage='ocr' "필기 인식 중..." + ✍️
- [ ] OCR 끝 후 stage='grading' "채점 중..." + 🧮
- [ ] OCR / 채점 실패 시 error 카드 + "다시 시도" link → handleSubmit 재실행
- [ ] 잘못된 problem id 진입 시 "문제를 찾을 수 없어요"

### 데이터 검증
- [ ] StudentAttempt 의 ocr_text 에 unwrap 적용 (`.response`) 후 markdown_text 가 채워짐
- [ ] claude_grade_json 에 unwrap 적용 후 JSON.stringify 결과가 저장
- [ ] `?assignment_id=X` query 가 있는 채로 진입 시 StudentAttempt.assignment_id 가 채워짐
- [ ] `?remediation_for=X` query 가 있는 채로 진입 시 ★ attempt_type / parent_attempt_id 가 미반영 (현재 알려진 버그)
- [ ] started_at, submitted_at, duration_sec 모두 정상 기록 (양수)
- [ ] canvas 탭 → canvas_image_url, 사진 탭 → photo_url 에 저장

### 채점 검증
- [ ] gradeResult.step_feedback / gap_locations / error_locations 정상 반환
- [ ] error / gap 의 tool_id 가 채워짐 (LLM 매핑 가능 시)
- [ ] correctness 와 score 의 정합성 (≥80 correct / 40-79 partial / <40 wrong) — LLM 의 자체 판단에 의존

### 회귀 / 보안
- [ ] 학생이 자기 시도만 ResultView 로 진입 가능 (다른 학생 시도 차단 — ResultView 의 권한 체크)
- [ ] Admin / Teacher 는 모든 학생 시도 조회 가능
- [ ] 시도 row 에 problem_id, assignment_id 정확히 기록
