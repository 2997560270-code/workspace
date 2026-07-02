# Product Drill MVP 项目工程目录说明

创建时间：2026-07-01  
适用阶段：从 Demo V3 进入正式 MVP 开发阶段  
目录目标：把后续代码、测试、提示词、设计资料、发布脚本和工程配置按统一规则存放，避免文件散落。

## 一、总目录

```text
product-drill-mvp/
├─ apps/
│  └─ web/                         # Web 前端应用
├─ packages/                       # 可复用公共包
├─ docs/                           # 工程内开发资料
├─ scripts/                        # 本地开发、测试、发布脚本
├─ config/                         # 工程配置
└─ storage/                        # 本地上传与导出临时目录
```

## 二、apps/web 前端应用目录

```text
apps/web/
├─ src/
│  ├─ app/                         # 应用入口、路由、全局挂载
│  ├─ pages/                       # 页面级组件
│  ├─ components/
│  │  ├─ layout/                   # 侧边栏、顶部栏、页面框架
│  │  ├─ ui/                       # 按钮、输入框、卡片等基础组件
│  │  └─ domain/                   # 业务组件
│  │     ├─ training/              # 训练工作台组件
│  │     ├─ products/              # 我的产品组件
│  │     ├─ history/               # 历史记录组件
│  │     └─ ability-profile/       # 能力画像组件
│  ├─ features/                    # 按业务模块组织的状态、逻辑和组合组件
│  ├─ hooks/                       # 通用 Hooks
│  ├─ lib/                         # 通用工具和适配层
│  ├─ services/                    # AI、存储、接口服务
│  ├─ store/                       # 全局状态
│  ├─ styles/                      # 全局样式、设计变量
│  ├─ types/                       # 前端类型定义
│  └─ assets/                      # 图片、图标等静态资产
├─ tests/
│  ├─ unit/                        # 单元测试
│  ├─ e2e/                         # 端到端测试
│  └─ fixtures/                    # 测试样例数据
└─ public/                         # 可直接访问的静态资源
```

## 三、packages 公共包目录

```text
packages/
├─ shared/                         # 全项目通用类型、常量、工具函数
├─ prompts/                        # AI 提示词模板
│  ├─ training/                    # 训练追问提示词
│  ├─ product-analysis/            # 自有产品分析提示词
│  └─ evaluation/                  # 方案评估提示词
└─ test-utils/                     # 测试辅助工具
```

## 四、docs 工程资料目录

```text
docs/
├─ requirements/                   # 需求说明、需求变更、人工审核结论
├─ product/                        # 产品方案、模块说明、用户流程
├─ design/                         # UI 规范、Demo V3 对齐说明、交互说明
├─ development/                    # 开发计划、模块拆分、技术方案
├─ testing/                        # 测试用例、测试报告、验收记录
└─ release/                        # 发布记录、同步记录、版本说明
```

说明：桌面 `项目文档/` 是项目管理主文档区；`product-drill-mvp/docs/` 是工程内部文档区。正式开发时，两边职责如下：

- `项目文档/`：给人看的项目管理、流程、审核、决策文档。
- `product-drill-mvp/docs/`：跟代码强相关的技术文档、测试记录、发布记录。

## 五、scripts 与 config

```text
scripts/
├─ dev/                            # 本地启动、环境检查脚本
├─ test/                           # 测试运行脚本
└─ release/                        # 打包、同步、发布脚本

config/                            # ESLint、Prettier、测试、构建等配置文件
```

## 六、storage 本地临时目录

```text
storage/
├─ uploads/                        # 用户上传产品文档、源代码的本地临时目录
└─ exports/                        # 导出的报告、测试截图、临时产物
```

注意：`storage/` 只保留目录结构，不保存真实用户资料到 GitHub 或飞书。

## 七、后续开发放置规则

1. 页面级入口放在 `apps/web/src/pages/`。
2. 通用 UI 组件放在 `apps/web/src/components/ui/`。
3. 侧边栏、顶栏、页面壳放在 `apps/web/src/components/layout/`。
4. 业务组件优先放在 `apps/web/src/components/domain/对应模块/`。
5. 业务状态、数据处理和模块组合逻辑放在 `apps/web/src/features/对应模块/`。
6. AI 提示词不直接散落在页面组件中，统一放入 `packages/prompts/`。
7. 类型定义优先放在 `apps/web/src/types/` 或 `packages/shared/src/types/`。
8. 测试文件按单元测试和 e2e 测试分别放入 `apps/web/tests/unit/` 与 `apps/web/tests/e2e/`。
9. 每个新模块开发前，先在 `项目文档/03_开发计划/` 写模块开发计划。
10. 每个模块验收后，把测试记录放入 `项目文档/04_测试与验收/`。

## 八、不进入该目录的内容

以下内容不放入 `product-drill-mvp/`：

- `归纳总结/开发记录.md`
- `.codegraph/`
- 飞书 CLI 临时认证信息
- 真实用户上传资料
- 大体积截图、录屏和临时调试日志
- 已废弃的旧 demo 入口

## 九、当前状态

该目录目前只创建规范结构和占位文件，尚未迁移 Demo V3，也尚未写入正式业务代码。正式开发开始后，将按测试先行方式逐个模块迁入和重构。
