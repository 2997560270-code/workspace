import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 回归文档一致性校验（模拟测试）
 *
 * 2026-09-06 第三轮回归清单里的「代码定位 / action 清单 / 文案引用 / 行号」都是可证伪的事实断言。
 * 本测试把文档当被测对象：逐条抽取文档里的事实主张，再回到源码里核对。
 * 文档写错、源码漂移导致行号失效、或修复后文档没同步，都会在这里暴露。
 */

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(appRoot, "..");

const appFile = (relative: string) => readFileSync(path.join(appRoot, relative), "utf8");
const repoFile = (relative: string) => readFileSync(path.join(repoRoot, relative), "utf8");

const DOC = "docs/product/regression-test-issues-2026-09-06.md";
const doc = repoFile(DOC);
const previousDoc = repoFile("docs/product/regression-test-issues-2026-09-04.md");
const fixChangelog = repoFile("docs/product/fix-changelog-2026-09-05.md");

const teamsRoute = appFile("src/app/api/teams/route.ts");
const voiceInput = appFile("src/app/voice-input-button.tsx");
const appShell = appFile("src/app/app-shell.tsx");
const teamPanel = appFile("src/app/team-workspace-panel.tsx");
const teamRepository = appFile("src/lib/repositories/team-repository.ts");
const teamStore = appFile("src/lib/team-workspace.ts");
const globalsCss = appFile("src/app/globals.css");
const prd = repoFile("docs/product/product-requirements-document.md");

const splitLines = (source: string) => source.split(/\r?\n/);
const lineAt = (source: string, lineNumber: number) => splitLines(source)[lineNumber - 1] ?? "";
const lineOf = (source: string, needle: string) => splitLines(source).findIndex((line) => line.includes(needle)) + 1;

