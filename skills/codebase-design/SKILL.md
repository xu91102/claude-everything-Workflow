---
name: codebase-design
description: "Design or improve deep modules, interfaces, seams, adapters, leverage, locality, and testability. Use when a module interface is too broad, callers carry duplicated complexity, tests reach through internals, or architecture work needs the Matt Pocock deep-module vocabulary."
---

# Codebase Design

Origin: `mattpocock/skills@2ab9580`, adapted to this repository's routing and safety gates.

Design deep modules: substantial behavior behind a small interface, placed at a clean seam and tested
through that interface.

## Vocabulary

Use these terms consistently:

- **Module**: anything with an interface and implementation, at any scale.
- **Interface**: everything callers must know: signature, invariants, ordering, errors, configuration
  and relevant performance behavior.
- **Implementation**: behavior hidden inside the module.
- **Depth**: leverage provided per unit of interface a caller must learn.
- **Seam**: a place where behavior can change without editing the caller.
- **Adapter**: a concrete implementation that fills a role at a seam.
- **Leverage**: capability reused across callers and tests.
- **Locality**: change, knowledge and verification concentrated behind one interface.

Avoid substituting vague terms such as “component”, “service”, “API” or “boundary” when the design
question is specifically about a module, interface or seam.

## Design Checks

1. Define the caller-visible behavior and constraints.
2. Locate the current seam and list what leaks across it.
3. Apply the deletion test: if the module vanished, would complexity disappear or spread into callers?
4. Reduce methods, parameters, ordering knowledge and configuration callers must carry.
5. Hide policy and orchestration behind the interface while preserving observable behavior.
6. Treat the interface as the test surface; tests and callers should cross the same seam.
7. Introduce an adapter only when something actually varies. One adapter is hypothetical; two make a
   seam real.
8. Compare at least two materially different interfaces when the decision is consequential.

## Dependency Strategy

Read `references/deepening.md` when merging shallow modules or changing dependencies. Read
`references/design-it-twice.md` when alternative interfaces need independent exploration.

## Output

```text
Module:
Current interface and seam:
Leaked complexity:
Proposed interface:
Hidden implementation:
Adapters:
Depth / leverage / locality:
Test surface:
Compatibility and migration:
Open consequential decisions:
```

Return unresolved user decisions to `skills/using-superpowers/SKILL.md`. Do not implement or persist
an architectural decision unless the active workflow authorizes it.
