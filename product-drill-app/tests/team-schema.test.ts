import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608150001_enterprise_teams.sql", "utf8");

describe("enterprise team schema", () => {
  it("defines teams, members, invitations and mentor notes", () => {
    for (const table of ["teams", "team_members", "team_invitations", "mentor_notes"]) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "i"));
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("protects membership checks through security-definer helpers", () => {
    expect(migration).toContain("is_active_team_member");
    expect(migration).toContain("is_active_team_manager");
    expect(migration).toContain("team_invitations");
    expect(migration).toContain("expires_at");
  });
});
