import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607150001_direction_a.sql", "utf8");

const REQUIRED_TABLES = [
  "profiles",
  "skills",
  "scenarios",
  "scenario_versions",
  "training_sessions",
  "messages",
  "product_judgments",
  "evaluations",
  "evaluation_evidence",
  "retry_attempts",
  "ability_evidence"
];

describe("Supabase direction A schema foundation", () => {
  it("creates the full training evidence model", () => {
    for (const table of REQUIRED_TABLES) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
    }
  });

  it("versions scenarios, rubrics, and models", () => {
    expect(migration).toContain("scenario_version integer");
    expect(migration).toContain("rubric_version text");
    expect(migration).toContain("model_version text");
  });

  it("enables RLS and isolates user-owned evidence", () => {
    for (const table of ["skills", "scenarios", "scenario_versions", "profiles", "training_sessions", "messages", "product_judgments", "evaluations", "evaluation_evidence", "retry_attempts", "ability_evidence"]) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("s.user_id = auth.uid()");
  });

  it("keeps formal ability evidence linked to a concrete session and version", () => {
    expect(migration).toMatch(/ability_evidence[\s\S]*session_id text not null/i);
    expect(migration).toMatch(/ability_evidence[\s\S]*scenario_version integer not null/i);
    expect(migration).toMatch(/ability_evidence[\s\S]*rubric_version text not null/i);
    expect(migration).toMatch(/ability_evidence[\s\S]*model_version text not null/i);
  });

  it("provides an atomic service-role-only model rate limiter", () => {
    expect(migration).toContain("create table if not exists public.api_rate_limits");
    expect(migration).toContain("create or replace function public.consume_rate_limit");
    expect(migration).toContain("security definer");
    expect(migration).toContain("grant execute on function public.consume_rate_limit");
    expect(migration).toContain("to service_role");
  });
});
