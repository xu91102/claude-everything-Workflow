---
name: using-superpowers
description: "Route non-trivial work through the smallest suitable workflow, including direct execution, grilling for unresolved user-owned decisions, and formal Spec Gate for explicitly requested or costly-to-reverse work. Use at task start, after a process Skill returns an outcome, and whenever continuation ownership is unclear."
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
       -> multi-session/tracker delivery -> to-tickets -> implement per frontier ticket
       -> single-session delivery -> writing-plans -> execute
```

File count, a new-feature label, ordinary behavior change, and normal code complexity do not upgrade a task. They affect implementation and verification intensity only.

## Routing

Use process skills before implementation skills:

```text
Task arrives
  -> explicit workflow advice?                    -> /ask-workflow advice mode
  -> explicit /setup-workflow?                     -> project-context
  -> explicit /grill-with-docs?                    -> grilling explicit + domain-modeling persistent mode
  -> explicit /grill?                              -> grilling explicit
  -> explicit /handoff or fresh session or prototype branch? -> skills/handoff/SKILL.md
  -> explicit /triage?                             -> skills/triage/SKILL.md
  -> explicit /implement?                          -> validate approved plan/ticket, then implementation loop
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
  -> approved Spec requiring tracker tickets?      -> skills/to-tickets/SKILL.md
  -> approved Spec, single-session plan missing?   -> writing-plans
  -> approved agent-ready ticket?                  -> /implement ticket loop
  -> approved plan + SDD/commit approved?          -> subagent-driven-development
  -> approved plan, no commit approval?            -> executing-plans
  -> behavior change with a test path?             -> test-driven-development
  -> dirty worktree or risky branch work?          -> consider using-git-worktrees
  -> completion, fixed, or ready claim?            -> verification-before-completion
  -> skill discovery or install request?           -> find-skills
  -> external skill learning or edit?              -> rules/common/skills-learning.md
  -> otherwise                                     -> shortest applicable loop
```

A high-risk boundary is a costly-to-reverse architecture or service boundary, public-contract compatibility, authentication or authorization boundary, persistent data/schema migration, or irreversible external side effect. Record this classification before grilling so its handoff can resume `spec-gate`.

## Process Outcomes

### Grilling handoff

Read `Risk classification` and `Resume target`. A non-formal task returns to direct or another narrow process. A high-risk/formal task with `resume_target: spec-gate` enters a fresh Spec Gate call.

### Spec Gate ready

`READY_FOR_USER_REVIEW` means the local artifact passed self-review but is not approved. Present the
path and wait for explicit approval. An approved Spec routes to `to-tickets` for multi-session/tracker
delivery or `writing-plans` for a single-session delivery plan.

### Cross-session handoff

When a prototype detour needs isolation or the current context is leaving its reliable reasoning zone,
recommend `/handoff` and wait for explicit approval before creating the temporary document. The handoff
ends the current flow; a fresh session references the returned path and enters this router again. Do not
use handoff as a substitute for durable Specs, ADRs, tickets, or verification evidence.

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
- continue implementation without an approved required Spec;
- claim completion without fresh verification evidence.

## Completion

Before saying work is complete, fixed, passing, or ready, apply `skills/verification-before-completion/SKILL.md` and report fresh evidence, skipped checks, and remaining risk.
