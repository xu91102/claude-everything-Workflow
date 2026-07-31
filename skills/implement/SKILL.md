---
name: implement
description: 实现明确小任务、单张 frontier ticket 或用户显式要求的整套 approved Spec/tickets，驱动 TDD、审查与验证。
disable-model-invocation: true
---

# Implement

实现明确小任务、单张 frontier ticket，或用户显式要求连续执行的整套 approved Spec/tickets。
内部每轮仍只执行一张 ticket，并在轮次间重新加载 persisted frontier。

## Preconditions

- 读取 ticket 全文、它引用的 Spec、项目领域词汇、相关 ADR 和必要代码事实。
- 确认 ticket 已获批准，且所有 `Blocked by` tickets 已完成。
- 从 fresh context 开始；combined artifact 只加载目标 ticket section 与 Spec 必要部分。
- 记录当前 ticket ref、允许范围、验收标准和 commit 权限。
- 本地 ticket 开始前用 `ticket-state.js` 写为 `in-progress`；阻塞时写为 `blocked`。
- 远程 tracker 先通过 `ticket-state.js normalize-remote` 归一状态；任何写回仍使用已配置且
  获授权的 tracker adapter。

## Flow

1. 固定最高可用 testing seam；读取 `skills/test-driven-development/SKILL.md`。
2. 对行为变化先运行正确失败的测试，再做最小实现。
3. 频繁运行目标测试和必要静态检查；意外失败使用
   `skills/systematic-debugging/SKILL.md`。
4. 对照 ticket 与 Spec 做需求符合性检查。
5. 使用 `/code-review` 或 `agents/code-reviewer.md` 做 Standards / Spec 双轴审查。
6. 使用 `skills/verification-before-completion/SKILL.md` 取得 fresh evidence，并运行
   `/verify` 或等价验证。
7. 验收通过后用 `ticket-state.js` 持久写为 `complete`，重新读取 artifact 并计算 frontier。

## Execution Modes

- **Direct**：没有 formal lane 的窄行为，一次完成并做相称验证。
- **Single ticket**：用户指定一张 frontier ticket，完成后返回 next frontier。
- **Approved batch**：用户明确给出整套 tickets 或 Spec 并要求连续执行。每轮从磁盘/远程
  adapter 重新读取状态，只领取一张 frontier ticket；以 fresh subcontext 执行同一 Flow，
  完成、review、verify、持久写回后才进入下一张。遇到 `BLOCKED`、授权缺失、验证失败或
  frontier 为空立即停止。Batch 不自动获得 commit/push/PR 权限。

只有 Spec 但没有 tickets 时，低风险且能在一个 context 完成可走 Direct；多会话 formal work
返回 `NEEDS_TICKETS`，不得自行发明隐藏工单。

新依赖、契约变化或超出单个 fresh context 的范围返回 `to-tickets` 修订，不能在实现阶段
暗增 scope。

## Git Boundary

Do not commit、push 或创建 PR，除非用户明确授权。用户批准 commit-per-ticket 或 SDD 时，
可调用 `skills/subagent-driven-development/SKILL.md`；否则保持改动未提交。

## Example

输入：“连续执行已批准 graph 中当前可做的 tickets，但不要提交。”先从持久状态确认 `T01`
是 frontier，执行 RED → GREEN → review → verify，写回 `complete` 后重载 graph；若 `T02`
解锁则以 fresh subcontext 继续。任何测试失败立即返回 `BLOCKED`，工作区保持未提交。

## Outcome

```text
IMPLEMENTED
- ticket_ref
- tests
- reviews
- verification
- next_frontier
- remaining_risks

BLOCKED
- ticket_ref
- blocker
- evidence

NEEDS_TICKETS
- spec_ref
- reason
```
