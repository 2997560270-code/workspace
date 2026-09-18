# UI/UX 改造实施日志（2026-09-17）

分支：`feat/ui-ux-overhaul`（基线 `master` = `21c4f05`）。
计划：`C:\Users\24100\.qoder-cn\plans\bright-cliff-darter.md`。
审查依据：`ui-ux-review-2026-09-17.md`、`copy-and-ui-plan-2026-09-17.md`、`DESIGN.md`。

## 记录约定

- 每个功能提交保持 `npm run typecheck` + `npx vitest run` 全绿，可独立 `git revert <hash>`。
- 每批最后一个提交为「日志提交」，回填本批全部 hash 与验证结果，并打 tag（`uiux/base` … `uiux/structure`）。
- 批次级回退：`git reset --hard uiux/<batch>`（未推送）；已推送用 `git revert <old>..<tag>`。
- 只点名 `git add <file>`；`next-env.d.ts` 跟踪 build 变体，本地 dev 产生的 diff 一律不入库。

## 批次 0 · 修红基线（tag `uiux/base`）

| hash | 提交 | 改动 | 验证 | 回退 |
|---|---|---|---|---|
| `29e2794` | test: 回归一致性校验改内容锚点，消除行号漂移误红 | `tests/regression-doc-consistency.test.ts`、`docs/product/regression-test-issues-2026-09-06.md` | typecheck ✅；vitest 435/435 ✅（改造前 2 failed） | `git revert 29e2794` |
| `8526ec9` | docs: 入库 UI/UX 审查与设计契约，CI 覆盖 feat 分支 | `docs/design/*`、`docs/README.md`、`.github/workflows/ci.yml`、`.gitignore` | typecheck ✅；vitest 435/435 ✅ | `git revert 8526ec9` |

批次验证（tag `uiux/base` 前）：`npm run typecheck` ✅ · `npx vitest run` 435/435 ✅ · `npm run eval:golden` 31/31 ✅ · `npm run test:rls:local` ✅ · `npm run e2e` 58/58 ✅。
批次回退：`git reset --hard uiux/base`（未推送）或 `git revert 21c4f05..uiux/base`（已推送）。

## 批次 1 · 测试脚手架（tag `uiux/harness`）

| hash | 提交 | 改动 | 验证 | 回退 |
|---|---|---|---|---|
| `75e10a6` | test: 增量补 data-testid 脚手架，解耦 e2e 与按钮文案 | `app-shell.tsx`、`signout-button.tsx`（约 24 处 testid） | typecheck ✅ vitest 435 ✅ e2e 58 ✅（证明 accname 未变） | `git revert 75e10a6` |
| `aefef3d` | test: e2e 导航迁 gotoView(testid)，enterApp 守卫串收敛为 UI_LABELS | `e2e-helpers.ts` + 10 个 spec | typecheck ✅ vitest 435 ✅ e2e 58 ✅ | `git revert aefef3d` |
| `0f175ba` | test: 主流程点击迁 testid，设计令牌收敛为 FONTS/INK 常量 | `app-shell.tsx`(3 锚点)、`e2e-helpers.ts`、9 个 spec | typecheck ✅ vitest 435 ✅ | `git revert 0f175ba` |

批次验证（tag `uiux/harness` 前）：typecheck ✅ · vitest 435/435 ✅ · golden 31/31 ✅ · rls ✅ · e2e 58/58 ✅。
批次回退：`git reset --hard uiux/harness` 或 `git revert uiux/base..uiux/harness`。

## 批次 2 · 文案 C1-C35（tag `uiux/copy`）

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `4a04001` | C1-C3 运行态披露改白话 | 演示模式在聊天阶段即披露 | `git revert 4a04001` |
| `99258b3` | C4 侧栏去存储来源 | 含清理 historyStatus 死状态 | `git revert 99258b3` |
| `529819a` | C5 退出按钮单一意图 | 「退出登录」 | `git revert 529819a` |
| `9f99491` | C6/C17 状态标签解耦 | 新增 ui-labels.ts；类名 ASCII 化；复练结果改三态 | `git revert 9f99491` |
| `546d19b` | C7-C12 登录页 | 单一时长口径；提交改「继续」；去 Supabase 术语 | `git revert 546d19b` |
| `d95357a` | C13-C21 今日训练页 | 世界/挑战/画像 改 情境/练习/判断报告；重点卡按钮与文字一致 | `git revert d95357a` |
| `b3a7b5c` | C22-C30 工作台 | 去粘连 eyebrow；actor 统一；发送按钮恒名+旁注 | `git revert b3a7b5c` |
| `f5d181e` | C31-C35 + X4-X7 | 必填说明移按钮旁；Rubric/World/Model 改中文 | `git revert f5d181e` |

