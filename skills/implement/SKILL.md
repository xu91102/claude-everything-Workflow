---
name: implement
description: Execute an authorized direct scope, approved Spec scope, or ready frontier ticket, then verify.
---

# Implement

执行 router 在用户已授权范围内选定的低风险 direct scope、approved Spec scope 或 agent-ready ticket。direct scope
只能来自明确的用户交付请求，且不得涉及 formal Spec 或高风险边界；不要把咨询、建议或模糊意图解释为交付授权。

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's tracker, review, and
external-write approval contracts.

## State Machine

`PRECONDITION → ISOLATE → [CLAIM] → EXECUTE → REVIEW → VERIFY → [RESOLVE → REFRESH_FRONTIER] → FINISH_DELIVERY`

方括号中的状态只属于 tracker ticket。无 ticket 的 direct scope 或 approved Spec scope 跳过 CLAIM、RESOLVE
和 REFRESH_FRONTIER，但不能跳过隔离、实施、审查或验证。每次调用只推进 router 选定的一张 ticket 或一个连贯范围；
任何 gate 失败都停止在当前状态并保留可恢复证据，不能把部分完成解释为交付完成。

### PRECONDITION

- direct scope 仅在 router 已判定为明确、低风险且用户已授权交付时进入。原始用户请求、要达成的行为、范围边界和
  相称验证共同构成 `direct-scope contract`；缺少其中任一项、存在未决用户决策，或命中 formal Spec/高风险边界时，停止并返回对应门禁。
- approved Spec scope 以已批准 Spec 为范围和验收来源；agent-ready ticket 则先读取
  `docs/agent-workflow/project-context.md` 和完整 blocking 状态，且必须位于 open + unblocked + unclaimed frontier。
- 所有路径都必须有可复核的验收或验证条件；未批准、仍有用户决策或缺少该条件时，停止并返回对应门禁，不猜测。

### ISOLATE

开始实现前检查当前 branch、worktree、staged、unstaged 和 untracked 状态。除只读分析和单文件修改外，所有代码、配置、Harness 改动必须先创建独立 `git worktree` 和任务分支；使用
`skills/using-git-worktrees/SKILL.md` 准备隔离工作区。无代码/配置/Harness 的窄范围文档改动可按该 Skill 的例外原地执行。不得嵌套创建 worktree。

只运行项目需要的 setup，然后执行与目标路径匹配的 baseline tests。只有 clean baseline 才能
进入 ticket 的 CLAIM 或无 ticket 范围的 EXECUTE；baseline 失败时报告命令、失败和现有工作区状态，等待用户决定调查还是继续。

进入实施前记录 `git rev-parse HEAD` 为 pre-delivery base；ticket 路径同时把它作为 pre-ticket base，并记录
task-owned dirty/untracked 初始状态。已有无关改动必须排除，不能回滚。

### CLAIM（仅 ticket）

- 本地 tracker：router 在用户已授权交付范围内选定该 ticket 后，可只把它从 `ready-for-agent` 改为
  `in-progress`，不得顺带修改其他 ticket。
- 外部 tracker：先展示 assignee/status/label 的准确 mutation，并取得 explicit confirmation。
- 无 ticket 范围不得 claim 或写入任何 tracker。

### EXECUTE

每次 `implement` 只在一个 fresh context 中完成一张已领取的 ticket 或一个无 ticket 连贯范围。ticket 以
`What to build`、验收标准和 blocker 为实施合同；direct scope 以 `direct-scope contract` 为合同；approved Spec
scope 以已批准 Spec 为合同。按 `test-driven-development` 的垂直切片实现，不要生成或依赖另一份逐文件、逐步骤的实施计划。

每个已验证切片只向当前 ticket 追加简短 progress 记录；无 ticket 范围只在当前交付回报中记录证据。遇到失败测试、flaky
或意外结果时进入 `systematic-debugging`，不得用后续步骤可能修复为由跳过当前失败。

### REVIEW

完成前以 ticket as the Spec source，执行 `/code-review --worktree <pre-ticket-base> --spec <ticket>`；无 ticket
范围则把 `direct-scope contract` 或 approved Spec 作为 scope source，并以 pre-delivery base 冻结同等审查包。
review package 必须覆盖 task-owned committed、staged、unstaged 和 untracked 改动。Spec 或 Standards 轴未通过时，
ticket 保持 `in-progress`，无 ticket 范围停止在 REVIEW；修复 Critical/Important findings 后重新 review。

### VERIFY

逐条核对 ticket acceptance criteria，或无 ticket 范围的 `direct-scope contract`/approved Spec 验收条件，并执行
`verification-before-completion` 要求的 fresh commands。任何 acceptance、测试、构建或验证失败都让 ticket 保持
`in-progress` 或让无 ticket 范围停止在 VERIFY，记录实际结果、跳过项和剩余风险；不得进入 RESOLVE。

### RESOLVE（仅 ticket）

只有 acceptance、双轴 review 和 fresh verification 全部通过后才能 resolve 当前 ticket：

- 本地 tracker 更新状态并记录证据。
- 外部 tracker 的评论或关闭仍需 explicit confirmation。
- 未通过时保持 `in-progress` 并记录失败，不得伪装完成。

### REFRESH_FRONTIER（仅 ticket）

resolve 后重新查询依赖图并返回 router。若 newly unlocked frontier tickets 仍在用户已授权范围内，router
可重新选择串行 `implement` 或安全 SDD；否则报告 frontier 并停止。不得自动关闭外部 Issue 或 parent issue。

### FINISH_DELIVERY

- 无 ticket 范围：双轴 review 与 fresh verification 均通过后，报告范围、证据、未运行项和剩余风险；不得 claim、resolve、查询或刷新 tracker frontier。若用户随后要求 PR，仍须先通过 `/verify pre-pr`，且不自动 commit、push 或创建 PR。
- frontier 非空：返回当前 graph 状态、newly unlocked tickets 和 blockers，然后停止。
- frontier 为空但仍有 open tickets：返回 `BLOCKED_GRAPH`，列出被依赖阻塞、循环依赖、claim
  冲突或状态异常的 tickets，保持交付未完成并停止，不能进入 PR 收尾。
- 只有 open ticket count = 0：以 feature/worktree 起点为固定基点执行全分支双轴 review，再运行
  `/verify pre-pr`。只有两者都通过，才能向用户展示 `/pr` 或 keep 当前 branch/worktree 的选择；
  不自动 merge、删除 branch 或清理 worktree。

## Authorization Invariants

- 用户的交付授权覆盖已批准 ticket graph，或 router 判定的明确低风险 direct scope/approved Spec scope 内的本地实现和拓扑选择；不覆盖新的产品范围，也不覆盖 commit、push 或创建 PR。
- tracker publication、claim、resolve、评论和关闭都是 ticket 路径中的独立外部 mutation；无 ticket 范围不得借此产生 tracker 写入，本次阶段授权也不能推导出下一阶段授权。
- FINISH_DELIVERY 只展示选择；merge、PR 和 cleanup 继续遵守用户授权与仓库 Git 规则。
