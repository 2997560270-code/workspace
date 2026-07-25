# Evaluation contract

Each evaluation stores:

- `rubricVersion`, `modelVersion`, `scenarioVersion`, `engine`
- per-skill `level`, `confidence`, `evidenceMessageIds`, `evidenceQuotes`
- `strengths`, `issues`, `nextAction`
- one primary retry task with `targetSkill`

Allowed levels:

- `not_observed`
- `with_hint`
- `independent`
- `stable_and_deep`

Golden cases must include:

- expected primary skill
- expected allowed levels
- required and forbidden evidence ids
- unsupported claims that must not appear
- whether the result may update ability evidence

Release thresholds default to:

- 100% cited message ids exist
- 0 unsupported facts in golden cases
- at least 90% primary-skill agreement
- at least 85% level agreement within one adjacent level
- repeated runs never vary by more than one level
