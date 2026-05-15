# Superpowers 风格开发闭环设计

> 日期：2026-05-15
> 状态：已由用户确认方向，等待实现计划

## 背景

本仓是面向 Claude Code、Codex 等 Agent Harness 的工作流模板，已经包含 `rules/`、`commands/`、`agents/`、`skills/`、`hooks/` 和持续学习目录。现有结构吸收了 Everything Claude Code 的 Harness 分层思想，也已经引入 `brainstorming`、`writing-plans`、`test-driven-development` 等接近 Superpowers 的流程能力。

当前缺口是：这些能力还没有被组织成一条明确、可验证、可审查的开发闭环。用户希望参考 `obra/superpowers` 的开发闭环流程，把关键门禁固化下来，而不是复制外部仓库文件。

## 目标

建立一条以 Superpowers 为主线的复杂任务开发闭环：

```text
复杂任务
  -> brainstorming 澄清需求
  -> 写 design spec
  -> 用户审核 spec
  -> writing-plans 写实施计划
  -> 用户确认执行方式
  -> TDD 红绿重构
  -> 需求符合性审查
  -> 代码质量审查
  -> /verify 质量门
  -> /pr 提交/PR
  -> /learn-eval --preview 学习沉淀
```

这条闭环要做到：

- 复杂任务有清晰入口和退出条件。
- 每个阶段有明确产物和通过条件。
- 文档、规则、命令和验证脚本之间不漂移。
- 简单任务仍可轻量处理，不被强制走完整重流程。

## 非目标

第一阶段不做以下事项：

- 不复制 Superpowers 的完整文件体系。
- 不强制引入 `using-git-worktrees`。
- 不新增 agent。
- 不新增安装 profile。
- 不把 `/learn-eval` 变成阻塞交付的硬门禁。
- 不把所有简单修复、翻译、格式调整强制纳入完整 spec/plan 流程。

## 参考模型

### Superpowers 提供的主线

Superpowers 的价值在于强门禁流程：

- `brainstorming` 在写代码前澄清需求并产出设计。
- design spec 经用户审核后，才进入 implementation plan。
- implementation plan 把工作拆成小任务。
- 实现阶段强调 TDD、审查、验证和分支收尾。

本仓应复制的是这种门禁结构，而不是照搬文件。

### Everything Claude Code 提供的支撑层

Everything Claude Code 的价值在于 Harness 工程能力：

- rules、skills、agents、commands、hooks 分层。
- 验证脚本和质量门。
- 跨 Harness 适配。
- 持续学习和沉淀机制。

本仓保留这些能力作为支撑层，但开发主流程以 Superpowers 的闭环为准。

## 硬门禁

### Spec Gate

触发场景：

- 复杂功能。
- 架构调整。
- 多文件行为变化。
- 高风险实现。
- 需求存在多种合理解释。

通过条件：

- 已写入 `docs/superpowers/specs/*-design.md`。
- spec 说明目标、非目标、边界、流程、错误处理、验证方式和验收标准。
- spec 自检无占位、无矛盾、无明显歧义。

失败处理：

- 回到 `brainstorming`，继续澄清或拆分范围。

### User Review Gate

触发场景：

- spec 写完并完成自检后。

通过条件：

- 用户明确确认 spec。

失败处理：

- 按用户反馈修改 spec，并重新自检。

### Plan Gate

触发场景：

- 准备进入实现前。

通过条件：

- 已基于确认过的 spec 写入 `docs/superpowers/plans/*.md`。
- plan 明确文件、任务、测试、命令、预期结果和提交点。

失败处理：

- 回到 `writing-plans`。

### Red Test Gate

触发场景：

- 新功能。
- bug 修复。
- 重构引起行为变化。
- 公共 API 或用户流程变化。

通过条件：

- 先写失败测试。
- 运行测试并确认失败原因与预期一致。

失败处理：

- 禁止写行为实现代码，先补测试或解释为什么当前任务不适用测试先行。

### Task Review Gate

触发场景：

- 每个计划任务完成后。

通过条件：

- 通过需求符合性审查。
- 通过代码质量审查。
- 与该任务匹配的测试或检查通过。

失败处理：

- 修复后重新审查，不能直接标记任务完成。

### Verify Gate

触发场景：

- 提交、推送、创建 PR 前。

通过条件：

- `/verify` 或等价验证已运行。
- 输出已运行检查、未运行检查、失败项和剩余风险。
- 阻塞问题已修复或获得用户明确授权。

失败处理：

- 不进入 `/pr`。

### PR Gate

触发场景：

- 用户要求提交、推送或创建 PR。

通过条件：

- 当前分支不是 `main`、`master`、`prod` 等受保护分支。
- 只暂存本次任务相关文件。
- commit message 符合 Conventional Commits。
- PR 描述包含背景、核心改动、验证结果、风险与回滚。

失败处理：

- 回到整理、验证或用户确认阶段。

### Learning Gate

触发场景：

- 非平凡问题解决后。

通过条件：

- 默认建议 `/learn-eval --preview`。
- 只有确认为高频、稳定、可复用模式后才保存。

失败处理：

- 不阻塞交付，只记录不沉淀的原因。

## 文件职责

### `README.md`

作为用户入口，增加“Superpowers 风格开发闭环”章节：

- 说明复杂任务标准流程。
- 列出硬门禁。
- 说明简单任务例外。
- 指向 `/verify`、`/pr`、`/learn-eval` 的收尾流程。

### `rules/01-base.md`

作为基础规则，补强开发门禁：

