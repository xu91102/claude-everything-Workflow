---
description: 从已批准 Spec、plan 或 agent-ready ticket 开始实现闭环
---

# /implement - 实现已批准工作

读取 `skills/using-superpowers/SKILL.md`，把 `$ARGUMENTS` 解析为已批准的 Spec、实施计划或
agent-ready ticket。

- 有实施计划：按授权边界选择 `executing-plans` 或 `subagent-driven-development`。
- 只有 agent-ready ticket：先读取 `docs/agent-workflow/project-context.md` 和 ticket 的完整
  blocking 状态。只有 ticket 位于 open + unblocked + unclaimed frontier 才能开始。
- claim 前记录 `git rev-parse HEAD` 为 pre-ticket base，并记录 task-owned dirty/untracked
  初始状态；已有无关改动必须排除，不能回滚。
- 开始 ticket 前执行 claim：
  - 本地 tracker：显式 `/implement <ticket>` 只授权把该 ticket 从 `ready-for-agent` 改为
    `in-progress`；不得顺带修改其他 ticket。
  - 外部 tracker：先展示 assignee/status/label 的准确 mutation，并取得 explicit confirmation。
- claim 成功后，形成最小内联任务序列，按 `test-driven-development` 的垂直切片实现；每个
  已验证切片只向当前 ticket 追加简短 progress 记录。
- 完成前把 ticket as the Spec source，执行
  `/code-review --worktree <pre-ticket-base> --spec <ticket>`；review package 必须覆盖 task-owned
  committed、staged、unstaged 和 untracked 改动。随后执行 `verification-before-completion`。
- 只有 acceptance、双轴 review 和 fresh verification 全部通过后才能 resolve 当前 ticket：
  本地 tracker 更新状态并记录证据；外部 tracker 的评论/关闭仍需 explicit confirmation。
  未通过时保持 `in-progress` 并记录失败，不得伪装完成。
- resolve 后重新查询依赖图，返回 newly unlocked frontier tickets；不得自动 claim 或实现
  下一 ticket，也不得关闭 parent issue。
- 未批准、仍有用户决策或缺少验收标准时停止并返回对应门禁，不猜测。

除非用户明确授权 commit/PR，不创建提交、不推送。
