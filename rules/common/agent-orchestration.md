# Agent 编排

## 使用边界

- 简单、明确、低风险且上下文连贯的任务由当前 agent 直接完成。
- 只有独立搜索、失败日志、专项审查或可安全并行的交付能减少主上下文噪音时才委派。
- 非平凡任务的 Skill/Agent 选择和交付拓扑以 `skills/using-superpowers/SKILL.md` 为权威来源。

## 交付拓扑

- 跨会话或需要可恢复依赖图的范围使用 `skills/to-tickets/SKILL.md`；单会话连贯范围直接实施。
- 只有至少两张已批准、无 blocker、写入面不重叠的 frontier tickets 才使用 `skills/subagent-driven-development/SKILL.md`。
- 不能证明安全并行时串行执行；不得为使用多 Agent 人为拆分任务。

## 上下文与权限

Fresh/Fork、agent `description`、回传格式、上下文隔离以及 Subagent 的 Git 与外部写入权限，均以 `rules/common/context-hygiene.md` 为唯一来源。
