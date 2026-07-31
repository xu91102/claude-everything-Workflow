---
name: visual-companion
description: "Use for mockups, diagrams, spatial relationships, or side-by-side visual options when seeing them materially improves understanding. Require consent before starting the secured local browser; combine with grilling for consequential decisions."
---

# Visual Companion

Use the browser as a visual aid, not as a workflow mode or a second requirements engine.

## Boundary

Use this Skill for UI mockups, architecture diagrams, visual hierarchy, spatial relationships, and side-by-side visual comparisons. Keep requirements, scope, technical trade-offs, text options, and discoverable facts in the terminal.

A task being visual, complex, or design-related is not sufficient. Use the companion only when seeing the content materially improves understanding over concise text.

## Consent Gate

Obtain explicit user consent before starting the local server or opening a browser URL. The consent request must state what will be shown and that a local authenticated URL will open.

Without user consent, continue with text or static in-conversation visuals. Do not treat prior use in another task as current consent.

## Ownership

- `grilling owns the decision loop` when browser feedback selects a consequential user-owned option.
- Spec Gate may show an already resolved design, support artifact review, or render a diagram with no new decision.
- Visual Companion does not own continuation, routing, requirements interviews, or approval gates.
- Return browser events and terminal feedback to the currently routed Skill.

## Workflow

1. Decide whether the next item is materially clearer when seen.
2. Obtain user consent if the server is not already approved for this task.
3. Read `references/guide.md` completely before starting or operating the companion.
4. Start the server with `scripts/start-server.sh`, preserving the returned complete URL and state paths.
5. Write one fresh visual screen, describe it briefly in the terminal, and wait for user feedback.
6. Merge terminal feedback with authenticated browser events.
7. Return the result to grilling, Spec Gate, or the current caller.
8. Stop or leave a waiting screen when visual work ends.

## Safety Invariants

- Always share the complete URL including `?key=`; never expose a bare host and port.
- Keep session key, HTTP/WebSocket authorization, restrictive response headers, owner-only state files, and same-origin checks enabled.
- Preserve the default four-hour idle timeout and same-port restart behavior.
- Do not bind a non-loopback host unless the user needs remote access and understands the exposure.
- Treat `.superpowers/brainstorm/` as local runtime state; do not stage or commit it.
- Fall back to the terminal when the server or browser is unavailable.

## Outputs

Return only:

```text
Visual result:
- screen shown
- terminal feedback
- relevant browser events
- confirmed visual choice, if any
- unresolved decision owner
```

Do not infer approval from a click without reconciling it with the user's terminal response.
