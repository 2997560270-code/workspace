# Domain docs

This repository uses a single-context domain documentation layout.

## Before exploring

- Read `CONTEXT.md` at the repository root when it exists.
- Read relevant decisions under `docs/adr/` when the directory exists.
- If either is absent, proceed silently. Create domain documentation only when terminology or architectural decisions are actually resolved.

## Layout

- `CONTEXT.md`: domain vocabulary, boundaries, and invariants.
- `docs/adr/`: accepted architectural decisions.
- `product-drill-app/`: application source.

## Vocabulary

Use terms defined in `CONTEXT.md`. Avoid introducing synonyms for established domain concepts.

## ADR conflicts

Explicitly identify proposals that conflict with an existing ADR instead of silently overriding it.