/** 截取文档章节：从 startMarker 到其后第一次出现的 endMarker */
function section(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`文档缺少章节标记：${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("2026-09-06 回归文档与源码一致性", () => {
  it("RT-008 引用的 /api/teams action 清单与源码完全一致（含 invite 与 RT-008 新增项）", () => {
    // 源码事实：TeamActionSchema 里定义的全部 action
    const schemaBlock = section(teamsRoute, "const TeamActionSchema", "export async function GET");
    const sourceActions = [...schemaBlock.matchAll(/z\.literal\("([a-z_]+)"\)/g)].map((match) => match[1]).sort();
    expect(sourceActions).toEqual(["create", "dissolve", "invite", "join", "leave", "mentor_note", "remove", "set_role", "set_title"]);

    const rt008 = section(doc, "### RT-008", "## 5.");
    for (const action of sourceActions) {
      expect(rt008, `RT-008 的代码定位漏了 action：${action}`).toContain(action);
    }
    // 错误的「四个 action」表述必须已被纠正，并且文档要跟上新增后的真实数量
    expect(rt008).not.toMatch(/四个\s*action/);
    expect(rt008).toMatch(/九个\s*action/);

    // 文档引用的 route.ts 行号必须落在真实的 schema / 分支上
    const refs = rt008.match(/`route\.ts:([\d,\-]+)`/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    expect(lineAt(teamsRoute, lineOf(teamsRoute, 'z.literal("create")'))).toContain("z.literal");
    const citedNumbers = [...rt008.matchAll(/route\.ts:([\d]+)(?:-([\d]+))?/g)].flatMap((match) =>
      match[2] ? [Number(match[1]), Number(match[2])] : [Number(match[1])]
    );
    const citedText = citedNumbers.map((number) => lineAt(teamsRoute, number)).join("\n");
    expect(citedText, "文档引用的 route.ts 行号没有落在 action 定义/分支上").toMatch(/z\.literal|action ===/);
  });

  it("§6 待回归清单覆盖 fix-changelog 声明的全部 P0", () => {
    const declaredP0 = [...fixChangelog.matchAll(/\|\s*(FB-\d+)\s*\|[^|]*\|[^|]*\|\s*P0\s*\|/g)].map((match) => match[1]).sort();
    expect(declaredP0).toEqual(["FB-006", "FB-011", "FB-013", "FB-014"]);

    const sec6 = section(doc, "## 6.", "## 7.");
    for (const id of declaredP0) {
      expect(sec6, `§6 待回归清单漏了已声明修复的 P0：${id}`).toContain(id);
    }
  });

  it("§6 覆盖本轮声明的 P1 修复（FB-008 / FB-009）", () => {
    const sec6 = section(doc, "## 6.", "## 7.");
    expect(sec6).toContain("FB-008");
    expect(sec6).toContain("FB-009");
  });

  it("§6 的暂缓分组与 fix-changelog 第四章一致", () => {
    const sec6 = section(doc, "## 6.", "## 7.");
    for (const id of ["FB-001", "FB-010"]) {
      expect(sec6).toContain(id);
    }
    expect(sec6).toContain("FB-002");
  });

  it("RT-006 引用的资源中心文案与 app-shell 源码逐字一致", () => {
    const hubSection = section(appShell, 'data-testid="resource-hub-entry"', "</section>");
    const heading = /<h2>([^<]+)<\/h2>/.exec(hubSection)?.[1] ?? "";
    expect(heading).not.toBe("");

    const rt006 = section(doc, "### 5.4 RT-006", "## 6.");
    expect(rt006, "RT-006 没有引用资源中心的真实标题文案").toContain(heading);
  });

  it("§5.3 说明后端 invite 已支持 role，缺口只在 UI", () => {
    const inviteSchemaLine = lineOf(teamsRoute, 'z.literal("invite")');
    expect(lineAt(teamsRoute, inviteSchemaLine)).toMatch(/role: z\.enum\(\["coach", "learner"\]\)/);

    const rt005 = section(doc, "### 5.3 RT-005", "### 5.4");
    expect(rt005, "§5.3 未说明后端 invite 已接受 role").toMatch(/invite/);
    expect(rt005, "§5.3 未点明「后端已支持、仅 UI 未暴露」").toMatch(/后端/);
  });

  it("RT-007 的语音文案与源码逐字一致", () => {
    const sourceMessage = /network:\s*"([^"]+)"/.exec(voiceInput)?.[1] ?? "";
    expect(sourceMessage).not.toBe("");
    expect(doc).toContain(sourceMessage);
  });

  it("RT-002 引用的 PRD 模式定义与 PRD 逐字一致", () => {
    const rt002 = section(doc, "### 5.1 RT-002", "### 5.2");
    const definitions = splitLines(prd)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- 诊断模式：") || line.startsWith("- 练习模式：") || line.startsWith("- 严格模式："));
    expect(definitions).toHaveLength(3);
    for (const definition of definitions) {
      expect(rt002, `§5.1 没有逐字引用 PRD 定义：${definition}`).toContain(definition);
    }
  });

  it("文档引用的源码行号指向预期代码", () => {
    // RT-007：voice-input-button.tsx 的 onerror / onend 行号
    const onerrorSpan = /`onerror`（`:(\d+)-(\d+)`）/.exec(doc);
    expect(onerrorSpan, "文档缺少 onerror 行号引用").not.toBeNull();
    const [, onerrorStart, onerrorEnd] = onerrorSpan!;
    expect(lineAt(voiceInput, Number(onerrorStart))).toContain("recognition.onerror");
    expect(lineAt(voiceInput, Number(onerrorEnd))).toMatch(/\};?\s*$/);

    const onendRef = /`onend`（`:(\d+)`）/.exec(doc);
    expect(onendRef, "文档缺少 onend 行号引用").not.toBeNull();
    expect(lineAt(voiceInput, Number(onendRef![1]))).toContain("recognition.onend");

    // RT-007 修复引用：releaseRecognition() 的落地位置
    const releaseRef = /`releaseRecognition\(\)`（`:(\d+)-(\d+)`）/.exec(doc);
    expect(releaseRef, "文档缺少 releaseRecognition() 行号引用").not.toBeNull();
    const releaseSpan = splitLines(voiceInput)
      .slice(Number(releaseRef![1]) - 1, Number(releaseRef![2]))
      .join("\n");
    expect(releaseSpan).toContain("function releaseRecognition");
    expect(releaseSpan).toContain("abort()");
    expect(releaseSpan).toContain("stop()");

    // RT-006：app-shell.tsx 的标准化考核直达入口
    const entryRef = /`app-shell\.tsx:(\d+)-(\d+)`/.exec(doc);
    expect(entryRef, "文档缺少 app-shell.tsx:358-360 引用").not.toBeNull();
    expect(lineAt(appShell, Number(entryRef![1]))).toContain('data-testid="assessment-entry"');
    expect(lineAt(appShell, Number(entryRef![2]))).toContain("进入标准化考核");

    // RT-003：review-submission-block 的两处类名
    const classRef = /`app-shell\.tsx:(\d+),(\d+)`/.exec(doc);
    expect(classRef, "文档缺少 app-shell.tsx 类名行号引用").not.toBeNull();
    expect(lineAt(appShell, Number(classRef![1]))).toContain("review-submission-block");
    expect(lineAt(appShell, Number(classRef![2]))).toContain("review-submission-block");

    // RT-004：团队名称 / 邀请码动态提示（文档用 527,544 这样的行号列表）
    const hintRef = /`team-workspace-panel\.tsx:(\d+)(?:-|,)(\d+)`/.exec(section(doc, "## 3.", "## 4."));
    expect(hintRef, "文档缺少 team-workspace-panel.tsx 提示行号引用").not.toBeNull();
    expect(lineAt(teamPanel, Number(hintRef![1])), "团队名称提示行号对不上").toContain("至少");
    expect(lineAt(teamPanel, Number(hintRef![2])), "邀请码提示行号对不上").toContain("至少");

    // RT-003：globals.css 的换行规则
    expect(lineOf(globalsCss, ".review-submission-block dd")).toBeGreaterThan(0);
    expect(lineAt(globalsCss, lineOf(globalsCss, ".review-submission-block dd"))).toMatch(/overflow-wrap|word-break/);
    expect(lineAt(globalsCss, lineOf(globalsCss, ".review-submission-block li p"))).toMatch(/overflow-wrap|word-break/);

    // RT-008 修复引用：仓储层
    const rt008 = section(doc, "### RT-008", "## 5.");
    const repoRef = /`team-repository\.ts:(\d+(?:,\d+)+)`/.exec(rt008);
    expect(repoRef, "文档缺少 team-repository.ts 行号引用").not.toBeNull();
    const repoLines = repoRef![1].split(",").map(Number).map((number) => lineAt(teamRepository, number));
    expect(repoLines[0]).toContain("export async function leaveTeam");
    expect(repoLines[1]).toContain("export async function dissolveTeam");
    expect(repoLines[2]).toContain("export async function removeTeamMember");

    // RT-008 修复引用：本地团队目录守卫
    const storeRef = /`team-workspace\.ts:(\d+)-(\d+)`/.exec(rt008);
    expect(storeRef, "文档缺少 team-workspace.ts 行号引用").not.toBeNull();
    const storeSpan = splitLines(teamStore)
      .slice(Number(storeRef![1]) - 1, Number(storeRef![2]))
      .join("\n");
    for (const fn of ["canLeaveTeam", "leaveTeamWorkspace", "canRemoveTeamMember", "removeTeamMember"]) {
      expect(storeSpan, `team-workspace.ts 引用行区间内没有 ${fn}`).toContain(`export function ${fn}`);
    }

    // RT-008 修复引用：界面新增控件
    const panelFixRef = /`team-workspace-panel\.tsx:(\d+(?:,\d+)+)`/.exec(rt008);
    expect(panelFixRef, "文档缺少 team-workspace-panel.tsx 新增控件行号引用").not.toBeNull();
    const panelLines = panelFixRef![1].split(",").map(Number).map((number) => lineAt(teamPanel, number));
    expect(panelLines[0]).toContain("team-member-remove-");
    expect(panelLines[1]).toContain('data-testid="team-dissolve"');
    expect(panelLines[2]).toContain('data-testid="team-leave"');

    // RT-005 修复引用：邀请身份 + 自定义称谓
    const rt005 = section(doc, "### 5.3 RT-005", "### 5.4");
    const titleRouteRef = /`route\.ts:(\d+),(\d+)`/.exec(rt005);
    expect(titleRouteRef, "文档缺少 set_title 的 route.ts 行号引用").not.toBeNull();
    expect(lineAt(teamsRoute, Number(titleRouteRef![1]))).toContain('z.literal("set_title")');
    expect(lineAt(teamsRoute, Number(titleRouteRef![2]))).toContain('action === "set_title"');

    const titleRepoRef = /`team-repository\.ts:(\d+)`/.exec(rt005);
    expect(titleRepoRef, "文档缺少 setTeamMemberTitle 的仓储行号引用").not.toBeNull();
    expect(lineAt(teamRepository, Number(titleRepoRef![1]))).toContain("export async function setTeamMemberTitle");

    const titleStoreRef = /`team-workspace\.ts:(\d+),(\d+)`/.exec(rt005);
    expect(titleStoreRef, "文档缺少称谓守卫的 team-workspace.ts 行号引用").not.toBeNull();
    expect(lineAt(teamStore, Number(titleStoreRef![1]))).toContain("export function canSetTeamMemberTitle");
    expect(lineAt(teamStore, Number(titleStoreRef![2]))).toContain("export function setTeamMemberTitle");

    const titlePanelRef = /称谓输入框（`team-workspace-panel\.tsx:(\d+)`）/.exec(rt005);
    expect(titlePanelRef, "文档缺少称谓输入框的行号引用").not.toBeNull();
    expect(lineAt(teamPanel, Number(titlePanelRef![1]))).toContain("team-member-title-");
  });

  it("09-04 清单已补上指向本轮的交叉引用", () => {
    expect(previousDoc).toContain("regression-test-issues-2026-09-06.md");
  });
});
