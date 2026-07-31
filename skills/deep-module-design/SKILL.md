---
name: deep-module-design
description: 用统一词汇设计小 Interface、高 Leverage、强 Locality 且可通过真实 Seam 测试的 deep Module。
---

# Deep Module Design

设计 **deep Module**：调用者学习很小的 **Interface**，却获得大量行为；维护知识和验证集中在
实现内部。使用以下术语，不用含混的 component/service/API/boundary 替换。

## When to Use

用户要设计/改善 Module Interface、选择 Seam、提升 testability 或比较模块形状时使用。

## How It Works

### Vocabulary

- **Module**：拥有 Interface 与 implementation 的任意尺度单元。
- **Interface**：正确使用 Module 必须知道的全部，包括 invariants、错误与性能约束。
- **Depth**：每单位 Interface 提供的行为与隐藏复杂度；不是代码行比率。
- **Seam**：无需在调用点编辑即可替换行为的位置。
- **Adapter**：在 Seam 上满足 Interface 的具体角色实现。
- **Leverage**：一份深层实现为多个调用者与测试提供的能力。
- **Locality**：变化、缺陷、知识和验证集中而非散落。

## Tests for a Good Shape

1. **Deletion test**：删除 Module 后，复杂度是否重新散回多个调用者？若直接消失，它可能只是
   pass-through。
2. **Interface is the test surface**：调用者与测试应穿过同一 Seam；需要绕过 Interface
   通常意味着形状不对。
3. **Two Adapter rule**：一个 Adapter 只是 hypothetical Seam；真实第二个 Adapter 才证明抽象。
4. 接受 dependencies，不在深处偷偷构造；返回 results，把 side effects 留在明确边缘。
5. 尽量减少方法、参数、调用顺序和必须共享的知识。

## Design Workflow

1. 用领域语言定义 Module 的责任和不变量。
2. 列出现有调用者必须知道的事实，找出泄漏的 implementation knowledge。
3. 给出至少两个 materially different Interface 方案；比较 Depth、Leverage、Locality、
   Seam placement 与迁移成本。
4. 选择最小 Interface，明确错误、配置、性能和事务语义。
5. 列出现有与预期 Adapters；若只有一个，不为未来假设创建 Seam。
6. 通过 Interface 设计 acceptance tests；内部测试只覆盖真正 private seam。
7. 迁移采用 expand → migrate → contract，并提供回滚点。

该 skill 提供设计词汇与判断标准，不自行触发重构。

## Example

“为支付授权设计可测 Interface”比较直接 gateway、port/adapter 与 transaction module 三种形状。

## Exit

只有 hypothetical adapter 的 speculative seam 返回 `NOT_APPLICABLE`。其他情况返回
`DESIGN_OPTIONS`、`DESIGN_SELECTED` 或 `BLOCKED_BY_DOMAIN_DECISION`，附 Interface 与验收 seam。
