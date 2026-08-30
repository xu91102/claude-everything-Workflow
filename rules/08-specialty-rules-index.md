# 专项规则索引

命中场景时读取对应规则；不得因为“可能有用”而一次性读取完整 `rules/` 或 `rules/common/`。加载层级和路径解析见 `AGENTS.md` 规则加载策略。

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
| 安全敏感实现或安全审查                   | `07-forbidden.md`                                                       |
| 跨平台脚本、不可变性                     | `03-architecture.md`                                                    |
