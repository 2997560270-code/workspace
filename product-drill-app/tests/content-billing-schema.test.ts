import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608150002_content_billing.sql", "utf8");

describe("content and billing schema", () => {
  it("defines governed content and subscription state", () => {
    for (const table of ["billing_subscriptions", "community_cases", "knowledge_entries", "content_audit_log"]) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("does not allow non-free plans without a provider subscription", () => {
    expect(migration).toContain("provider_subscription_id is not null");
    expect(migration).toContain("account_role");
    expect(migration).toContain("content_audit_log");
  });
});
