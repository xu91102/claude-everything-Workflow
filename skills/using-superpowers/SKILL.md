---
name: using-superpowers
description: "Route delivery work through an agent-selected direct, serial-ticket, or safe SDD topology; use grilling for unresolved user-owned decisions and Spec Gate for explicitly requested or costly-to-reverse work. Use at task start, after a process Skill returns an outcome, and whenever continuation ownership is unclear."
---

# Using Superpowers

Own routing and continuation for the workflow harness. Skills return outcomes here instead of directly invoking one another.

## Priority

Follow instructions in this order:

1. User instructions, `AGENTS.md`, `CLAUDE.md`, and repository rules.
2. Applicable process Skills, commands, agents, and hooks.
3. Implementation Skills and default agent behavior.

If a Skill conflicts with an explicit higher-priority instruction, follow the higher-priority instruction and explain any material impact.

## Skill Invocation Rule

Before acting on a non-trivial task:

1. Classify explicit intent, high-risk boundaries, discoverable facts, and unresolved user-owned decisions.
2. Load the narrowest applicable process Skill before exploration, implementation, clarification, or a final claim.
3. Announce briefly which Skill is being used and why.
4. Follow its gates, outcome contract, and verification requirements.
5. Return here whenever continuation needs another Skill or path.

Do not rely on memory of a Skill. Skills evolve; read the current `SKILL.md`.

Primary process definitions include `skills/grilling/SKILL.md`, `skills/spec-gate/SKILL.md`, `skills/systematic-debugging/SKILL.md`, and `skills/verification-before-completion/SKILL.md`.

## Three Lanes

The workflow has three lanes:

```text
direct
  clear low-risk task -> implement -> proportionate verification

needs-decision
  unresolved user-owned decision -> grilling inline -> route again

formal-spec
  explicit formal Spec or high-risk boundary
    -> grilling inline first only when a consequential decision is unresolved
    -> spec-gate -> user review -> approved Spec
       -> router selects delivery topology
          -> durable ticket graph -> to-tickets -> user approves ticket contract
          -> one coherent scope -> implement
          -> independent frontier tickets without write overlap -> subagent-driven-development
```

File count, a new-feature label, ordinary behavior change, and normal code complexity do not upgrade a task. They affect implementation and verification intensity only.

## Routing

Use process skills before implementation skills:

```text
Task arrives
  -> explicit workflow advice?                    -> workflow advice mode
  -> explicit project-context setup request?       -> project-context
  -> explicit documented grilling request?        -> grilling explicit + domain-modeling persistent mode
  -> explicit grilling request?                    -> grilling explicit
  -> explicit handoff or fresh session or prototype branch?
                                                     -> skills/handoff/SKILL.md
  -> explicit triage request?                      -> skills/triage/SKILL.md
  -> explicit TDD request?                         -> skills/test-driven-development/SKILL.md + agents/tdd-guide.md
  -> explicit E2E or Playwright request?           -> skills/e2e-testing/SKILL.md + agents/e2e-runner.md
  -> explicit harness audit?                       -> agents/harness-optimizer.md
  -> huge effort beyond one session?               -> skills/wayfinder/SKILL.md
  -> explicit architecture-health audit?           -> skills/improve-codebase-architecture/SKILL.md
  -> merge or rebase conflict?                     -> skills/resolving-merge-conflicts/SKILL.md
  -> bug, failing test, or unexpected result?      -> systematic-debugging
  -> discoverable fact?                            -> inspect it; do not ask
  -> primary-source research or cited research artifact? -> skills/research/SKILL.md
  -> systematic evidence or blind-spot gap?        -> iterative-retrieval
  -> explicit prototype or runnable design question? -> skills/prototype/SKILL.md
  -> unresolved user-owned decision?               -> grilling inline
       high-risk or explicit formal Spec context?  -> resume_target: spec-gate
  -> explicit formal Spec or high-risk boundary?   -> spec-gate
  -> delivery request in defined scope?            -> select delivery topology
       -> durable multi-session/tracker graph?     -> skills/to-tickets/SKILL.md
       -> independent frontier tickets with no overlapping write surface?
                                                     -> skills/subagent-driven-development/SKILL.md
       -> otherwise                                 -> skills/implement/SKILL.md
  -> behavior change with a test path?             -> test-driven-development
  -> dirty worktree or risky branch work?          -> consider using-git-worktrees
  -> completion, fixed, or ready claim?            -> verification-before-completion
  -> skill discovery or install request?           -> find-skills
  -> external skill learning or edit?              -> rules/common/skills-learning.md
  -> otherwise                                     -> shortest applicable loop
```

