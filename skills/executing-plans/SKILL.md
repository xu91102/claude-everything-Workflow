---
name: executing-plans
description: Use after an implementation plan exists and the user wants execution. Runs the plan task-by-task with checkpoints, proportional review, tests, and final verification without expanding scope or asking for duplicate approval.
---

# Executing Plans

Reference: https://github.com/obra/superpowers

Use this skill after `skills/writing-plans/SKILL.md` has produced an execution-ready plan. A separate approval is unnecessary when the plan faithfully records requirements or a design the user already approved and the user already requested implementation. If the plan introduces a material decision, scope change, or new risk, get approval for that difference before editing.

The plan is the execution source of truth; do not add scope unless the user approves the change.

## Preconditions

- An implementation plan exists and has passed its self-review.
- The user requested implementation in the current request or earlier in the task.
- If the plan contains a material decision the user has not seen, approve that difference; do not re-approve unchanged requirements.
- If work should be isolated, use `skills/using-git-worktrees/SKILL.md` before editing.
- Read the plan once, extract tasks, files, tests, and acceptance criteria.
- Choose inline or project-agent loop from task shape. Ask only when missing Git permission or a user-owned trade-off blocks that choice.

## Inline Execution

Use inline execution for small, clear, tightly coupled work.

For each task:

1. Mark exactly one task in progress.
2. Perform the next unchecked step only.
3. Run the command specified by the plan.
4. If a test or command fails unexpectedly, pause and use `skills/systematic-debugging/SKILL.md`.
5. Apply proportional review: always self-check requirement compliance and the diff; use independent requirement/code-quality review only for high-risk, cross-module, security-sensitive, or independently delegated tasks.
6. Mark the task complete only after the required checks pass.

## Project-Agent Loop

Use this for substantial plans with independent tasks.

For each task:

1. Dispatch one fresh implementation agent with only:
   - the binding requirement, approved design, or spec summary
   - the exact task section
   - relevant file paths
   - expected tests and acceptance criteria
2. Tell the agent it is not alone in the codebase and must not revert others' changes.
3. After implementation, run requirement/spec compliance review.
4. Run code quality review with `agents/code-reviewer.md`; add security or database review only when the touched area warrants it.
5. Send findings back to the same implementer until resolved.
6. Mark the task complete only after tests and reviews pass.

Subagents must return only conclusion, evidence paths, risks, and next steps. Do not accept large raw logs as final output.

## Completion Loop

After all tasks are complete:

1. Apply `skills/verification-before-completion/SKILL.md`: identify the verification evidence required before any completion claim.
2. Run `/verify` or the plan's equivalent verification commands to produce that fresh evidence.
3. If verification fails, use `skills/systematic-debugging/SKILL.md` for each failure class before changing code.
4. Run a final proportional review over the full diff; add independent reviewers when risk warrants them.
5. Summarize files changed, tests run, skipped checks, remaining risk, and whether the work is ready for `/pr`.

## Boundaries

- Do not commit, push, create PRs, delete branches, or remove worktrees unless the user asked for that action.
- Do not skip failed tests because later tasks might fix them; record the failure and debug now unless the plan explicitly says the failure is expected.
- Do not mark multiple tasks complete at the end; update status incrementally.
