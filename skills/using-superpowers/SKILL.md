---
name: using-superpowers
description: "Route engineering work through direct, decision, or formal lanes. Use at task start, after a process outcome, or when continuation between Spec, tickets, implementation, debugging, review, and verification is unclear."
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
    -> /to-tickets -> ticket review -> approved tickets
    -> /implement on a frontier ticket
```

File count, a new-feature label, ordinary behavior change, and normal code complexity do not upgrade a task. They affect implementation and verification intensity only.

## Routing

Use process skills before implementation skills:

```text
Task arrives
  -> explicit /setup-workflow?                     -> project-context
  -> explicit /grill?                              -> grilling explicit
  -> explicit documented domain interview?         -> /documented-grill
  -> external Issue/PR triage request?              -> issue-triage
  -> huge effort whose path exceeds one session?   -> large-work-planning
  -> architecture health/deepening scan?           -> architecture-audit
  -> one runnable design question?                  -> rapid-prototyping
  -> primary-source research request?               -> evidence-research
  -> merge/rebase conflict already in progress?    -> merge-conflict-resolution
  -> domain term/invariant/lifecycle/context change? -> domain-modeling
  -> bug, failing test, or unexpected result?      -> systematic-debugging
  -> discoverable fact?                            -> inspect it; do not ask
  -> systematic evidence or blind-spot gap?        -> iterative-retrieval
  -> unresolved user-owned decision?               -> grilling inline
       high-risk or explicit formal Spec context?  -> resume_target: spec-gate
  -> explicit formal Spec or high-risk boundary?   -> spec-gate
  -> approved Spec, no tickets?                    -> hand off to explicit /to-tickets
  -> approved tickets + explicit /implement?       -> implement one frontier ticket
  -> approved ticket + SDD/commit approved?        -> subagent-driven-development
  -> behavior change with a test path?             -> test-driven-development
  -> module interface or seam design?               -> deep-module-design
  -> fixed-point diff review?                       -> /code-review
  -> dirty worktree or risky branch work?          -> consider using-git-worktrees
  -> completion, fixed, or ready claim?            -> verification-before-completion
  -> external skill learning or edit?              -> skills-learning policy + available runtime authoring skill
  -> otherwise                                     -> shortest applicable loop
```

A high-risk boundary is a costly-to-reverse architecture or service boundary, public-contract compatibility, authentication or authorization boundary, persistent data/schema migration, or irreversible external side effect. Record this classification before grilling so its handoff can resume `spec-gate`.

## Process Outcomes

### Grilling handoff

Read `Risk classification` and `Resume target`. A non-formal task returns to direct or another narrow process. A high-risk/formal task with `resume_target: spec-gate` enters a fresh Spec Gate call.

### Spec Gate ready

`READY_FOR_USER_REVIEW` means the local artifact passed self-review but is not approved. Present the path and wait for explicit approval. After approval, hand off to explicit `/to-tickets`; a user-invoked Skill cannot be called implicitly.

### Ticket review

`READY_FOR_TICKET_REVIEW` means the ticket graph is drafted but not approved. Present titles, outcomes, and blocking edges; do not publish tickets or implement.

`TICKETS_PUBLISHED` returns ticket refs and the current **frontier**. Only a user-selected frontier ticket may enter explicit `/implement`. Each ticket starts from fresh context.

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
- continue formal work without approved tickets, or implement a ticket outside the frontier;
- claim completion without fresh verification evidence.

## Completion

Before saying work is complete, fixed, passing, or ready, apply `skills/verification-before-completion/SKILL.md` and report fresh evidence, skipped checks, and remaining risk.
