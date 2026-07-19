---
name: using-superpowers
description: 用于为非平凡任务选择最小充分工作流，尤其是用户提到 Superpowers、需要在直接执行、关键追问和正式设计之间路由，或需要判断应加载哪个 process skill 时。按决策风险升级，不按文件数量升级。
---

# Using Superpowers

这是本仓库的工作流路由器。目标不是让每个任务都经过完整仪式，而是用最短路径获得可靠结果。

## Priority

按以下顺序执行：

1. User instructions，包括直接请求、`AGENTS.md`、`CLAUDE.md` 和项目规则。
2. 与当前风险和任务阶段匹配的 skills、commands、agents 与 hooks。
3. 默认 agent 行为。

若 skill 与用户或项目指令冲突，服从更高优先级指令；冲突影响结果时简要说明。

## Skill Invocation Rule

处理非平凡任务时：

1. 先做最小上下文检查，判断当前缺的是事实、用户决策，还是正式设计。
2. 按决策风险选择下面三档路径；不要仅凭“复杂”“行为变化”或文件数量升级。
3. 只加载所选路径直接需要的 skill。只有会影响用户协作方式时才简短宣布。
4. 不凭记忆执行 skill；skill 会变化，应读取当前 `SKILL.md`。
5. 工作流不匹配时立即降级到更小路径，不为已经足够清楚的任务制造产物。

## Risk-Based Routing

```text
Task arrives
  -> clear + reversible                         -> direct execution
  -> one or more implementation-changing gaps  -> skills/grill-me/SKILL.md
  -> explicit formal design or high-risk change -> skills/brainstorming/SKILL.md
  -> execution-ready and coordination-heavy     -> skills/writing-plans/SKILL.md
  -> approved plan + SDD/commit approved?        -> subagent-driven-development
  -> approved plan, no commit approval?          -> executing-plans
  -> bug / failing test / unexpected result      -> systematic-debugging
  -> behavior change with test path?             -> test-driven-development
  -> dirty worktree / risky branch work?         -> using-git-worktrees
  -> completion / fixed / ready claim?            -> verification-before-completion
  -> external skill learning or edit?             -> skill-creator + skills-learning
```

### 1. Direct execution

直接执行适用于目标、成功标准和边界已足够清楚，且改动可回退的任务。先检查仓库中可发现的事实，再实现并运行与改动范围匹配的验证。

- multi-file changes alone do not trigger brainstorming、spec 或 plan。
- 行为变化只触发与风险匹配的 TDD 或验证，不自动触发完整设计流程。
- 不询问可以从代码、配置、测试或文档中低成本查明的问题。

### 2. Targeted clarification

只有某个答案会改变实现、接口、数据、安全边界或用户体验时，才使用 `skills/grill-me/SKILL.md`。一次解决一个最高价值未知点，满足退出条件后立刻回到直接执行或正式设计。

### 3. Formal design

以下场景使用 `skills/brainstorming/SKILL.md`：

- 用户明确要求 Brainstorming、design spec 或方案评审。
- 不可逆或高代价决策，例如数据迁移、安全/权限边界、公共 API 兼容、跨系统协议。
- 存在多个可信方案，选错会造成明显返工，且简短追问不足以消除风险。

是否写 plan 取决于执行协调复杂度。一个已批准设计可以直接实现；只有任务拆分、交接或依赖关系值得持久化时才进入 `skills/writing-plans/SKILL.md`。

## No Workflow Tax

- 不为满足 Harness 形式创建无用的 spec、plan、review package 或进度账本。
- 不重复询问用户已经回答或仓库已经给出的事实。
- 不要求用户对同一份未发生实质变化的设计批准两次。
- 用户要求结果且风险可控时，默认继续执行，而不是再询问“是否执行”。
- 可以随新证据升级路径，也可以在风险消失后降级路径。

Process skills only take priority after routing selects them；它们不是所有非平凡任务的固定前置链。

## Completion

无论走哪条路径，完成、修复、通过或 ready 声明前都应用 `skills/verification-before-completion/SKILL.md`，提供新鲜验证证据、未运行项和剩余风险。

执行中遇到 bug、失败测试、flaky 或意外结果时，使用 `skills/systematic-debugging/SKILL.md`，不要堆叠猜测性修复。