A high-risk boundary is a costly-to-reverse architecture or service boundary, public-contract compatibility, authentication or authorization boundary, persistent data/schema migration, or irreversible external side effect. Record this classification before grilling so its handoff can resume `spec-gate`.

## Process Outcomes

### Workflow advice mode

只返回推荐入口与原因、前置条件、需要补齐的用户决策或 Spec/tickets/map/handoff，以及直到
审查和验证的闭环路径。不要调用下一 Skill、写文件或修改 tracker。

### Agent-selected Delivery Topology

用户要求完成一个定义明确的交付范围后，router 自行选择 `implement`、`to-tickets` 或
`subagent-driven-development`；选择依据是持续性、依赖图、写入面和验证成本，而不是用户是否记得某个
Skill 名称。开始时用一行说明所选拓扑及理由，然后继续执行。

- 一个可在当前上下文完成的连贯范围，使用 `implement`。
- 需要跨会话、tracker 或可恢复依赖图时，使用 `to-tickets`。这仍必须展示 ticket 的行为、验收标准与
  blocker，并在发布前获得用户对 ticket contract 的批准。
- 只有至少两张已批准、无 blocker、写入面不重叠的 frontier tickets，才使用 SDD。不能安全并行时选择
  串行 `implement`，不要为了使用 subagent 人为拆票。

用户的交付授权覆盖已批准范围内的本地实现与拓扑选择，不覆盖新的产品范围、未决用户决策、外部 tracker
mutation、commit、push、PR 或不可逆副作用。新的 frontier 只有仍在该授权范围内时才能由 router 再次选择
执行拓扑。

### Grilling handoff

Read `Risk classification` and `Resume target`. A non-formal task returns to direct or another narrow process. A high-risk/formal task with `resume_target: spec-gate` enters a fresh Spec Gate call.

### Spec Gate ready

`READY_FOR_USER_REVIEW` means the local artifact passed self-review but is not approved. Present the
path and wait for explicit approval. Approval returns control here; the router then selects a delivery
topology from the approved scope instead of waiting for the user to name the next Skill.

### Cross-session handoff

When a prototype detour needs isolation or the current context is leaving its reliable reasoning zone,
recommend the `handoff` Skill and wait for explicit approval before creating the temporary document.
The handoff ends the current flow; a fresh session references the returned path and enters this router
again. Do not use handoff as a substitute for durable Specs, ADRs, tickets, or verification evidence.

### Spec Gate blocked

`BLOCKED_BY_UNRESOLVED_DECISION` is terminal for the current call chain:

1. Stop without drafting, guessing, or automatically invoking another Skill.
2. Present a decision map: confirmed decisions, unresolved decision, and blocking point.
3. Let the user choose to continue clarification, reduce scope, or exit the formal flow.
4. Only an explicit choice to continue starts a new grilling session.
5. After that session completes, route again into a new Spec Gate; do not resume the old call stack.

If the same confirmed `decision_id` blocks again with unchanged evidence, report a `Spec Gate contract conflict`. Do not repeat the question. Only reversal evidence or an invalidated premise can reopen the decision.

### Spec Gate not applicable

`NOT_APPLICABLE` returns control here. Select the shortest applicable path without asking the originating Skill to recommend a successor.

## Compatibility Alias

For one release cycle, interpret a user explicitly asking for the old name `brainstorming` as a formal Spec request. Explain that the entry moved to `/to-spec`; route through the same optional grilling and `spec-gate` path. Do not expose an old Skill shim or a second protocol source.

## Red Flags

Stop and reassess if you are about to:

- ask for a fact that tools can discover;
- add grilling because a task is merely complex or multi-file;
- enter formal Spec Gate for an ordinary reversible change;
- let Spec Gate interview the user;
- automatically bounce from a blocked Spec Gate to grilling;
- select SDD without at least two safe, independent frontier tickets;
- treat a topology choice as approval for a ticket contract or an external mutation;
- continue implementation without an approved required Spec;
- claim completion without fresh verification evidence.

## Completion

Before saying work is complete, fixed, passing, or ready, apply `skills/verification-before-completion/SKILL.md` and report fresh evidence, skipped checks, and remaining risk.
