# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

## Process / 门禁

- `using-superpowers`：非平凡任务的 skill 路由、优先级和完成声明纪律。
- `grilling`：对计划、设计或重大用户决策进行单问式压力测试。
- `spec-gate`：显式 formal spec 或高风险任务的零访谈成稿、自审和用户批准门。
- `writing-plans`：已批准 spec 到实施计划的 Plan Gate。
- `executing-plans`：按已批准计划顺序执行。
- `subagent-driven-development`：用户批准 commit/PR/SDD handling 后的任务拆分、审查和进度账本。
- `using-git-worktrees`：脏工作区、高风险或并行任务的隔离工作区准备。
- `discover-unknowns-zh`：系统性事实、证据和盲点缺口的低成本调查流程。
- `verification-before-completion`：完成、通过、已修复或 ready 声明前的新鲜验证门。

## 旁路设计能力

- `domain-modeling`：领域术语、实体关系、不变量、生命周期和 bounded context 变化建模。
- `visual-companion`：经用户同意后，在安全本地浏览器中展示视觉方案和图示。

## Engineering / 开发实践

- `test-driven-development`：行为变化的 Red Test Gate。
- `systematic-debugging`：失败、异常结果和 flaky 行为的根因调试。
- `e2e-testing`：Playwright E2E 模式、CI、制品和 flaky 处理。
- `feature-acceptance`：以真实证据、用例矩阵和二次审核完成用户功能验收。

## Harness / 上下文与编排

- `iterative-retrieval`：subagent 和大仓库探索的迭代检索闭环。
- `continuous-learning-v2`：Hook 观察、project/global instinct、学习评估和演化。

## Meta / Skill 管理

- `skill-creator`：创建或更新 skill 的结构和质量规则。
- `find-skills`：查找可安装或本地已有 skill。

## Learn / 学习沉淀

学习目录 `learn/` 经 `/learn-eval` 质量门确认学习模式，必须继续按 `skills/learn/<category>/` 分类保存。
