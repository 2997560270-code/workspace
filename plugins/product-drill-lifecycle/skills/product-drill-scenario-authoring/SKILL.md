---
name: product-drill-scenario-authoring
description: Use when creating, editing, reviewing, importing, or validating Product Drill training scenarios. Enforces deep scenario structure, one primary skill, controlled fact disclosure, difficulty behavior, versioning, and expert review.
---

# Product Drill Scenario Authoring

## Workflow

1. Read [references/scenario-schema.md](references/scenario-schema.md).
2. Select exactly one primary product-discovery skill.
3. Define role goal, trigger event, current workflow, constraints, hidden facts, alternatives, impact, and success criteria.
4. Define what question types reveal each hidden fact; never reveal the entire scenario in the opening.
5. Define practice, independent, and strict-mode behavior.
6. Add source notes and reviewer status.
7. Run `python scripts/validate_scenario.py <scenario.json>`.

## Quality gate

Reject a scenario when it is only an industry label, has no conflict or hidden information, rewards feature pitching, lacks a measurable outcome, or requires unrelated domain trivia.

Every published revision increments `scenarioVersion`; old sessions keep their original version.
