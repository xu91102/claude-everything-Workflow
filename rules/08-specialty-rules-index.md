# 专项规则索引

本文件只保留专项规则索引，避免默认加载过多细节。需要对应场景时再读取对应规则。

## 加载层级

1. 入口层：优先使用 `AGENTS.md` 或 `CLAUDE.md` 的硬规则和规则索引。
2. 基础层：只有涉及实现、审查或验证时，读取 `01-base.md` 及少量相关基础规则。
3. 专项层：只有任务明确触发时，读取 `rules/common/` 中对应文件。

不得因为“可能有用”而一次性读取完整 `rules/` 或 `rules/common/`。

| 专项规则                        | 内容                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `common/harness-engineering.md` | Agent Harness 主循环、工具、上下文、状态、权限、验证 |
| `common/context-hygiene.md`     | 上下文卫生、Subagent 边界、Fresh/Fork 选择、路由契约 |
| `common/agent-orchestration.md` | Agent 使用、规划、并行编排                           |
| `common/hooks.md`               | Hook 类型、退出码、Profile、权限                     |
| `common/performance.md`         | 模型选择、MCP、上下文压缩、Token 成本                |
| `common/skills-learning.md`     | Skills 工作流、持续学习、按需学习                    |
| `common/security.md`            | 安全优先原则、安全扫描                               |
| `common/testing.md`             | TDD、E2E、验证策略                                   |
| `common/pr-automation.md`       | PR 自动化、CI 质量门、验证制品                       |
| `common/implementation.md`      | 不可变性、跨平台、实施阶段控制                       |

## 默认原则

- 简单任务优先由当前 agent 直接完成。
- 长任务优先维护干净工作集；探索、审查、诊断等可隔离任务按需委派 subagent，只回传结论和证据。
- Agent 不稳定时，先检查 Harness 六层：主循环、工具、上下文、状态、权限、验证。
- 复杂、跨领域或需要独立视角时，再读取对应专项规则并考虑委派 agent。
- 不为轻量任务加载完整专项规则集。

## 触发矩阵

| 场景                                     | 读取                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Harness 审计、命令/agent/skill/hook 调整 | `common/harness-engineering.md`、必要时读取 `common/context-hygiene.md` |
| Ticket/SDD 编排、并行探索               | `common/agent-orchestration.md`                                         |
| Fresh/Fork、Subagent 回传、上下文隔离   | `common/context-hygiene.md`                                             |
| Hook 行为、退出码、Profile、权限         | `common/hooks.md`                                                       |
| Token、MCP、模型和上下文成本             | `common/performance.md`                                                 |
| 外部 skill 学习、模式保存、演化评估      | `common/skills-learning.md`                                             |
| 测试策略、TDD、E2E、验证范围             | `common/testing.md`                                                     |
| 提交、推送、PR、CI 质量门                | `05-git-workflow.md`、`common/pr-automation.md`                        |
| 安全敏感实现或安全审查                   | `common/security.md`                                                    |
| 跨平台脚本、不可变性、实施阶段控制       | `common/implementation.md`                                              |
