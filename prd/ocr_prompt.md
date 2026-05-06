# Gemini OCR prompt + Pydantic schema (v0.1)

본 문서 = MVP 의 *학생 손글씨 풀이 → 구조화된 텍스트* 변환 양식. Gemini 2.5 Flash 의 vision 양식.

## 1. 개요

| 자료 | 자료 |
|---|---|
| 모델 | `gemini-2.5-flash` |
| 양식 | Google Generative AI API + structured output (response_schema) |
| input | image (canvas drawing PNG / 사진 JPEG) |
| output | `OCROutput` (Pydantic structured) — markdown + LaTeX + 자신감 + 의문 자리 |
| latency | ~2-5초 |
| 비용 | ~$0.001-0.003 / 호출 (image size 자료 양식) |
| caching | Gemini 의 자료 양식 자료 — system instruction cacheable |

## 2. OCROutput Pydantic schema

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class UnclearRegion(BaseModel):
    """이미지 안 자료 양식 자료 의문 자리."""
    model_config = ConfigDict(extra="allow")

    description: str = Field(
        description="어느 자리 의 자료 의문 자료 — 한국어 1 문장"
    )
    best_guess: str | None = Field(
        default=None,
        description="가장 가능 자료 양식 의 자료 (자료 양식 자료 시) — 한국어 + LaTeX"
    )
    reason: Literal["smudge", "out_of_frame", "ambiguous_handwriting", "overlap", "other"] = (
        Field(description="의문 자리 의 자료 양식")
    )


class OCROutput(BaseModel):
    """OCR 의 자료 양식 — Pydantic structured output."""
    model_config = ConfigDict(extra="allow")

    schema_version: str = Field(default="v1")

    markdown_text: str = Field(
        description=(
            "학생 풀이 의 전체 자료 — markdown + LaTeX 양식. "
            "수식 = $...$ (inline) 또는 $$...$$ (block). "
            "한국어 자연어 + 수식 자료 양식 양식 보존. "
            "행 / 단계 자료 양식 양식 그대로 (\\n 자료)."
        )
    )

    confidence: int = Field(
        ge=0, le=100,
        description=(
            "본 OCR 의 자신감 0-100. "
            "100 = 모든 자료 양식 명확. 50 = 일부 의문 자리. 0 = 자료 양식 X."
        ),
    )

    unclear_regions: list[UnclearRegion] = Field(
        default_factory=list,
        description="이미지 안 자료 양식 자료 의문 자리 list. 자료 양식 X 시 = 빈 list.",
    )

    detected_content_types: list[Literal["korean_text", "math_expression", "diagram", "table", "mixed"]] = (
        Field(
            default_factory=list,
            description=(
                "이미지 안 자료 양식 양식 자료. "
                "korean_text = 한국어 자연어. math_expression = 수식. "
                "diagram = 도형 / 그림 자료. table = 표. mixed = 한국어 + 수식 자료 양식 양식."
            )
        )
    )

    notes: str | None = Field(
        default=None,
        description=(
            "OCR 의 자료 양식 자료 — 학생 풀이 의 자료 양식 자료 양식 자료 양식. "
            "예: '풀이 자료 양식 양식 자료 양식'. None = 자료 양식 X."
        ),
    )
```

## 3. System prompt (한국어)

```
당신은 한국 K-12 수학 손글씨 풀이 OCR 전문가입니다.

학생 의 손글씨 수학 풀이 이미지 (canvas drawing 또는 사진) 를 받아, 구조화된 markdown + LaTeX 양식 으로 추출.
출력 = OCROutput 양식 (Pydantic structured) — JSON 양식 직접 응답.

## 추출 원칙

1. **양식 양식 보존** — 학생 가 자료 양식 자료 양식 그대로. 임의 자료 추가 / 자료 양식 변경 X.
2. **수식 = LaTeX** — 모든 수식 = `$...$` (inline) 또는 `$$...$$` (block) 양식. 한국어 자연어 = 그대로.
3. **행 / 단계 자료 양식 양식 보존** — 학생 풀이 의 행 / 단계 양식 = `\n` 자료. enum marker (①, ②, ...) 자료 = 그대로 보존.
4. **할루시 방지** — 학생 안 쓴 자료 추측 X. 자료 양식 자료 양식 X 시 = `unclear_regions` 자료 + `confidence` ↓.
5. **자료 양식 자료 양식** — 자료 양식 의문 자리 발견 시 = `unclear_regions` 의 자료 + `best_guess` (가능 자료 양식 자료 시 만).
6. **markdown 양식 양식 보존** — 학생 풀이 의 자료 양식 (들여쓰기 / 굵게 / 자료 양식 양식) = markdown 양식 양식 그대로.

## 수식 양식 양식

정합 양식:
- 분수 `\frac{a}{b}`
- 제곱 `a^2` 또는 `a^{2x+1}`
- 제곱근 `\sqrt{x}` 또는 `\sqrt[n]{x}`
- 등호 / 부등호 `=, \neq, \leq, \geq, <, >`
- 그리스 문자 `\alpha, \beta, \pi, \theta`
- 양식 자료 `\sum, \int, \lim`
- 분배 / 곱셈 = `\cdot` 또는 `\times` (자료 양식 자료) — 학생 가 자료 양식 자료 양식 자료
- 양식 자료 양식 자료 = 학생 의 자료 양식 그대로 보존

