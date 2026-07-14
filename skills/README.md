# Skills 分类索引

正式 skill 保持 `skills/<skill-name>/SKILL.md` 平铺结构，兼容 Claude Code、Codex 和打包安装的发现方式。分类只在本索引维护，不用物理嵌套目录；需要长材料时，放到对应 skill 的 `references/`。

## 来源治理

`skills/sources.json` 是 skill 来源与同步策略的机器可读事实来源。`origin=upstream` 表示能力映射自 Superpowers 方法论，`strategy=overlay` 表示 CEW 只维护可说明的差异；`origin=cew` 与 `strategy=own` 表示本仓独立能力。新增、重命名或删除正式 skill 时必须同步更新该文件，避免同名能力出现多个事实来源。

## Process / 门禁

- `using-superpowers`：非平凡任务的 skill 路由、优先级和完成声明纪律。
- `brainstorming`：复杂/高风险任务的 Spec Gate。
- `writing-plans`：已批准 spec 到实施计划的 Plan Gate。
- `executing-plans`：按已批准计划顺序执行。
- `subagent-driven-development`：用户批准 commit/PR/SDD handling 后的任务拆分、审查和进度账本。
- `using-git-worktrees`：脏工作区、高风险或并行任务的隔离工作区准备。
- `discover-unknowns-zh`：复杂、模糊或高风险任务前的未知项、盲点和低成本工件发现流程。
- `verification-before-completion`：完成、通过、已修复或 ready 声明前的新鲜验证门。

## Engineering / 开发实践

- `test-driven-development`：行为变化的 Red Test Gate。
- `systematic-debugging`：失败、异常结果和 flaky 行为的根因调试。
- `e2e-testing`：Playwright E2E 模式、CI、制品和 flaky 处理。
- `documentation-lookup`：第三方库/API 的最新文档查询。

## Harness / 上下文与编排

- `context-budget`：审计上下文、MCP、agent 和 skill 常驻开销。
- `iterative-retrieval`：subagent 和大仓库探索的迭代检索闭环。
- `continuous-learning-v2`：Hook 观察、project/global instinct、学习评估和演化。

## Meta / Skill 管理

- `find-skills`：查找可安装或本地已有 skill。

## Learn / 学习沉淀

学习目录 `learn/` 经 `/learn-eval` 质量门确认学习模式，必须继续按 `skills/learn/<category>/` 分类保存。
