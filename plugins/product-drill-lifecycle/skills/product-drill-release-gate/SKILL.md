---
name: product-drill-release-gate
description: Use before merging or releasing Product Drill changes. Verifies tests, build, E2E, accessibility, security, database migrations, AI golden regressions, analytics events, Sentry readiness, privacy, and rollback notes.
---

# Product Drill Release Gate

## Required checks

Read [references/release-checklist.md](references/release-checklist.md), then run `scripts/release_check.ps1` from the plugin skill directory with the app path.

A release is blocked by failing unit, type, build, E2E, migration, security, or golden-evaluation checks; missing analytics for a changed core step; raw conversation text sent to analytics/monitoring; or no rollback note for schema/API changes.

## Output

Report PASS, FAIL, or BLOCKED for each gate. Never mark missing credentials or unavailable external services as PASS; mark them BLOCKED with the exact required action.
