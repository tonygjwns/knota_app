# Claude 채점 prompt + Pydantic schema (v0.1)

본 문서 = MVP 의 핵심 자리 — Claude Sonnet 4.6 의 *학생 풀이 채점* prompt + structured output schema.

## 1. 개요

| 자료 | 자료 |
|---|---|
| 모델 | `claude-sonnet-4-6` |
| 양식 | Anthropic Messages API + tool_choice 강제 (structured output) |
| input | problem + verified_answer + agent_solution + 정답 풀이 path + 학생 OCR 풀이 |
| output | `GradingOutput` (Pydantic structured) — 점수 + 단계별 피드백 + 별해 |
| latency | ~5-10초 (Anthropic API 양식 양식) |
| 비용 | ~$0.02-0.05 / 채점 (input ~3-5K + output ~500-1000 token) |
| caching | system prompt + tool def = `cache_control: ephemeral` (다음 채점 자료 양식 자료 양식) |

## 2. GradingOutput Pydantic schema

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StepFeedback(BaseModel):
    """학생 풀이 의 매 step 별 피드백."""
    model_config = ConfigDict(extra="allow")

    step_number: int = Field(ge=1, description="학생 풀이 의 step 자료 (1-based)")
    student_step: str = Field(
        description="학생 의 본 step 의 자료 (OCR 추출 자료 그대로)"
    )
    status: Literal["correct", "partial", "missing", "wrong"]
    comment: str = Field(
        description="1-2 문장 한국어 — 격려 / 정정 자료. 학생 친화 톤"
    )
    correction: str | None = Field(
        default=None,
        description="status=wrong 또는 partial 시 = 정정 자료 (한국어 + LaTeX)",
    )


class GapLocation(BaseModel):
    """학생 풀이 안 *공백* 자리 — 본래 있어야 할 step 의 부재."""
    model_config = ConfigDict(extra="allow")

    description: str = Field(description="어느 자리 가 공백 자료 — 한국어 1 문장")
    expected_step: str = Field(
        description="본래 있어야 할 자료 — 한국어 + LaTeX"
    )


class ErrorLocation(BaseModel):
    """학생 풀이 안 *오류* 자리."""
    model_config = ConfigDict(extra="allow")

    description: str = Field(description="어느 자리 의 오류 자료 — 한국어 1 문장")
    student_wrote: str = Field(description="학생 의 자료 — OCR 추출 자료")
    correct_form: str = Field(description="정답 자료 — 한국어 + LaTeX")
    error_type: Literal["calculation", "conceptual", "notation"] = Field(
        description=(
            "calculation = 산수 / 부호 / 정리 자료 의 오류. "
            "conceptual = 개념 / 공식 적용 자료 의 오류. "
            "notation = 표기 / 수식 자료 의 오류."
        )
    )


class GradingOutput(BaseModel):
    """채점 의 자료 양식 — Pydantic structured output."""
    model_config = ConfigDict(extra="allow")

    schema_version: str = Field(default="v1")

    score: int = Field(
        ge=0, le=100,
        description="부분점수 0-100. 정답 도달 + 풀이 완전 = 100. 부분 정합 자료 양식.",
    )
    correctness: Literal["correct", "partial", "wrong"] = Field(
        description="correct = 정답 도달 + 풀이 양식 정합. "
                    "partial = 정답 자료 또는 풀이 일부 정합. "
                    "wrong = 정답 X + 풀이 양식 X."
    )
    summary: str = Field(
        description="1-2 문장 한국어 격려 + 정정 자료. 학생 친화 톤. 본 채점 의 요약."
    )

    step_feedback: list[StepFeedback] = Field(
        default_factory=list,
        description="학생 풀이 의 매 step 별 자료. 풀이 안 step 수 만큼 자료.",
    )

    gap_locations: list[GapLocation] = Field(
        default_factory=list,
        description="학생 풀이 안 공백 자리 (본래 있어야 할 step 부재).",
    )

    error_locations: list[ErrorLocation] = Field(
        default_factory=list,
        description="학생 풀이 안 오류 자리.",
    )

    alternative_solution: str | None = Field(
        default=None,
        description=(
            "학생 풀이 와 다른 방식 의 별해 제안 (자료 양식 자리 시). "
            "한국어 + LaTeX. 학생 의 자료 양식 자료 양식 양식."
        ),
    )

    confidence: int = Field(
        ge=0, le=100,
        description=(
            "본 채점 의 자신감 0-100. OCR 자료 양식 의문 자리 / 학생 풀이 양식 양식 자료 시 ↓."
        ),
    )
    ocr_quality_concern: str | None = Field(
        default=None,
        description=(
            "OCR 자료 양식 의문 자리 발견 시 — 학생 의 자료 양식 의 자료. "
            "예: '두 번째 식 의 자료 양식 의문 — 부호 자료 자료 양식'. None = 의문 X."
        ),
    )
```

## 3. System prompt (한국어)

```
당신은 한국 K-12 수학 풀이 채점 전문가입니다.

학생 의 손글씨 풀이 (OCR 추출 자료) 를 받아, problem + verified_answer + agent_solution + 정답 풀이 path 자료 와 비교 채점.
출력 = GradingOutput 양식 (Pydantic structured) — `report_grade` tool 한 번 호출.

## 채점 원칙

