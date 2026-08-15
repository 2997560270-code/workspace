import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTeamWorkspace, findTeamByInviteCode, joinTeamWorkspace, loadTeamDirectory, saveTeamDirectory } from "../src/lib/team-workspace";

describe("team workspace", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    } });
  });

  it("creates an owner and a shareable invite code", () => {
    const team = createTeamWorkspace({ ownerId: "user-1", ownerName: "张明", name: "产品训练小组" });
    expect(team.name).toBe("产品训练小组");
    expect(team.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(team.members[0]).toMatchObject({ id: "user-1", role: "owner", status: "active" });
  });

  it("lets another member join by invite code and ignores duplicate joins", () => {
    const team = createTeamWorkspace({ ownerId: "user-1", ownerName: "张明", name: "产品训练小组" });
    const joined = joinTeamWorkspace(team, { memberId: "user-2", memberName: "李敏" });
    expect(findTeamByInviteCode([joined], team.inviteCode)?.members).toHaveLength(2);
    expect(joinTeamWorkspace(joined, { memberId: "user-2", memberName: "李敏" }).members).toHaveLength(2);
  });

  it("persists a validated local directory", () => {
    const team = createTeamWorkspace({ ownerId: "user-1", ownerName: "张明", name: "产品训练小组" });
    saveTeamDirectory([team]);
    expect(loadTeamDirectory()).toEqual([team]);
  });
});
