# Product Drill AI

`product-drill-app/` 是本仓库唯一的活动应用。需求、缺陷和工作状态以 GitHub Issues 为准。

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| `product-drill-app/` | Next.js 产品应用、测试与评测数据 |
| `docs/product/` | 当前产品方案 |
| `docs/adr/` | 已接受的架构决策 |
| `docs/research/` | 研究与评测资料 |
| `docs/agents/` | 代理协作和 Issue 规范 |
| `plugins/product-drill-lifecycle/` | Product Drill 生命周期插件 |

## 本地开发

最方便的 Windows 测试入口是双击仓库根目录的 `start-test.cmd`。它会自动检查依赖、启动开发服务器，并在服务就绪后打开浏览器。

```powershell
cd product-drill-app
npm ci
npm run dev
```

## AI API 配置

在 `product-drill-app/.env.local` 中配置服务端密钥。OpenAI 官方接口只需要密钥；OpenAI 兼容服务还需要配置服务地址和该服务提供的模型 ID：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_ROLEPLAY_MODEL=gpt-5.6-luna
OPENAI_EVALUATION_MODEL=gpt-5.6-terra
```

`.env.local` 已被 Git 忽略，密钥不会进入仓库。修改配置后需要重启开发服务。

## 验证

```powershell
npm run typecheck
npm test
npm run eval:golden
npm run build
npm run e2e:run
```

Windows PowerShell 若阻止执行 `npm.ps1`，请将上述 `npm` 替换为 `npm.cmd`。

## 文档与协作

- 项目背景与领域词汇：[`CONTEXT.md`](./CONTEXT.md)
- 文档索引：[`docs/README.md`](./docs/README.md)
- AI 原生重构方案：[`docs/product/ai-native-refactor-plan.md`](./docs/product/ai-native-refactor-plan.md)
- 方向 A 产品优化方案：[`docs/product/direction-a-product-optimization.md`](./docs/product/direction-a-product-optimization.md)
- 协作规则：[`AGENTS.md`](./AGENTS.md)
- 需求与缺陷：[GitHub Issues](https://github.com/2997560270-code/workspace/issues)
