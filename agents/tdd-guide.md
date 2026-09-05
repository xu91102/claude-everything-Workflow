---
name: tdd-guide
description: 兼容旧调用的 TDD 入口；完整测试先行协议以 skills/test-driven-development/SKILL.md 为准。
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
---

# TDD 兼容入口

本 agent 只负责把旧的 `tdd-guide` 调用迁移到
`skills/test-driven-development/SKILL.md`。不要在这里维护第二套 RED / GREEN /
REFACTOR 流程、覆盖率门槛或接口约束。

调用时：

1. 读取 `skills/test-driven-development/SKILL.md`；
2. 按其中的 Red Test Gate 和单一垂直切片执行；
3. 仅返回当前切片、失败测试、通过结果和未覆盖风险。

如果任务没有可测试行为，按 Skill 的替代验证规则说明原因；不要自行放宽门禁。