批次验证（tag `uiux/copy` 前）：typecheck ✅ · vitest 435/435 ✅ · golden 31/31 ✅ · rls ✅ · e2e 58/58 ✅。
批次回退：`git reset --hard uiux/copy` 或 `git revert uiux/harness..uiux/copy`。

## 批次 3 · P0 交互（tag `uiux/p0`）

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `554d1b6` | P0-2 禁用态可读配色 + 解锁提示 | 去全局 opacity 洗白；发送/结束/复练补说明 | `git revert 554d1b6` |
| `32146a1` | P0-6 FAB 安全区 | .content 底留白 96px；右栏 84px | `git revert 32146a1` |
| `03310d6` | P0-7 弹窗 dialog 语义 | 新增 useDialogA11y；模型设置首屏演示模式说明 | `git revert 03310d6` |
| `96776ad` | P0-8 页头焦点环 | 抑制 tabIndex=-1 的 :focus-visible 环 | `git revert 96776ad` |

批次验证（tag `uiux/p0` 前）：typecheck ✅ · vitest 435/435 ✅ · golden 31/31 ✅ · rls ✅ · e2e 58/58 ✅。
批次回退：`git reset --hard uiux/p0` 或 `git revert uiux/copy..uiux/p0`。

## 批次 4 · 视觉基线（tag `uiux/visual`）

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `efdd019` | 18 字体 token | 标题去衬线、正文去 Inter；FONTS 常量同步 | `git revert efdd019` |
| `70abbb6` | 19 颜色收敛 | 单一强调 #1F6F54；删 6 条彩虹边条；indigo 身份用法改 sage/中性 | `git revert 70abbb6` |
| `0515601` | 20 图标库 | @phosphor-icons/react 替换 ⚙●↗▸×✓ | `git revert 0515601` |
| `e9abba2` | 21 删编号与 eyebrow | ⚠ 曾带红落地：删编号 span 未同步导航 grid 轨道，按钮高 206px 掉出视口致 9 个 e2e 超时 | `git revert e9abba2`（须与 0907465 成对） |
| `0907465` | 21-fix 配套布局 | 导航改 block 单列、skill-row 两列；e2e 恢复 58/58 | 与 e9abba2 成对 |
| `d05291e` | 22 圆角单一尺度 | 七种散落圆角收敛为 12/8/999 | `git revert d05291e` |

事故记录：e9abba2 的验证命令用了 `npm run e2e | tail`，管道掩盖了 playwright 退出码，
使 9 个失败未阻断提交。此后验证一律以 `grep -E "Tests |passed|failed"` 直读结果并人工核对计数。
批次验证（tag `uiux/visual` 前）：typecheck ✅ · vitest 435/435 ✅ · golden 31/31 ✅ · rls ✅ · e2e 58/58 ✅。
批次回退：`git reset --hard uiux/visual` 或 `git revert uiux/p0..uiux/visual`（e9abba2 与 0907465 成对）。

## 批次 5 · 结构改造（tag `uiux/structure`）

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `8ce7284` | 23+24 模式切换上移 + 一句话解释 | 聊天头；aria-describedby；MODE_HINTS | `git revert 8ce7284` |
| `0e7026c` | 25 覆盖度 n/5 + 点亮 | 去 0% 百分比；命中 180ms 动效（reduced-motion 关闭） | `git revert 0e7026c` |
| `352378b` | 26 覆盖度清单 ul/li | 语义化列表 | `git revert 352378b` |
| `0772a9b` | 27 画布预填（P0-4） | judgment-draft.ts + 6 条单测锁不变量 | `git revert 0772a9b` |
| `eebff30` | 28 新人态收敛 | 能力页第一步 CTA；团队面板下移；复盘单一空态 | `git revert eebff30` |

deferred：训练地图「分组折叠」暂缓——`scenario-library.spec.ts` 以
`.scenario-card` 计数 12 与入口顺序 rect 为契约，折叠会破坏；待该契约改为
testid 语义后再做（另立提交）。
批次验证（tag `uiux/structure` 前）：typecheck ✅ · vitest 441/441 ✅ · golden 31/31 ✅ · rls ✅ · e2e 58/58 ✅。
批次回退：`git reset --hard uiux/structure` 或 `git revert uiux/visual..uiux/structure`。

