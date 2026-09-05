# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

入口只维护选择与通用约束：`using-superpowers` 的过程返回处理在 `references/process-outcomes.md`，
`implement` 的 ticket 状态机在 `references/ticket-delivery.md`。只在对应模式读取；普通直接交付不加载这两份引用。

## Process / 门禁

- `using-superpowers`：非平凡任务的 skill 路由、优先级和完成声明纪律。
- `grilling`：对计划、设计或重大用户决策进行单问式压力测试。
- `spec-gate`：显式 formal spec 或高风险任务的零访谈成稿、自审和用户批准门。
- `using-git-worktrees`：脏工作区、高风险或并行任务的隔离工作区准备。
- `to-tickets`：把已批准工作拆成 tracer-bullet tickets 和 blocking graph。
- `implement`：执行用户授权的低风险 direct scope、已批准 Spec scope 或 frontier ticket；仅 ticket 路径 claim、resolve 并刷新 frontier。
- `subagent-driven-development`：router 对已授权范围发现多个相互独立的 frontier tickets 时，分派到隔离 worktree 的 fresh subagent。
- `wayfinder`：为跨 session 的模糊工作维护 decision-ticket map/frontier。
- `triage`：对 Issue/外部 PR 分类、验证并形成 agent-ready brief。
- `handoff`：将当前上下文脱敏压缩到临时 Markdown，供全新 session 接续。
- `verification-before-completion`：完成、通过、已修复或 ready 声明前的新鲜验证门。

## 旁路设计能力

- `project-context`：显式配置项目工作追踪、领域文档和 ADR 的长期位置。
- `domain-modeling`：领域术语、实体关系、不变量、生命周期和 bounded context 变化建模。
- `codebase-design`：deep module、interface、seam、adapter、leverage 和 locality 设计词汇。
- `improve-codebase-architecture`：扫描 deepening 机会、展示报告并收敛选中候选。
- `prototype`：用 logic TUI 或视觉 UI 原型回答一个可运行的设计问题。
- `visual-companion`：经用户同意后，在安全本地浏览器中展示视觉方案和图示。

## Engineering / 开发实践

- `code-review`：用两个隔离 subagent 并行执行 Standards 与 Spec 双轴审查。
- `test-driven-development`：行为变化的 Red Test Gate。
- `systematic-debugging`：失败、异常结果和 flaky 行为的根因调试。
- `resolving-merge-conflicts`：按双方原始意图逐 hunk 解决 merge/rebase 冲突。
- `e2e-testing`：Playwright E2E 模式、CI、制品和 flaky 处理。
- `feature-acceptance`：以真实证据、用例矩阵和二次审核完成用户功能验收。

## Harness / 上下文与编排

- `iterative-retrieval`：事实、证据、盲点、subagent 和大仓库探索的迭代检索闭环。
- `research`：后台一手来源调查与逐项引用的 Markdown 研究记录。
- `continuous-learning-v2`：Hook 观察、project/global instinct、学习评估和演化。

## Meta / Skill 管理

- `find-skills`：查找本地已有或开放生态中可安装的 agent skill。

## Learn / 学习沉淀

学习目录 `learn/` 经 `/learn eval` 质量门确认学习模式，必须继续按 `skills/learn/<category>/` 分类保存。
