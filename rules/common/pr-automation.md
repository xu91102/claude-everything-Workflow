# PR 自动化与 CI 质量门

Git、分支、提交和外部授权以 `rules/05-git-workflow.md` 为准；验证层级以 `rules/common/testing.md` 为准。

## PR 契约

- PR 前完成选定的最终验证；描述只记录真实结果、未运行项和剩余风险。
- CI 至少覆盖适用的 lint/format、测试/构建和关键 E2E；失败时保留 trace、screenshot、HTML report 和 `test-results`。
- 新提交应取消同一 PR 的过期 CI 运行，避免重复消耗。
- 没有模板时，描述包含背景、核心改动、验证、风险与回滚。

检查失败时先修复可安全修复的问题并重跑；失败检查不得跳过。Git/PR 操作按 `rules/05-git-workflow.md` 的授权边界执行。
