# 채점 결과 화면 기능 명세서

## 1. 개요

채점 결과 화면(ResultView)은 학생이 ProblemSolve 화면에서 수학 풀이를 제출한 후, 해당 풀이에 대한 AI 채점 결과를 상세하게 확인하고 피드백을 받을 수 있는 화면입니다. 이 화면은 학생의 풀이 점수, 단계별 피드백, 풀이 과정 중 발생한 오류 및 누락된 부분, 그리고 OCR(광학 문자 인식) 인식 결과를 보여줍니다. 또한, 학생이 OCR 인식 결과를 직접 수정하여 재채점을 요청할 수 있는 기능을 제공하여, OCR 오류로 인한 오채점을 보정할 수 있도록 합니다.

- **상위/관련 기능과의 관계**: ProblemSolve에서 풀이가 제출된 후 이동하는 화면이며, StudentAttempt entity의 데이터를 기반으로 합니다. ProblemSolve에서 풀이 제출 시 StudentAttempt 레코드가 생성됩니다.
- **대상 사용자**: 학생 (자신의 풀이 결과에 한해), 관리자 (모든 학생의 풀이 결과 열람 및 수정 가능)
- **영향 받는 파일 리스트**:
  - `src/pages/ResultView.jsx`
  - `src/pages/ProblemSolve.jsx`
  - `src/components/ScoreBadge.jsx`
  - `src/components/MathRenderer.jsx`
  - `base44/entities/StudentAttempt.jsonc`
  - `base44/entities/Problem.jsonc`

## 2. 화면 구상도 (텍스트 wireframe)

- **URL 경로**: `/result/:id` (여기서 `:id`는 StudentAttempt의 ID입니다.)
- **모바일 / 데스크탑 양식 차이**: 반응형 디자인으로, AppLayout 내에서 콘텐츠가 유동적으로 배치됩니다. 특정 데스크탑/모바일 전용 레이아웃 차이는 없습니다.

### 화면 영역 구조

```
┌──────────────────────────────────────────────────┐
│ [홈으로] 버튼                                       │  src/pages/ResultView.jsx:251
├──────────────────────────────────────────────────┤
│ [영역 1] 점수 카드 (Card)                            │  src/pages/ResultView.jsx:256
│   - {점수}점 (예: 85점)                              │  src/pages/ResultView.jsx:260
│   - [ScoreSummaryText] (격려/총평 메시지)             │  src/pages/ResultView.jsx:263
│   - (선택) AI 총평 메시지 (grading.summary)          │  src/pages/ResultView.jsx:265
├──────────────────────────────────────────────────┤
│ [영역 2] (선택) OCR 인식 의문 경고 (Card)             │  src/pages/ResultView.jsx:271
│   - "필기 인식에 의문이 있어요" 헤더                   │
│   - AI가 제시하는 구체적인 우려 내용                   │
│     (ocr_quality_concern)                          │
├──────────────────────────────────────────────────┤
│ [영역 3] (선택) 채점 자신감 부족 경고 (Card)          │  src/pages/ResultView.jsx:282
│   - "채점 자신감이 낮아요 (XX점). 관리자가 검토할       │
│     거예요." 메시지                                  │
├──────────────────────────────────────────────────┤
│ [영역 4] 단계별 피드백 (StepCard 리스트)              │  src/pages/ResultView.jsx:290
│   - 헤더: "단계별 피드백"                             │
│   - 각 StepCard:                                    │  src/pages/ResultView.jsx:47
│     - {단계 번호}단계 (예: 1단계)                     │
│     - [StepStatusBadge] (정답/부분정답/누락/오답)     │
│     - 학생 풀이 요약                                  │
│     - 확장/축소 버튼 ([ChevronUp]/[ChevronDown])      │
│     - (확장 시) 학생 풀이 (MathRenderer)              │
│     - (확장 시) 피드백 메시지                          │
│     - (확장 시) 정정 풀이 (MathRenderer)              │
├──────────────────────────────────────────────────┤
│ [영역 5] (선택) 빠진 단계 (Gap Locations 리스트)      │  src/pages/ResultView.jsx:300
│   - 헤더: "빠진 단계"                                 │
│   - 각 항목:                                        │
│     - "여기에 단계가 빠졌어요"                         │
│     - 빠진 단계에 대한 설명 (gap.description)         │
│     - (선택) 예상되는 단계 (MathRenderer)             │
├──────────────────────────────────────────────────┤
│ [영역 6] (선택) 오류 위치 (Error Locations 리스트)    │  src/pages/ResultView.jsx:320
│   - 헤더: "오류 위치"                                 │
│   - 각 항목:                                        │
│     - 오류 유형 (계산/개념/표기 오류)                  │
│     - 오류 설명 (err.description)                    │
│     - 학생이 쓴 풀이 (MathRenderer)                   │
│     - 올바른 풀이 (MathRenderer)                      │
├──────────────────────────────────────────────────┤
│ [영역 7] (선택) 다른 방법도 있어요! (버튼 토글)         │  src/pages/ResultView.jsx:348
│   - (확장 시) 다른 풀이 (MathRenderer)                │
├──────────────────────────────────────────────────┤
│ [영역 8] OCR 인식 결과 보기 (버튼 토글)               │  src/pages/ResultView.jsx:365
│   - (확장 시) 현재 인식된 OCR 텍스트 표시              │  src/pages/ResultView.jsx:376
│   - "OCR이 잘못됐어요" 버튼                           │  src/pages/ResultView.jsx:380
│   - (버튼 클릭 시) OCR 수정용 Textarea               │  src/pages/ResultView.jsx:395
│   - "취소" 버튼 및 "수정해서 다시 채점" 버튼            │  src/pages/ResultView.jsx:402
├──────────────────────────────────────────────────┤
│ [영역 9] 액션 버튼 그룹                              │  src/pages/ResultView.jsx:415
│   - [메인으로] 버튼                                   │
│   - [다시 풀기] 버튼                                  │
│   - [다음 문제] 버튼                                  │
└──────────────────────────────────────────────────┘
```

