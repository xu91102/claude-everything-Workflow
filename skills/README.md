# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

## Process / 门禁

- `using-superpowers`：按风险选择直接执行、关键追问或正式设计，并保留完成声明纪律。
- `grill-me`：一次只追问一个会改变实现的关键未知点，达到问题预算或退出条件后立即交回执行。
- `brainstorming`：显式正式设计或不可逆高风险任务的 Formal Spec Gate。
- `writing-plans`：execution-ready 工作在确有协调价值时使用的 Plan Gate，不强制前置 spec。
- `executing-plans`：按已批准计划顺序执行。
- `subagent-driven-development`：用户批准 commit/PR/SDD handling 后的任务拆分、审查和进度账本。
- `using-git-worktrees`：脏工作区、高风险或并行任务的隔离工作区准备。
- `discover-unknowns-zh`：复杂、模糊或高风险任务前的未知项、盲点和低成本工件发现流程。
- `verification-before-completion`：完成、通过、已修复或 ready 声明前的新鲜验证门。

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
