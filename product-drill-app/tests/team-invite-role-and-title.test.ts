import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canSetTeamMemberTitle,
  createTeamWorkspace,
  joinTeamWorkspace,
  loadTeamDirectory,
  saveTeamDirectory,
  setTeamInviteRole,
  setTeamMemberTitle,
  TEAM_MEMBER_TITLE_MAX,
  type TeamWorkspace
} from "../src/lib/team-workspace";

/**
 * RT-005 模拟测试：邀请时指定身份 + 负责人自定义成员称谓。
 * 核心约束：称谓只是展示名，权限角色仍由 role 决定。
 */

function makeTeam(inviteRole?: "coach" | "learner"): TeamWorkspace {
  return createTeamWorkspace({ ownerId: "owner-1", ownerName: "张明", name: "产品训练小组", inviteRole });
}

describe("RT-005 邀请时指定身份", () => {
  it("建队时可以选择被邀请者的身份，加入者直接获得该身份", () => {
    const team = makeTeam("coach");
    expect(team.inviteRole).toBe("coach");

    const joined = joinTeamWorkspace(team, { memberId: "member-2", memberName: "李敏" });
    expect(joined.members.find((member) => member.id === "member-2")).toMatchObject({ role: "coach", status: "active" });
  });

  it("未指定邀请身份时默认是学习者", () => {
    const joined = joinTeamWorkspace(makeTeam(), { memberId: "member-2", memberName: "李敏" });
    expect(joined.members.find((member) => member.id === "member-2")?.role).toBe("learner");
  });

  it("显式传入的身份优先级高于团队默认邀请身份", () => {
    const joined = joinTeamWorkspace(makeTeam("coach"), { memberId: "member-2", memberName: "李敏", role: "learner" });
    expect(joined.members.find((member) => member.id === "member-2")?.role).toBe("learner");
  });

  it("只有负责人能切换邀请身份", () => {
    const team = joinTeamWorkspace(makeTeam(), { memberId: "member-2", memberName: "李敏" });
    expect(setTeamInviteRole(team, "owner-1", "coach").inviteRole).toBe("coach");
    // 普通成员切换无效，团队原样返回
    expect(setTeamInviteRole(team, "member-2", "coach").inviteRole).toBe("learner");
  });

  it("邀请身份会随团队目录一起持久化", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    } });
    saveTeamDirectory([makeTeam("coach")]);
    expect(loadTeamDirectory()[0]?.inviteRole).toBe("coach");
  });
});

describe("RT-005 自定义成员称谓", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function teamWithMember(): TeamWorkspace {
    return joinTeamWorkspace(makeTeam(), { memberId: "member-2", memberName: "李敏" });
  }

  it("负责人可以给成员设置自定义称谓", () => {
    const next = setTeamMemberTitle(teamWithMember(), "owner-1", "member-2", "产品总监");
    expect(next.members.find((member) => member.id === "member-2")?.title).toBe("产品总监");
    // 展示名不影响权限角色
    expect(next.members.find((member) => member.id === "member-2")?.role).toBe("learner");
  });

  it("称谓会去除首尾空格并截断到上限", () => {
    const long = "产".repeat(TEAM_MEMBER_TITLE_MAX + 10);
    const next = setTeamMemberTitle(teamWithMember(), "owner-1", "member-2", `  ${long}  `);
    expect(next.members.find((member) => member.id === "member-2")?.title).toHaveLength(TEAM_MEMBER_TITLE_MAX);
  });

  it("传空字符串表示清除称谓，回退到角色名", () => {
    const withTitle = setTeamMemberTitle(teamWithMember(), "owner-1", "member-2", "产品总监");
    const cleared = setTeamMemberTitle(withTitle, "owner-1", "member-2", "   ");
    expect(cleared.members.find((member) => member.id === "member-2")?.title).toBeUndefined();
  });

  it("普通成员不能给他人设置称谓", () => {
    const team = teamWithMember();
    expect(canSetTeamMemberTitle(team, "member-2", "owner-1").ok).toBe(false);
    expect(setTeamMemberTitle(team, "member-2", "owner-1", "老板")).toEqual(team);
  });

  it("负责人本人的称谓不可被修改", () => {
    const team = teamWithMember();
    expect(canSetTeamMemberTitle(team, "owner-1", "owner-1").ok).toBe(false);
    expect(setTeamMemberTitle(team, "owner-1", "owner-1", "超级管理员")).toEqual(team);
  });

  it("对不存在的成员设置称谓不会改动团队", () => {
    const team = teamWithMember();
    expect(canSetTeamMemberTitle(team, "owner-1", "ghost").ok).toBe(false);
    expect(setTeamMemberTitle(team, "owner-1", "ghost", "幽灵")).toEqual(team);
  });

  it("称谓随团队目录持久化并可重新读取", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    } });
    saveTeamDirectory([setTeamMemberTitle(teamWithMember(), "owner-1", "member-2", "产品总监")]);
    const [restored] = loadTeamDirectory();
    expect(restored.members.find((member) => member.id === "member-2")?.title).toBe("产品总监");
  });
});
