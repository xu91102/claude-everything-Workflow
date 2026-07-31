---
name: executing-plans
description: 兼容旧 executing-plans 入口；按 checkpoint 执行获批实施计划，或转交 implement frontier-ticket 工作流。
---

# Executing Plans Compatibility

这是至少保留一个发布周期的 **compatibility** 入口，保留旧 plan execution 语义。

## When to Use

用户已有批准的 implementation plan 并要求执行时使用。有 persisted tickets 时转交
`implement`；纯 legacy plan 则按步骤与 checkpoint 执行。

## How It Works

1. 读取完整 plan、来源 Spec、当前 git 状态和仓库规则；计划与事实冲突时先 `BLOCKED`。
2. 一次执行一个 plan step，每个行为变化走 TDD；完成该步验证后报告 checkpoint。
3. 用户授权连续执行时可继续下一步；遇到外部授权、consequential decision、范围扩大或失败
   验证立即停止。
4. 最后运行 Standards/Spec 双轴 review 与 `verification-before-completion`。
5. commit/push/PR 仍需明确授权，不因兼容调用自动获得。

Ticket mode 读取并完整遵循 `skills/implement/SKILL.md`，每次从 persisted frontier 重载状态。

## Example

“执行 `docs/plan.md`，每两步汇报”进入 legacy checkpoints；“执行 T03 ticket”进入
frontier-ticket mode。

## Exit

返回 `PLAN_STEP_COMPLETE`、`IMPLEMENTED`、`BLOCKED` 或 `VERIFICATION_FAILED`，并带当前步骤、
证据和下一 checkpoint；不得盲目批量修改。
