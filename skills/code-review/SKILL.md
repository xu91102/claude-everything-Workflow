---
name: code-review
description: "Review changes since a user-supplied fixed point with two parallel subagents: one for repository standards and Fowler smell heuristics, one for Spec compliance. Use for branch, PR, or work-in-progress review before completion."
---

# Code Review

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's fixed-base and no-implicit-write rules.

## Pin the review package

1. Resolve the user-supplied base with `git rev-parse`. Never infer a missing base. Only explicit
   `--staged` review has no branch base.
2. Select one review package:
   - committed branch: `git diff <base>...HEAD` plus `git log <base>..HEAD --oneline`;
   - active no-commit/mixed worktree: `git diff <base>`, which includes committed changes plus
     tracked staged and unstaged changes relative to the base;
   - explicit staged-only review: `git diff --cached`.
3. For branch and worktree modes, list task-owned untracked files explicitly and include their complete
   content/diff because Git does not include untracked files. Record unrelated dirty files as excluded.
4. Capture the selected package once and give the identical package to both reviewers.
5. Stop as `BLOCKED` when a required base is invalid or the intended review package is empty.
6. Resolve the Spec source in order: explicit `--spec`, tracker reference in commits, matching durable
   Spec/plan, then user confirmation that no Spec exists.
7. Read repository standards and only the rules relevant to the changed areas.

## Run two isolated axes

Spawn two parallel subagents with isolated contexts. Do not ask one reviewer to simulate both axes.

- **Standards reviewer**: load `references/standards-reviewer-prompt.md`, the fixed review package,
  relevant repository standards, and the complete smell baseline from that prompt.
- **Spec reviewer**: load `references/spec-reviewer-prompt.md`, the same fixed review package, and
  the complete Spec source. Skip this subagent only when the user confirms there is no Spec.

Both are read-only. They must not edit files or influence one another. If the runtime cannot create
two isolated review contexts, return `BLOCKED`; do not silently collapse them into one reviewer.

## Aggregate

Report the two results side by side under `## Standards` and `## Spec`. Do not merge or rerank
findings across axes. Preserve each axis's severity order and evidence.

End with:

- finding count and worst severity within each axis;
- checks not run;
- the minimal required fixes or missing input.

After fixes, rerun both axes against the same base and current full review package.
