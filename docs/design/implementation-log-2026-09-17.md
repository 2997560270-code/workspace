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
