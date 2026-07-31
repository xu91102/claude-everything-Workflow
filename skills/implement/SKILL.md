---
name: implement
description: "Execute an approved Spec, implementation plan, or agent-ready frontier ticket through claim, TDD, review, verification, resolve, and frontier refresh. Use only when the user explicitly asks to implement approved work."
disable-model-invocation: true
---

# Implement

执行用户明确指定且已批准的 Spec、实施计划或 agent-ready ticket。不要把模糊意图解释为实施授权。

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's tracker, review, and
external-write approval contracts.

## Preconditions

- 有实施计划时，按授权边界选择 `executing-plans` 或 `subagent-driven-development`。
- 只有 agent-ready ticket 时，先读取 `docs/agent-workflow/project-context.md` 和 ticket 的完整
  blocking 状态。只有 ticket 位于 open + unblocked + unclaimed frontier 才能开始。
- 未批准、仍有用户决策或缺少验收标准时，停止并返回对应门禁，不猜测。

## Claim

claim 前记录 `git rev-parse HEAD` 为 pre-ticket base，并记录 task-owned dirty/untracked
初始状态；已有无关改动必须排除，不能回滚。

- 本地 tracker：用户显式指定该 ticket，只授权把它从 `ready-for-agent` 改为
  `in-progress`，不得顺带修改其他 ticket。
- 外部 tracker：先展示 assignee/status/label 的准确 mutation，并取得 explicit confirmation。

## Delivery Loop

claim 成功后，形成最小内联任务序列，按 `test-driven-development` 的垂直切片实现。每个
已验证切片只向当前 ticket 追加简短 progress 记录。

完成前把 ticket as the Spec source，执行
`/code-review --worktree <pre-ticket-base> --spec <ticket>`；review package 必须覆盖 task-owned
committed、staged、unstaged 和 untracked 改动。随后执行 `verification-before-completion`。

## Resolve

只有 acceptance、双轴 review 和 fresh verification 全部通过后才能 resolve 当前 ticket：

- 本地 tracker 更新状态并记录证据。
- 外部 tracker 的评论或关闭仍需 explicit confirmation。
- 未通过时保持 `in-progress` 并记录失败，不得伪装完成。

resolve 后重新查询依赖图，返回 newly unlocked frontier tickets；不得自动 claim 或实现
下一 ticket，也不得关闭 parent issue。

除非用户明确授权 commit/PR，不创建提交、不推送。
