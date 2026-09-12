# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

入口只维护选择与通用约束：`using-superpowers` 的过程返回处理在 `references/process-outcomes.md`，`implement` 的 ticket 状态机在 `references/ticket-delivery.md`。只在对应模式读取；普通直接交付不加载这两份引用。

调用策略登记在 `harness/manifest.json`，由 `npm run verify` 按宿主校验。`implicit` 允许模型在命中描述与正文条件时调用，不等于授权外部写入；本项目需要明确请求的入口接受自然语言，不要求用户再输入 `/name` 或 `$name`；路由不能把任务复杂度当作用户请求。Skill 正文仍按命中后加载，不能把分类索引当作全量加载清单。

实施、审查、领域设计、E2E、原型、视觉辅助和 `/learn` 依赖的能力允许工作流按条件调用，仍遵守各自的用户请求、同意和写入边界。`handoff`、`improve-codebase-architecture`、`triage` 仅在用户明确请求相应任务时使用；宿主允许模型识别自然语言请求，正文仍限制任务范围。

## Process / 门禁

- `using-superpowers`：工程交付及明确请求的工程工作流的 skill 路由、优先级和完成声明纪律。
- `grilling`：对计划、设计或重大用户决策进行单问式压力测试。
- `spec-gate`：显式 formal spec 或高风险任务的零访谈成稿、自审和用户批准门。
- `to-tickets`：把已批准工作拆成 tracer-bullet tickets 和 blocking graph。
- `implement`：执行用户授权的低风险 direct scope、已批准 Spec scope 或 frontier ticket；仅 ticket 路径 claim、resolve 并刷新 frontier。
- `subagent-driven-development`：router 对已授权范围发现多个相互独立的 frontier tickets 时，分派到隔离 worktree 的 fresh subagent。
- `triage`：对 Issue/外部 PR 分类、验证并形成 agent-ready brief。
- `handoff`：将当前上下文脱敏压缩到临时 Markdown，供全新 session 接续。

## 旁路设计能力

- `domain-modeling`：领域术语、实体关系、不变量、生命周期和 bounded context 变化建模。
- `codebase-design`：deep module、interface、seam、adapter、leverage 和 locality 设计词汇。
- `improve-codebase-architecture`：扫描 deepening 机会、展示报告并收敛选中候选。
- `prototype`：用 logic TUI 或视觉 UI 原型回答一个可运行的设计问题。
- `visual-companion`：经用户同意后，在安全本地浏览器中展示视觉方案和图示。

## Engineering / 开发实践

- `code-review`：简单、明确、低风险且可验证的任务可自审；复杂或证据不足时使用一个独立子智能体，高风险使用 Standards/Spec 双轴；必要的独立审查不可用时阻塞。
- `test-driven-development`：行为变化的 Red Test Gate。
- `systematic-debugging`：区分普通明确失败与疑难故障；预期 TDD RED 留在实现循环。
- `resolving-merge-conflicts`：按双方原始意图逐 hunk 解决 merge/rebase 冲突。
- `e2e-testing`：Playwright E2E 模式、CI、制品和 flaky 处理。
- `feature-acceptance`：用户明确要求真实流程验收、截图或日志证据时，输出用例矩阵与复核结论。

## Harness / 上下文与编排

- `continuous-learning-v2`：学习系统的观察 Hook、project/global instinct、学习评估和演化。

## Learn / 学习沉淀

学习目录 `learn/` 经 `/learn eval` 质量门确认学习模式，必须继续按 `skills/learn/<category>/` 分类保存。
