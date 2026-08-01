---
name: implement
description: "Execute an approved Spec, implementation plan, or agent-ready frontier ticket through claim, TDD, review, verification, resolve, and frontier refresh. Use only when the user explicitly asks to implement approved work."
disable-model-invocation: true
---

# Implement

执行用户明确指定且已批准的 Spec、实施计划或 agent-ready ticket。不要把模糊意图解释为实施授权。

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's tracker, review, and
external-write approval contracts.

## State Machine

`PRECONDITION → ISOLATE → CLAIM → EXECUTE → REVIEW → VERIFY → RESOLVE → REFRESH_FRONTIER → FINISH_DELIVERY`

每次调用只推进用户明确指定的工作。任何 gate 失败都停止在当前状态并保留可恢复证据，不能
跳过失败状态或把部分完成解释为交付完成。

### PRECONDITION

- 有实施计划时，按授权边界选择 `executing-plans` 或 `subagent-driven-development`。
- 只有 agent-ready ticket 时，先读取 `docs/agent-workflow/project-context.md` 和 ticket 的完整
  blocking 状态。只有 ticket 位于 open + unblocked + unclaimed frontier 才能开始。
- 未批准、仍有用户决策或缺少验收标准时，停止并返回对应门禁，不猜测。

### ISOLATE

开始实现前检查当前 branch、worktree、staged、unstaged 和 untracked 状态。任务较大、风险较高、
需要并行，或当前 checkout 有无关用户改动时，先使用 `skills/using-git-worktrees/SKILL.md`；简单且
checkout 干净的 ticket 可以原地执行。不得嵌套创建 worktree。

只运行项目需要的 setup，然后执行与目标路径匹配的 baseline tests。只有 clean baseline 才能
进入 CLAIM；baseline 失败时报告命令、失败和现有工作区状态，等待用户决定调查还是继续。

### CLAIM

claim 前记录 `git rev-parse HEAD` 为 pre-ticket base，并记录 task-owned dirty/untracked
初始状态；已有无关改动必须排除，不能回滚。

- 本地 tracker：用户显式指定该 ticket，只授权把它从 `ready-for-agent` 改为
  `in-progress`，不得顺带修改其他 ticket。
- 外部 tracker：先展示 assignee/status/label 的准确 mutation，并取得 explicit confirmation。

### EXECUTE

claim 成功后按 ticket 复杂度选择一条执行路径：

- 小而清晰、能在一个 fresh context 内完成的 ticket：形成最小内联任务序列，按
  `test-driven-development` 的垂直切片实现。
- 有多个独立步骤、需要精确文件级指令或进度恢复的复杂 ticket：先使用 `writing-plans`；用户已
  明确授权 SDD/commit handling 时进入 `subagent-driven-development`，否则使用
  `executing-plans` 并保持改动未提交。

每个已验证切片只向当前 ticket 追加简短 progress 记录。遇到失败测试、flaky 或意外结果时进入
`systematic-debugging`，不得用后续步骤可能修复为由跳过当前失败。

### REVIEW

完成前把 ticket as the Spec source，执行
`/code-review --worktree <pre-ticket-base> --spec <ticket>`；review package 必须覆盖 task-owned
committed、staged、unstaged 和 untracked 改动。Spec 或 Standards 轴未通过时，保持
`in-progress`，修复 Critical/Important findings 后重新 review。

### VERIFY

逐条核对 acceptance criteria，并执行 `verification-before-completion` 要求的 fresh commands。
任何 acceptance、测试、构建或验证失败都保持 `in-progress`，记录实际结果、跳过项和剩余风险；
不得进入 RESOLVE。

### RESOLVE

只有 acceptance、双轴 review 和 fresh verification 全部通过后才能 resolve 当前 ticket：

- 本地 tracker 更新状态并记录证据。
- 外部 tracker 的评论或关闭仍需 explicit confirmation。
- 未通过时保持 `in-progress` 并记录失败，不得伪装完成。

### REFRESH_FRONTIER

resolve 后重新查询依赖图，返回 newly unlocked frontier tickets；不得自动 claim 下一张 ticket，
不得自动实现下一张 ticket，也不得自动关闭外部 Issue 或 parent issue。

### FINISH_DELIVERY

- frontier 非空：返回当前 graph 状态、newly unlocked tickets 和 blockers，然后停止。
- frontier 为空但仍有 open tickets：返回 `BLOCKED_GRAPH`，列出被依赖阻塞、循环依赖、claim
  冲突或状态异常的 tickets，保持交付未完成并停止，不能进入 PR 收尾。
- 只有 open ticket count = 0：以 feature/worktree 起点为固定基点执行全分支双轴 review，再运行
  `/verify pre-pr`。只有两者都通过，才能向用户展示 `/pr` 或 keep 当前 branch/worktree 的选择；
  不自动 merge、删除 branch 或清理 worktree。

## Authorization Invariants

- 除非用户明确授权，不得自动 commit、push 或创建 PR。
- tracker publication、claim、resolve、评论和关闭都是独立的外部 mutation；本次阶段授权不能
  推导出下一阶段授权。
- FINISH_DELIVERY 只展示选择；merge、PR 和 cleanup 继续遵守用户授权与仓库 Git 规则。
