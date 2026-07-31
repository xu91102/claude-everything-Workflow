---
name: to-tickets
description: 将 conversation、plan 或 Spec 拆成带 blocking edges 的 tracer-bullet tickets，并发布到本地或已授权 tracker；formal lane 要求已批准 Spec。
disable-model-invocation: true
---

# To Tickets

把 conversation、plan 或 Spec 拆成可由 fresh context 独立完成的 **tracer bullet** tickets。每张 ticket
交付一条窄但完整、可演示或可验证的端到端行为，并声明真实的 **Blocked by** 边。

## Preconditions

- Formal lane 必须提供已获用户批准的 Spec；普通低风险请求可直接使用 conversation 或
  plan。Formal lane 没有批准时返回
  `BLOCKED_BY_UNAPPROVED_SPEC`。
- 新会话调用时，用户必须同时提供 Spec 路径并明确它已经获批。
- 读取 `docs/agent-workflow/project-context.md`（若存在），获取 tracker、domain docs 和 ADR
  位置。没有配置时默认使用 ignored local artifact。
- 读取 Spec 全文、当前代码事实和相关 ADR，不重新访谈已经解决的设计决策。

## Process

### 1. Draft

1. 用项目领域词汇描述用户可观察 outcome。
2. 按 **tracer bullet** 拆分 vertical slices；每张 ticket 必须适合一个 fresh context。
3. 先找必要 prefactoring：“Make the change easy, then make the easy change”。
4. 为每张 ticket 写 `Blocked by`；没有 blocker 的 ticket 构成初始 **frontier**。
5. Wide refactor 使用 expand → migrate → contract，不强迫它伪装成 vertical slice。

### 2. Review

在写文件或远程 Issue 前展示编号列表，每项只显示：

- Title
- Blocked by
- What it delivers

确认 granularity、blocking edges 与 merge / split。用户也可明确委托 agent 采用推荐图。
未确认时返回 `READY_FOR_TICKET_REVIEW`，不写 tracker。

### 3. Publish

Local tracker 支持两种布局，共用同一 ticket schema：

- `combined`：`docs/superpowers/tickets/YYYY-MM-DD-<feature>.md`
- `per-ticket`：`docs/superpowers/tickets/<feature>/issues/<TNN>-<slug>.md`

默认 `combined`；用户偏好或 project context 可覆盖。Combined ref 使用 `<path>#<TNN>`，
per-ticket ref 使用文件路径。

本地 ticket 是 ignored workflow artifact。Do not stage or commit it.

远程 tracker 一票一 Issue，按 blocker 优先顺序创建；优先使用原生 blocking / sub-issue
关系，否则写 `Blocked by`。只有 tracker 已配置、工具可用且用户当次授权时才远程写入。
不关闭或修改 parent issue。

## Ticket Schema

```markdown
## <TNN> — <Title>

**Parent / Source:** <approved Spec or parent issue>

**What to build:** <end-to-end user-visible outcome>

**Blocked by:** <ticket refs or None — can start immediately>

**Status:** ready-for-agent

- [ ] <acceptance criterion>
```

新 ticket 使用 `T01`、`T02` 格式；迁移期内读取旧 `01`、`02`。状态只能是
`ready-for-agent`、`in-progress`、`blocked` 或 `complete`。

本地 artifact 使用同一个状态工具做校验、状态写回和 frontier 计算：

```bash
node skills/to-tickets/scripts/ticket-state.js validate TICKET_FILE...
node skills/to-tickets/scripts/ticket-state.js frontier TICKET_FILE...
node skills/to-tickets/scripts/ticket-state.js set TARGET_FILE TICKET_ID STATUS GRAPH_FILE...
node skills/to-tickets/scripts/ticket-state.js normalize-remote TRACKER_EXPORT.json
```

Per-ticket layout 的 `set` 必须把同一 graph 的其余文件作为 `GRAPH_FILE...` 传入，防止只读取
目标文件而误判 blocker。远程 adapter 输出 `{status_map, tickets}` JSON，经
`normalize-remote` 验证后再计算 frontier；远程写回仍需要 tracker 授权。

不写预计文件路径、接口清单、实现代码或微步骤；这些内容会陈旧。Spec 是架构、testing seams
和全局约束的唯一事实来源。

## Validation

- 每项 Spec requirement 至少映射一张 ticket，每张 ticket 都能回指 Spec。
- Ticket IDs 唯一，blocking graph 无环。
- Frontier 只包含状态为 `ready-for-agent`，且所有 blockers 状态为 `complete` 的 tickets。
- 每张 ticket 可独立验收，并适合一个 fresh context。
- Fresh context 必须重新读取 artifact/tracker 状态，不使用仅存在于进程内的完成集合。

## Example

输入：“把获批的账户迁移 Spec 拆成 tickets。”推荐图：

```text
T01 — 让新旧读路径可并存
Blocked by: None
What it delivers: 生产请求可在不切流量的情况下验证新读路径

T02 — 迁移并验证真实流量
Blocked by: T01
What it delivers: 新读路径承接流量且回滚开关有效

T03 — 删除旧读路径
Blocked by: T02
What it delivers: 旧实现退出且公共行为保持
```

先返回 `READY_FOR_TICKET_REVIEW`；用户确认图后才写 combined/per-ticket artifact 或远程 tracker。

## Outcomes

```text
READY_FOR_TICKET_REVIEW
- proposed_tickets
- spec_coverage
- dependency_check

TICKETS_PUBLISHED
- ticket_refs
- frontier
- tracker
- non_blocking_risks

BLOCKED_BY_UNAPPROVED_SPEC
- spec_path
- missing_approval

BLOCKED_BY_INVALID_SPEC
- spec_path
- validation_error

NEEDS_TRACKER_AUTHORIZATION
- approved_draft
- tracker
- missing_tool_or_authorization
```
