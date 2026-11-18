---
name: using-superpowers
description: Route engineering delivery and explicitly requested engineering workflows; resume their process outcomes.
---

# Using Superpowers

Use this router for engineering delivery or an explicitly requested engineering workflow. Apply returned outcomes here. Answer ordinary questions, translations and summaries directly.

## Skill Invocation Rule

User instructions and project rules (including `AGENTS.md` and `CLAUDE.md`) take priority over Skills, commands and hooks. Infer scope and acceptance from the request and project. Select the shortest applicable path, briefly explain the choice and read only the selected procedure. Reuse it while its contents and context are current.

An explicit request can use ordinary language, `/name` or `$name`. When the user asks only for advice or status, report the proposal or verified state. A standalone review authorizes findings. Use existing delivery authorization to resume work within its scope.

## Three Lanes

The three lanes are direct (clear low-risk task), needs-decision (grilling inline), and formal-spec (explicit formal Spec or high-risk boundary). File count, new features, and ordinary complexity affect
verification intensity, not the lane. A high-risk boundary involves costly-to-reverse architecture, public contracts, authentication or authorization, persistent migrations, or irreversible external effects. Record this risk before grilling so the handoff can resume the formal Spec.

## Routing

Use process skills before implementation skills:

```text
Task arrives
  -> explicit workflow advice?                    -> workflow advice mode
  -> explicit documented grilling request?        -> grilling explicit + domain-modeling persistent mode
  -> explicit grilling request?                    -> grilling explicit
  -> explicit handoff or fresh session or prototype branch?
                                                     -> skills/handoff/SKILL.md
  -> standalone diff or PR review?                 -> skills/code-review/SKILL.md
  -> explicit triage request?                      -> skills/triage/SKILL.md
  -> explicit TDD request?                         -> skills/test-driven-development/SKILL.md
  -> explicit project verification setup/maintenance or real-flow acceptance request?
                                                     -> skills/feature-acceptance/SKILL.md
  -> explicit E2E or Playwright request?           -> skills/e2e-testing/SKILL.md + agents/e2e-runner.md
  -> explicit harness audit?                       -> agents/harness-optimizer.md
  -> explicit architecture-health audit?           -> skills/improve-codebase-architecture/SKILL.md
  -> merge or rebase conflict?                     -> skills/resolving-merge-conflicts/SKILL.md
  -> reported bug or unexplained/repeated failure? -> skills/systematic-debugging/SKILL.md
  -> discoverable fact?                            -> inspect it; do not ask
  -> external engineering fact or documentation question? -> inspect primary sources directly; cite the answer
  -> explicit prototype or runnable design question? -> skills/prototype/SKILL.md
  -> unresolved user-owned decision?               -> skills/grilling/SKILL.md (grilling inline)
       high-risk or explicit formal Spec context?  -> resume_target: spec-gate
  -> explicit formal Spec or high-risk boundary?   -> spec-gate
  -> delivery request in defined scope?            -> select delivery topology
       -> durable multi-session/tracker graph?     -> skills/to-tickets/SKILL.md
       -> independent frontier tickets with no overlapping write surface?
                                                     -> skills/subagent-driven-development/SKILL.md
       -> otherwise                                 -> read-reference skills/implement/SKILL.md
  -> behavior change with a test path?             -> test-driven-development
  -> new feature or other Git-rule isolation need? -> rules/05-git-workflow.md
  -> completion, fixed, or ready claim?            -> rules/common/testing.md (report final-state evidence, gaps and risk)
  -> skill discovery or install request?           -> use available host tooling for the explicit request
  -> external skill learning or edit?              -> rules/common/skills-learning.md
  -> otherwise                                     -> shortest applicable loop
```

### Workflow advice mode

给出推荐入口、理由、前置条件及到审查和验证的路径，列出尚缺的用户决定或工件。到建议为止。

### Agent-selected Delivery Topology

Select within the authorized scope. For one coherent delivery, `read-reference` means read [the delivery procedure](../implement/SKILL.md) from the same distribution as a file. Expected TDD RED stays in that implementation loop.

For durable work, show ticket behavior, acceptance criteria and blockers and obtain contract approval before publishing. Choose parallel ticket implementation only for at least two approved, unblocked tickets with disjoint write surfaces. Otherwise implement serially. Commit, push, PR, external tracker writes, irreversible actions and scope expansion require their own authorization. Reuse approvals already given.

## Process Outcomes

For grilling/Spec outcomes or cross-session handoff, read [references/process-outcomes.md](references/process-outcomes.md). A self-reviewed Spec still needs user approval. Ordinary direct delivery does not load this reference.

## Compatibility Alias

For one release cycle, explain that the old name `brainstorming` moved to `/to-spec` and apply the formal Spec route.