### 각 영역 데이터 출처

- `:id` 파라미터를 통해 StudentAttempt entity (`base44.entities.StudentAttempt.filter({ id }, '-created_date', 1)`)를 조회합니다. (`src/pages/ResultView.jsx:121`)
- `attempt.claude_grade_json` 필드의 JSON 파싱 결과(`grading` 상태 변수)에서 채점 상세 데이터(`score`, `summary`, `step_feedback`, `gap_locations`, `error_locations`, `alternative_solution`, `confidence`, `ocr_quality_concern`)를 가져옵니다. (`src/pages/ResultView.jsx:131-134`)
- `attempt.score`, `attempt.correctness` 필드를 직접 사용합니다. (`src/pages/ResultView.jsx:237`)
- `attempt.ocr_corrected_text` 또는 `attempt.ocr_text` 필드를 OCR 결과 표시 및 수정에 사용합니다. (`src/pages/ResultView.jsx:137`)
- Problem entity (`problem_id`를 통해 조회)에서 문제 내용(`problem_content`)을 가져와 재채점 시 프롬프트에 활용합니다. (`src/pages/ResultView.jsx:149, 199`)

## 3. 상태

| 조건 | 상태 |
| --- | --- |
| 로딩 중 | 화면 전체에 `<InlineLoader message="결과 불러오는 중..." />` 표시 (`src/pages/ResultView.jsx:234`). |
| 결과 없음 | StudentAttempt를 찾을 수 없을 때 "결과를 찾을 수 없어요." 메시지 표시 (`src/pages/ResultView.jsx:235`). |
| 권한 부족 | 현재 로그인한 사용자의 `id`가 `StudentAttempt.student_id`와 일치하지 않고 `user.role`이 `'admin'`이 아닐 경우: `toast.error('이 결과를 볼 권한이 없어요')` 메시지 표시 후 `/home`으로 리디렉션 (`src/pages/ResultView.jsx:124-129`). |
| 정상 표시 (Success) | StudentAttempt 로드 및 `claude_grade_json`이 성공적으로 파싱된 후 채점 결과 상세 정보 표시 (`src/pages/ResultView.jsx:246-429`). |
| 재채점 진행 중 (Partial) | `regrading` 상태가 true일 때 `<LoadingOverlay stage="grading" />` 표시 (`src/pages/ResultView.jsx:248`). |
| OCR 인식 의문 | `grading.ocr_quality_concern` 필드가 존재할 경우 주황색 경고 카드 표시 (`src/pages/ResultView.jsx:271-279`). |
| 채점 자신감 낮음 | `grading.confidence`가 70 미만일 경우 회색 경고 카드 표시 (`src/pages/ResultView.jsx:282-286`). |
| OCR 텍스트 수정 모드 | "OCR이 잘못됐어요" 버튼 클릭 시 `editingOCR`이 true로 설정되며, OCR 텍스트가 Textarea 입력 필드로 대체되고 "수정해서 다시 채점" 및 "취소" 버튼이 표시됨 (`src/pages/ResultView.jsx:392-409`). |
| OCR 텍스트 일반 표시 모드 | `editingOCR`이 false일 때, 저장된 `ocr_corrected_text`(없으면 `ocr_text`)가 `<pre>` 태그 내에 표시됨 (`src/pages/ResultView.jsx:374-379`). |
| 대안 풀이 표시 | "이런 방법도 있어요! 💡" 버튼 클릭 시 `showAlt` 상태 토글, `grading.alternative_solution` 내용을 확장/축소하여 표시 (`src/pages/ResultView.jsx:348-360`). |
| OCR 결과 표시 | "OCR 인식 결과 보기" 버튼 클릭 시 `showOCR` 상태 토글, OCR 인식 결과 섹션을 확장/축소하여 표시 (`src/pages/ResultView.jsx:365-411`). |