- 复杂任务先定义成功标准。
- 复杂任务先 spec，再 plan，再实现。
- 行为变化优先测试先行。
- 完成前运行与改动范围匹配的验证。

### `skills/brainstorming/SKILL.md`

作为 Spec Gate 的主入口：

- 保持现有用户审核门。
- 明确 spec 是进入 plan 的必要条件。
- 保持 `docs/superpowers/specs/` 作为默认路径。

### `skills/writing-plans/SKILL.md`

作为 Plan Gate 的主入口：

- 明确没有已确认 spec 时不写实现计划。
- 计划必须能被逐任务执行和审查。
- 执行前让用户选择项目 agent 循环或当前会话执行。

### `skills/test-driven-development/SKILL.md`

作为 Red Test Gate 的主入口：

- 新功能、bug 修复、行为变化必须先写失败测试。
- 如果无法测试，必须记录原因和替代验证。

### `commands/verify.md`

作为 Verify Gate：

- 输出已运行检查。
- 输出未运行检查和原因。
- 输出失败项、风险和是否可进入 PR。

### `commands/pr.md`

作为 PR Gate：

- 要求 verify 结果明确后再进入提交或 PR。
- 继续遵守不混入无关文件、不在受保护分支提交的规则。

### `commands/learn-eval.md`

作为 Learning Gate：

- 保持非阻塞。
- 解决非平凡问题后建议先 preview。
- 只有通过质量门才保存。

### `scripts/verify-harness.js`

作为闭环漂移检查：

- 检查 README 是否包含闭环流程说明。
- 检查基础规则是否包含 spec、plan、test、review、verify 关键门禁。
- 检查相关 command 和 skill 文件仍存在。
- 修复当前 `AGENTS.md`、`CLAUDE.md` 规则加载描述与脚本检查之间的漂移。

## 流程细节

### 复杂任务判定

满足任一条件即按复杂任务处理：

- 涉及多个文件或多个模块。
- 改变用户可见行为。
- 改变公共接口、数据流、状态管理、权限、测试或发布流程。
- 存在多种合理实现方案。
- 错误假设会造成明显返工。

不满足这些条件的简单任务可以直接执行，但仍需遵守最小验证闭环。

### 实现阶段执行模式

第一阶段保留两种执行方式：

- 当前会话执行：适合小而清晰、耦合较强的计划。
- 项目 agent 循环：适合任务边界清楚、可分步审查的计划。

本设计不强制引入完整 Superpowers `subagent-driven-development`，但保留未来演进空间。

### 收尾阶段

交付收尾顺序：

```text
任务完成
  -> 需求符合性审查
  -> 代码质量审查
  -> /verify
  -> /pr
  -> /learn-eval --preview
```

`/learn-eval --preview` 是建议门，不阻塞 PR。原因是学习沉淀应避免低质量、一次性、重复模式污染长期知识库。

## 错误处理

- spec 范围过大：拆成多个子 spec，每个子 spec 能独立计划和验证。
- plan 不可执行：回到 `writing-plans` 重写任务、文件和验证命令。
- 测试无法先写：记录原因，补替代验证，例如快照、CLI smoke test、人工验收步骤。
- review 发现需求偏差：回到对应任务修复，必要时更新 plan。
- verify 失败：修复后重跑失败层级；不能直接进入 PR。
- harness 验证失败：先修复文档、命令或脚本漂移，再继续发布。

## 验证策略

第一阶段实现完成后运行：

```bash
node scripts/verify-harness.js
```

并人工检查：

- README 能从用户角度解释闭环。
- 基础规则能从 agent 角度执行门禁。
- skills 和 commands 的职责不冲突。
- 简单任务不会被误判为必须完整 spec/plan。

如果涉及脚本逻辑修改，应补充或更新 `scripts/verify-harness.js` 的检查项，确保后续文档漂移能被自动发现。

## 分阶段路线图

### Phase 1：门禁闭环

- 更新 README、基础规则、相关 skill 和 command。
- 修复 `verify-harness.js` 当前失败。
- 增加闭环索引检查。

### Phase 2：worktree 隔离

- 评估是否引入 Superpowers 风格的 worktree 执行能力。
- 明确创建、验证、收尾和清理规则。

### Phase 3：subagent-driven-development

- 基于本仓现有 agents，设计任务执行、需求审查、代码审查的标准循环。
- 避免复制外部 prompt，优先复用本仓 agent 职责。

### Phase 4：hooks 自动拦截

- 在 Hook Profile 中增加可选严格门禁。
- 严格模式可阻止明显跳过 verify 或混入调试代码的提交路径。

## 验收标准

第一阶段完成时必须满足：

- `README.md` 清楚说明复杂任务闭环。
- `rules/01-base.md` 明确表达 spec、review、plan、red test、task review、verify、PR 门禁。
- `brainstorming`、`writing-plans`、`test-driven-development` 三个 skill 职责边界一致。
- `/verify` 和 `/pr` 明确承担 Verify Gate 与 PR Gate。
- `scripts/verify-harness.js` 通过。
- 简单任务仍可轻量处理。
- 非平凡问题解决后建议 `/learn-eval --preview`，但不阻塞交付。

## 用户确认记录

用户已确认以下设计重点：

- 参考 `obra/superpowers` 的开发闭环流程。
- 关键是复制门禁结构，而不是复制文件。
- 硬门禁包括：
  - 没有 spec，不进入 plan。
  - 没有用户审核，不进入实现。
  - 没有 failing test，不写行为代码。
  - 没有 review，不标记任务完成。
  - 没有 verify，不进入 PR。
