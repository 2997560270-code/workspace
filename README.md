# Product Drill AI

> 一个 AI 产品发现训练场：不让 AI 替你做产品发现，而是让 AI 为你提供一个可以反复试错、拿到可追溯反馈的真实业务情境。

[Product Drill 产品需求文档（PRD）](docs/product/product-requirements-document.md) ·
[文档索引](docs/README.md) ·
[GitHub Issues](https://github.com/2997560270-code/workspace/issues)

---

## 一、项目是什么（What）

**Product Drill 是一个训练「产品判断力」的应用。** 它不以输出标准答案为目标，而是让产品经理新人、转岗者和产品决策负责人在真实业务情境中完成「追问 → 证据判断 → 方案决策」，再根据用户**原始回答**给出可追溯的反馈与针对性复练。

一句话定位：*让产品新人用每天 10 分钟，在真实业务情境中练习用户访谈、需求澄清、问题判断与方案设计，并通过逐句证据反馈和针对性复练持续提升。*

核心闭环：

> 进入情境 → 追问业务角色 → 形成判断 → 提交决策 → 查看证据反馈 → 针对短板复练 → 累积能力证据

### 目标用户

- 产品经理新人、产品岗位候选人；
- 正在转岗、需要补足产品发现能力的人；
- 需要训练团队判断质量的产品主管或导师。

### 核心产品体验

- **首次诊断与训练地图**：每日训练推荐、训练模式/严格模式/练习模式、训练历史与局部复练。
- **AI 角色对话**：AI 扮演业务角色但不直接泄露答案，用户可以连续追问当前流程、影响、替代方案与成功指标。
- **判断画布与证据反馈**：用户提交核心用户、当前流程、核心问题、问题影响、替代方案、建议行动、成功指标与最大假设；反馈必须引用用户原始回答，给出支持证据、反证、缺失信息与下一步动作。
- **世界工作台与三世界迁移**：世界由可追溯的事实、状态、行动与后果组成；世界 1/2/3 依次验证同一个底层判断习惯是否迁移。
- **多视角与扩展训练**：自定义场景、课程、产品资料生成实验、多人角色训练与语音输入。

### 当前实现状态

`product-drill-app/` 是本仓库**唯一的活动应用**。MVP 已可本地运行；生产化、商业化与外部效度验证尚未完成。需求、缺陷与工作状态以 GitHub Issues 为唯一事实来源。

| 模块 | 状态 | 主要入口 |
| --- | --- | --- |
| 首次诊断、训练地图、训练历史 | 已实现 | 今日训练、训练地图、复盘与复练 |
| AI 对话、判断画布、证据反馈 | 已实现 | 训练工作台 |
| 世界工作台与三世界迁移 | 已实现本地闭环 | 今日训练 → 世界工作台 |
| 我的能力与判断证据 | 已实现 | 我的能力 |
| 自定义场景、课程、语音、多角色 | 已实现本地版本 | 训练地图 |
| 社区案例、知识库、内容审核 | 已实现本地/API 基础 | 资源中心 |
| 邀请制验证、社区盲评 | 已实现服务端边界和本地控制台 | 资源中心 |
| 标准化考核评分 | 已实现诊断版本 | 资源中心 |
| 赛季排名 | 仅有受约束的服务端基础 | 暂无正式公开入口 |
| 真实支付 | 仅有订阅状态模型 | 暂未接入支付商 |
| 多人会话服务端 | 已实现 API 与本地回退 | 多人角色训练 |

---

## 二、为什么做（Why）

### 用户痛点

- 学习材料通常讲概念，却缺少真实决策练习；
- 通用 AI 容易直接给答案，用户无法知道自己的提问和判断哪里不足；
- 传统分数缺少原始证据，难以复盘和证明改善；
- 用户在不同情境中是否能迁移判断习惯，通常没有被单独验证。

### 设计原则

1. **训练行为，而不是讲授知识**；
2. **评分必须引用用户真实回答**；
3. **AI 模拟不能伪装成真实市场证据**；
4. **一次只训练一个主要能力**；
5. **先反馈具体行为，再给抽象分数**；
6. **复练比历史存档更重要**；
7. **能力画像必须由多次可比较训练形成**；
8. **场景深度优先于场景数量**。

### 边界与非目标

Product Drill **不替用户完成真实市场调研或业务决策**，也**不把离线降级反馈、导师点评、课程进度和社区内容直接计入正式能力趋势**。在真实参与者、独立评审、岗位效度、公平性与评分一致性研究完成前，指标只用于产品试验，不能宣传为已验证能力提升；评分是诊断辅助，不是招聘结论。

### 成功标准（北极星）

> 每周完成「训练 → 反馈 → 复练」闭环的有效用户数。

有效闭环定义：完成一轮训练；查看至少一个证据反馈；针对一个短板完成复练；且复练表现高于首次表现。

---

## 三、怎么做（How）

### 技术栈

- **前端/服务端**：Next.js、React、TypeScript
- **AI**：OpenAI 官方接口或任意 OpenAI 兼容服务（角色扮演模型 + 评测模型分离）
- **数据与鉴权**：Supabase（含 RLS）、Zod 校验
- **可观测**：PostHog、Sentry
- **测试**：Vitest（单元/集成）、Playwright（E2E/自动化）、黄金评测（golden evals）
- **本地回退**：无 Supabase 时支持受控本地文件回退

### 仓库结构

| 路径 | 用途 |
| --- | --- |
| `product-drill-app/` | Next.js 产品应用、测试与评测数据 |
| `docs/product/` | 当前产品方案（PRD、AI 原生重构、方向 A） |
| `docs/adr/` | 已接受的架构决策 |
| `docs/research/` | 研究与评测资料 |
| `docs/agents/` | 代理协作和 Issue 规范 |
| `plugins/product-drill-lifecycle/` | Product Drill 生命周期插件 |
| `start-test.cmd` | Windows 一键启动入口 |

### 本地开发

最方便的 Windows 测试入口是双击仓库根目录的 `start-test.cmd`。它会自动检查依赖、启动开发服务器，并在服务就绪后打开浏览器。

```powershell
cd product-drill-app
npm ci
npm run dev
```

### AI API 配置

在 `product-drill-app/.env.local` 中配置服务端密钥。OpenAI 官方接口只需要密钥；OpenAI 兼容服务还需要配置服务地址和该服务提供的模型 ID：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_ROLEPLAY_MODEL=gpt-5.6-luna
OPENAI_EVALUATION_MODEL=gpt-5.6-terra
```

`.env.local` 已被 Git 忽略，密钥不会进入仓库。修改配置后需要重启开发服务。完整的环境变量清单见 `product-drill-app/.env.example`。

> **fork / 本地开箱即用**：未配置 Supabase 时，登录页默认是**本地邮箱注册/登录**——注册即登录、无需邮箱验证，账号数据保存在本机（`product-drill-app/data/local-runtime-state.json`）；配置 Supabase 后自动切换为云端邮箱登录。

### 验证

```powershell
npm run typecheck
npm test
npm run eval:golden
npm run build
npm run e2e:run
```

Windows PowerShell 若阻止执行 `npm.ps1`，请将上述 `npm` 替换为 `npm.cmd`。

### 文档与协作

- 项目背景与领域词汇：[CONTEXT.md](./CONTEXT.md)
- 文档索引：[docs/README.md](./docs/README.md)
- 产品需求文档（PRD）：[docs/product/product-requirements-document.md](./docs/product/product-requirements-document.md)
- AI 原生重构方案：[docs/product/ai-native-refactor-plan.md](./docs/product/ai-native-refactor-plan.md)
- 方向 A 产品优化方案：[docs/product/direction-a-product-optimization.md](./docs/product/direction-a-product-optimization.md)
- 研究与评测题库：[docs/research/product-discovery-assessment-item-bank.md](./docs/research/product-discovery-assessment-item-bank.md)
- 协作规则：[AGENTS.md](./AGENTS.md)
- 需求与缺陷：[GitHub Issues](https://github.com/2997560270-code/workspace/issues)

### 贡献约定

- 需求、缺陷与工作状态以 [GitHub Issues](https://github.com/2997560270-code/workspace/issues) 为唯一事实来源，操作规范见 `docs/agents/issue-tracker.md` 与 `docs/agents/triage-labels.md`。
- 协作与领域文档采用单上下文布局，见 `docs/agents/domain.md`。
- 请勿恢复已删除的 `product-drill-mvp/`、`demov2/` 或 Demo V3 页面；`product-drill-app/` 是唯一活动应用。