## 4. 동작

| 조건 (사용자 액션) | 동작 (시스템 반응) |
| --- | --- |
| 초기 화면 로드 | 1. `id` 파라미터를 사용하여 `base44.entities.StudentAttempt.filter` 호출 (StudentAttempt entity 조회) (`src/pages/ResultView.jsx:121`).<br>2. `useAuth`의 `user` 객체를 사용하여 `StudentAttempt.student_id`와 `user.id`를 비교하고, `user.role === 'admin'` 여부를 확인하여 권한 체크 (client-side) (`src/pages/ResultView.jsx:124-125`).<br>3. `attempt.claude_grade_json`이 있으면 JSON 파싱하여 `grading` 상태 업데이트 (`src/pages/ResultView.jsx:131-135`).<br>4. `attempt.ocr_corrected_text` 또는 `attempt.ocr_text`로 `correctedText` 상태 초기화 (`src/pages/ResultView.jsx:137`).<br>5. `loading` 상태를 `false`로 변경하고 화면 표시. |
| `OCR이 잘못됐어요` 버튼 클릭 | 1. 현재 `ocr_corrected_text` 또는 `ocr_text` 값을 `correctedText` state에 설정 (`src/pages/ResultView.jsx:385`).<br>2. `editingOCR` 상태를 `true`로 설정하여 OCR 수정 Textarea와 관련 버튼 표시 (`src/pages/ResultView.jsx:386`). |
| `취소` 버튼 클릭 (OCR 수정 모드) | 1. `editingOCR` 상태를 `false`로 설정하여 OCR 텍스트 일반 표시 모드로 돌아감 (`src/pages/ResultView.jsx:402`). |
| `수정해서 다시 채점` 버튼 클릭 | 1. `correctedText`의 유효성 검증: 비어있으면 `toast.error('풀이를 작성해 주세요')` (`src/pages/ResultView.jsx:145`).<br>2. `regrading` 상태를 `true`로 설정하여 로딩 오버레이 표시 (`src/pages/ResultView.jsx:146`).<br>3. `REGRADE_PROMPT_TEMPLATE`를 사용하여 Claude LLM (`claude_sonnet_4_6` 모델)에 재채점 요청 (`base44.integrations.Core.InvokeLLM` 호출) (`src/pages/ResultView.jsx:148-201`).<br>4. 채점 결과 (`result`)를 사용하여 StudentAttempt entity 업데이트 (`base44.entities.StudentAttempt.update` 호출) (`src/pages/ResultView.jsx:207`).<br>&nbsp;&nbsp;&nbsp;- `ocr_corrected_text` 필드에 수정된 텍스트 저장.<br>&nbsp;&nbsp;&nbsp;- `claude_grade_json`, `score`, `correctness` 필드 업데이트.<br>5. `grading`, `attempt` 상태 업데이트.<br>6. `editingOCR` 상태를 `false`로, `regrading` 상태를 `false`로 변경.<br>7. `toast.success('다시 채점됐어요!')` 메시지 표시 (`src/pages/ResultView.jsx:217`).<br>8. **DB 변경**: StudentAttempt entity의 해당 레코드의 `ocr_corrected_text`, `claude_grade_json`, `score`, `correctness` 필드가 변경됨. |
| `메인으로` 버튼 클릭 | `/home` 경로로 화면 전환 (`navigate('/home')`) (`src/pages/ResultView.jsx:416`). |
| `다시 풀기` 버튼 클릭 | 현재 문제의 `problem_id`를 사용하여 `/problem/:problem_id` 경로로 화면 전환 (`navigate(\`/problem/${attempt.problem_id}\`)`) (`src/pages/ResultView.jsx:420`). |
| `다음 문제` 버튼 클릭 | 1. `base44.entities.Problem.list('-created_date', 100)` 호출하여 임의의 문제 100개 목록을 가져옴 (`src/pages/ResultView.jsx:227`).<br>2. 목록에서 랜덤으로 하나의 문제를 선택 (`src/pages/ResultView.jsx:229`).<br>3. `/problem/:problem_id` 경로로 화면 전환 (`navigate(\`/problem/${problems[idx].id}\`)`) (`src/pages/ResultView.jsx:230`).<br>4. **API 호출**: `base44.entities.Problem.list`. |
| `OCR 인식 결과 보기` 토글 버튼 클릭 | `showOCR` 상태를 토글하여 OCR 결과 섹션의 확장/축소 상태를 변경 (`src/pages/ResultView.jsx:368`). |
| `이런 방법도 있어요! 💡` 토글 버튼 클릭 | `showAlt` 상태를 토글하여 다른 풀이 섹션의 확장/축소 상태를 변경 (`src/pages/ResultView.jsx:352`). |

