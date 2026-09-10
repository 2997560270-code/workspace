import { describe, expect, it } from "vitest";
import {
  canLeaveTeam,
  canRemoveTeamMember,
  createTeamWorkspace,
  joinTeamWorkspace,
  leaveTeamWorkspace,
  removeTeamMember,
  setTeamMemberRole,
  type TeamWorkspace
} from "../src/lib/team-workspace";

/**
 * RT-008：团队生命周期（退出 / 移除 / 解散）的纯函数模拟测试。
 * 这些函数是本地团队目录与 UI 守卫的共同依据，越权规则必须在这里锁死。
 */

function makeTeam(): TeamWorkspace {
  const created = createTeamWorkspace({ ownerId: "owner-1", ownerName: "张明", name: "产品训练小组" });
  return joinTeamWorkspace(created, { memberId: "learner-1", memberName: "李敏" });
}

describe("RT-008 退出团队", () => {
  it("普通成员退出后从成员列表移除，团队仍然存在", () => {
    const team = makeTeam();
    const next = leaveTeamWorkspace(team, "learner-1");
    expect(next).not.toBeNull();
    expect(next!.members.map((member) => member.id)).toEqual(["owner-1"]);
  });

  it("最后一名成员退出后返回 null（团队应被删除）", () => {
    const team = createTeamWorkspace({ ownerId: "owner-1", ownerName: "张明", name: "产品训练小组" });
    expect(leaveTeamWorkspace(team, "owner-1")).toBeNull();
  });

  it("负责人还有其他活跃成员时不能退出", () => {
    const team = makeTeam();
    const check = canLeaveTeam(team, "owner-1");
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("解散团队");
    // 校验不通过时团队必须原样返回，不能静默把人删掉
    expect(leaveTeamWorkspace(team, "owner-1")).toEqual(team);
  });

  it("负责人是唯一成员时可以退出（等价于解散）", () => {
    const team = createTeamWorkspace({ ownerId: "owner-1", ownerName: "张明", name: "产品训练小组" });
    expect(canLeaveTeam(team, "owner-1").ok).toBe(true);
  });

  it("非成员无法退出", () => {
    expect(canLeaveTeam(makeTeam(), "outsider").ok).toBe(false);
  });
});

describe("RT-008 移除成员", () => {
  it("负责人可以移除学习者", () => {
    const team = makeTeam();
    const next = removeTeamMember(team, "owner-1", "learner-1");
    expect(next.members.map((member) => member.id)).toEqual(["owner-1"]);
  });

  it("学习者不能移除任何人", () => {
    const team = makeTeam();
    expect(canRemoveTeamMember(team, "learner-1", "owner-1").ok).toBe(false);
    expect(removeTeamMember(team, "learner-1", "owner-1")).toEqual(team);
  });

  it("任何人都不能移除负责人", () => {
    const team = setTeamMemberRole(makeTeam(), "learner-1", "coach");
    expect(canRemoveTeamMember(team, "learner-1", "owner-1").ok).toBe(false);
    expect(removeTeamMember(team, "learner-1", "owner-1")).toEqual(team);
  });

  it("导师只能移除学习者，不能移除另一位导师", () => {
    const base = setTeamMemberRole(makeTeam(), "learner-1", "coach"); // learner-1 现在是导师
    const team = joinTeamWorkspace(base, { memberId: "learner-2", memberName: "王强", role: "learner" });
    expect(canRemoveTeamMember(team, "learner-1", "learner-2").ok).toBe(true);

    const withSecondCoach = joinTeamWorkspace(team, { memberId: "coach-2", memberName: "赵磊", role: "coach" });
    expect(canRemoveTeamMember(withSecondCoach, "learner-1", "coach-2").ok).toBe(false);
    expect(canRemoveTeamMember(withSecondCoach, "owner-1", "coach-2").ok).toBe(true);
  });

  it("不能移除自己（应使用退出团队）", () => {
    const team = makeTeam();
    const check = canRemoveTeamMember(team, "owner-1", "owner-1");
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.reason).toContain("退出团队");
  });

  it("非成员不能移除成员", () => {
    expect(canRemoveTeamMember(makeTeam(), "outsider", "learner-1").ok).toBe(false);
  });
});
