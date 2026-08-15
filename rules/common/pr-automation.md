# PR 自动化与 CI 质量门

本规则只维护 PR 特有的 CI、验证制品和描述。Git 分支、暂存、提交与外部授权以
`rules/05-git-workflow.md` 为准；验证层级与 E2E 实践以 `rules/common/testing.md` 为准。

## PR 质量门

PR 前按 `rules/common/testing.md` 完成选定的最终验证；描述只记录真实结果、未运行项和剩余风险，不重新定义测试层级或 E2E 策略。

## CI 工作流

推荐把 PR checks 拆成独立 job：

1. `lint`：运行 `testing.md` 选定的静态质量门。
2. `test`：运行 `testing.md` 选定的测试与构建门。
3. `e2e`：按 `testing.md` 准备环境并运行关键路径；失败时上传 trace、screenshot、HTML report 和 `test-results`。

CI 设置 concurrency，使新的 PR 更新取消旧运行。

## PR 描述

没有仓库模板时，默认使用以下结构：

```markdown
## 背景

## 核心改动

## 验证
- [ ] 命令：结果

## 风险与回滚
```

验证项写真实执行结果；未运行的检查明确写“未运行”并说明原因。

## 自动化边界

可以在 `05-git-workflow.md` 的授权边界内检查状态、运行验证、整理提交内容和草拟 PR 描述；检查失败时先修复可安全修复的问题并重跑相关验证，不跳过失败检查直接提交。
