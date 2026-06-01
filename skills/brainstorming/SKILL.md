---
name: brainstorming
description: "Use for explicit Brainstorming/design-spec/Spec-Gate requests, or before complex, ambiguous, high-risk, cross-file, architectural, integration, UI/UX, public API, data-flow, or behavior-changing development work. Skip for clearly specified low-risk edits such as button color tweaks, typo fixes, mechanical replacements, straightforward docs/config updates, or obvious single-file changes."
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by deciding whether the request needs the full brainstorming flow. If it does, understand the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Trigger Policy

Use the full brainstorming flow when any of these apply:

- The user explicitly mentions Brainstorming, design spec, spec, Spec Gate, or asks to design before implementation
- The work touches >1 repository top-level directory or involves multiple independent subsystems
- The work modifies public APIs, shared CLI/agent contracts, or cross-module interfaces
- The work impacts data persistence, schema, authentication/authorization, security, integrations, or release/migration behavior
- The work changes UI/UX workflows, product behavior, verification strategy, or automation boundaries
- The work spans files/modules where responsibilities, boundaries, or test strategy are not obvious
- A wrong assumption could cause meaningful rework, regressions, or user-visible churn

Use a minimal design summary flow only if all of these are true:

- single-file change
- no API, data, UX, architecture, security, or integration impact
- user provided exact diff, replacement text, or a fully specified implementation request
- no tests, CI, release process, or migration work is required

If the request looks simple but hides uncertainty, ask one targeted clarification before deciding. If the uncertainty affects architecture, data, integration, test scope, or release behavior, trigger brainstorming.

If the user explicitly asks for code or implementation immediately, respond that you will first produce the design per the HARD-GATE and offer an expedited mini-design limited to 4 bullets if the user accepts.

If repository files, docs, commits, or git history are inaccessible, respond:
"I cannot access the repository. Provide a zip of relevant files or a short description of project structure. Proceed with limited context? (yes/no)"

## Repository Spec Profile

For this repository, specs should default to infrastructure and workflow design documents, not product narrative specs.

Bias every spec toward:

- Repository workflow behavior and Superpowers gate interactions
- Skill, command, hook, rule, agent, CLI, prompt, and artifact contracts
- Failure modes, migration, rollback, verification commands, fixtures, dry-runs, and failure-path tests

Avoid product-style narrative specs unless the user explicitly asks for product design. When the request sounds product-oriented, frame the spec around the workflow, adapter, automation, prompt, fixture, or infrastructure behavior this repository needs to support.

## Checklist

When this skill applies, you MUST create a task for each of these items and complete them in order:

