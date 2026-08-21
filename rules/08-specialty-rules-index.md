# 专项规则索引

本文件只维护规则触发矩阵。流程路由不在 rules 中维护；非平凡任务的流程选择由 `skills/using-superpowers/SKILL.md` 所有。

## 加载方式

1. 先读取当前项目的 `AGENTS.md` 或 `CLAUDE.md` 差异。
2. 只在任务命中下列场景时读取对应 policy；不得因为“可能有用”而一次性读取完整 `rules/` 或 `rules/common/`。
3. 项目规则不存在时，按全局 Bootstrap 回退到用户级规则目录。

## 触发矩阵

| 场景 | 读取 |
| --- | --- |
| 一般实施边界、最小范围和完成证据 | `01-base.md` |
| 项目缺少规模、架构、错误或注释约定 | 对应读取 `02-code-size.md`、`03-architecture.md`、`04-error-handling.md`、`06-comments.md` |
| Git、worktree、提交、push 或 PR | `05-git-workflow.md`；PR 时再读 `common/pr-automation.md` |
| 密钥、外部输入、危险操作或安全审查 | `07-forbidden.md` |
| 高风险或复杂变更的失败路径选择 | `09-first-principles-adversarial-testing.md` |
| Harness、command、agent、skill 或 hook 调整 | `common/harness-engineering.md` |
| Fresh/Fork、subagent 回传或上下文隔离 | `common/context-hygiene.md`；并行 ticket 再读 `common/agent-orchestration.md` |
| Hook 行为、退出码、profile 或权限 | `common/hooks.md` |
| Token、MCP、模型和上下文成本 | `common/performance.md` |
| 外部 skill 学习、模式保存或演化 | `common/skills-learning.md` |
| 测试命令、验证范围或质量门 | `common/testing.md` |