## 5. 에러

| 조건 | 사용자에게 표시 | 시스템 처리 |
| --- | --- | --- |
| StudentAttempt 조회 실패 (404) | "결과를 찾을 수 없어요." 메시지 (`src/pages/ResultView.jsx:235`). | 해당 화면에 콘텐츠를 표시하지 않고 메시지만 보여줌. |
| 권한 부족으로 결과 접근 시도 (403) | `toast.error('이 결과를 볼 권한이 없어요')` (`src/pages/ResultView.jsx:126`). | `/home` 경로로 리디렉션 (client-side) (`src/pages/ResultView.jsx:127`). |
| 재채점 시 OCR 텍스트 입력 누락 | `toast.error('풀이를 작성해 주세요')` (`src/pages/ResultView.jsx:153`). | 재채점 API 호출을 중단. |
| 재채점 API 호출 실패 (LLM 에러, 네트워크 등) | `toast.error('다시 채점 중 문제가 생겼어요. 다시 시도해 주세요')` (`src/pages/ResultView.jsx:220`). | `console.error`에 에러 로그 기록 (`src/pages/ResultView.jsx:219`). `regrading` 상태를 `false`로 변경. |
| ProblemSolve에서 OCR 결과 없음 (`handleSubmit`) | `toast.error('풀이를 작성해 주세요')` (`src/pages/ProblemSolve.jsx:153`). | `handleSubmit` 함수를 중단. |
| ProblemSolve에서 이미지 업로드 파일 크기 초과 | `toast.error('파일 크기는 10MB 이하여야 해요.')` (`src/pages/ProblemSolve.jsx:109`). | 이미지 선택을 중단. |
| ProblemSolve에서 문제 로드 실패 | "문제를 불러오지 못했어요." 메시지 (`src/pages/ProblemSolve.jsx:89`). | `loading` 상태를 `false`로 변경하고 메시지 표시. |
| ProblemSolve에서 제출 API 호출 실패 | "잠시 문제가 생겼어요. 다시 시도해 주세요" 메시지 (`src/pages/ProblemSolve.jsx:334`). | `console.error`에 에러 로그 기록 (`src/pages/ProblemSolve.jsx:333`). |

## 6. 미결정 / 양식 보류 사항

- 현재 `REGRADE_PROMPT_TEMPLATE` 및 `GradingOutput` JSON 스키마는 `ResultView.jsx` 코드에 하드코딩되어 있습니다. 추후 LLM 프롬프트 및 스키마 변경 시 코드 배포가 필요하며, 이를 동적으로 관리할 방법(예: 백엔드에서 프롬프트 템플릿 제공)에 대한 논의가 필요합니다.
- '다음 문제' 기능은 현재 Problem entity의 최신 100개 레코드에서 랜덤으로 선택합니다. 문제 수가 많아질 경우 성능 저하 또는 특정 문제가 반복될 수 있으며, 이를 개선하기 위한 더 효율적인 문제 추천 로직(예: 학생의 학습 이력 기반) 구현에 대한 논의가 필요합니다.
- AppLayout 내에서 로딩 오버레이가 표시되는데, 전체 페이지를 덮는 `LoadingOverlay`와 AppLayout 내부에 표시되는 `InlineLoader`의 사용 일관성에 대한 검토가 필요합니다.

