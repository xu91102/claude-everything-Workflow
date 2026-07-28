# Claude Everything Workflow

> 一套通用的 Agent Harness 工程模板，可直接复制到 `~/.claude/` 使用。
> 学习 [everything-claude-code](https://github.com/affaan-m/everything-claude-code) 的最佳 Harness 工程实践。

## 一键安装

macOS / Linux / Git Bash / WSL：

```bash
bash scripts/install.sh
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

只安装某个工具：

```bash
bash scripts/install.sh --claude-only
bash scripts/install.sh --codex-only
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -ClaudeOnly
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -CodexOnly
```

预览将要写入的文件：

```bash
bash scripts/install.sh --dry-run
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
```

## npm / npx 安装

发布到 npm 后，可以不 clone 仓库，直接运行：

```bash
npx claude-everything-workflow install
npx claude-everything-workflow install --claude-only
npx claude-everything-workflow install --codex-only
npx claude-everything-workflow verify
```

本地发布前检查：

```bash
npm pack --dry-run
npm publish --dry-run
```

## npm 发布

版本号通过 PR 更新 `package.json`，并与功能改动一起接受审查。PR 合并到 `main` 后，`.github/workflows/ci.yml` 会先运行 `npm run verify` 与 `npm run pack:dry-run`，只有 `verify` 成功时才发布该提交中的版本。

发布会拒绝不高于 npm `latest` 的新版本，创建指向当前提交的 `v<version>` tag，然后通过 npm 受信任的发布商 OIDC 执行 `npm publish`。当前版本已在 npm 时会安全跳过；待发布版本的 tag 已指向其他提交时会失败，要求先审计。

如需重试发布，可在 `main` 上手动触发 `CI`；流程不会修改、提交或推送 `main`。

npm 包设置里必须添加 GitHub Actions 受信任的发布商，仓库为 `xu91102/claude-everything-Workflow`，workflow 文件名为 `ci.yml`，并允许 `npm publish`。

安装目标：

- Claude Code: `~/.claude/`
- Codex: `~/.codex/`

Claude Code 会安装 `CLAUDE.md` 并合并 `settings.json` 作为 hooks 入口；Codex 安装共享 Workflow 材料，不默认消费 Claude Code `settings.json`。顶层配置文件已存在且内容不同时，会先生成 `.bak.<timestamp>` 备份再覆盖；目录内容按仓库版本同步。

## 手动安装

### Windows

```powershell
Copy-Item -Recurse .\claude-everything-Workflow\* $env:USERPROFILE\.claude\ -Force
```

### macOS / Linux

```bash
cp -r ./claude-everything-Workflow/* ~/.claude/
```

## 目录结构

```
claude-everything-Workflow/
├── README.md                   # 本文档
├── AGENTS.md                   # Codex 与通用权威规则入口
├── CLAUDE.md                   # Claude Code 最小 bootstrap 入口
├── settings.json               # Claude Code Hooks 配置入口
├── .github/
│   └── workflows/
│       └── ci.yml               # PR / main 校验与 verify 后发布 npm
│
├── rules/                      # 规则索引与按需加载规则
│   ├── 01-base.md              # 基础设定
│   ├── 02-code-size.md         # 代码规模约束
│   ├── 03-architecture.md      # 架构原则
│   ├── 04-error-handling.md    # 错误处理
│   ├── 05-git-workflow.md      # Git 规范
│   ├── 06-comments.md          # 注释规范
│   ├── 07-forbidden.md         # 禁止事项
│   ├── 08-ecc-integration.md   # ECC 集成索引
│   ├── 09-first-principles-adversarial-testing.md # 第一性原则与对抗性测试
│   └── common/                 # 通用最佳实践
│       ├── harness-engineering.md # Agent Harness 六层与执行循环
│       ├── context-hygiene.md   # 上下文卫生与 Subagent 边界
│       ├── agent-orchestration.md # Agent 编排
│       ├── performance.md      # Token 优化 & 模型选择
│       ├── hooks.md            # Hook 系统最佳实践
│       ├── skills-learning.md  # Skills 与持续学习
│       ├── security.md         # 安全优先原则
│       ├── testing.md          # 测试与验证
│       ├── pr-automation.md    # PR 自动化与 CI 质量门
│       └── implementation.md   # 实施实践
│
├── agents/                     # 代理（专业任务委托）
│   ├── architect.md            # 架构师
│   ├── code-reviewer.md        # 代码审查员
│   ├── tdd-guide.md            # TDD 指导
│   ├── e2e-runner.md           # E2E / Playwright（可选 Agent Browser）
│   ├── harness-optimizer.md    # Harness 配置调优
│   └── ...                     # 其他专业代理
│
├── commands/                   # 命令（斜杠快捷入口）
│   ├── pr.md                   # /pr 提交与创建 PR
│   ├── verify.md               # /verify 验证
│   ├── learn-eval.md           # /learn-eval 提取模式 (含质量门)
│   ├── instinct-status.md      # /instinct-status 状态与待审查
│   ├── projects.md             # /projects 查看学习项目注册表
│   ├── promote.md              # /promote 预览/推广项目直觉
│   ├── prune.md                # /prune 清理已标记直觉
│   ├── evolve.md               # /evolve 演化评估
│   ├── code-review.md          # /code-review → code-reviewer
│   ├── tdd.md                  # /tdd → tdd-guide
│   ├── e2e.md                  # /e2e → e2e-runner
│   ├── grill.md                # /grill → grilling
│   ├── to-spec.md              # /to-spec → spec-gate
│   ├── to-tickets.md           # /to-tickets → to-tickets
│   ├── implement.md            # /implement → implement
│   ├── setup-workflow.md        # /setup-workflow → project-context
│   └── harness-audit.md        # /harness-audit → harness-optimizer
│
├── references/                 # 按需加载的长参考材料
│   └── agents/                 # Agent 详细检查清单与示例
│
├── scripts/                    # 跨平台脚本
│   ├── install.sh              # macOS / Linux / Git Bash / WSL 一键安装
│   ├── install.ps1             # Windows PowerShell 一键安装
│   └── learning/               # 学习系统手动维护脚本
│       └── review-confidence.js # 置信度审查报告
│
├── skills/
│   ├── README.md               # Skill 分类索引；物理目录保持平铺以兼容发现
│   ├── using-superpowers/      # Skill 路由、优先级与门禁纪律
│   │   └── SKILL.md
│   ├── grilling/               # 重大用户决策的单问式压力测试
│   │   └── SKILL.md
│   ├── spec-gate/              # 零访谈工程 Spec 成稿、自审和用户批准
│   │   ├── SKILL.md
│   │   └── references/
│   ├── domain-modeling/        # 领域术语、关系、不变量和边界建模
│   │   └── SKILL.md
│   ├── project-context/        # 显式配置项目工作追踪、领域文档和 ADR 位置
│   │   └── SKILL.md
│   ├── visual-companion/       # 经同意后展示安全本地视觉方案
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   ├── subagent-driven-development/ # SDD：ticket brief、review package、progress ledger
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   ├── using-git-worktrees/    # 隔离式 worktree 执行准备
│   │   └── SKILL.md
│   ├── to-tickets/             # 获批 Spec → tracer-bullet tickets
│   ├── implement/              # frontier ticket → TDD、审查与验证
│   │   └── SKILL.md
│   ├── verification-before-completion/ # 完成声明前的新鲜验证门
│   │   └── SKILL.md
│   ├── e2e-testing/            # Playwright E2E 模式（POM、CI、制品）
│   │   └── SKILL.md
│   ├── iterative-retrieval/     # Subagent 迭代检索与上下文收敛
│   │   └── SKILL.md
│   ├── continuous-learning-v2/ # 自主学习系统
│   │   ├── SKILL.md            # 技能说明
│   │   ├── config.json         # 配置
│   │   ├── agents/             # Observer Agent
│   │   └── hooks/              # observe-v2.js 增强观察脚本
│   ├── test-driven-development/ # TDD 测试先行规则
│   └── learn/                  # 学习到的模式，按分类保存
│       ├── pr/
│       ├── testing/
│       └── debugging/
│
├── hooks/                      # 钩子脚本
│   ├── runtime/                # Hook 运行时与 Profile 控制
│   │   ├── run-with-flags.js
│   │   └── hook-flags.js
│   ├── commit-quality.js       # 可选 Pre-commit 质量门
│   ├── check-console-log.js    # console.log 检测
│   └── check-code-size.js      # 代码规模检测
│
└── homunculus/                 # 自主学习系统
    └── instincts/
        └── personal/           # 个人直觉
```

正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构，避免破坏 Claude Code、Codex 和安装脚本的发现方式；分类维护在 `skills/README.md`。只有学习产物使用物理分类目录 `skills/learn/<category>/`。

## 规则加载策略

- 默认入口只加载 `AGENTS.md` 或 `CLAUDE.md` 中的硬规则和最小索引。
- `AGENTS.md` 是权威规则入口；`CLAUDE.md` 是 Claude Code bootstrap，只保留启动必需规则和回退策略，避免两份完整规则漂移。
- 简单问答、解释、格式调整、翻译或只读查看，不读取额外规则。
- 规则路径解析顺序：先检查当前项目根目录 `rules/`；若项目无 `rules/` 或目标规则文件不存在，必须回退到用户级规则目录：Codex 使用 `~/.codex/rules/`，Claude Code 使用 `~/.claude/rules/`。
- 当用户级 Workflow 注入到没有 `rules/` 的项目时，不能把项目规则目录缺失等同于“无规则”；必须继续检查对应的用户级规则目录。
- 回退只改变查找位置，不改变按需读取原则；仍然只读取当前任务直接相关的规则文件，不要默认全量加载 `rules/` 或 `rules/common/`。
- `rules/common/` 是专项参考区，只在命令、agent、skill 或当前任务明确触发时读取。

## 按需 MCP 与上下文控制

默认 MCP 必须同时满足“通用”和“MCP 明显优于 CLI/API/原生能力”。GitHub、文档查询、Exa 搜索、Playwright E2E、memory 和 sequential-thinking 这类纯请求/响应或已有原生替代的能力，优先通过 skill、CLI/API 或 harness 原生能力按需触发，而不是默认常驻。

### 1. Claude Code：用户级 `~/.claude/settings.json`

复制 Workflow 到 `~/.claude/` 后，在 **`~/.claude/settings.json`**（没有则新建）里配置 **`mcpServers`**，与主仓根目录 **`.mcp.json`** 中 **`context7`** 条目保持一致：

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@2.1.4"]
    }
  }
}
```

- 若文件中已有 hooks、其它字段，请**合并**进同一 JSON，**不要**整文件覆盖。
- 需要本机 **Node / npx**（`npx` 首次会拉取包）。
- 更全的 MCP 列表与说明见主仓 **`mcp-configs/mcp-servers.json`** 与主仓 **README「Configure MCPs」**。

**仅查文档时**：用户级只保留 **`context7`** 即可，不必一次打开主仓里的 GitHub、Exa、Playwright 等全部服务。

### 2. 节省 Token（与主仓 `rules/common/performance.md` 一致）

- MCP 工具描述会占用上下文；建议**同时启用的 MCP 少于 10 个**，并控制活跃工具数量。
- **策略**：从 **0 个或只开 Context7** 开始，需要再加其它 MCP。
- **缓存命中策略**：保持入口文件前缀稳定，默认只加载小型 bootstrap 和规则索引；长参考材料、专项规则、agent 详细清单和学习材料必须按需加载。
- **入口预算**：`CLAUDE.md` 控制在约 1.5K 字符内，`AGENTS.md` 控制在约 3.6K 字符内；超过预算时优先把细节下沉到 `rules/`、`references/` 或专项 skill。
- **按项目禁用**（Claude Code）：在具体仓库的 **`.claude/settings.json`** 中使用 **`disabledMcpServers`**，写上全局已启用、但本项目不用的服务名（与 `mcpServers` 的**键名**一致），例如：

```json
{
  "disabledMcpServers": [
    "github",
    "exa",
    "playwright",
    "sequential-thinking",
    "memory"
  ]
}
```

- **跑 ECC 安装/同步且你已有同名自建 MCP**：可设置 `export ECC_DISABLED_MCPS="github,context7,exa,playwright,sequential-thinking,memory"`，避免重复写入（见主仓 README）。
- **新增 MCP 前先评估**：判断它是否应该默认启用、按需启用，还是改为 CLI/API skill。

### 3. Cursor

在项目根使用 **`.mcp.json`**，放入与上文相同的 **`context7`** 段即可；用 MCP 面板关闭不需要的服务，效果与 `disabledMcpServers` 类似。

## 可用命令

| 命令               | 功能                                                       |
| ------------------ | ---------------------------------------------------------- |
| `/pr`              | 提交、推送和创建 PR 的标准工作流                           |
| `/verify`          | 运行全面验证检查                                           |
| `/learn-eval`      | 从会话提取模式 (含质量门评估)                              |
| `/instinct-status` | 查看学习状态和待审查报告                                   |
| `/projects`        | 查看 Continuous Learning 项目注册表                        |
| `/promote`         | 预览或推广项目级直觉到全局直觉                             |
| `/prune`           | 清理已人工标记删除、拒绝或归档的直觉                       |
| `/evolve`          | 评估模式是否值得演化为 skill、agent 或 command             |
| `/code-review`     | 固定基点、Standards 轴与 Spec 轴的双轴审查，委派 `code-reviewer` agent |
| `/tdd`             | 薄封装入口，委派 `tdd-guide` agent                         |
| `/e2e`             | 薄封装入口，委派 `e2e-runner` agent 和 `e2e-testing` skill |
| `/harness-audit`   | 薄封装入口，委派 `harness-optimizer` agent                 |
| `/setup-workflow`  | 显式配置项目工作追踪、领域文档和 ADR 位置                  |

## 验证 Harness

```bash
node scripts/verify-harness.js
bash scripts/install.sh --dry-run
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
```

`verify-harness.js` 会检查 README 与 `commands/` 是否一致、薄封装 command 是否指向存在的 agent/skill、旧命令和旧衰减语义是否残留，并运行 `observe-v2` 最小 smoke test。

## Hook Profile 控制

通过环境变量控制 Hook 行为:

```bash
# minimal | standard | strict (默认: standard)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook (逗号分隔 ID)
export ECC_DISABLED_HOOKS="post:edit:console-log"
```

当前仓库以根目录 `settings.json` 作为 Claude Code hooks 入口；`hooks/` 目录统一保存低噪音 Hook 运行时和脚本实现。默认不启用会话启动、会话结束、停止或压缩前的弱摘要 Hook，避免污染上下文。`scripts/learning/` 只保存手动学习治理脚本，不作为 Hook 自动触发。
Codex 安装同一套 `hooks/` 脚本材料，但不会因为安装本仓文件而自动启用 Claude Code hooks；如未来需要 Codex 原生自动化，应新增明确 adapter。

## Superpowers 风格开发闭环

本仓默认最短闭环、按风险逐级升级。高风险任务或用户显式 opt-in 时参考 [obra/superpowers](https://github.com/obra/superpowers) 的门禁结构，但不复制外部仓库文件。主线是：

Formal lane 固定为 `to-spec → to-tickets → implement`：

```text
任务
  -> using-superpowers 先路由到相关 process skill
  -> 可查事实直接检索；系统性事实缺口用 iterative-retrieval
  -> 标记用户显式 formal spec 或高回滚成本架构/公共契约、安全、持久数据、不可逆副作用
  -> 存在关键用户决策：grilling 一次只问一个最高价值问题，并返回结构化 handoff
  -> 明确低风险且无未决决策：direct，直接实现并做相称验证
  -> 高风险/formal spec 且上下文充分：spec-gate 零访谈写 design spec 并自审
  -> Spec Gate 阻塞：停止并展示决策地图；用户明确继续才创建新 grilling 会话
  -> 用户审核并批准 spec
  -> using-git-worktrees 按需创建隔离工作区
  -> /to-tickets 拆成 tracer-bullet tickets 并确认 blocking edges
  -> 从 frontier 显式 /implement 一张 ticket
  -> 获批 commit-per-ticket 时可使用 subagent-driven-development
  -> TDD 红绿重构
  -> 需求符合性审查
  -> 代码质量审查
  -> verification-before-completion 完成声明前确认新鲜验证证据
  -> /verify 质量门
  -> /pr 提交/PR
  -> /learn-eval --preview 学习沉淀
```

需要显式压力测试计划、设计或重大决策时使用 `/grill`；需要正式工程 Spec 时使用 `/to-spec`。显式 grilling 会话保留共同理解确认；自动触发只使用更短的微型访谈。明确任务、多文件任务、普通行为变化和可查事实不会因此增加交互轮数。

旧入口名 `brainstorming` 兼容一个发布周期：中央路由会提示迁移并按 formal Spec 请求处理，但不再安装或发现同名 Skill。`grilling` 是唯一需求澄清引擎，`spec-gate` 只负责零访谈成稿、自审和用户批准。

### Skill 迁移说明

- `writing-plans` → `/to-tickets`
- `executing-plans` → `/implement`
- `discover-unknowns-zh` → `iterative-retrieval`
- `find-skills` → 宿主提供的 Skill 发现/安装能力
- `skill-creator` → 宿主提供的 Skill 创作能力

升级安装会按精确退役清单删除上述旧分发文件；同名目录中的未知用户文件会被保留并报告。

硬门禁：

- 开始非平凡任务前，先用 `using-superpowers` 判断并加载相关 process skill。
- 上下文或工具面变重时，先盘点常驻 Token 开销，再决定新增或删除 MCP/skill/agent。
- 子代理需要探索大仓库时，先用 `iterative-retrieval` 的 Dispatch/Evaluate/Refine/Loop 闭环收敛上下文，再回传证据。
- 完整流程适用时：没有批准的 Spec 不生成 tickets；没有用户审核不进入实现；没有批准的 tickets 不进入实现；没有 review 不标记任务完成。
- Ticket 使用 tracer-bullet vertical slice、显式 `Blocked by` 和 frontier；本地可单文件汇总或一票一文件。
- 没有 failing test，不写行为代码。
- 没有新鲜验证证据，不声明完成、通过、已修复或 ready。
- 没有 verify，不进入 PR。
- 有脏工作区、并行任务或高风险改动时，先考虑 `using-git-worktrees`。
- 只有用户明确批准 commit/PR/SDD 执行时，才使用 `subagent-driven-development` 的 per-ticket commit 流；否则 `/implement` 保持改动未提交。

### 对齐 Superpowers v6.0.3 的能力

- `subagent-driven-development` 使用 `.superpowers/sdd/` 保存 ticket brief、implementer report、review package 和 `progress.md`，避免把 scratch 写进 `.git/`。
- 每张 ticket 使用一个 `ticket-reviewer-prompt.md` 同时返回 spec compliance 和 code quality verdict，减少重复 reviewer 上下文。
- `to-tickets` 不复制预计实现代码；架构、testing seams 和全局约束留在 Spec，ticket 只保留 outcome、acceptance 与 blocking edges。
- Visual Companion 使用带 `?key=` 的 per-session URL，HTTP/WebSocket 请求都需要 session key；默认 idle timeout 为 4 小时，可用 `--idle-timeout-minutes` 调整。

复杂度只影响执行与验证强度，不自动触发完整流程。普通新功能、多文件行为变化和存在低风险关键未知的任务仍走最短适用闭环；只有上述高风险类别或显式 opt-in 才进入完整流程。简单问答、翻译、格式调整、窄范围文档修正和无行为变化的小修复，可以直接处理，但完成前仍需运行与改动范围匹配的最小验证。

收尾阶段按 `/verify` -> `/pr` -> `/learn-eval --preview` 推进。`/learn-eval --preview` 是非阻塞学习建议门，只在模式高频、稳定、可复用时保存。

## Continuous Learning v2

### 工作流程

```
会话活动 → Hooks 观察 → projects/<project-id>/observations.jsonl
                            ↓
                     Observer Agent (Haiku)
                            ↓
               projects/<project-id>/instincts/
                  ↓                    ↓
       /learn-eval 质量门     /promote 预览推广
                  ↓                    ↓
        skills/learn/<category>/   global/instincts
                  ↓
        /evolve 评估是否升级为正式 skills/commands/agents
```

默认学习数据根目录为 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus`。旧版 `~/.claude/homunculus` 可用 `node scripts/learning/migrate-homunculus.js --dry-run` 预览迁移。

`observations.jsonl`、project instincts 和 global instincts 是观察、候选和迁移来源；经 `/learn-eval` 质量门确认后，最终学习产物以 `skills/learn/<category>/` 为权威路径。只有高频、稳定、可组合的模式才通过 `/evolve` 升级为正式 `skills/`、`commands/` 或 `agents/`。

### 置信度系统

| 分数 | 含义   | AI 行为      |
| ---- | ------ | ------------ |
| 0.3  | 试探性 | 建议但不强制 |
| 0.5  | 中等   | 相关时应用   |
| 0.7  | 强     | 主动应用     |
| 0.9  | 核心   | 始终应用     |

> 置信度不会因时间流逝自动衰减。使用 `scripts/learning/review-confidence.js` 审查、`/prune` 清理。

## 使用流程

```
1. 复制到 ~/.claude/
2. 首次需要长期协作上下文时，用 `/setup-workflow` 配置工作追踪和领域文档位置；需求清楚时直接实现；关键未知按需用 `/grill`；高风险任务或显式 opt-in 用 `/to-spec` 写 design spec
3. 高风险或并行实现前，用 `using-git-worktrees` 隔离工作区
4. 用 `/to-tickets` 把批准的 Spec 拆成 tracer-bullet tickets
5. 从 frontier 选择一张 ticket，用 `/implement` 在 fresh context 中执行
6. 使用 /tdd 委派 tdd-guide 规划测试先行实现
7. 关键路径使用 /e2e 委派 e2e-runner 维护 Playwright
8. 使用 /verify 验证
9. 使用 /code-review 基于固定基点委派 code-reviewer 做双轴审查
10. 使用 /learn-eval 将稳定模式沉淀到 skills/learn/<category>/
11. 使用 /projects 查看项目级学习来源
12. 使用 /promote --dry-run 评估是否推广为全局直觉
13. 使用 /evolve 评估是否演化
14. 使用 /prune 清理已人工标记删除的直觉
```
