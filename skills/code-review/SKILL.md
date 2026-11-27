---
name: code-review
description: Review a fixed diff and confirmed scope with an independent read-only subagent, escalating to dual-axis review as risk grows.
---

# Code Review

Origin: `mattpocock/skills@2ab9580`, adapted to fixed-base review and proportionate verification.
Review depth belongs here; callers supply the scope, base, risk and available evidence.

## Pin the review package

1. Resolve the user-supplied or caller-recorded base with `git rev-parse`. A pre-delivery/pre-ticket base
   is valid input. Never invent a missing base; explicit `--staged` review needs none.
2. Select the package:
   - committed branch: `git diff <base>...HEAD` and `git log <base>..HEAD --oneline`;
   - active worktree: `git diff <base>` includes committed changes and tracked staged and unstaged edits;
   - staged-only: `git diff --cached`.
3. Include task-owned untracked files in full; exclude unrelated dirty files explicitly.
4. Use the original user request, including user-approved Spec/ticket and scope changes, as the scope
   authority. An implementer's plan or summary cannot broaden it. Only then inspect tracker references
   or matching durable documents if needed.
   Do not ask again for a base or scope the caller already supplied. Never infer requirements from the diff.
5. Missing base or required acceptance evidence is `BLOCKED`. An intentionally empty package is `NO CHANGES`.
   For a standalone review with no confirmed requirements, report the Spec axis as `NOT RUN` without
   requiring an extra user confirmation; implementation completion still requires its acceptance criteria.

For local fixes touching shared logic, apply the preservation requirements in `rules/02-implementation.md`.
Unrequested behavior changes fail the Spec axis even if all tests pass; missing required preservation
evidence is `BLOCKED`, not `PASS`.

## Select review depth

`--mode auto` is the default. Always delegate review to a fresh independent read-only subagent (`independent` or `dual`), selected by risk and verification evidence, not file count, model generation or confidence. State the selected mode and reason briefly.

| Mode | Trigger | Execution |
| --- | --- | --- |
| independent | Standard changes with clear scope and verification evidence, or an explicit request for single-subagent review | One fresh read-only subagent checks Standards and Spec against the same frozen package |
| dual | High-risk changes such as authorization, persistent data, destructive operations or public contracts, insufficient verification, repeated unexpected failures, or an explicit request for two isolated axes | Spawn two parallel subagents: separate Standards and Spec reviewers |

`--mode auto|independent|dual` may request a mode, but cannot weaken the review required by the scope or
project. Reassess if the scope grows or verification exposes a gap. Review never replaces required tests.

The implementing agent must never review its own diff (no self-review mode is offered).
Load `references/standards-reviewer-prompt.md` and `references/spec-reviewer-prompt.md` only for the
reviewer(s) that need them (`independent` receives both; `dual` passes each prompt only to its respective
subagent). Repository standards override smell heuristics. Each independent context receives only the
frozen package, relevant rules, confirmed scope and verification evidence. Reviewers are read-only and
must not influence each other.

Lack of agent capacity is never a reason to fall back to self-review. If parallelism is unavailable during
`dual` review, run dual axes sequentially in fresh isolated contexts. If no independent context is
available, return `BLOCKED`, mark review `NOT RUN`, and do not claim completion.
Only when the user explicitly opts out of local review in favor of external/online PR review (e.g., GitHub `@codex review`), callers record local review as `SKIPPED (deferred to user-requested online review)` rather than self-reviewing or claiming review passed, and treat review as pending until the online review result is received and addressed.

## Report and follow-up

Report mode, base and scope source, then separate `Standards` and `Spec` findings with evidence and severity.
Do not merge or rerank findings across axes. Include checks not run and remaining risks.

Fix Critical/Important findings before completion. Recheck affected axes against the same base and updated
package; rerun both when scope, shared behavior or review assumptions change. Reuse checks whose relevant
inputs are unchanged. A task's complete acceptance and required verification remain completion gates.
