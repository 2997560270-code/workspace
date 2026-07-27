# Product Drill AI

`product-drill-app/` 是本仓库唯一的活动应用。需求、缺陷和工作状态以 GitHub Issues 为准。

## 本地开发

```powershell
cd product-drill-app
npm ci
npm run dev
```

## 验证

```powershell
npm run typecheck
npm test
npm run eval:golden
npm run build
npm run e2e:run
```

项目背景见 [`CONTEXT.md`](./CONTEXT.md)，架构决策见 [`docs/adr/`](./docs/adr/)，协作规则见 [`AGENTS.md`](./AGENTS.md)。
