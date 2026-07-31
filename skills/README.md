# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

## Process / 门禁

- `using-superpowers`：非平凡任务的 skill 路由、优先级和完成声明纪律。
- `grilling`：对计划、设计或重大用户决策进行单问式压力测试。
- `spec-gate`：显式 formal spec 或高风险任务的零访谈成稿、自审和用户批准门。
- `to-tickets`：用户显式把已批准 Spec 拆成 tracer-bullet tickets 与 blocking graph；invocation: user-invoked。
- `implement`：用户显式执行 frontier 上的一张获批 ticket，驱动 TDD、审查和验证；invocation: user-invoked。
- `writing-plans`：旧计划入口，保留 legacy plan 并可迁移到 `to-tickets`。
- `executing-plans`：旧执行入口，保留 checkpoint execution 并可迁移到 `implement`。
- `issue-triage`：外部 Issue/PR 的分类、核验与状态机；invocation: user-invoked。
- `large-work-planning`：巨大模糊工作的 decision-ticket 地图；invocation: user-invoked。
- `subagent-driven-development`：用户批准 commit/PR/SDD handling 后的任务拆分、审查和进度账本。
- `using-git-worktrees`：脏工作区、高风险或并行任务的隔离工作区准备。
- `verification-before-completion`：完成、通过、已修复或 ready 声明前的新鲜验证门。

## 旁路设计能力

- `project-context`：显式配置项目工作追踪、领域文档和 ADR 的长期位置；invocation: user-invoked。
- `domain-modeling`：领域术语、实体关系、不变量、生命周期和 bounded context 变化建模。
- `deep-module-design`：以 Depth、Seam、Leverage 和 Locality 设计深模块。
- `architecture-audit`：发现并可视化 deepening opportunities；invocation: user-invoked。
- `rapid-prototyping`：用抛弃式逻辑或 UI 原型回答一个设计问题。
- `evidence-research`：基于第一方来源生成带 citation 的研究记录。
- `visual-companion`：经用户同意后，在安全本地浏览器中展示视觉方案和图示。

## Engineering / 开发实践

- `test-driven-development`：行为变化的 Red Test Gate。
- `systematic-debugging`：失败、异常结果和 flaky 行为的根因调试。
- `merge-conflict-resolution`：按双方变更意图完成 merge/rebase 冲突解决。
- `e2e-testing`：Playwright E2E 模式、CI、制品和 flaky 处理。
- `feature-acceptance`：以真实证据、用例矩阵和二次审核完成用户功能验收。

## Harness / 上下文与编排

- `iterative-retrieval`：subagent 和大仓库探索的迭代检索闭环。
- `discover-unknowns-zh`：旧未知项入口，兼容转交 `iterative-retrieval`。
- `continuous-learning-v2`：Hook 观察、project/global instinct、学习评估和演化；invocation: user-invoked。

## Meta / Skill 管理

- `find-skills`：优先发现仓库能力，并可回退到宿主发现工具。
- `skill-creator`：用仓库自带脚本创建、验证和打包可移植 skill。

## Learn / 学习沉淀

学习目录 `learn/` 经 `/learn-eval` 质量门确认学习模式，必须继续按 `skills/learn/<category>/` 分类保存。
