# Design It Twice

Use when one interface choice will materially affect callers, testability or long-term locality.

1. Frame constraints, dependencies, current coupling and the behavior that must stay stable.
2. Generate at least three materially different interface designs:
   - minimum surface and maximum leverage;
   - maximum flexibility;
   - simplest common caller;
   - ports-and-adapters shape when a remote dependency exists.
3. For each design include interface, usage, hidden implementation, adapter strategy and trade-offs.
4. Compare depth, locality, seam placement, compatibility and test surface.
5. Recommend one design or a justified hybrid.

Independent subagents may generate alternatives when the active runtime and user authorization allow
delegation. Give each only the same constraints and a different design objective; do not leak a
preferred answer.
