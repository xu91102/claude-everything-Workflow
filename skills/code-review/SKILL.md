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
4. Use an explicit Spec, the caller's direct-scope contract/approved Spec/ticket, or confirmed user
   acceptance criteria. Only then inspect tracker references or matching durable documents if needed.
   Do not ask again for a base or scope the caller already supplied. Never infer requirements from the diff.
5. Missing base or required acceptance evidence is `BLOCKED`. An intentionally empty package is `NO CHANGES`.
   For a standalone review with no confirmed requirements, report the Spec axis as `NOT RUN` without
   requiring an extra user confirmation; implementation completion still requires its acceptance criteria.

## Select review depth

`--mode auto` is the default. Select by risk and verification evidence, not file count, model generation
or confidence. State the selected mode and reason briefly.

| Mode | Trigger | Execution |
| --- | --- | --- |
| self | Clear requirements, local and reversible low-risk changes, with direct checks or relevant tests covering the result; no unresolved risk or repeated unexpected failures | The implementing agent checks the diff against requirements and relevant rules, then provides verification evidence; no review subagent |
| independent | Cross-module behavior, complex dependencies, hidden constraints, insufficient verification, repeated unexpected failures, or an explicit request for independent review | One fresh read-only subagent checks Standards and Spec against the same package |
| dual | High-risk changes such as authorization, persistent data, destructive operations or public contracts, or an explicit request for two isolated axes | Spawn two parallel subagents: separate Standards and Spec reviewers |

`--mode self|independent|dual` may request a mode, but cannot weaken the review required by the scope or
project. Self-review requires every self condition above; otherwise use independent, or dual for high
risk. Reassess if the scope grows or verification exposes a gap. Review never replaces required tests.

For self-review, keep the result concise and use relevant existing checks or direct inspection; do not
load the independent-review prompts, invent low-value tests, or write a long checklist just for ceremony.
The implementing agent cannot serve as its own independent reviewer.

For independent or dual review, load `references/standards-reviewer-prompt.md` and
`references/spec-reviewer-prompt.md` only for the reviewer that needs them. Repository standards override
smell heuristics. Each independent context receives only the frozen package, relevant rules, confirmed
scope and verification evidence. Reviewers are read-only and must not influence each other.

When independent or dual review is selected, lack of agent capacity is never a reason to downgrade to
self. If parallelism is unavailable, run dual axes sequentially in fresh isolated contexts. If no
independent context is available, return `BLOCKED`, mark review `NOT RUN`, and do not claim completion.

## Report and follow-up

Report mode, base and scope source, then separate `Standards` and `Spec` findings with evidence and severity.
Do not merge or rerank findings across axes. Include checks not run and remaining risks.
For self-review with no findings, a short conclusion and verification evidence are sufficient.

Fix Critical/Important findings before completion. Recheck affected axes against the same base and updated
package; rerun both when scope, shared behavior or review assumptions change. Reuse checks whose relevant
inputs are unchanged. A task's complete acceptance and required verification remain completion gates.