## 验收复核（2026-09-18，浏览器实测 1440×900）

已确认生效：登录页无衬线标题/单一时长块/「继续」提交/白话存储说明/登录模式无重复注册入口；
侧栏无编号、「退出登录」单一意图、「产品练习生」无来源泄漏；首页「开始首次练习/进入情境对话/
下一个情境/还没开始/没练过/去开始第一次练习」；工作台白话横幅、模式切换在聊天头并带一句话解释、
actor 统一「AI 角色」、覆盖度「0 / 5 个信息维度已问到」+ 解锁提示、「← 返回」不再与标签粘连。

已知遗留（批次 6 已全部关闭，逐项标注落点提交）：
1. 登录页仍留英文 eyebrow「PRODUCT DISCOVERY GYM」与重复 PD 标记（V9/V10）。✅ `3c06d02`
2. 0 训练时右栏 week-bars 仍画 5 根空柱（D3 假数据可视化未移除）。✅ `3c06d02`
3. 训练地图分组折叠 deferred（见批次 5 说明）。✅ `1f01801`
4. 反馈 FAB 在滚动中途仍可能悬浮于右栏文字之上（到底时已让位）。✅ `9015275`
5. 登录页 hero H1 仍为三行超大字号（gpt-taste 两行铁律未达标）。✅ `3c06d02`

## 批次 6 · 残留清理（tag `uiux/residual`）

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `3c06d02` | 残留 1/2/5 | 登录面板去 PD 标记与英文 eyebrow、hero H1 收敛两行；week-bars 改真实进度条（role=progressbar，段数=周目标，完成段才点亮） | `git revert 3c06d02` |
| `9015275` | 残留 4 | 反馈入口从悬浮 FAB 移入页头 `.topbar-actions`（testid `feedback-open`），弹层改居中模态 + 遮罩；全页零 fixed 定位元素 | `git revert 9015275` |
| `1f01801` | 残留 3 | 训练地图按五个能力分组（原生 details/summary，组头含场景数与「还没练过/已练 n」）；状态标签只在真有状态时渲染；e2e 契约改 testid 语义并新增 2 条用例 | `git revert 1f01801` |
| `a5f579c` | 批次6-fix | 分组折叠真隐藏（显式 `:not([open])` display:none）；`.scenario-topline` 两端对齐 | `git revert a5f579c` |

契约变化（随 `1f01801` 落地）：
- `scenario-library.spec.ts`：12 张卡计数改 `[data-testid^='scenario-card-']`；新增「分组折叠可逆」
  与「状态标签只在真有状态时出现」两条用例；旧 `.scenario-card` 类名计数与入口 rect 契约作废。
- `training-history.spec.ts`：「还没开始」文本断言改 `scenario-status-dashboard-request` 计数 0。
- `DESIGN.md`：FAB 反模式措辞改为「modals, dialog panels」。

事故记录（折叠假通过）：`1f01801` 的折叠用例在 Playwright 自带 Chromium 151 上通过，
但真实 Chrome 153 里收起组时卡片仍可见——`.scenario-grid` 的作者层 `display:grid`
盖掉了 UA 对未 open details 的隐藏，而 Chromium 151 的 `::details-content`
`content-visibility:hidden` 恰好让 `toBeHidden()` 成立，掩盖了缺陷。
`a5f579c` 显式声明 `.scenario-group:not([open]) > .scenario-group-desc/.scenario-grid { display:none }`，
并在真实浏览器复测：收起 rect=0 / 展开 rect=263，强加回作者 display 即复现旧缺陷，确认修复为承重件；
定向回归 `npx playwright test tests/scenario-library.spec.ts` 10/10 通过。

浏览器实测（2026-09-18，1440×900，dev 模式）：登录页 H1 两行（48px/行高 57.6，盒高 115px）、
面板无 PD 标记与英文 eyebrow；今日视图周进度为 5 段中性条且 `aria-valuenow=0`、无 `.feedback-fab`、
页头出现「反馈」按钮、全页 `position:fixed` 元素为 0；反馈模态居中带遮罩、Esc 可关；
训练地图 5 组（2/2/4/2/2）默认全开、无「还没开始」空标签、卡片标题行对齐、折叠/展开可逆。

批次验证（tag `uiux/residual` 前）：typecheck ✅ · vitest 441/441（69 files）✅ · golden 31/31（VALID 30 cases）✅ · rls ✅ · e2e 60/60 ✅。
批次回退：`git reset --hard uiux/structure` 或 `git revert uiux/structure..uiux/residual`。
