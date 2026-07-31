---
name: domain-modeling
description: "Model domain vocabulary, entity relationships, invariants, lifecycle transitions, and bounded context changes. Use only when a task introduces or changes domain concepts or ownership boundaries; do not trigger for ordinary code complexity, file count, or merely consuming existing CONTEXT.md vocabulary."
---

# Domain Modeling

Make domain changes explicit without becoming a workflow gate or a second clarification engine.

## Boundary

Trigger only when the task introduces or changes at least one of:

- domain terms and their precise meanings;
- entities, value objects, or their relationships;
- invariants and ownership rules;
- lifecycle states or transitions;
- a bounded context or the contract between contexts.

Do not trigger for ordinary code complexity, a new module that reuses the existing model, or read-only use of established `CONTEXT.md` vocabulary.

## Inputs

Consume verified repository facts, an optional confirmed grilling handoff, the current approved or
draft Spec, and `docs/agent-workflow/project-context.md` when it exists. Do not ask the user for
discoverable facts and do not own consequential user decisions.

## Workflow

1. Extract existing terms, entities, invariants, states, owners, and context boundaries from code and documents.
2. Identify what the task adds, removes, renames, or transfers.
3. State ambiguous terms and contract conflicts without silently resolving user-owned choices.
4. Produce the smallest model needed for the task: glossary, relationship list, invariants, lifecycle, boundary map, and ADR recommendation when relevant.
5. Return the model to the currently routed Skill; do not select or invoke the next workflow Skill.

## Output

Use only the applicable parts:

```text
Domain vocabulary:
- Term: definition

Entities and relationships:
- Entity/value object: ownership and relationship

Invariants:
- invariant and enforcement boundary

Lifecycle:
- state -> event -> next state

Bounded contexts:
- context: responsibility and external contract

ADR recommendations:
- decision that merits a durable record

Unresolved consequential decisions:
- stable decision subject and evidence
```

If an unresolved item changes product meaning, ownership, a public contract, persistence, or a high-cost boundary, return it to the current router/Spec Gate contract. Do not interview or choose for the user.

## Persistence Gate

Before an approved Spec exists, keep the output in the active handoff or Spec only. Do not modify tracked `CONTEXT.md`, ADRs, schemas, or code.

After the user approves the Spec, persistence becomes an explicit implementation-plan task with its
own verification. When `docs/agent-workflow/project-context.md` exists, use its confirmed context
and ADR locations; otherwise do not invent a project-wide documentation layout. This preserves the
distinction between modeling a decision and implementing it.

## Documentation Mode

只有用户显式调用 `documented-grill` 时启用 **Documentation Mode**。它把 grilling 已确认的
决定实时整理为待持久化 patch：

1. 从 `docs/agent-workflow/project-context.md` 解析 `CONTEXT.md` / `CONTEXT-MAP.md` 与 ADR
   位置；没有配置时只返回建议内容，不发明布局。
2. 每个已确认答案更新 glossary、invariant、lifecycle 或 bounded context 草稿；只记录已确认
   内容，不把仍在讨论的选项写成事实。
3. 共同理解 gate 通过后，展示目标文件和 diff 摘要；显式命令的写文档授权覆盖上面的
   “approved Spec 后持久化”默认门，但不授权 schema/code/外部 tracker 改动。
4. 追加或精确修改既有 `CONTEXT.md`；hard-to-reverse decision 创建 ADR，保留既有格式和编号。
5. 返回文档路径、写入的决定、未写入风险和 grilling handoff。

## Examples

- Adding a subscription entity with trial, active, suspended, and cancelled lifecycle states triggers this Skill.
- Renaming an internal helper while consuming unchanged billing vocabulary does not trigger it.
- Moving authorization ownership between bounded contexts triggers it and may surface a high-risk decision for Spec Gate.

## Exit

内部 helper 变更且领域语言、invariant、lifecycle 与 context 均不变时返回 `NOT_APPLICABLE`。
遇到未解决产品语义时返回当前 router，不替用户决定。
