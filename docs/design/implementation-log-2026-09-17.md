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

## 批次 7 · 调研驱动的细节优化（tag `uiux/polish`）

调研来源（2026-09-18，网络/GitHub）：Linear / Vercel Geist / shadcn / Notion 的 DESIGN.md 汇总
（soulcore-dev/soul-design-md）、anthropics/skills frontend-design、alexpate/awesome-design-systems、
Ant Design 字体/动效/空状态规范、ant-design-pro 账户设置 IA、Microsoft WinUI 设置指南、Apple HIG Settings、
NN/g 表单与响应时限、sparanoid/chinese-copywriting-guidelines、W3C clreq 中文排版需求、
thedaviddias/Front-End-Checklist、The A11Y Project Checklist。
落地规则摘要：摘要行 `minmax(0,1fr) auto auto` + 名称列 `min-width:0`；设置页单列 ≤680px、分区 ≤5 项、
即时生效 + 行内「已保存」；动效四档 100/150/200/300ms 且禁 spring/bounce；CJK 正文行高 1.7–1.8；
计数 tabular-nums；模态 scale-in 300ms；禁用态保持可读配色（P0-2 优先于 opacity 惯例）。

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `18fff51` | 能力页行布局修复 | 桌面三列 + 窄屏两行堆叠，修掉 38px 编号列残留导致的竖排断行；e2e 锁单行契约 | `git revert 18fff51` |
| `2501238` | 批次7-1 设置中心 | 账号/界面/模型三分区单列 680px；减少动画开关即时生效 + 行内反馈；入口统一「设置」 | `git revert 2501238` |
| `1ec1419` | 移除旧面板 | 删除被取代的 llm-config-panel（与 2501238 成对回退） | `git revert 1ec1419` |
| `43967fe` | 批次7-2 动效与排版 | --dur-1..4 / --ease-* token；按压 scale(.98)；模态 scale-in；CJK 行高 1.75；计数 tabular-nums | `git revert 43967fe` |
| `f2ed72d` | 设置中心 e2e 契约 | 分区可见 + 减少动画开关即时生效/持久化两条用例 | `git revert f2ed72d` |

契约变化：设置入口 testid 不变（`open-settings` / `sidebar-settings`），文案「模型设置」→「设置」；
新增 `reduce-motion-switch` testid 与 `html[data-reduce-motion]` 属性契约。

批次验证（tag `uiux/polish` 前）：typecheck ✅ · vitest 441/441（69 files）✅ · golden 31/31（VALID 30 cases）✅ · rls ✅ · e2e 63/63 ✅。
批次回退：`git reset --hard uiux/residual` 或 `git revert uiux/residual..uiux/polish`（2501238 与 1ec1419 成对）。

## 批次 8 · 隐藏开发态框架浮窗（tag `uiux/devtools`）

用户验收反馈（2026-09-18）：登录页左下角 Next.js 开发指示器（黑底 N 徽标）点击后展开全英文框架调试面板，
与全中文演示界面冲突。该浮窗为 Next 内置 dev overlay（`nextjs-portal` shadow DOM），非应用 UI、无法本地化，
且仅 dev 模式出现、生产构建不含。处理：`next.config.ts` 设 `devIndicators: false` 整体关闭；
编译错误浮层不受影响（无错误时 shadow root 可见节点为 0）。

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `61b354f` | 关闭开发指示器 | `devIndicators: false`；重启 dev server 实测 shadow root 无指示器标记、0 可见节点 | `git revert 61b354f` |

契约变化：无（testid / 文案 / 存储结构均未动）。仅 dev 模式观感变化，e2e 跑生产构建故不受影响。

批次验证（tag `uiux/devtools` 前）：typecheck ✅ · vitest 441/441（69 files）✅ · e2e 63/63 ✅
（配置级改动，不触及 golden/rls 覆盖范围）。
批次回退：`git reset --hard uiux/polish` 或 `git revert uiux/polish..uiux/devtools`。

## 批次 9 · 术语白话化：用户可见「世界」统一为「情境」（tag `uiux/copy-2`）

用户验收反馈（2026-09-18）：「我的能力」页仍出现「世界判断证据」「世界工作台」「判断证据画像」
「陌生世界」等内部术语。排查发现今日页既有白话词已是「情境 / 情境对话」（世界工作台入口按钮即
「进入情境对话」），能力页与工作台是漏网 outlier；且工作台顶栏把英文枚举 `transfer_role`
（calibration/intervention/transfer_test）直接渲染进了界面。

