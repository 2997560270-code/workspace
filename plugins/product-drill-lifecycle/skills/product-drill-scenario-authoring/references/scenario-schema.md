# Scenario schema

Required fields:

- `id`, `scenarioVersion`, `title`, `industry`
- `primarySkill`: one of `role`, `workflow`, `impact`, `alternative`, `metric`
- `difficulty`: `basic`, `standard`, or `strict`
- `role`: `name`, `goal`, `attitude`, `authority`
- `triggerEvent`, `context`, `opening`
- `currentWorkflow`, `constraints`, `decisionChain`
- `hiddenFacts`: non-empty entries for all five skills
- `revealRules`: question intent mapped to hidden fact ids
- `successCriteria`, `commonMisjudgments`
- `sourceNotes`, `reviewStatus`, `rubricVersion`

Authoring constraints:

- Opening contains the presenting request, not the root cause.
- At least one hidden fact contradicts or reframes the opening request.
- Strict mode includes pressure, avoidance, or conflicting goals without becoming hostile.
- Facts are stable within one version; the roleplay model may vary wording, not facts.
