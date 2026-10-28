---
name: code-review
description: Review a fixed diff and confirmed scope; use self-review for verifiable low-risk work and independent review as risk grows.
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

For local fixes touching shared logic, apply the preservation requirements in [架构与兼容规则](../../rules/02-implementation.md).
Unrequested behavior changes fail the Spec axis even if all tests pass; missing required preservation
evidence is `BLOCKED`, not `PASS`.

## Select review depth

Review depth is owned by [review-policy](references/review-policy.md). Select self, independent or dual
from that policy; a direct delivery label is not proof of low risk. Self-review needs only requirements,
the actual diff and applicable evidence, without independent prompts or subagents.

Independent reviewers receive only the fixed package, confirmed scope, evidence and relevant rule paths
in a fresh read-only context (`fork_turns="none"` or host equivalent). Load only the needed
`references/standards-reviewer-prompt.md` or `references/spec-reviewer-prompt.md`; repository rules override heuristics.
Batch independent reads/checks, retain each exit code and failure, and keep dependent actions sequential.
Return findings together in one report per package; use commentary for routine progress instead of message
round trips. The caller fixes findings before sending the updated package for recheck. Reviewers must not influence each other.

## Report and follow-up

Report mode, base and scope source, then separate `Standards` and `Spec` findings with evidence and severity.
Do not merge or rerank findings across axes. Include checks not run and remaining risks.
For self-review with no findings, a short conclusion and verification evidence are sufficient.

Fix Critical/Important findings before completion. Recheck affected axes against the same base and updated
package; rerun both when scope, shared behavior or review assumptions change. Reuse checks whose relevant
inputs are unchanged. A task's complete acceptance and required verification remain completion gates.
