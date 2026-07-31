---
name: prototype
description: "Build throwaway runnable code to answer one design question. Use when a user needs to feel a state model or business-logic flow in a terminal, compare materially different UI shapes, or says they will know the answer when they can interact with it."
---

# Prototype

Origin: `mattpocock/skills@2ab9580`, adapted to reuse this repository's secured visual companion.

A prototype answers one question. It is not a production shortcut.

## Select the Branch

- Logic, state transition, data shape or API feel → read `references/logic.md`.
- Visual hierarchy, layout or interaction shape → read `references/ui.md` and
  `skills/visual-companion/SKILL.md`.

If the branch is ambiguous and the user is unavailable, use surrounding code as evidence: backend
or state code defaults to logic; page/component work defaults to UI. State the assumption.

## Shared Contract

1. Write the exact question at the top of the prototype.
2. Place throwaway code near the relevant module or route and name it visibly as a prototype.
3. Reuse the project's runtime and task runner; provide one command to run.
4. Keep state in memory unless persistence itself is the question.
5. Skip production polish, broad error handling, abstractions and tests.
6. Surface full relevant state after every action or variant change.
7. Never connect UI variants to real mutations.
8. Capture the answer: decision, evidence and remaining uncertainty.
9. Promote only the validated decision. Rewrite production code under normal TDD and review gates.

Prototype creation is an authorized implementation step only when the user requested it. Commit,
branch, browser and external-system actions keep their own approval requirements.

## Exit

Return:

```text
Prototype question:
Branch and run command/URL:
Observed answer:
Validated decision:
Discarded assumptions:
Prototype cleanup/capture status:
Next router input:
```

Then return to `skills/using-superpowers/SKILL.md`. Do not silently continue into production code.