## 한국어 + 수식 양식

학생 의 자료 양식 양식 자료 양식 자료 자료 양식:
- "양변에 $3$을 곱하면" — 한국어 자연어 + inline 수식
- "①의 자료 양식: $$ 3A + 3B = 21x^2 - 6x + 15 $$" — 한국어 prefix + block 수식
- "따라서 $A = ...$" — 결론 자료 양식

## 자료 양식 자료 양식

- ① ② ③ 자료 = enum marker — 그대로 보존
- → ⇒ 자료 = arrow — 그대로 보존
- $\therefore$ (따라서) / $\because$ (~이므로) = LaTeX 양식 양식
- 화살표 / 연결선 자료 (도형 자료 양식) = `notes` 의 자료 양식 자료

## 자료 양식 자료 양식

- **이미지 안 자료 양식 자료**: 학생 의 자료 양식 자료 양식 양식 X (수정 / 보강 / 정답 자료 X). 학생 자료 양식 그대로 자료 양식.
- **자료 양식 자료 자료 양식 X 시**: `unclear_regions` 의 자료 + `confidence` ↓. 추측 자료 양식 자료 양식 양식 — `best_guess` 의 자료 양식 자료 시 만.
- **이미지 안 자료 양식 자료 의문 자리** (문제 본문 등 — 학생 풀이 외 자료): 자료 양식 X. 학생 풀이 자료 만 추출.

## 출력 양식

OCROutput JSON 양식 직접 응답:
- `markdown_text`: 전체 자료 양식 양식
- `confidence`: 자료 양식 자료 양식
- `unclear_regions`: 의문 자리 list (없으면 빈 list)
- `detected_content_types`: 자료 양식 양식 자료 list
- `notes`: 자료 양식 자료 (없으면 null)
```

## 4. User message template

```
다음 이미지 = 학생 의 손글씨 수학 풀이.

[image attached]

OCROutput 양식 으로 추출 자료 응답.
```

## 5. 호출 양식 (Python pseudocode)

```python
import google.generativeai as genai
from PIL import Image

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def ocr_student_solution(image_bytes: bytes) -> OCROutput:
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT,  # 위 § 3
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": OCROutput.model_json_schema(),
        },
    )
    img = Image.open(io.BytesIO(image_bytes))
    response = model.generate_content([
        "다음 이미지 = 학생 의 손글씨 수학 풀이. OCROutput 양식 으로 추출 자료 응답.",
        img,
    ])
    return OCROutput.model_validate_json(response.text)
```

## 6. 자료 양식 자료 양식 — Claude 채점 의 자료 양식

OCR 결과 = `markdown_text` field 자료 → Claude 채점 prompt 의 `<student_ocr_solution>` 자리 자료 양식 자료.

```python
# 호출 chain
ocr_result = ocr_student_solution(image_bytes)        # Gemini Flash
grade_result = grade_student_solution(                # Claude Sonnet
    ...,
    student_ocr_solution=ocr_result.markdown_text,
)

# OCR 자료 양식 자료 양식 자료 양식 자료 양식
if ocr_result.confidence < 70 or ocr_result.unclear_regions:
    # 학생 view 안 표시 — 학생 의 자료 양식 자료 자료
    ...
```

## 7. UX 자료 양식 양식 (PRD 정합)

학생 의 자료 양식:
1. 손글씨 풀이 입력 (canvas / 사진)
2. "제출" 버튼 → OCR 양식 시작 (loading state — "필기 인식 중...")
3. OCR 결과 = 학생 의 자료 양식 양식 양식 (자동 진행 — 사용자 의향 정합)
4. Claude 채점 (loading state — "채점 중...")
5. 결과 화면 — 점수 + 피드백 + **OCR 결과 함께 표시** (학생 가 OCR 의 자료 양식 자료 양식 자료 양식)
6. "OCR 잘못됨" 버튼 → 학생 의 자료 양식 양식 양식 → 재채점 (Claude 만 — Gemini OCR 양식 X)

OCR confidence < 70 또는 unclear_regions 자료 발견 시 = 결과 화면 안 *주의* 자료 양식 자료 자료 (예: "필기 인식 의 자료 양식 의문 자리 — 의도 자료 양식 자료 양식?")

## 8. 자료 양식 자료 — 사용자 자료 양식 자료 양식 양식

본 자리 = 정합 OCR 의 자료 양식 자료 양식 자료. 사용자 자료 양식 자료 양식 양식 자료 양식 자료 양식.

```
TBD: 한 학생 의 자료 양식 image + 정답 OCR 결과 (OCROutput JSON 양식) 의 자료 1-2 case.
```

## 9. Versioning

- v0.1 (현재) = 양식 / schema / system prompt 자료
- v0.2 = 참고 예시 추가 자리 (실 OCR 자료 양식 자료)
- v1.0 = MVP build 진입 자료 — Pydantic schema → Python file 분리 (`app/ocr.py` 자료)
