---
name: writing-plans
description: 兼容旧 writing-plans 入口；生成可执行的逐步实施计划，或把正式多会话工作转为 to-tickets 工单图。
---

# Writing Plans Compatibility

这是至少保留一个发布周期的 **compatibility** 入口，保留旧计划输入/输出，同时给出迁移路径。

## When to Use

用户提供 Spec/requirements 并要求先写 implementation plan 时使用。若目标明确是并行、多会话、
tracker 或 blocking graph，则转交 `to-tickets`；否则保留 legacy plan mode。

## How It Works

Legacy plan 写入 ignored local artifact，按执行顺序列出：

- outcome、前置条件和不做什么；
- 每步精确文件/模块、行为变化、失败测试、最小实现、验证命令和 checkpoint；
- 风险、回滚与完成证据。

不要猜不存在的路径；先检查代码事实。每步足够小，可由 fresh context 执行，但不能用时间估算
替代验收。正式 lane 的架构决定仍来自获批 Spec。

若选择 `to-tickets`，先解释迁移，再完整遵循其 ticket schema，不把两种格式混写。

## Example

“根据这个已批准 Spec 写一个按测试推进的实施计划”进入 legacy plan mode；“拆成可并行 Issue”
进入 `to-tickets` mode。

## Exit

返回 `PLAN_READY`（路径、步骤数、验证和风险）、`READY_FOR_TICKET_REVIEW`，或
`BLOCKED_BY_MISSING_SOURCE`。不自动执行计划。
