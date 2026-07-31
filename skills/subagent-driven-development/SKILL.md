---
name: subagent-driven-development
description: "Use only after the user explicitly approves SDD or commit-per-ticket execution for an approved frontier ticket. Coordinates a fresh implementer, per-ticket review, recorded commits, and a final branch review."
---

# Subagent-Driven Development

Execute approved frontier tickets with a fresh implementation subagent and an independent reviewer.
This is an optional commit-capable path under `skills/implement/SKILL.md`, not a second workflow mainline.

## Preconditions

- The ticket and its approved Spec are available.
- The ticket is on the current frontier: every `Blocked by` edge is complete.
- The user explicitly authorized SDD and commit-per-ticket handling.
- A clean ticket branch or worktree is active.

Without commit authorization, return to `skills/implement/SKILL.md` and keep changes uncommitted.

## Local Git Boundary

This workflow needs a stable `BASE` and `HEAD` for each ticket. It may create the authorized ticket
commit, but it does not push, open a PR, merge, delete branches, or rewrite unrelated history.

Use `.superpowers/sdd/` for short-lived artifacts. Resolve it with:

```bash
skills/subagent-driven-development/scripts/sdd-workspace
```

The directory contains its own `.gitignore` and must not be committed.

## Recovery

开始或恢复前先读取 ticket artifact、`.superpowers/sdd/progress.md` 和 ticket 分支 git log。
把三者归一为
`{ticketStatus, ledgerStatus, ledgerPhase, commitPresent, base, head, commitBelongsToTicket}`，
运行
`node skills/subagent-driven-development/scripts/reconcile-state.js STATE.json`。`no-dispatch`
表示已完成，不得重复派发；`resume-implementation` 只恢复未提交实现；
`resume-review` 只在 ledger 记录 `review-pending` / `reviewing`、BASE/HEAD 不同且 HEAD
确属当前 ticket 授权提交时恢复审查。任何冲突都返回 `BLOCKED` 并列出证据，不得猜测或覆盖
持久事实。

## Ticket Loop

1. Read the approved ticket and only the necessary Spec sections.
2. Record the ticket ref, acceptance criteria, Spec constraints, current `BASE`, and allowed scope in
   `.superpowers/sdd/progress.md`.
3. For a combined ticket file, extract the target section:

   ```bash
   skills/subagent-driven-development/scripts/ticket-brief TICKETS_FILE TICKET_ID
   ```

4. Create a report path inside `.superpowers/sdd/`.
5. 把 ledger phase 持久化为 `implementing`，再 dispatch one fresh implementer using
   `references/implementer-prompt.md`. Require TDD evidence, focused tests,
   self-review, an authorized commit, and a report file.
6. Read the short status plus report. A blocked result stops the loop; do not guess. 提交出现后立即记录
   原始 `BASE`、当前 `HEAD`、ticket ref 与 `review-pending`，再进行任何 review。
7. Record `HEAD` and create the review package:

   ```bash
   skills/subagent-driven-development/scripts/review-package BASE HEAD
   ```

8. Dispatch one fresh reviewer with `references/ticket-reviewer-prompt.md`. It returns Spec Compliance and Ticket
   quality from the ticket brief, report, Spec constraints, and diff package.
9. Send valid findings back to the same implementer, require new test evidence and a fix commit, then
   regenerate the package from the original `BASE`.
10. Mark the ticket `complete` with `ticket-state.js` only when both verdicts approve it and verification
    passes. Reload the artifact and recompute the frontier before selecting another ticket.

Do not dispatch multiple implementers into the same checkout concurrently.

## Model Selection

Choose the cheapest model that can safely complete the bounded role:

- mechanical, well-specified implementation: fast model;
- multi-file or unfamiliar-domain implementation: capable model;
- architecture-sensitive work or subtle review: strongest available model.

Always set the model explicitly when the host supports it.

## Review Discipline

- The implementer owns edits and tests; the reviewer is read-only.
- The reviewer does not trust the implementer report and does not broaden into a whole-repository crawl.
- Ticket requirements and approved Spec constraints outrank implementation rationales.
- New scope, a new contract, or an invalid ticket graph returns to `/to-tickets`.

After all authorized tickets complete, run one broad branch review with `agents/code-reviewer.md`, then
apply `skills/verification-before-completion/SKILL.md`. Do not claim completion from per-ticket tests
alone.

## Outcomes

```text
TICKET_COMPLETE
- ticket_ref
- base
- head
- tests
- review
- next_frontier

BLOCKED
- ticket_ref
- evidence
- required_decision_or_dependency
```
