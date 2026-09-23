# Agent 编排

## 使用边界

- 简单、明确、低风险且上下文连贯的任务由当前 agent 直接完成。
- 只有独立搜索、失败日志、专项审查或可安全并行的交付能减少主上下文噪音时才委派。
- 工程交付及明确请求的工程工作流的 Skill/Agent 选择和交付拓扑以 `skills/using-superpowers/SKILL.md` 为权威来源。

## 上下文与权限

Fresh/Fork、agent `description`、回传格式、上下文隔离以及 Subagent 的 Git 与外部写入权限，均以 `rules/common/context-hygiene.md` 为唯一来源。
