---
name: using-superpowers
description: Route engineering delivery and explicitly requested engineering workflows; resume their process outcomes.
---

# Using Superpowers

仅用于工程交付（实现、调试、测试、审查）及显式工程工作流；普通问答、翻译、总结和资料检索直接处理。
优先级：用户指令 / `AGENTS.md` / `CLAUDE.md` / 项目 Rules > Skills / Commands / Agents / Hooks > 默认行为。

## 选路原则

- 选最短适用路径，只读当前阶段需要的 Skill，不预加载整条链路；简短说明选择后即执行。
- 显式请求某一专职能力（如 `grilling`、`feature-acceptance`、`handoff`、`triage`、`prototype`、`improve-codebase-architecture`、`resolving-merge-conflicts`、`test-driven-development`、`code-review`）时，宿主按各 Skill 的 `description` 直接匹配，不再逐条在路由表重复列出。
- 复杂度本身不触发额外门禁；`handoff`、`triage`、`improve-codebase-architecture` 仅在用户明确请求时使用。

## 三条交付通道

1. **direct**：需求明确、低风险 → `read-reference skills/implement/SKILL.md`（有测试路径的行为变化结合 `test-driven-development`）。
2. **needs-decision**：存在会实质改变结果且工具查不到的用户决策 → `skills/grilling/SKILL.md`（高风险或显式 Spec 场景记录 `resume_target: spec-gate`）。
3. **formal-spec**：用户要求 formal Spec（含旧称 `brainstorming`，引导至 `/to-spec`）或命中高风险边界（难逆架构/服务边界、公共契约兼容、认证授权、持久化 schema 迁移、不可逆外部副作用）→ `skills/spec-gate/SKILL.md`。

## 核心路由

```text
工程任务到达
  -> 询问工作流建议？                 -> 只返回推荐路径、前置条件和闭环，不写文件
  -> 故障 / 偶发失败 / 性能回退？      -> skills/systematic-debugging/SKILL.md（预期 TDD RED 留在实现循环）
  -> 未决关键用户决策？               -> skills/grilling/SKILL.md
  -> 显式 formal Spec 或高风险边界？  -> skills/spec-gate/SKILL.md
  -> 明确范围的交付请求？             -> 选择交付拓扑（一行说明理由）：
       需要跨会话 / tracker 依赖图    -> skills/to-tickets/SKILL.md
       其余（含已批准多票安全并行）   -> read-reference skills/implement/SKILL.md
  -> 声明完成 / 修复 / ready？        -> rules/common/testing.md
```

## 交付拓扑与收尾

- 单次会话可完成的范围用 `implement`；仅当存在 ≥2 张已批准、无 blocker、写入面不重叠的 frontier tickets 时，按 `skills/implement/references/parallel-delivery.md` 并行分派。
- 处理 `grilling` / `spec-gate` 返回结果或跨会话交接时，按需读取 [references/process-outcomes.md](references/process-outcomes.md)。
- 交付授权不扩大产品范围，也不覆盖 commit、push、PR 或外部写入；声明完成前按 `rules/common/testing.md` 报告本轮新鲜验证证据、未运行项和剩余风险。
