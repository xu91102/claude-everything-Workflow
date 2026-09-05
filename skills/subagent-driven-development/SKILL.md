---
name: subagent-driven-development
description: Dispatch approved independent frontier tickets in isolated worktrees; use only when router selects SDD.
---

# Subagent-Driven Development

Run several independent frontier tickets in parallel without reintroducing a long implementation plan.
Each fresh subagent receives one approved ticket, discovers current code details itself, and returns evidence
for review. The controller owns ticket selection, worktree isolation, review, tracker mutations and user
communication.

## When to Use

Use only when all of the following are true:

- the router is executing a user-authorized delivery scope and records why SDD is safer or faster than
  serial `implement`;
- at least two selected tickets are `ready-for-agent`, unclaimed and have no unresolved blocker;
- the tickets do not modify the same files, shared migration, release boundary or external state;
- each ticket can finish in one fresh subagent context.

Announce the selected topology and its reason in one line, then continue. Otherwise use `implement` for
one ticket. Do not manufacture extra tickets merely to justify parallelism.

## Prepare

1. Read the full source ticket and its blocker status; record its acceptance criteria and the user-approved
   scope.
2. Confirm the selected tickets form the frontier and have no overlapping write surface. If overlap is
   uncertain, run them sequentially.
3. Create one clean controller-owned integration worktree at the common base, plus one separate worktree
   and branch per ticket using `skills/using-git-worktrees/SKILL.md`. The integration worktree is the only
   delivery target; do not share a checkout between implementers.
4. Record the common base and every worktree path. The integration worktree must have no unrelated dirty
   or untracked files before the first diff is applied.
5. Do not generate a detailed implementation plan, task brief file, or code skeleton. The ticket is the
   implementation contract.

## Dispatch

For each ticket, dispatch one fresh subagent with only:

```text
Ticket: <reference and full body>
Worktree: <absolute path>
Base: <commit>
Context: <why this behavior exists, confirmed interfaces, and completed blockers>

Implement only this ticket. Inspect the current code to choose files and implementation details.
Use test-driven-development for behavior changes. Keep the ticket's acceptance criteria as the
source of truth; do not expand scope or start another ticket.

Do not stage, commit, push, open a PR, claim/resolve/comment on a tracker, or perform any other external
mutation. Leave only this ticket's worktree diff, including task-owned untracked files.

Before reporting, run focused verification, self-review the diff, and report:
- status: DONE | BLOCKED | NEEDS_DECISION
- changed files and tests run
- task-owned untracked files created since dispatch
- RED/GREEN evidence when TDD applied
- unresolved risk or assumption
```

If an agent finds a consequential decision, stop that ticket and return it to `using-superpowers`; do not
let a parallel worker decide it unilaterally.

## Review, Integrate and Resolve

1. Review each completed ticket against its ticket body and its worker review package. That package must
   include tracked, staged, unstaged and task-owned untracked files from the recorded worker base. Run the
   ticket's required verification, then use `skills/code-review/SKILL.md`; the ticket is the Spec source.
2. For each ticket that passes, generate an applyable binary patch from its recorded worker base. Record
   task-owned untracked files before and after dispatch, then append a `git diff --binary --no-index`
   patch for every new untracked file. Apply both tracked and untracked patches with a three-way apply to
   the controller-owned integration worktree. Never copy files between worktrees.
3. Confirm every applied tracked and task-owned untracked file is present in the integration worktree, run
   `git diff --check`, and run the ticket's integration-sensitive verification. An apply conflict or
   regression keeps that ticket `in-progress`; do not resolve it or silently discard its worker diff.
4. After every selected ticket is integrated, use `skills/code-review/SKILL.md` against the complete
   integration worktree package from the common base. Include its tracked, staged, unstaged and
   task-owned untracked files, and give every selected ticket body as the combined Spec source. Then run
   the combined verification required by the selected tickets. Do not resolve any selected ticket until
   this integrate-and-verify gate passes.
5. Update a local tracker only for integrated tickets that pass the gate. External claim, comment or close
   operations still require the confirmation specified by `implement`.
6. Refresh the graph after every resolve and return it to the router. The router may select the next
   topology only for frontier tickets that remain inside the same user-authorized delivery scope.

## Boundaries

- One fresh subagent owns one ticket and one separate worktree.
- Do not generate a detailed implementation plan or depend on file-by-file instructions.
- Do not parallelize tickets with a real dependency, overlapping files, shared migrations or shared external
  side effects.
- Do not auto-commit, push, open a PR or close an external Issue. A topology choice does not authorize
  external tracker mutation or a new product scope.
- Keep the integration worktree and its uncommitted, task-owned diff as the handoff target until the user
  separately authorizes commit, push, PR or cleanup.

## Example

Tickets `01` and `02` are both unblocked and modify different packages. The router selects SDD, creates one
integration worktree plus two worker worktrees, then dispatches two fresh subagents. Each implements and
verifies only its own ticket. Review both worker diffs, apply passing diffs to the integration worktree, and
run the combined gate before resolving either ticket or returning the unlocked frontier to the router.
