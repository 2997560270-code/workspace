-- Issue #13: enforce the same single-decision invariant at the database layer.
-- The repository maps this constraint violation to DuplicateDecisionError.

create unique index if not exists decision_events_run_world_event_unique
  on public.decision_events (run_id, world_event_id);
