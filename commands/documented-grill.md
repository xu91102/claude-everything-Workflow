---
description: 在需求压力测试时同步维护领域词汇与决策记录
---

# /documented-grill

这是用户显式入口。联合执行 `skills/grilling/SKILL.md` 与
`skills/domain-modeling/SKILL.md` 的 **Documentation Mode**：

1. 按 grilling 协议一次只解决一个 consequential decision。
2. 同步维护待写入的 glossary、invariant、lifecycle、bounded context 与 ADR 草稿。
3. 共同理解确认后，按 Documentation Mode 的持久化门写入已配置文档。
4. 返回 grilling handoff 与变更文档路径，不生成 Spec、tickets 或实现。

没有领域决定时返回 `NOT_APPLICABLE`。决定尚未确认时返回 handoff，不写文档。

参数：`$ARGUMENTS`
