---
name: using-superpowers
description: "Use when starting or routing a non-trivial task in this workflow harness, when the user references Superpowers, or when deciding which skill, command, rule, or agent should govern the work. Establishes skill invocation discipline: check relevant process skills before acting, follow user/project instructions first, and verify before completion."
---

# Using Superpowers

This is the workflow router for the local Superpowers-inspired harness. It keeps action disciplined while respecting this repository's Chinese communication rules and Git boundaries.

## Priority

Follow instructions in this order:

1. User instructions, including direct requests, `AGENTS.md`, `CLAUDE.md`, and repo-local rules.
2. Applicable skills, commands, agents, and hooks from this repository.
3. Default agent behavior.

If a skill conflicts with explicit User instructions or project instructions, follow the user/project instruction and state the conflict if it affects the outcome.

## Skill Invocation Rule

Before taking action on a non-trivial task:

1. Decide whether a process skill applies.
2. Load the applicable skill before exploration, implementation, clarification, or final claims.
3. Announce briefly which skill is being used and why.
4. Follow the skill's gate, checklist, and verification requirements.
5. If the skill is not a fit after reading it, say so briefly and continue with the smallest suitable workflow.

Do not rely on memory of a skill. Skills evolve; use the current `SKILL.md` content.

## Routing

Use process skills before implementation skills:

```text
Task arrives
  -> unclear / high-risk / multi-file?      -> brainstorming
  -> approved spec, no plan?                -> writing-plans
  -> approved plan + SDD/commit approved?   -> subagent-driven-development
  -> approved plan, no commit approval?     -> executing-plans
  -> bug / failing test / unexpected result -> systematic-debugging
  -> behavior change with test path?        -> test-driven-development
  -> dirty worktree / risky branch work?    -> using-git-worktrees
  -> completion / fixed / ready claim?      -> verification-before-completion
  -> external skill learning or edit?       -> skill-creator + skills-learning
```

- Complex, ambiguous, architectural, integration, high-risk, cross-file, or behavior-changing work: use `skills/brainstorming/SKILL.md` first.
- Approved spec that needs an implementation plan: use `skills/writing-plans/SKILL.md`.
- Approved plan with independent tasks and approved commit/PR/SDD handling: use `skills/subagent-driven-development/SKILL.md`.
- Approved plan without commit handling or with tightly coupled tasks: use `skills/executing-plans/SKILL.md`.
- Bug, failing test, flaky behavior, or unexpected result: use `skills/systematic-debugging/SKILL.md` before proposing a fix.
- Behavior-changing implementation with a viable test path: use `skills/test-driven-development/SKILL.md`.
- Risky branch work, dirty worktree, parallel effort, or PR cleanup: consider `skills/using-git-worktrees/SKILL.md`.
- Completion, fixed, passing, ready, or PR-readiness claims: use `skills/verification-before-completion/SKILL.md`.
- External skill learning or skill edits: use `skills/skill-creator/SKILL.md` and `rules/common/skills-learning.md`.

Then apply domain skills such as documentation lookup, E2E testing, or workflow engineering as needed.

## Red Flags

Stop and check skills before continuing if you think:

- "This is just a quick code change."
- "I need to inspect files before deciding."
- "I remember what this skill says."
- "The user asked for the outcome, so the workflow gate can be skipped."
- "The verification should pass."

These are usually signs that a process skill should shape the next step.

## Completion

Before saying work is complete, fixed, passing, or ready, apply `skills/verification-before-completion/SKILL.md` and report fresh evidence, skipped checks, and remaining risk.
