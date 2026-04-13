---
name: brainstorming
description: "Use before substantial creative work, feature design, architecture changes, ambiguous behavior changes, or high-risk implementation. Do not use for simple execution tasks such as translation, formatting, small documentation edits, running commands, straightforward file reads, or mechanical replacements."
---

# Brainstorming Ideas Into Designs

Use this skill to turn unclear or high-impact ideas into a concrete design before implementation. Optimize for useful alignment with minimal token cost.

## Triage First

Classify the request before starting any process:

- **No brainstorming needed**: translation, summarization, formatting, simple documentation edits, command output requests, file reads, direct explanations, mechanical replacements, typo fixes, or narrowly specified changes with low risk. Execute directly.
- **Lightweight design**: small behavior changes, focused config edits, single-file changes, or low-risk improvements where the user's intent is clear. Give a 1-3 sentence implementation approach, then proceed unless there is a real risk that needs confirmation.
- **Full brainstorming**: new features, UI/UX design, architecture changes, multi-file behavior changes, unclear requirements, irreversible work, security-sensitive flows, data migrations, public API changes, or work with non-obvious tradeoffs. Use the full process below.

If the user has already approved a concrete approach in the conversation, treat that as approval and do not repeat the same questions.

## Lightweight Design

For small, clear work:

1. State the intended change in 1-3 sentences.
2. Ask at most one targeted question only if a reasonable assumption would be risky.
3. Proceed with the implementation after the user confirms, or immediately if the request already contains enough detail.
4. Do not write a design doc or invoke a planning workflow unless the user asks for it.

## Full Process

Use this only for work classified as full brainstorming:

1. Explore the current project context just enough to understand the relevant structure.
2. Ask one clarifying question at a time when requirements are ambiguous.
3. Propose 2-3 approaches with tradeoffs and a recommendation.
4. Present a concise design covering the parts that matter: architecture, components, data flow, error handling, and testing.
5. Get user approval before implementation.
6. Write a design doc only when the user asks for one, the change is large enough to need handoff, or the repository convention requires it.

## Principles

- Keep context small; read only the files needed for the decision.
- Prefer clear assumptions over broad discovery when the risk is low.
- Do not block simple tasks behind process.
- Escalate deliberately when decisions have hidden risk or non-obvious consequences.
- Use visual companion tools only when visual comparison would materially improve the decision.