1. **부분점수 일관성** — 비슷한 풀이 → 비슷한 점수. 채점 양식 의 자료 양식 자료.
2. **학생 친화 톤** — 격려 + 정정 양식. 부정적 표현 자료 자료 양식 X. "틀렸어요" → "이 부분 다시 살펴볼까요" 양식.
3. **다른 풀이 인지 (별해 인정)** — 학생 풀이 가 verified_answer 와 다른 양식 자료 시 = 자료 양식 자료. 정답 도달 시 = 정합 자료 양식.
4. **산수 vs 개념 오류 구분**:
   - calculation = 산수 / 부호 / 정리 자료 의 오류 (소소한 자료 — 점수 자료 양식 ↓ 자료)
   - conceptual = 개념 / 공식 적용 자료 의 오류 (큰 자료 — 점수 ↓↓ 자료)
   - notation = 표기 / 수식 자료 의 오류 (작은 자료 — 점수 자료 양식 ↓ 자료)
5. **할루시 방지** — 학생 안 쓴 자료 추측 X. 자료 양식 결정 X 자료 = uncertain 명시 (`confidence` ↓).
6. **OCR 자료 양식 양식** — OCR 결과 의 자료 양식 자료 의문 자리 = `ocr_quality_concern` 명시. 자료 양식 X 시 = `confidence` ↓.
7. **actionable feedback** — "다시 살펴봐요" 같은 자료 X. *어느 자리 / 왜* 의 자료 양식 자료. step_feedback / gap_locations / error_locations 의 자료 양식.

## 점수 양식

- 100 = 정답 + 풀이 양식 완전 + 표기 자료 양식 정합
- 80-99 = 정답 + 풀이 양식 정합 + 사소 자료 (산수 / 표기)
- 60-79 = 정답 도달 + 풀이 양식 일부 자료 (공백 / 자료 양식)
- 40-59 = 풀이 일부 정합 + 정답 X 또는 정답 도달 자료 양식
- 20-39 = 풀이 양식 일부 정합 + 다수 자료
- 1-19 = 풀이 양식 양식 양식 자료 자료
- 0 = 풀이 양식 X 자료 / 완전 오답 자료 양식

## 출력 양식 의 자료 양식

`report_grade` tool 한 번 호출 — GradingOutput Pydantic structured.
- summary: 1-2 문장 격려 + 정정 자료
- step_feedback: 학생 풀이 의 매 step 별 자료
- gap_locations: 공백 자리 (본래 있어야 할 step 부재)
- error_locations: 오류 자리 + 정정 자료
- alternative_solution: 별해 제안 (자료 양식 자리 시 만 — 자료 양식 X 시 null)
- confidence + ocr_quality_concern: 자료 양식 자료

## 톤 양식 자료 양식 (학생 친화)

정합 양식:
- "잘 풀었어요!" / "여기 까지 정합!" / "이 부분 다시 살펴볼까요?"
- "다음 step 에서 자료 양식 자료 자료 — 자료 양식 양식 자료 양식"
- "별해도 가능해요 — 이런 방법은 어떨까요?"

자료 양식 X 양식:
- "틀렸어요" / "X 자료" / "잘못했어요" / "다시 자료 양식"
```

## 4. User message template

```
<problem>
{problem.content 의 자료 양식 자료 — list of {text, type} 의 자료 자료}
</problem>

<verified_answer>
{problem.verified_answer — 단일 자료 자료 양식. null 시 = "(검증된 정답 X)"}
</verified_answer>

<agent_solution>
{agent_answer_records.answer — agent 의 전체 풀이 자료. null 시 = "(agent 풀이 자료 X)"}
</agent_solution>

<correct_solution_path>
{usage_records 의 자료 양식 — sequence_order 별:
  Step {N}: 도구 = "{tool.name}"
    - 사유: {reason}
    - 적용: {application}
    - 결과: {appended_info}
}
</correct_solution_path>

<student_ocr_solution>
{ocr_text — Gemini 의 자료 양식. 학생 손글씨 → markdown + LaTeX}
</student_ocr_solution>

위 학생 풀이 채점 자료. `report_grade` 호출.
```

## 5. 호출 양식 (Python pseudocode)

```python
from anthropic import Anthropic

client = Anthropic()  # 또는 wrap_anthropic(Anthropic()) — LangSmith trace

def grade_student_solution(
    *, problem: dict, verified_answer: str | None,
    agent_solution: str | None,
    correct_solution_path: list[dict],  # usage_records
    student_ocr_solution: str,
) -> GradingOutput:
    system_prompt = SYSTEM_PROMPT  # 위 § 3
    user_msg = build_user_message(...)  # 위 § 4
    grading_tool = {
        "name": "report_grade",
        "description": "학생 풀이 채점 결과 보고. 한 번 호출.",
        "input_schema": GradingOutput.model_json_schema(),
        "cache_control": {"type": "ephemeral"},
    }
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=[
            {"type": "text", "text": system_prompt,
             "cache_control": {"type": "ephemeral"}}
        ],
        tools=[grading_tool],
        tool_choice={"type": "tool", "name": "report_grade"},
        messages=[{"role": "user", "content": user_msg}],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "report_grade":
            return GradingOutput.model_validate(block.input)
    raise RuntimeError("LLM did not call report_grade")
```

## 6. 참고 예시 (TBD — 자료 양식 추가 자리)

본 자리 = 정합 채점 의 자료 양식 양식 자료 자료 자료. 사용자 자료 양식 자료 양식 자료 양식 자료 자료 양식 양식.

```
TBD: 한 problem + 학생 풀이 + 정답 채점 결과 (GradingOutput JSON 양식) 의 자료 1-2 case.
```

## 7. Versioning

- v0.1 (현재) = 양식 / schema / system prompt 자료
- v0.2 = 참고 예시 추가 자리 (실 채점 자료 양식 자료)
- v1.0 = MVP build 진입 자료 — Pydantic schema → Python file (`app/grading.py` 자료) 분리
