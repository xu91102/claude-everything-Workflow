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
│   ├── subagent-driven-development/ # SDD：task brief、review package、progress ledger
│   │   ├── SKILL.md
│   │   ├── implementer-prompt.md
│   │   ├── task-reviewer-prompt.md
│   │   └── scripts/
│   ├── using-git-worktrees/    # 隔离式 worktree 执行准备
│   │   └── SKILL.md
│   ├── executing-plans/        # 按计划执行、检查点、审查与验证
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
| `/code-review`     | 薄封装入口，委派 `code-reviewer` agent                     |
| `/tdd`             | 薄封装入口，委派 `tdd-guide` agent                         |
| `/e2e`             | 薄封装入口，委派 `e2e-runner` agent 和 `e2e-testing` skill |
| `/harness-audit`   | 薄封装入口，委派 `harness-optimizer` agent                 |

## 验证 Harness

```bash
node scripts/verify-harness.js
bash scripts/install.sh --dry-run
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
```

`verify-harness.js` 会检查 README 与 `commands/` 是否一致、薄封装 command 是否指向存在的 agent/skill、旧命令和旧衰减语义是否残留，并运行 `observe-v2` 最小 smoke test。

## Behavior Eval

Behavior Eval 为后续衡量 Harness 是否真的帮助模型完成任务提供可执行地基，而不是只检查配置文本。
内置 `quality-autonomy` profile 对齐当前使用习惯：范围明确、可逆且在本地的工作直接执行并自证；
本地可查明的歧义先只读探索再行动；只有关键架构信息缺失、外部写入或不可逆动作才阻塞询问。
七个内置场景覆盖明确小改动、中文与空格路径、脏工作区保护、本地歧义探索、关键架构选择、
外部写入授权和首次验证失败后的恢复。
其中本地歧义场景启用 `readBeforeWrite` 独立 oracle：结构化 `Read` 类工具的成功结果必须先于明确的
Edit/Write/file_change 写入调用；Bash/command execution 的语义不可证明，不能充当读取证据，verification
命令也不计作探索。Codex 当前事件协议缺少结构化读取证据；Claude 的内置 `Read` 又不受 Bash sandbox
约束，因此安全 profile 不开放它。两种完整 live suite 都会在启动前返回 `E_ADAPTER_CAPABILITY`、
`complete=false`，不会把不可观测性算成模型失败；可用 `--scenario` 运行其余场景。
七场景尚未覆盖“本地不可逆动作授权”，所以不能声称已完整覆盖所有 `ask` 边界。

默认离线运行内置 replay，不访问 Codex 或 Claude，也不产生模型费用：

```bash
npm run eval -- --json
cew eval --json
cew eval --list
```

离线 replay 只验证 evaluator、fixture、独立 oracle、指标和质量门本身，分数不等于真实模型质量。
内置 replay 是随包审查的可信自测；自定义 replay 的验证证据默认不计入真实性门。只有确认 trace 来源可信时，
才显式增加 `--trust-replay`。
真实评测必须显式授权 `--live`，并选择宿主 adapter：

```bash
cew eval --adapter codex --live --json
cew eval --adapter claude --live --json
```

live 不传模型降级参数。为避免用户配置合并后重新开启 MCP、Hook、连接器或重定向 provider，Codex 使用
`--ignore-user-config` 和专用最小权限 profile，Claude 使用 `--safe-mode`。因此模型由厂商 CLI 的内置默认值
选择；Foundation 不能在不新增可信模型选择输入的情况下证明它一定是本机“最强”模型。

prompt 只通过 stdin 传入，并明确编码 `act / explore_then_act / ask` 使用习惯。两个宿主命令都会先从去除
相对项和 fixture 项的宿主 PATH 解析为绝对可执行文件，再以各自最小环境启动；这能阻止 fixture-cwd
劫持，但调用者仍需信任自己的宿主 PATH。Codex 顶层环境不继承
`NODE_OPTIONS`、动态加载器或 shell 启动注入变量。Codex 只允许 fixture 写入、把 `.git` 限为只读、关闭
命令网络，并拒绝读取用户主目录和 fixture 外临时目录。

Claude 只向模型暴露并显式允许 sandboxed `Bash`，在 `dontAsk` 下读、改、建文件都走同一个 OS sandbox
边界，避免内置 Read/Edit 绕过或依赖旧版权限语义。会话的 `TMP/TEMP/TMPDIR` 和 Claude 专用 temp root
指向宿主短临时根下随机、私有的短生命周期目录（POSIX 为 `0700`），仅精确加入 sandbox allow，并在
成功或失败后清理；同一临时根的其它路径仍不可读写。sandbox 还拒绝读取用户主目录与常见 Unix socket
目录，fixture 写入使用 cwd 默认边界、显式 fixture allow 和 `.git` deny。
`CLAUDE_CONFIG_DIR` 与凭据环境变量动态加入保护。网络、hooks、MCP、连接器、后台 agent 与会话持久化均关闭。
所以本阶段 live 衡量的是受控决策策略，不是当前候选 Harness 的 skills、plugins、hooks 或多 agent 集成能力，
也不能用来证明本分支已让真实模型达到最大能力；候选/基线真实对照属于下一阶段。

live 会把场景 prompt 发送给所选模型供应商；“不保存原始 prompt”只约束本地评测报告，不等于不向模型
供应商发送。宿主 sandbox 也不是完整 OS 安全边界，尤其 Claude 在部分 Linux 环境中的 Unix-socket
seccomp 保护可能不可用。live 只应用于可信 fixture，涉及不可信输入时应放进一次性容器和受控账号；
默认离线 replay 不进行模型请求。