术语映射（仅用户可见文案；代码内领域名 world_* 保持不变）：
世界工作台→情境对话 · 世界 N→情境 N · 陌生世界→新情境 · 同世界→同情境 ·
聊天角色「世界」→「对方」 · 判断证据画像→判断证据 · transfer_role→基线轮/修正轮/迁移轮。
覆盖文件：judgment-profile-panel（空态/摘要/证据卡/历史面板）、world-workbench（顶栏/进度轨/
错误闸门/揭示文案）、app-shell（页头标题与描述）、challenge-selector（选择理由）、
judgment-profile-builder（置信度标签）、intervention-generator（干预文案）。

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `485ec41` | 术语白话化 | 上述 6 个源文件 + 4 个测试契约同步（能力页例证、进度轨、页头 h1、选择理由） | `git revert 485ec41` |

契约变化：e2e 断言文案同步更新——`世界决策记录`→`情境决策记录`、`世界 1/2/3`→`情境 1/2/3`、
页头 h1 `世界工作台`→`情境对话`、能力页空态两条例证改为「例如「…」」句式、
challenge-selection 单测 `校准世界`→`基线情境`。testid 均未变。

批次验证（tag `uiux/copy-2` 前）：typecheck ✅ · vitest 441/441（69 files）✅ · e2e 63/63 ✅。
浏览器实测：能力页空态 h2「还没有情境对话的判断证据」+ 四条白话例证；工作台 h1「情境对话」、
顶栏「情境 1 / 3 · B2C / AI 工具产品 · 基线轮」、进度轨「情境 1/2/3」、聊天角色「对方」。
批次回退：`git reset --hard uiux/devtools` 或 `git revert uiux/devtools..uiux/copy-2`。

## 批次 10 · 训练工作区 100% 缩放布局重排（tag `uiux/workspace`）

用户验收反馈（2026-09-18，100% 缩放截图）：训练工作区 composer 的「语音输入 / 给我一点提示 /
发送追问」被压到 CJK 竖排断行、简报列过窄挤出自滚动条、右栏「0 / 5 个信息维度已问到」互挤换行。
根因：`.training-shell` 三列最小宽之和（300+420+250+gap）超过 100% 缩放下主区可用宽（约 1000–1100px），
中列 `minmax(420px,1fr)` 的下限使网格溢出，composer 的 space-between 单行把按钮压碎。
漏测原因：e2e 默认视口 1280×720 命中 ≤1180px 的两列分支，三列桌面布局从未被覆盖。

落地（沿用批次7 调研规则：摘要列 `minmax(0,1fr)` 防溢出、控件 nowrap、行高/间距 token 不变）：
- 列宽改 `clamp(280px,23vw,360px) minmax(0,1fr) clamp(232px,19vw,280px)`，gap 18px
- `.composer-actions` 改 `flex-wrap: wrap`；按钮/语音/提示按钮 `white-space: nowrap; flex: 0 0 auto`；
  主按钮 `margin-left: auto` 靠右；`.composer-note` `flex-basis: 100%` 独立成行
- 覆盖度计数与单位上下堆叠（`flex-wrap` + 单位 `flex-basis: 100%`），计数保持 tabular-nums
- 简报列 `scrollbar-width: thin` + 标题 `text-wrap: balance`；会话头状态（练习模式/计时）`margin-left: auto` 右对齐
- 新增 `tests/training-layout.spec.ts`：`test.use({ viewport: 1366×768 })` 锁单行按钮高度、
  零横向溢出、计数堆叠三条契约，补上桌面三列分支的覆盖缺口

| hash | 提交 | 覆盖 | 回退 |
|---|---|---|---|
| `28070f9` | 布局重排 + 回归 e2e | globals.css 训练工作区段 + 新 spec（e2e 63→64） | `git revert 28070f9` |

契约变化：新增 e2e 用例 1 条（64/64）；testid 未变（复用 `send-reply` / `request-hint` /
`coverage-summary` / `coverage-unit`）。

批次验证（tag `uiux/workspace` 前）：typecheck ✅ · vitest 441/441（69 files）✅ · e2e 64/64 ✅。
截图实测（Playwright 1366×768 与 1440×900）：composer 三控件单行、提示语独立成行、
三列零横向溢出、右栏计数堆叠、简报标题两行平衡断行。
批次回退：`git reset --hard uiux/copy-2` 或 `git revert uiux/copy-2..uiux/workspace`。