## 7. 검증 (QA 체크리스트)

### 정상 흐름

- [ ] ProblemSolve에서 풀이 제출 후 ResultView로 올바르게 이동하는가?
- [ ] ResultView 화면이 모든 채점 결과(점수, 총평, 단계별 피드백, 오류 위치 등)를 정확하게 표시하는가?
- [ ] MathRenderer가 수학 풀이를 올바르게 렌더링하는가?
- [ ] ScoreSummaryText와 StepStatusBadge가 점수 및 단계 상태에 따라 올바르게 표시되는가?
- [ ] `메인으로`, `다시 풀기`, `다음 문제` 버튼이 올바르게 작동하는가?

### 로딩 상태

- [ ] ResultView 진입 시 InlineLoader가 올바르게 표시되는가?
- [ ] OCR 텍스트 수정 후 재채점 시 LoadingOverlay (`stage="grading"`)가 올바르게 표시되는가?

### Empty / Not Found 상태

- [ ] 유효하지 않은 StudentAttempt ID로 접근 시 "결과를 찾을 수 없어요." 메시지가 표시되는가?

### 권한 관련

- [ ] 다른 학생의 StudentAttempt ID로 직접 접근 시도 시 `toast.error('이 결과를 볼 권한이 없어요')` 메시지가 뜨고 `/home`으로 리디렉션되는가? (admin 계정 제외)
- [ ] admin 계정으로 모든 학생의 결과에 접근할 수 있는가?

### 경고 메시지

- [ ] `grading.ocr_quality_concern`이 있을 때 "필기 인식에 의문이 있어요" 경고가 올바르게 표시되는가?
- [ ] `grading.confidence`가 70 미만일 때 "채점 자신감이 낮아요" 경고가 올바르게 표시되는가?

### OCR 수정 기능

- [ ] "OCR 인식 결과 보기" 토글 버튼이 정상 작동하여 OCR 섹션을 확장/축소하는가?
- [ ] 확장된 OCR 섹션에 Gemini가 인식한 풀이가 올바르게 표시되는가?
- [ ] "OCR이 잘못됐어요" 버튼 클릭 시 Textarea가 나타나고 기존 OCR 텍스트로 채워지는가?
- [ ] Textarea에서 텍스트 수정 후 "수정해서 다시 채점" 버튼 클릭 시 재채점이 진행되는가?
- [ ] 수정된 텍스트가 비어있을 때 재채점 시도 시 `toast.error('풀이를 작성해 주세요')` 메시지가 표시되는가?
- [ ] "취소" 버튼 클릭 시 OCR 수정 모드에서 벗어나 정상 표시 모드로 돌아오는가?
- [ ] 재채점 성공 후 `toast.success('다시 채점됐어요!')` 메시지가 표시되는가?

### 오류 처리

- [ ] 재채점 API 호출 실패 시 `toast.error('다시 채점 중 문제가 생겼어요. 다시 시도해 주세요')` 메시지가 표시되는가?
- [ ] ProblemSolve에서 이미지 업로드 시 10MB 초과 파일에 대해 `toast.error('파일 크기는 10MB 이하여야 해요.')` 메시지가 표시되는가?
- [ ] ProblemSolve에서 문제 로드 실패 시 "문제를 불러오지 못했어요." 메시지가 표시되는가?
- [ ] ProblemSolve에서 제출 API 호출 실패 시 "잠시 문제가 생겼어요. 다시 시도해 주세요" 메시지가 표시되는가?

### 기타

- [ ] "이런 방법도 있어요! 💡" 토글 버튼이 정상 작동하여 대체 풀이를 확장/축소하는가?
- [ ] MathRenderer 내의 LaTeX 수식이 올바르게 표시되는가?
- [ ] 모바일/데스크탑 환경에서 UI 레이아웃이 깨지지 않고 반응형으로 잘 표시되는가?
