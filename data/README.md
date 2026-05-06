# KNOTA jaemin_math_tool_0423 snapshot

본 폴더 = KNOTA RDS 의 `jaemin_math_tool_0423` DB 의 *local snapshot*. 한국 K-12 수학 문제 / 풀이 / 도구 자료.

## 자료 출처 + 갱신

- **source**: KNOTA RDS `jaemin_math_tool_0423` (read-only)
- **갱신 양식**: `python -m extraction.download_snapshot` 재실행 시 전체 갱신 (현 자료 overwrite)
- **자료 양식 결정 룰**: row 수 ≤ 500 = JSON, 500 초과 = JSONL, 0 = skip
- **manifest.json**: 본 snapshot 의 모든 table 의 자료 / 양식 / 행 수 / column 자료 (단일 source of truth)

## 파일 자료

| file | row | 양식 | 자료 |
|---|---|---|---|
| [tools.json](tools.json) | 24 | JSON | 수학 *도구* (math tool) — 한 풀이 step 의 자료 단위 |
| [achvmt_stds.json](achvmt_stds.json) | 311 | JSON | 한국 교육과정 성취기준 코드 표 |
| [alembic_version.json](alembic_version.json) | 1 | JSON | DB schema 버전 (SQLAlchemy migration) |
| [problems.jsonl](problems.jsonl) | 511 | JSONL | 수학 *문제* — content 양식 = LaTeX 포함 자료 |
| [agent_answer_records.jsonl](agent_answer_records.jsonl) | 510 | JSONL | agent 가 본 문제 별 작성한 답 |
| [usage_records.jsonl](usage_records.jsonl) | 2286 | JSONL | *문제 × 도구* 의 적용 기록 — 핵심 자료 |
| [manifest.json](manifest.json) | — | meta | 본 snapshot 의 자료 + schema |

## table 별 자료

### `tools` (수학 도구)

한 풀이 step 의 자료 단위. 한 도구 = 한 *수학 개념 / 공식 / algorithm* 의 적용 양식.

| field | type | 자료 |
|---|---|---|
| `id` | varchar | 도구 식별자 (예: `tool_00001`) |
| `name` | varchar | 도구 이름 (한국어) — 예: "등식의 가감법을 이용한 미지수 소거" |
| `goal` | text | 도구 의 *목적* — 무엇을 달성하는지 |
| `operation` | text | 도구 의 *수행 절차* — 어떻게 적용하는지 (예시 포함) |
| `precondition` | text | 도구 적용 *조건* — 언제 사용 가능한지 |
| `achvmt_std_code` | varchar | 본 도구 의 교과 영역 (achvmt_stds.code 참조) |
| `created_at` / `updated_at` | timestamptz | — |

### `achvmt_stds` (성취기준)

한국 교육과정 의 표준 코드 표. 도구 의 교과 영역 mapping.

| field | type | 자료 |
|---|---|---|
| `code` | varchar | 성취기준 코드 (예: `9수02-19` = 중3 수학 02 영역 19번) |
| `content` | text | 성취기준 의 자연어 설명 |
| `explanation` | text | 추가 설명 (대부분 null) |

코드 양식: `<grade><subject><area>-<seq>` 또는 `<grade><subject><sub>-<area>-<seq>`.
예: `9수02-19`, `10공수1-01-01`, `12미적I-02-03`.

### `problems` (수학 문제)

511 개 의 한국 K-12 수학 문제.

| field | type | 자료 |
|---|---|---|
| `problem_id` | varchar | UUID 또는 식별자 |
| `content` | jsonb | **list of {text: str, type: "human"}** — LaTeX 포함 문제 본문 |
| `source` | varchar | 문제 출처 (예: `CYCLE_0423`, `ssen_*`, `ocr_*`) |
| `verified_answer` | varchar | 검증된 정답 (사람 확인 자료) |
| `proposed_answer` | varchar | agent 가 제안한 답 |
| `created_at` / `updated_at` | timestamptz | — |

`content` 자료 양식 (jsonb 양식 그대로 보존):
```json
[
  {"text": "두 다항식 $A$, $B$에 대하여... $A+B = 3x^2 + 2x + 3$ ...", "type": "human"}
]
```

### `usage_records` (도구 적용 기록 — 핵심 자료)

2286 개 의 (문제 × 도구) 적용 기록. 한 row = 한 풀이 step.

