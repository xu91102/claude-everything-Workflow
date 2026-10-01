# Detailed Spec Reference

Read for complex or high-risk designs. This is a section menu, not a requirement to generate every
heading. Keep material decisions and evidence together; combine or omit sections that do not affect
implementation or review. The main Skill owns applicability, unresolved decisions, approval and outcomes.

Useful sections:

- `背景`、`目标`、`非目标`：problem, intended result and scope boundaries.
- `需求`：observable behavior, constraints, compatibility and useful User Stories.
- `现有上下文`：verified code facts, domain terms, ADRs, patterns and test precedents.
- `方案对比`、`推荐方案`：real alternatives, trade-offs and the resolved choice.
- `Implementation Decisions`：modules, interfaces, public contracts, schemas and migration decisions.
- `架构设计`、`组件与文件`、`数据流 / 接口`：boundaries and interactions that affect the implementation.
- `错误处理`：normal and adversarial behavior, retries, partial failure and recovery where relevant.
- `测试策略`、`验收标准`：highest available test seams and repeatable automated or manual checks.
- `风险与取舍`、`回滚`：impact, compatibility, migration, rollout and recovery.
- `开放问题`：only non-blocking questions; omit when none remain.

For public contracts, retain compatibility and consumer impact. For authentication or authorization,
retain trust boundaries, permissions and denial behavior. For persistent data or schemas, retain
migration ordering, partial failure, backup/recovery and rollback limits. A shorter document must still
make these consequential decisions explicit; user-owned decisions must already be resolved or delegated.
