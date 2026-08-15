import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608150003_validation_beta.sql", "utf8");

describe("validation beta schema", () => {
  it("defines cohorts, hidden anchors, blind reviews and measurements", () => {
    for (const table of ["validation_cohorts", "validation_participants", "anchor_cases", "blind_review_assignments", "blind_reviews", "validation_measurements"]) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("keeps anchor identity and review conflict boundaries explicit", () => {
    expect(migration).toContain("hidden boolean not null default true");
    expect(migration).toContain("conflict_declared boolean not null default false");
    expect(migration).toContain("reviewer_agreement");
  });
});
