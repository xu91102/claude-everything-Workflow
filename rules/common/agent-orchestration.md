# Agent 编排政策

- Skill 负责流程，Agent 只负责隔离角色。当前 agent 能在一个上下文中可靠完成的任务不委派。
- 只有任务边界清楚、输入可冻结、结果可压缩回传，且隔离或并行收益明确时才创建 fresh subagent；需要继承复杂背景时才 fork。
- 代码审查由 `skills/code-review/SKILL.md` 编排隔离审查轴；TDD 由 `skills/test-driven-development/SKILL.md` 执行。兼容 agent 不是默认路由目标。
- 多 ticket 并行只由 `skills/subagent-driven-development/SKILL.md` 在已批准、无 blocker、写入面不重叠时执行。
- Fresh/Fork 选择、回传内容和外部写入边界以 `rules/common/context-hygiene.md` 为准。
- Subagent 默认只返回结论、证据、风险和下一步，不回传完整日志，也不执行未经授权的外部 mutation。
