# PR 自动化与 CI 质量门

本规则沉淀自成熟 monorepo 的 PR 工作流：本地先分层验证，CI 再并行复核，PR 描述必须可审阅、可追溯、可回滚。

## 目标

- 提交前尽早发现 lint、单测、构建、E2E 问题。
- 避免把无关脏文件、临时备份文件或未验证变更混入 PR。
- 让 PR 描述包含背景、改动、验证结果和风险点。
- 推送和创建 PR 前保留用户确认，不静默执行外部写操作。

## 分支与工作区

1. 不要在 `main`、`master`、`prod` 等受保护分支上直接提交。
2. 开始 PR 流程前运行 `git status --short --branch`，区分本次任务改动和无关脏文件。
3. 只暂存本次任务相关文件；遇到用户已有修改，保留并说明，不要回滚。
4. 提交信息使用 conventional commit。

## 分层验证

优先按改动范围选择最小验证，再在 PR 前补齐完整质量门。

| 层级 | 目的 | 常见命令 |
| --- | --- | --- |
| 仓库卫生 | 捕获临时文件、备份文件、调试残留 | `pnpm lint:repo-files`、自定义脚本 |
| Lint / Format | 捕获风格、导入顺序和明显 bug | `pnpm lint`、目标文件 lint |
| 单元测试 | 覆盖纯逻辑、服务、组件和工具函数 | `pnpm test`、`pnpm --filter <pkg> test` |
| 构建 / 类型 | 验证类型边界和打包产物 | `pnpm build`、`pnpm --filter <pkg> build` |
| E2E | 验证关键用户路径和跨服务集成 | `pnpm test:e2e`、`npx playwright test` |

如果仓库是 monorepo，先识别 package 依赖。内部 package 以 `dist/` 暴露时，consumer 测试或构建前必须先构建被依赖 package。

## E2E 最佳实践

- E2E 使用独立目录，例如 `e2e/`，配置 `playwright.config`、`fixtures/`、`helpers/`、`tests/`。
- `globalSetup` 先等待 API 和 Web 健康检查，服务未就绪时明确失败。
- 本地 worktree 使用独立 `.env.worktree` 或等价机制隔离端口和环境变量。
- 测试认证优先使用专用 bypass token、测试账号或 fixture，不依赖真实用户会话。
- 对网络、SSE、外部模型等不稳定边界，优先 mock 可控响应；真正集成 smoke test 单独标记。
- CI 中启用失败制品：Playwright trace、screenshot、HTML report、test-results。

## CI 工作流

推荐把 PR checks 拆成独立 job：

1. `lint`：安装依赖后运行仓库 lint。
2. `test`：构建内部 package 后运行后端、前端或共享包单测。
3. `e2e`：准备环境变量、恢复 Playwright 浏览器缓存、运行 E2E，失败时上传制品。

CI 应设置 concurrency，新的 PR 更新取消旧运行，避免重复消耗资源。

## PR 描述

没有仓库模板时，默认使用以下结构：

```markdown
## 背景

## 核心改动

## 验证
- [ ] 命令：结果

## 风险与回滚
```

验证项必须写真实执行结果。未运行的检查要明确写“未运行”并说明原因。

## 自动化边界

- 可以自动检查状态、运行验证、整理提交内容和草拟 PR 描述。
- 推送分支、创建 PR、合并 PR 属于外部写操作，执行前必须向用户确认。
- 检查失败时先修复可安全修复的问题，再重跑相关验证；不要跳过失败检查直接提交。
