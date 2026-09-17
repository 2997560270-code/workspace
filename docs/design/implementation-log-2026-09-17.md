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