Windows Node 22 CI 只验证包内协议与路径测试；真实 Windows live 尚未运行。live 解析器只接受能被
`shell:false` 直接启动的原生 `.exe`，不会执行 npm 的 `.cmd` / `.bat` shim；只有 shim 的安装会返回
`E_ADAPTER_MISSING`，不能把 CI 绿灯当作 Windows live 已可用。

自定义 suite 中的 `verification.command` 是本地代码执行入口，默认拒绝。只有在审查并信任 suite 后才使用
`--allow-suite-code`；启用后，独立 oracle 会以当前用户权限执行这些命令。`--keep-fixtures` 会在评测流程正常
结束时保留临时工作区，包括行为或 gate 失败的现场，并在终端和报告的 `fixturePaths` 中给出路径；adapter、
oracle、报告写入等基础设施异常始终清理。

内置“外部写入授权”场景只使用临时目录内的受控模拟脚本，不连接 GitHub 或其它外部服务。

报告包含六组信号：

- `taskSuccessRate`：adapter 正常完成且决策、独立文件与行为顺序 oracle 都正确的比例。
- `unnecessaryQuestionRate`：本应直接完成的场景中，模型提出任何问题的比例；非阻塞追问同样不能绕过门禁。
- `falseGateRate`：本应直接完成的场景被错误判定为 `blocked` 的比例。
- `toolRoundTrips`：工具调用轮次、均值、P50、P95 与调用总数，用来观察流程摩擦；`roundCoverage`
  表示真实轮次数据覆盖率，宿主不提供轮次时保持 `null`，不伪造轮次。
- `contextCost`：fresh/cache input 与 output token；`usageCoverage` 表示有真实 usage 的场景覆盖率。
  缺失时保持 `null`，不猜测 token。
- `verificationTruthfulness`：声称验证通过时，是否能按 `checkId` 关联到完整且成功的可信工具结果，
  且同时通过独立 oracle；恢复场景还要求成功证据之前真实出现过失败结果。

默认报告不保存原始 prompt、tool output 或环境变量；
adapter 错误也只返回稳定错误码和裁剪后的安全信息。

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

复杂任务默认参考 [obra/superpowers](https://github.com/obra/superpowers) 的门禁结构，但不复制外部仓库文件。本仓的主线是：

```text
复杂任务
  -> using-superpowers 先路由到相关 process skill
  -> brainstorming 澄清需求
  -> 写 design spec
  -> 用户审核 spec
  -> using-git-worktrees 按需创建隔离工作区
  -> writing-plans 写实施计划
  -> subagent-driven-development 或 executing-plans 按计划执行
  -> TDD 红绿重构
  -> 需求符合性审查
  -> 代码质量审查
  -> verification-before-completion 完成声明前确认新鲜验证证据
  -> /verify 质量门
  -> /pr 提交/PR
  -> /learn-eval --preview 学习沉淀
```

硬门禁：

- 开始非平凡任务前，先用 `using-superpowers` 判断并加载相关 process skill。
- 上下文或工具面变重时，先盘点常驻 Token 开销，再决定新增或删除 MCP/skill/agent。
- 子代理需要探索大仓库时，先用 `iterative-retrieval` 的 Dispatch/Evaluate/Refine/Loop 闭环收敛上下文，再回传证据。
- 没有 spec，不进入 plan。
- 没有用户审核，不进入实现。
- 计划必须包含 `Global Constraints` 和每任务 `Interfaces`，让 implementer/reviewer 不依赖父会话记忆。
- 没有 failing test，不写行为代码。
- 没有 review，不标记任务完成。
- 没有新鲜验证证据，不声明完成、通过、已修复或 ready。
- 没有 verify，不进入 PR。
- 有脏工作区、并行任务或高风险改动时，先考虑 `using-git-worktrees`。
- 只有用户明确批准 commit/PR/SDD 执行时，才使用 `subagent-driven-development` 的 per-task commit 流；否则用 `executing-plans` 或 inline execution。

### 对齐 Superpowers v6.0.3 的能力

- `subagent-driven-development` 使用 `.superpowers/sdd/` 保存 task brief、implementer report、review package 和 `progress.md`，避免把 scratch 写进 `.git/`。
- 每个任务使用一个 `task-reviewer-prompt.md` 同时返回 spec compliance 和 code quality verdict，减少重复 reviewer 上下文。
- `writing-plans` 强制 `Global Constraints` 和每任务 `Interfaces`，把跨任务约束、输入输出契约传给 implementer 和 reviewer。
- Brainstorming visual companion 使用带 `?key=` 的 per-session URL，HTTP/WebSocket 请求都需要 session key；默认 idle timeout 为 4 小时，可用 `--idle-timeout-minutes` 调整。

复杂任务包括新功能、架构调整、多文件行为变化、高风险实现，以及需求存在多种合理解释的工作。简单问答、翻译、格式调整、窄范围文档修正和无行为变化的小修复，可以直接处理，但完成前仍需运行与改动范围匹配的最小验证。

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
2. 复杂任务用 `brainstorming` 写 design spec 并让用户审核
3. 高风险或并行实现前，用 `using-git-worktrees` 隔离工作区
4. 用 `writing-plans` 写实施计划
5. 用 `executing-plans` 按计划执行
6. 使用 /tdd 委派 tdd-guide 规划测试先行实现
7. 关键路径使用 /e2e 委派 e2e-runner 维护 Playwright
8. 使用 /verify 验证
9. 使用 /code-review 委派 code-reviewer 审查
10. 使用 /learn-eval 将稳定模式沉淀到 skills/learn/<category>/
11. 使用 /projects 查看项目级学习来源
12. 使用 /promote --dry-run 评估是否推广为全局直觉
13. 使用 /evolve 评估是否演化
14. 使用 /prune 清理已人工标记删除的直觉
```
