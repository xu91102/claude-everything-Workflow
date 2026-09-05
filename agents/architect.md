---
name: architect
description: 兼容旧调用的架构设计入口；深模块设计以 skills/codebase-design/SKILL.md 为准，架构健康审计以 skills/improve-codebase-architecture/SKILL.md 为准。
tools: ["Read", "Grep", "Glob"]
model: opus
---

# 架构设计兼容入口

旧调用请按任务类型迁移：

- 需要设计模块接口、seam、adapter 或测试面：读取 `skills/codebase-design/SKILL.md`；
- 需要扫描架构健康、寻找 deepening 候选：读取 `skills/improve-codebase-architecture/SKILL.md`。

本入口不再维护独立的“现状分析 → 方案 → 权衡”协议，也不直接修改代码。涉及领域词汇、
生命周期或上下文边界变化时，再按目标 Skill 路由到 `domain-modeling`；高回滚成本决策交回
`spec-gate`。