1. **Explore project context** — check files, docs, recent commits
2. **Offer visual companion** (if task explicitly involves mockups, layouts, wireframes, screenshots, diagrams, or side-by-side visual comparisons) — this is its own message, not combined with a clarifying question. See the Visual Companion section below.
3. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
4. **Propose 2-3 approaches** — with trade-offs and your recommendation
5. **Present design** — in sections scaled to their complexity, get user approval after each section
6. **Write design doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` using the required template below
7. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
8. **User reviews written spec** — ask user to review the spec file before proceeding
9. **Transition to implementation** — invoke writing-plans skill to create implementation plan

- If approval is partial, record per-section approval state and iterate only on sections marked 'revise'; do not proceed to write the spec file until all sections are approved or the user explicitly asks to finalize with known exceptions.
- If writing-plans is unavailable, produce an equivalent JSON task list following the writing-plans schema and ask the user how they would like it delivered.

### Priority

1. HARD-GATE: no implementation until design approval.
2. Checklist order: follow the steps in sequence.
3. Visual Companion offer: send as a standalone message.
4. If a rule conflicts with a higher-priority item, state the deviation and ask the user before proceeding.

## Process Flow

```dot
digraph brainstorming {
    "Explore project context" [shape=box];
    "Visual questions ahead?" [shape=diamond];
    "Offer Visual Companion\n(own message, no other content)" [shape=box];
    "Ask clarifying questions" [shape=box];
    "Propose 2-3 approaches" [shape=box];
    "Present design sections" [shape=box];
    "User approves design?" [shape=diamond];
    "Write design doc" [shape=box];
    "Spec self-review\n(fix inline)" [shape=box];
    "User reviews spec?" [shape=diamond];
    "Invoke writing-plans skill" [shape=doublecircle];

    "Explore project context" -> "Visual questions ahead?";
    "Visual questions ahead?" -> "Offer Visual Companion\n(own message, no other content)" [label="yes"];
    "Visual questions ahead?" -> "Ask clarifying questions" [label="no"];
    "Offer Visual Companion\n(own message, no other content)" -> "Ask clarifying questions";
    "Ask clarifying questions" -> "Propose 2-3 approaches";
    "Propose 2-3 approaches" -> "Present design sections";
    "Present design sections" -> "User approves design?";
    "User approves design?" -> "Present design sections" [label="no, revise"];
    "User approves design?" -> "Write design doc" [label="yes"];
    "Write design doc" -> "Spec self-review\n(fix inline)";
    "Spec self-review\n(fix inline)" -> "User reviews spec?";
    "User reviews spec?" -> "Write design doc" [label="changes requested"];
    "User reviews spec?" -> "Invoke writing-plans skill" [label="approved"];
}
```

**The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is writing-plans.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits)
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.
- If the project is too large for a single spec, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then brainstorm the first sub-project through the normal design flow. If estimated scope exceeds 8 major components OR >20 affected files OR >2 weeks estimated effort, automatically propose decomposition into sub-projects with a recommended order and a brief spec for the first sub-project.
- For appropriately scoped projects, ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Scale each section to its complexity: for changes affecting <=3 files or <=200 LOC, target 2-5 sentences; for changes affecting >3 files or >200 LOC or involving architectural decisions, target 150-300 words per complex section
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

**Design for isolation and clarity:**

- Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently
- For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?
- Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.
- Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

**Working in existing codebases:**

- Explore the current structure before proposing changes. Follow existing patterns.
- Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.
- Don't propose unrelated refactoring. Stay focused on what serves the current goal.

## After the Design

**Documentation:**

- Write the validated design (spec) to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
  - (User preferences for spec location override this default)
- If writing the spec to the default path fails due to permission, branch protection, or conflict, notify the user and ask for an alternate path or permission to create a draft at `tmp/<filename>`.
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Do not commit silently or directly on protected branches; commit only when workflow/user intent allows it.

**Required Spec Template:**

Use these headings in order: `Background`, `Goals`, `Non-Goals`, `Requirements`, `Existing Context`, `Approaches Considered` with 2-3 options, `Recommended Approach`, `Architecture`, `Components and Files`, `Data Flow / Interfaces`, `Error Handling`, `Testing Strategy`, `Acceptance Criteria`, `Risks and Trade-offs`, `Open Questions`.

**Spec Quality Bar:**

- Write an engineering design document, not a loose product memo.
- Make it specific enough for `writing-plans`; do not include implementation checkboxes.
- Include concrete files/interfaces, alternatives, tests, and acceptance criteria.

**Spec Self-Review:**
After writing the spec document, look at it with fresh eyes:

1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
3. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

Fix any issues inline. No need to re-review — just fix and move on.

**User Review Gate:**
After the spec review loop passes, ask the user to review the written spec before proceeding:

> "Spec written to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

Wait for the user's response. If they request changes, make them and re-run the spec review loop. Only proceed once the user approves.

**Implementation:**

- Invoke the writing-plans skill to create a detailed implementation plan
- Do NOT invoke any other skill. writing-plans is the next step.

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options during brainstorming. Available as a tool — not a mode. Accepting the companion means it's available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

**Offering the companion:** When you anticipate that upcoming questions will involve visual content (mockups, layouts, diagrams), offer it once for consent:

> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)"

**This offer MUST be its own message.** Do not combine it with clarifying questions, context summaries, or any other content. The message should contain ONLY the offer above and nothing else. Wait for the user's response before continuing. If they decline, proceed with text-only brainstorming.

If the user does not respond within 48 hours or a configured timeout, proceed with text-only brainstorming and note that the Visual Companion was not accepted.

**Per-question decision:** Even after the user accepts, decide FOR EACH QUESTION whether to use the browser or the terminal. The test: **would the user understand this better by seeing it than reading it?**

- **Use the browser** for content that IS visual — mockups, wireframes, layout comparisons, architecture diagrams, side-by-side visual designs
- **Use the terminal** for content that is text — requirements questions, conceptual choices, tradeoff lists, A/B/C/D text options, scope decisions

A question about a UI topic is not automatically a visual question. "What does personality mean in this context?" is a conceptual question — use the terminal. "Which wizard layout works better?" is a visual question — use the browser.

If they agree to the companion, read the detailed guide before proceeding:
`skills/brainstorming/visual-companion.md`
