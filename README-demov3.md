# Product Drill Demo V3

Demo V3 是 Product Drill 的静态前端演示文件，当前用于测试训练设置确认流程、产品档案、历史记录和能力画像等模块。

## 推荐打开方式

在 Windows 上双击：

```text
打开测试-demov3训练设置确认流程.cmd
```

该入口会自动启动本地静态服务，并打开测试入口页面。

## 必要文件

请保持以下文件在同一目录：

```text
demov3.html
打开测试-demov3训练设置确认流程.cmd
打开测试-demov3训练设置确认流程.html
open-demov3-workbench-entry.ps1
serve-demov3-static.ps1
open-test-demov3.cmd
```

## 备用打开方式

如果不使用中文测试入口，也可以双击：

```text
open-test-demov3.cmd
```

或手动启动静态服务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve-demov3-static.ps1 -Root . -Port 3013
```

然后访问：

```text
http://127.0.0.1:3013/demov3.html
```

## 当前重点测试

- 训练设置未确认前，只显示“请选择您的训练设置”
- 点击“确定”后才开始训练并询问具体业务
- 训练中或训练完成后修改设置，按钮变为“确定更改”
- 点击“确定更改”后，上一轮训练归档到历史记录，并用新设置重新开始
- 历史记录模块内部滚动，不带动整个页面滚动
