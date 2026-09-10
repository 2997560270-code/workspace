import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";

/**
 * RT-008 模拟测试：/api/teams 的退出 / 移除 / 解散三个 action。
 *
 * 走真实路由处理器 + 仓储层 + 本地运行时存储（mock 掉登录与 Supabase），
 * 覆盖「成员能退出、负责人能移除、越权被拒」这条完整链路。
 * 每个用例使用独立的负责人账号，避免同一账号跨用例拥有多个团队。
 * 账号 id 必须是 UUID 形状：/api/teams 的 zod schema 对 teamId / memberId 有 uuid() 校验。
 */

const env = vi.hoisted(() => {
  // 每个测试文件用独立的状态文件，避免与其它集成测试互相覆盖。
  const statePath = `${process.cwd()}/data/local-runtime-team-lifecycle.json`;
  process.env.LOCAL_RUNTIME_STATE_PATH = statePath;
  process.env.ALLOW_DEMO_AUTH = "true";
  return { statePath };
});

const auth = vi.hoisted(() => ({
  user: { id: "rt008-anonymous", email: "anonymous@example.com", name: "Anonymous", source: "demo" as const },
}));

vi.mock("../src/lib/api/server", () => ({
  apiError: (message: string, status = 400, details?: unknown) => Response.json({ error: message, details }, { status }),
  parseJsonBody: async (request: Request) => request.json().catch(() => null),
  requireApiUser: async () => auth.user,
}));
vi.mock("../src/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("../src/lib/monitoring/server", () => ({ captureServerException: vi.fn() }));

import { GET, POST } from "../src/app/api/teams/route";

const asUser = (id: string) => {
  auth.user = { id, email: `${id}@example.com`, name: id, source: "demo" as const };
};

function post(body: unknown) {
  return POST(new Request("http://localhost/api/teams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

async function json<T = Record<string, any>>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function currentTeam(userId: string) {
  asUser(userId);
  return (await json<{ team: any }>(await GET())).team;
}

/** 负责人建队 + 发出一个学习者邀请，返回 teamId 与邀请码 */
async function createTeamWithInvite(owner: string, name: string) {
  asUser(owner);
  const created = await post({ action: "create", name });
  expect(created.status).toBe(201);
  const teamId = (await json<{ team: { id: string } }>(created)).team.id;
  const invited = await post({ action: "invite", teamId, role: "learner" });
  expect(invited.status).toBe(201);
  const code = (await json<{ invitation: { code: string } }>(invited)).invitation.code;
  return { teamId, code };
}

describe("RT-008 团队退出 / 移除 / 解散 API", () => {
  beforeAll(async () => {
    await rm(env.statePath, { force: true });
  });

  afterAll(async () => {
    await rm(env.statePath, { force: true });
    // 关键：清掉环境变量，否则同一 worker 线程里后续运行的测试文件会继承这个状态文件路径。
    delete process.env.LOCAL_RUNTIME_STATE_PATH;
  });

  it("成员可以退出团队，退出后不再属于该团队", async () => {
    const owner = "11111111-1111-4111-8111-111111111111";
    const learner = "22222222-2222-4222-8222-222222222222";
    const { teamId, code } = await createTeamWithInvite(owner, "RT008 退出组");

    asUser(learner);
    const joined = await post({ action: "join", code });
    expect(joined.status).toBe(200);
    expect((await json<{ team: { team_members: unknown[] } }>(joined)).team.team_members).toHaveLength(2);
    expect(await currentTeam(learner)).not.toBeNull();

    const left = await post({ action: "leave", teamId });
    expect(left.status).toBe(200);
    expect(await json<{ dissolved: boolean }>(left)).toEqual({ dissolved: false });

    expect(await currentTeam(learner)).toBeNull();
    const ownerTeam = await currentTeam(owner);
    expect(ownerTeam.team_members).toHaveLength(1);
  });

  it("负责人还有成员时不能退出，但可以移除成员后再退出", async () => {
    const owner = "33333333-3333-4333-8333-333333333333";
    const learner = "44444444-4444-4444-8444-444444444444";
    const { teamId, code } = await createTeamWithInvite(owner, "RT008 移除组");

    asUser(learner);
    await post({ action: "join", code });

    asUser(owner);
    const blocked = await post({ action: "leave", teamId });
    expect(blocked.status).toBe(400);
    expect(await currentTeam(owner)).not.toBeNull();

    const removed = await post({ action: "remove", teamId, memberId: learner });
    expect(removed.status).toBe(200);
    const afterRemove = await json<{ team: { team_members: Array<{ user_id: string }> } }>(removed);
    expect(afterRemove.team.team_members.map((member) => member.user_id)).toEqual([owner]);
    expect(await currentTeam(learner)).toBeNull();

    asUser(owner); // currentTeam() 会切换 mock 登录态，这里必须切回负责人
    const leftAlone = await post({ action: "leave", teamId });
    expect(leftAlone.status).toBe(200);
    expect(await json<{ dissolved: boolean }>(leftAlone)).toEqual({ dissolved: true });
    expect(await currentTeam(owner)).toBeNull();
  });

  it("成员不能移除他人，也不能移除负责人", async () => {
    const owner = "55555555-5555-4555-8555-555555555555";
    const learner = "66666666-6666-4666-8666-666666666666";
    const { teamId, code } = await createTeamWithInvite(owner, "RT008 越权组");

    asUser(learner);
    await post({ action: "join", code });

    const forbidden = await post({ action: "remove", teamId, memberId: owner });
    expect(forbidden.status).toBe(400);
    expect(await currentTeam(owner)).not.toBeNull();

    asUser(owner);
    const selfRemove = await post({ action: "remove", teamId, memberId: owner });
    expect(selfRemove.status).toBe(400);
  });

  it("负责人可以解散团队，解散后全员脱离", async () => {
    const owner = "77777777-7777-4777-8777-777777777777";
    const learner = "88888888-8888-4888-8888-888888888888";
    const { teamId, code } = await createTeamWithInvite(owner, "RT008 解散组");

    asUser(learner);
    await post({ action: "join", code });

    asUser(owner);
    const dissolved = await post({ action: "dissolve", teamId });
    expect(dissolved.status).toBe(200);
    expect(await json<{ dissolved: boolean }>(dissolved)).toEqual({ dissolved: true });
    expect(await currentTeam(owner)).toBeNull();
    expect(await currentTeam(learner)).toBeNull();
  });

  it("非负责人不能解散团队", async () => {
    const owner = "99999999-9999-4999-8999-999999999999";
    const { teamId } = await createTeamWithInvite(owner, "RT008 权限组");

    asUser("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const denied = await post({ action: "dissolve", teamId });
    expect(denied.status).toBe(400);

    expect(await currentTeam(owner)).not.toBeNull();
  });

  it("退出动作的请求体校验依然生效", async () => {
    asUser("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    const badRemove = await post({ action: "remove", teamId: "not-a-uuid", memberId: "not-a-uuid" });
    expect(badRemove.status).toBe(400);
    const badAction = await post({ action: "nope" });
    expect(badAction.status).toBe(400);
  });
});

describe("RT-005 邀请身份与自定义称谓 API", () => {
  const OWNER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const COACH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const LEARNER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  async function seedTeam() {
    asUser(OWNER);
    const created = await post({ action: "create", name: "RT005 小组" });
    const teamId = (await json<{ team: { id: string } }>(created)).team.id;
    return teamId;
  }

  it("用导师身份邀请，加入者直接获得导师角色", async () => {
    const teamId = await seedTeam();
    asUser(OWNER);
    const invited = await post({ action: "invite", teamId, role: "coach" });
    expect(invited.status).toBe(201);
    const code = (await json<{ invitation: { code: string } }>(invited)).invitation.code;

    asUser(COACH);
    const joined = await post({ action: "join", code });
    expect(joined.status).toBe(200);
    const members = (await json<{ team: { team_members: Array<{ user_id: string; role: string }> } }>(joined)).team.team_members;
    expect(members.find((member) => member.user_id === COACH)?.role).toBe("coach");
  });

  it("负责人可以设置成员自定义称谓，展示名不影响权限角色", async () => {
    const teamId = await seedTeam();
    asUser(OWNER);
    const invited = await post({ action: "invite", teamId, role: "learner" });
    const code = (await json<{ invitation: { code: string } }>(invited)).invitation.code;
    asUser(LEARNER);
    await post({ action: "join", code });

    asUser(OWNER);
    const titled = await post({ action: "set_title", teamId, memberId: LEARNER, title: "产品总监" });
    expect(titled.status).toBe(200);
    const members = (await json<{ team: { team_members: Array<{ user_id: string; role: string; title: string | null }> } }>(titled)).team.team_members;
    const target = members.find((member) => member.user_id === LEARNER);
    expect(target?.title).toBe("产品总监");
    expect(target?.role).toBe("learner");
  });

  it("普通成员不能设置称谓", async () => {
    const teamId = await seedTeam();
    asUser(OWNER);
    const invited = await post({ action: "invite", teamId, role: "learner" });
    const code = (await json<{ invitation: { code: string } }>(invited)).invitation.code;
    asUser(LEARNER);
    await post({ action: "join", code });

    const denied = await post({ action: "set_title", teamId, memberId: OWNER, title: "老板" });
    expect(denied.status).toBe(400);
  });

  it("称谓长度与请求体校验生效", async () => {
    const teamId = await seedTeam();
    asUser(OWNER);
    const tooLong = await post({ action: "set_title", teamId, memberId: LEARNER, title: "称".repeat(21) });
    expect(tooLong.status).toBe(400);
    const badId = await post({ action: "set_title", teamId, memberId: "not-a-uuid", title: "产品总监" });
    expect(badId.status).toBe(400);
  });
});
