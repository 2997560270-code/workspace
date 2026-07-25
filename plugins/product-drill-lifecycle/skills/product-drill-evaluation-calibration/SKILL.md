---
name: product-drill-evaluation-calibration
description: Use when changing Product Drill rubrics, evidence extraction, scoring, confidence, ability aggregation, retry evaluation, models, or prompts. Requires message-backed evidence, golden-session regression, versioning, and anti-gaming checks.
---

# Product Drill Evaluation Calibration

## Invariants

- Evidence references real message ids and verbatim spans.
- Extraction, rubric evaluation, feedback writing, and retry evaluation are separate stages.
- Message count, answer length, and time spent never directly determine mastery.
- Practice-mode hints are recorded and cannot produce independent mastery.
- Fallback-engine results are marked and excluded from formal ability trends.
- Low confidence returns “more evidence needed.”

## Workflow

1. Read [references/evaluation-contract.md](references/evaluation-contract.md).
2. Update the rubric or prompt with a new version.
3. Add positive, borderline, missing, and adversarial golden cases.
4. Run `python scripts/validate_golden.py <golden.jsonl>`.
5. Run repeated evaluations and compare evidence accuracy, level stability, unsupported claims, and retry isolation.
6. Do not release if a cited message id is missing or a claim cannot be traced to text.