| field | type | 자료 |
|---|---|---|
| `id` | int | 자동 증가 PK |
| `problem_id` | varchar | problems.problem_id 참조 |
| `sequence_order` | int | 본 problem 의 풀이 안 step 순서 (1, 2, 3, ...) |
| `tool_id` | varchar | tools.id 참조 |
| `reason` | text | 도구 선택 사유 (왜 본 도구를 쓰는지) |
| `application` | text | 도구 의 *실 적용 자료* — input → 정리 step → 결과 |
| `appended_info` | text | 본 step 에서 풀이 에 추가된 *결과 요약* (한 문장) |
| `contribution` | int | 본 step 의 *기여도* 점수 (0-100) |
| `discover_difficulty` | int (1-6) | "이 도구를 *떠올리기* 어려운 자료" — dd |
| `compute_difficulty` | int (1-4) | "이 도구를 *적용/계산* 하는 데 어려운 자료" — cd |
| `is_created_tool` | bool | 본 step 에서 *신설* 된 도구 자료 (true = 신설) |
| `search_steps_back` / `search_rank` / `is_related_tool` | int / bool | agent 의 도구 검색 자료 (decomposer agent metadata) |
| `created_at` | timestamptz | — |

`dd / cd` 의 자료 = LLM agent 가 매긴 라벨 자료. 사람 검증 X — 노이즈 자료.
한 problem 안 여러 record 자료 (sequence_order 별) — 풀이 의 step 자료.

### `agent_answer_records` (agent 답변 기록)

510 개 의 problem 별 agent 의 답.

| field | type | 자료 |
|---|---|---|
| `id` / `problem_id` / `created_at` | — | — |
| `answer` | text | agent 가 작성한 답 (자연어 + LaTeX) |

### `alembic_version` (schema 버전)

DB 의 alembic migration 버전 자료 (1 row 만).

## 사용 양식 (예시 코드)

### Python (JSON load)

```python
import json

# tools (작은 자료)
with open("data/snapshot/tools.json", encoding="utf-8") as f:
    tools = json.load(f)  # list[dict]
print(f"{len(tools)} 도구")
for t in tools[:3]:
    print(t["id"], t["name"])
```

### Python (JSONL streaming)

```python
import json

# usage_records (큰 자료)
with open("data/snapshot/usage_records.jsonl", encoding="utf-8") as f:
    for line in f:
        record = json.loads(line)
        if record["discover_difficulty"] >= 5:
            print(record["problem_id"], record["tool_id"], record["dd"])
```

### Python (manifest 자료)

```python
import json
manifest = json.load(open("data/snapshot/manifest.json", encoding="utf-8"))
for tbl, info in manifest["tables"].items():
    print(f"{tbl}: {info['row_count']} rows, {info['format']}")
```

### Pandas (분석 자료)

```python
import pandas as pd

# JSON → DataFrame
tools_df = pd.read_json("data/snapshot/tools.json")

# JSONL → DataFrame
usage_df = pd.read_json("data/snapshot/usage_records.jsonl", lines=True)
problems_df = pd.read_json("data/snapshot/problems.jsonl", lines=True)

# 도구 별 적용 횟수
print(usage_df["tool_id"].value_counts().head())
```

## table 간 관계

```
problems (problem_id) ──┬── usage_records (problem_id, tool_id) ── tools (id) ── achvmt_stds (achvmt_std_code)
                        └── agent_answer_records (problem_id)
```

- problem 1 개 = usage_record 0 ~ N 개 (sequence_order 별 — 풀이 step)
- tool 1 개 = usage_record 0 ~ M 개 (다른 problem 의 적용 자료)
- tool ↔ achvmt_stds = `tools.achvmt_std_code` (문자열 prefix 자료)

## 갱신 자료 / 주의

- **read-only**: DB 자료 의 영향 X. 본 snapshot 을 수정 해도 서버 자료 변경 X
- **갱신 시점**: snapshot_at 자료 (manifest.json) 참조
- **재 download**: `python -m extraction.download_snapshot` 실행 시 전체 갱신 (현 자료 overwrite)
- **자료 무결성**: round-trip 검증 통과 자료 (DB row 수 = file row 수)
- **timestamptz**: ISO 8601 양식 string 자료 변환 (`2026-04-23T13:36:37.713568+00:00`)
- **bytea / UUID 등 binary**: hex string / str() 변환 자료
