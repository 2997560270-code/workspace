# 测试反馈修复变更清单（2026-09-05）

> 依据：`user-trial-feedback-2026-09-02.md`（FB-001~FB-014）、`regression-test-issues-2026-09-04.md`（RT-001~RT-006）。
> 本清单记录已完成的代码/文档修改，便于协作者拉取后验收。

## 一、已修复（代码）

| 编号 | 模块 | 修复内容 | 优先级 | 提交 |
| --- | --- | --- | --- | --- |
| FB-013 | 世界工作台 | 无有效调查证据时禁止进入决策阶段与「揭示后果」（前端 + 服务端 `decisions` 路由校验 `evidence_basis` 非空）；揭示文案展示短期/中期/长期完整因果链并标注「过早承诺/充分调查」路径；客户端不再把服务端 4xx 当作离线演示而静默生成本地决策 | P0 | 705667b |
| FB-014 | 评分完整性 | 签名密钥 fail-closed（生产必须配置 `INTEGRITY_SECRET`，移除公开 `DEV_SECRET` 兜底）；仅服务端签名且校验通过的记录计入正式能力证据 | P0 | 705667b |
| FB-011 | 团队点评 | 复盘页「本账号备注」的点评人改为当前登录账号（不可手填），点评归属当前账号，杜绝代写/冒充身份 | P0 | 705667b |
| FB-006 | 世界决策记录 | 「揭示后果」即视为完成该世界（`revealDecisionConsequences` 同步将 run 标记为 `completed`，服务端 + demo 两条路径），复盘页「世界决策记录」、世界推进、能力统计 / 判断画像即可读到已观察到的结果；后续反馈步保持幂等 | P0 | cd1d78a |
| FB-008 | 多角色训练 | 默认「今日训练」页补充多人角色训练入口，不再仅藏在二级「训练地图」 | P1 | 705667b |
| FB-009 | 团队成员视图 | 负责人/导师可查看成员训练概况；远程（服务端）团队走新增的按成员读取记录接口（含 owner/coach 越权校验），本地团队读取本机训练历史 | P1 | 705667b |
| FB-012 / RT-006 | 标准化考核 | 训练地图新增「标准化考核」直达入口；资源中心支持初始标签深链；入口卡片与资源中心介绍文案覆盖考核 | P1 | 705667b |
| RT-001 / FB-002 | 语音输入 | 提示文案说明「Chrome 语音识别需上传云端识别服务，当前网络无法访问该服务」，避免误导为「没联网」 | P1 | 705667b |
| RT-003 | 复盘展示 | 判断画布 / 对话段落补 `overflow-wrap: anywhere; word-break: break-word; min-width:0;`，长文本不再横向溢出 | P1 | 705667b |
| RT-004 | 团队提示 | 团队名称 / 邀请码输入补动态长度提示，修正邀请码 placeholder（实际 4–16 位，字母数字） | P2 | 705667b |
| RT-005 | 角色指派 | 新增 `set_role` 接口 + 成员角色下拉（learner / coach），owner 角色不可被改动 | P1 | 705667b |

## 二、已修复（文档，不改代码）

| 编号 | 内容 | 提交 |
| --- | --- | --- |
| RT-002 | 「训练 / 练习 / 严格」模式定义区分：训练=完整诊断流程、练习=单环节练习、严格=限时高等级验证；并将已废弃的「独立模式」更名为「训练模式」（`product-requirements-document.md` §4.1 与 `direction-a-product-optimization.md` §5.4）。未改动存储枚举值，避免破坏历史签名 | cd1d78a |

## 三、此前已在代码中修复、需运行时回归确认（无需再改代码）

- **FB-003** 训练地图完成训练后即时刷新（已改为从训练记录推导）。
- **FB-004** 训练模式命名已对齐为「训练 / 严格 / 练习」（旧名「独立」废弃，仅在 schema 里作归一化）。
- **FB-005** 切换模式计时器不再 +1 秒（`applyStrictDeadline` 同步刷新 clockMs）。
- **FB-007** 世界 1/2/3 轨道导航已实现（三个世界可切换、有进度状态与顺序说明）。

## 四、暂缓处理（按当前决定不做）

- **FB-001** 注册/登录校验提示：代码已有校验，但字段非法时「注册」按钮直接置灰导致反馈不可见，需要改 `login-form.tsx` 让提示及时显示。暂缓。
- **FB-010** 盲评「至少 20 字」无提示：`validation-lab-panel` / `community-review-panel` 的盲评理由只有 placeholder、无实时提示。暂缓。
- **FB-002 / RT-001（功能本体）**：语音识别目前仅改文案；功能本身需接入可配置的服务端 ASR（新增接口 + 密钥），暂缓。

## 五、涉及文件

- `product-drill-app/src/app/api/challenge-runs/[id]/decisions/route.ts`
- `product-drill-app/src/app/api/teams/route.ts`
- `product-drill-app/src/app/app-shell.tsx`
- `product-drill-app/src/app/globals.css`
- `product-drill-app/src/app/resource-hub-panel.tsx`
- `product-drill-app/src/app/team-workspace-panel.tsx`
- `product-drill-app/src/app/voice-input-button.tsx`
- `product-drill-app/src/app/world-workbench.tsx`
- `product-drill-app/src/lib/repositories/challenge-repository.ts`
- `product-drill-app/src/lib/repositories/team-repository.ts`
- `product-drill-app/src/lib/team-workspace.ts`
- `product-drill-app/src/lib/training-integrity.ts`
- `docs/product/product-requirements-document.md`（RT-002）
- `docs/product/direction-a-product-optimization.md`（RT-002）
