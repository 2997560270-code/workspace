import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/202607230002_causal_world_phase1.sql",
  "utf8"
);

const REQUIRED_TABLES = [
  "causal_worlds",
  "causal_world_versions",
  "challenge_runs",
  "world_events",
  "decision_events",
  "interventions",
  "judgment_hypotheses",
  "hypothesis_evidence",
];

const REQUIRED_POLICIES = [
  "approved worlds readable",
  "runs own row",
  "events through own run",
  "decisions through own run",
  "interventions through own run",
  "hypotheses own row",
  "evidence through own hypothesis",
];

describe("causal world phase 1 migration", () => {
  it("creates all required tables", () => {
    for (const table of REQUIRED_TABLES) {
      expect(migration).toMatch(
        new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i")
      );
    }
  });

  it("does not drop any existing tables", () => {
    expect(migration).not.toMatch(/drop table/i);
  });

  it("enables RLS on all new tables", () => {
    for (const table of REQUIRED_TABLES) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`
      );
    }
  });

  it("creates all required RLS policies", () => {
    for (const policy of REQUIRED_POLICIES) {
      expect(migration).toContain(`"${policy}"`);
    }
  });

  it("isolates all user data by auth.uid()", () => {
    const uidMatches = migration.match(/auth\.uid\(\)/g) ?? [];
    // at least one auth.uid() per user-data table (runs, events, decisions, interventions, hypotheses, evidence)
    expect(uidMatches.length).toBeGreaterThanOrEqual(6);
  });

  it("ensures decision_events default consequences_revealed to false", () => {
    expect(migration).toContain("consequences_revealed boolean not null default false");
  });

  it("versions world and model in hypothesis_evidence for traceability", () => {
    const evidenceSection = migration.slice(
      migration.indexOf("create table if not exists public.hypothesis_evidence")
    );
    expect(evidenceSection).toContain("world_version text not null");
    expect(evidenceSection).toContain("model_version text not null");
    expect(evidenceSection).toContain("decision_event_id text not null");
  });

  it("creates indexes on key lookup columns", () => {
    expect(migration).toContain("idx_runs_user_started");
    expect(migration).toContain("idx_events_run_seq");
    expect(migration).toContain("idx_decisions_run");
    expect(migration).toContain("idx_hypotheses_user_habit");
    expect(migration).toContain("idx_hyp_evidence_decision");
  });

  it("world_events has unique constraint on (run_id, sequence_index)", () => {
    expect(migration).toContain("unique (run_id, sequence_index)");
  });

  it("supports transfer evidence via transfer_world_id", () => {
    expect(migration).toContain("transfer_world_id text");
  });
});
