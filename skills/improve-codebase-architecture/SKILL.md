---
name: improve-codebase-architecture
description: "Scan a codebase for deepening opportunities, present a visual architecture report, and grill through a selected candidate. Use for explicit architecture-health, deep-module, seam, testability, or AI-navigability audits; default to read-only analysis."
disable-model-invocation: true
---

# Improve Codebase Architecture

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's visual consent and routing gates.

## 1. Scope and Explore

Read `skills/codebase-design/SKILL.md`, relevant `CONTEXT.md`/`CONTEXT-MAP.md`, ADRs and project rules.

- Use the user-named subsystem when supplied.
- Otherwise inspect recent history for repeatedly changed areas before widening the scan.
- Look for shallow modules, duplicated caller policy, message chains, pass-through layers, leaked
  ordering/error rules, and code that cannot be tested through a stable interface.
- Apply the deletion test and classify dependency types before recommending a new seam.
- Keep speculative candidates separate from evidence-backed friction.

## 2. Report

For each candidate include:

- files/modules and evidence;
- current interface and leaked complexity;
- proposed deepening direction, without committing to a final interface;
- expected leverage, locality and test-surface improvement;
- compatibility risk and recommendation strength: `Strong`, `Worth exploring` or `Speculative`;
- a before/after relationship diagram.

Prefer a compact Markdown report when visuals add little. When a visual report materially improves
understanding, use `skills/visual-companion/SKILL.md` and obtain its explicit consent before starting
the server or opening a URL. Never open a browser silently.

End with one top recommendation. Do not implement it.

## 3. Decision Loop

After the user chooses a candidate:

1. Use `skills/grilling/SKILL.md` for consequential choices.
2. Use `skills/domain-modeling/SKILL.md` when domain language or an ADR-worthy decision changes.
3. Use `skills/codebase-design/references/design-it-twice.md` when interface alternatives remain.
4. Return the resolved candidate to the central router for Spec/planning classification.

Do not turn an architecture audit into an unapproved refactor.
