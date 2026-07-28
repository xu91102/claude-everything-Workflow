---
name: implement
description: 实现用户选定的获批 ticket 或明确小任务，驱动 TDD、审查与验证。
disable-model-invocation: true
---

# Implement

实现用户选定的 ticket，或不需要 formal lane 的明确小任务。Formal lane 中一次只执行
frontier 上的一张 ticket。

## Preconditions

- 读取 ticket 全文、它引用的 Spec、项目领域词汇、相关 ADR 和必要代码事实。
- 确认 ticket 已获批准，且所有 `Blocked by` tickets 已完成。
- 从 fresh context 开始；combined artifact 只加载目标 ticket section 与 Spec 必要部分。
- 记录当前 ticket ref、允许范围、验收标准和 commit 权限。

## Flow

1. 固定最高可用 testing seam；读取 `skills/test-driven-development/SKILL.md`。
2. 对行为变化先运行正确失败的测试，再做最小实现。
3. 频繁运行目标测试和必要静态检查；意外失败使用
   `skills/systematic-debugging/SKILL.md`。
4. 对照 ticket 与 Spec 做需求符合性检查。
5. 使用 `/code-review` 或 `agents/code-reviewer.md` 做 Standards / Spec 双轴审查。
6. 使用 `skills/verification-before-completion/SKILL.md` 取得 fresh evidence，并运行
   `/verify` 或等价验证。
7. 验收通过后更新 ticket 状态；重新计算 frontier。

新依赖、契约变化或超出单个 fresh context 的范围返回 `to-tickets` 修订，不能在实现阶段
暗增 scope。

## Git Boundary

Do not commit、push 或创建 PR，除非用户明确授权。用户批准 commit-per-ticket 或 SDD 时，
可调用 `skills/subagent-driven-development/SKILL.md`；否则保持改动未提交。

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
```
