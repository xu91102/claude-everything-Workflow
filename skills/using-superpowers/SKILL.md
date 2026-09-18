---
name: using-superpowers
description: Claude Code only — select specialized workflows when workflow guidance is explicitly requested.
---

# Using Superpowers

Own routing and continuation. Skills return outcomes here instead of selecting one another.

## Applicability

仅供 Claude Code 的显式工作流咨询；不作为普通开发必经入口，Codex 不安装本技能。
普通问答、翻译、总结和一般资料检索直接处理；复杂度本身不触发本路由。

## Priority

User instructions, `AGENTS.md`, `CLAUDE.md`, and repository rules take precedence over Skills,
commands, agents, and hooks, which take precedence over default behavior.

## Skill Invocation Rule

Classify intent, discoverable facts, user-owned decisions, and risk; select the shortest applicable path
below and read only its Skill. Briefly announce the selection, then act. Do not load a chain of Skills
in anticipation of later stages. Reuse a Skill already read in this task unless it changed or context
was lost; returning here means applying the routing decision, not reading this file again.

Expected TDD RED stays in the current implementation loop. Do not reroute it as a reported bug.
An explicit request may use ordinary language or a native `/name` or `$name` invocation.
For handoff, triage and improve-codebase-architecture,
require the corresponding user request; complexity or a router match alone is insufficient.
Do not ask users to repeat an already clear request using command syntax. Skill selection never
expands authorization for publishing, external writes, or other consequential actions.

## Three Lanes

The three lanes are: direct (clear low-risk task), needs-decision (grilling inline), and formal-spec
(explicit formal Spec or high-risk boundary). File count, new features, and ordinary complexity affect
verification intensity, not the lane. Resolve only consequential user decisions that tools cannot discover.

## Routing

Select only the capabilities needed for the goal; this map is not a mandatory sequence of artifacts.
Audit and advice are read-only unless the user authorizes implementation; routing never grants write permission.
TDD and isolation follow their rule owners; a low-risk small feature on a safe task branch needs no extra Spec, ticket or worktree unless explicitly requested.

Routing map:

```text
Task arrives
  -> explicit workflow advice?                    -> workflow advice mode
  -> explicit documented grilling request?        -> grilling explicit + domain-modeling persistent mode
  -> explicit grilling request?                    -> grilling explicit
  -> explicit handoff or fresh session or prototype branch?
                                                     -> skills/handoff/SKILL.md
  -> explicit triage request?                      -> skills/triage/SKILL.md
  -> explicit TDD request?                         -> skills/test-driven-development/SKILL.md
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
       -> otherwise                                 -> direct development
  -> testing method or behavior verification?      -> rules/common/testing.md
  -> Git-rule isolation need?                      -> rules/05-git-workflow.md
  -> completion, fixed, or ready claim?            -> rules/common/testing.md
  -> skill discovery or install request?           -> use available host tooling for the explicit request
  -> external skill learning or edit?              -> rules/common/skills-learning.md
  -> otherwise                                     -> shortest applicable loop
```

A high-risk boundary is a costly-to-reverse architecture or service boundary, public-contract compatibility, authentication or authorization boundary, persistent data/schema migration, or irreversible external side effect. Record this classification before grilling so its handoff can resume `spec-gate`.

### Workflow advice mode

只返回推荐入口与原因、前置条件、需要补齐的用户决策或 Spec/tickets/map/handoff，以及直到
审查和验证的闭环路径。不要调用下一 Skill、写文件或修改 tracker。

### Agent-selected Delivery Topology

显式咨询交付方法时，按范围建议直接开发、ticket 专项 `implement`、`to-tickets` 或
`subagent-driven-development`；选择依据是持续性、依赖图、写入面和验证成本，而不是用户是否记得某个
Skill 名称。开始时用一行说明所选拓扑及理由，然后继续执行。

- 一个可在当前上下文完成的连贯范围，直接开发；`implement` 仅用于已批准 ticket。
- 需要跨会话、tracker 或可恢复依赖图时，使用 `to-tickets`。这仍必须展示 ticket 的行为、验收标准与
  blocker，并在发布前获得用户对 ticket contract 的批准。
- 只有至少两张已批准、无 blocker、写入面不重叠的 frontier tickets，才使用 SDD。不能安全并行时选择
  串行交付，不要为了使用 subagent 人为拆票。

用户的交付授权覆盖已批准范围内的本地实现与拓扑选择，不覆盖新的产品范围、未决用户决策、外部 tracker
mutation、commit、push、PR 或不可逆副作用。新的 frontier 只有仍在该授权范围内时才能由 router 再次选择
执行拓扑。

## Process Outcomes

Only when processing a grilling/Spec outcome or preparing a cross-session handoff, read
[process outcomes](../../references/process-outcomes.md). Follow the matching outcome before
continuing; a self-reviewed Spec is not user approval. Ordinary direct delivery does not load this reference.

## Compatibility Alias

For one release cycle, interpret a user explicitly asking for the old name `brainstorming` as a formal Spec request. Explain that the entry moved to `/to-spec`; route through the same optional grilling and `spec-gate` path. Do not expose an old Skill shim or a second protocol source.

## Completion

Before saying work is complete, fixed, passing, or ready, apply `rules/common/testing.md` and report fresh evidence, skipped checks, and remaining risk.
