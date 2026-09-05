# Ticket Delivery

仅执行 tracker ticket 时读取；实施、隔离、审查和验证共用 `skills/implement/SKILL.md`，不重复定义。

## State Machine

`PRECONDITION → ISOLATE → [CLAIM] → EXECUTE → REVIEW → VERIFY → [RESOLVE → REFRESH_FRONTIER] → FINISH_DELIVERY`

方括号为 ticket 专属状态。任何 gate 失败均停在当前状态并保留证据，不能提前 resolve。

## PRECONDITION 与 CLAIM

- 读取 `docs/agent-workflow/project-context.md`、完整 ticket 和 blocking 状态；必须位于
  open + unblocked + unclaimed frontier。`What to build`、验收标准和 blocker 构成交付合同。
- 每次在一个 fresh context 中完成一张 ticket。pre-delivery base 同时记为 pre-ticket base。
- 按入口完成隔离并取得 clean baseline 后，本地 tracker 可将选定 ticket 从 `ready-for-agent`
  改为 `in-progress`；不改其他 ticket。外部 tracker 先展示准确 mutation，并取得 explicit confirmation，
  已覆盖该动作的明确授权有效。
- 每个已验证切片只向当前 ticket 追加简短 progress 记录。

## REVIEW 与 VERIFY

ticket as the Spec source：`/code-review --worktree <pre-ticket-base> --spec <ticket>`。
审查包和 fresh verification 要求以入口为准；失败时 ticket 保持 `in-progress`，不得进入 RESOLVE。

## RESOLVE 与 REFRESH_FRONTIER

验收、双轴 review 与 fresh verification 全部通过后才 resolve：本地 tracker 更新状态并记录证据；
外部评论或关闭需要相应明确授权。不得自动关闭外部 Issue 或 parent issue。

resolve 后重查依赖图并返回 router。newly unlocked tickets 仍在已授权范围内时，router
可重新选择串行 `implement` 或安全 SDD；超出范围则报告 frontier 并停止。

## FINISH_DELIVERY

- frontier 非空：返回 graph、newly unlocked tickets 和 blockers；由 router 决定下一张。
- frontier 为空但仍有 open tickets：返回 `BLOCKED_GRAPH`，列出依赖、循环、claim 冲突或状态异常，
  保持交付未完成，不能进入 PR 收尾。
- 只有 open ticket count = 0：以 feature/worktree 起点为固定基点执行全分支双轴 review，再运行
  `/verify pre-pr`。通过后展示 `/pr` 或 keep 当前 branch/worktree 的选择；已获授权的动作可继续。
- tracker publication、claim、resolve、评论和关闭需要各自适用的授权；一次阶段授权不推导出下一阶段。
  不自动 merge、删除 branch 或清理 worktree。
