import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migrations = [
  ["supabase/migrations/202608150004_community_review_beta.sql", ["review_pool_entries", "reviewer_conflicts", "blind_review_aggregates"]],
  ["supabase/migrations/202608150005_community_governance.sql", ["review_quality_votes", "reviewer_reputation", "review_reroutes", "seasonal_challenges", "seasonal_challenge_entries", "training_credit_ledger", "review_anomaly_flags"]],
  ["supabase/migrations/202608150006_standardized_assessment.sql", ["assessment_blueprints", "assessment_item_pools", "assessment_runs", "assessment_responses", "assessment_evaluations", "assessment_reports", "assessment_fairness_metrics"]],
  ["supabase/migrations/202608150007_verified_assessment_pilots.sql", ["verified_organizations", "verified_assessment_sessions", "verified_process_events", "verified_assessment_reports", "verified_human_review_cases"]],
] as const;

describe("remaining roadmap schema", () => {
  for (const [file, tables] of migrations) {
    it(`${file} defines governed tables and RLS`, () => {
      const sql = readFileSync(file, "utf8");
      for (const table of tables) {
        expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
        expect(sql).toContain(`alter table public.${table} enable row level security`);
      }
    });
  }

  it("keeps standardized assessment pools and verified reports bounded", () => {
    const assessment = readFileSync("supabase/migrations/202608150006_standardized_assessment.sql", "utf8");
    const verified = readFileSync("supabase/migrations/202608150007_verified_assessment_pilots.sql", "utf8");
    expect(assessment).toContain("pool_kind text not null check (pool_kind in ('training','experiment','assessment','anchor'))");
    expect(assessment).toContain("report_status text not null default 'diagnostic_only'");
    expect(verified).toContain("usage_status text not null default 'pilot_only'");
    expect(verified).toContain("pending_manual");
    expect(verified).toContain("human_review_status");
  });

  it("does not grant client-side score or run updates", () => {
    const governance = readFileSync("supabase/migrations/202608150005_community_governance.sql", "utf8");
    const assessment = readFileSync("supabase/migrations/202608150006_standardized_assessment.sql", "utf8");
    expect(governance).toContain("users read own challenge entries");
    expect(governance).not.toContain("users manage own challenge entries");
    expect(assessment).toContain("users read own assessment runs");
    expect(assessment).not.toContain("users manage own assessment runs");
  });
});
