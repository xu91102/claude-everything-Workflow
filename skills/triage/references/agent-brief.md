# Durable Agent Brief

An agent brief is the implementation contract attached when an item becomes `ready-for-agent`.

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** one-line outcome

**Current behavior:**
<observable status quo or broken behavior>

**Desired behavior:**
<observable result, edge cases and failure behavior>

**Key interfaces:**
- <stable type, contract or config shape; avoid file paths and line numbers>

**Acceptance criteria:**
- [ ] independently verifiable behavior

**Out of scope:**
- explicit adjacent work not included
```

Briefs must be durable, behavioral and complete:

- describe interfaces and contracts, not edit procedures;
- avoid paths and line numbers that may become stale;
- include normal, error and compatibility behavior;
- ensure every criterion can be checked independently.
