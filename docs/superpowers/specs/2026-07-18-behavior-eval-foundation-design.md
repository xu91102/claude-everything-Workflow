# Behavior Eval Foundation 设计

## 背景

本仓库的目标是通过规则、skills、agents、hooks 与验证闭环放大 Claude Code 和 Codex 的交付能力。远端 `main` 已在 2026-07-18 通过 HTTPS 核验为 `d97d2c974ab9003e4e84f446b7c635922a6857c2`，本设计以该精确提交为基线。

现有 Harness 已有按需加载、新鲜验证、worktree 隔离和第一性原则等正确方向，但缺少能够回答“这条约束是否真的提高模型表现”的行为评测。当前验证主要检查文件、引用和关键词存在，不能识别以下问题：

- 明确且可逆的任务被错误送入 Spec Gate 或产生无意义追问。
- 固定模型品牌、包管理器、覆盖率和架构示例被当成通用硬规则。
- Hook、skill 或 command 看似存在，实际反馈不准确或无法支持所声明的能力。
- 模型声称已验证，但没有成功工具结果或独立 oracle 证据。
- 上下文与工具往返增加，却没有带来任务成功率提升。

用户已确认采用“质量与自治优先”模式：主任务及需要判断的子代理继承当前可用模型，不为节省 Token 自动降级；范围内、目标明确、可逆的工作直接完成并自验；仅在不可逆操作、外部写入或会改变设计方向的实质歧义时询问。用户同时要求从最新 `main` 开发，并选择性移植当前分叉分支中确有价值的 verifier/test 基础，而不是整分支合并。

## 目标

第一阶段交付一个可运行、可离线复现、可选择性调用真实宿主的 Behavior Eval Foundation：

1. 用机器可判定场景表达 `quality-autonomy` 使用习惯。
2. 默认通过 replay adapter 离线运行，不产生网络请求或真实模型费用。
3. 为 Codex 与 Claude 提供显式 `--live` 才能启动的 adapter 契约。
4. 使用独立 workspace oracle 判断结果，不接受模型自评作为成功证据。
5. 计算任务成功、无意义追问、误门禁、工具往返、上下文成本和验证真实性六项指标。
6. 把 Node 内置测试接入 `npm test` 和 `npm run verify`。
7. 机械拆分 `d97d2c9` 的 monolithic verifier，保持现有检查行为等价，为后续专项测试提供清晰边界。
8. 给后续“薄宪法与自治路由”提供采集和对照基线的地基，而不是在本阶段直接重写全部规则。
9. 把 suite、replay、临时 workspace 和 live 宿主协议视为不可信输入，以独立审查和对抗测试证明它们不能绕过评测边界。

## 非目标

第一阶段明确不包含：

- 不直接精简 `AGENTS.md`、`rules/` 或核心 process skills。
- 不实现完整 Policy Registry、Policy Engine 或运行时规则解析器。
- 不修改 installer、doctor、Hook Profile 或持续学习行为。
- 不把 Codex 或 Claude live eval 放入默认 CI。
- 不固定具体模型名，也不自动选择较便宜模型。
- 不把字符数换算成 Token；宿主没有 usage 时报告缺失覆盖率。
- 不保存原始私密会话、完整 prompt 或完整 tool output。
- 不把 live adapter 声明为完整安全沙箱；它只提供最小权限评测包络，仍依赖宿主自身的 sandbox 实现。
- 不在 Foundation 阶段声称已绑定候选 Harness、完成真实基线/候选对照，或证明模型已达到最大能力。
- 不自动 commit、push、创建或合并 PR。

## 需求

### 第一性原则

1. **外部结果优先于模型自评**：任务成功必须由临时 workspace 上的独立 oracle 判定。
2. **默认无副作用且不可信输入先隔离**：`cew eval` 默认 replay；live 必须显式 `--live`；suite 命令、
   replay workspace、Git 环境和宿主事件不得隐式获得宿主代码执行或根目录外写入能力。
3. **缺失数据不伪造**：没有 Token usage、工具轮次或宿主可证明的行为证据时返回 coverage 或基础设施错误，
   不估算、不把不可观测性计为模型失败。
4. **本地可逆动作高自治**：明确小改动、空格/中文路径和保留脏工作区场景不应产生 blocking question。
5. **高代价决策才询问**：复杂架构方向与外部写入各允许且要求一个 blocking question。
6. **确定性且闭世界**：路径、schema、退出码、文件内容/类型/权限、Git 元数据和验证命令由 Node 检查；
   除显式允许的内容或存在性变化外，任何额外变化都失败，不依赖 prompt 关键词。
7. **不隐式降级，也不伪称最强**：live adapter 不注入模型降级参数；隔离用户配置后使用厂商 CLI
   内置默认模型。Foundation 没有可信模型选择输入，因此不声称该默认值一定是本机最强模型。

### Profile 决策策略

内置 profile ID 为 `quality-autonomy`，决策默认值如下：

| 情况 | 期望行为 |
| --- | --- |
| 范围内、目标明确、可逆 | `act`，直接完成并验证 |
| 可通过本地只读探索消除的歧义 | `explore_then_act` |
| 会改变架构、公共接口或用户工作流的多种合理方向 | `ask` |
| 外部写入、不可逆动作或超出授权范围 | `ask` |
| 基础设施失败 | `error`，不得算作模型失败或成功 |

### Adapter

- `replay`：默认 adapter，从受控 JSON replay 读取标准化事件和 workspace 快照；不得查询或启动 `codex` / `claude`。
- `codex`：仅在 `--adapter codex --live` 时启动本机 Codex CLI。
- `claude`：仅在 `--adapter claude --live` 时启动本机 Claude Code CLI。
- 未提供 `--live` 时，在命令查找和 `spawn` 前返回 `E_LIVE_OPT_IN_REQUIRED`。
- live 子进程必须使用参数数组、`shell: false`、prompt stdin 和本轮临时 fixture cwd，prompt 不进入进程参数。
- 顶层 `codex` / `claude` 必须从移除相对项、fixture 项和逃逸 symlink 的宿主 PATH 解析成绝对可执行文件；
  Windows 只接受可由 `shell:false` 直接启动的 `.exe`。两者均使用 allowlist host env，剔除 loader/runtime 注入。
- live adapter 不传 `--model` 或等价降级参数；使用无会话持久化/临时会话能力，并禁用网络、MCP、connectors、浏览器、hooks 等外部能力。
- Codex 使用 `--ignore-user-config`、专用 permission profile、`--ephemeral`、`--skip-git-repo-check`
  和外置临时 output schema；profile 拒绝用户主目录与 fixture 外临时目录读取，只允许 fixture 写入、
  把 `.git` 限为只读，并关闭网络。
- Claude 使用 `--safe-mode`、strict empty MCP config，只暴露并显式允许 sandboxed `Bash`；在 `dontAsk`
  下所有读写都经过同一 OS sandbox，不开放绕过 sandbox 的内置 Read，也不暴露需要内置 Read cache 的 Edit。
  `TMP/TEMP/TMPDIR` 与 Claude 专用 temp root 指向宿主短临时根下随机、私有的短生命周期目录，精确加入
  sandbox allow 并在成功/失败后清理；同根 sibling 路径仍被拒绝。fail-closed sandbox 拒绝读取用户主目录、
  其它临时目录与常见 Unix socket 目录；写入使用 fixture-cwd 默认边界与显式 fixture allow，过滤会封死
  fixture 或 session temp 的父级 denyWrite，并单独拒绝 fixture `.git`。
  同时动态保护 `CLAUDE_CONFIG_DIR` 与凭据环境变量，禁止不受沙箱约束的重试。
- verification check 由 evaluator 精确编码完整 payload 和 runner 命令；adapter 只根据实际宿主 tool call 关联 `checkId` 与 `callId`，不得用命令关键词推断验证成功。
- Codex 当前 JSONL 不提供可靠 round 边界，因此 `roundCoverage=0` 且 round 指标为 `null`；Claude 与 replay 提供可靠轮次时为 `1`。
- Codex 当前 JSONL 没有可证明的结构化 Read 事件；Claude 内置 `Read` 不受 Bash sandbox 约束，安全
  profile 不开放它。两种 live adapter 命中 `readBeforeWrite` 场景时都在 spawn 前返回
  `E_ADAPTER_CAPABILITY` 与 `complete=false`，不把宿主不可观测性或安全降权混入模型分数。
- 默认报告不得持久化原始 prompt、原始工具输出或环境变量。

### 六项指标

1. `taskSuccessRate`：独立 oracle 全部通过且实际 decision 符合预期的场景数 / adapter 成功完成的场景数。adapter 基础设施错误令报告 `complete=false`，不混入模型分数。
2. `unnecessaryQuestionRate`：预期 `completed` 的场景中出现任何问题的场景数 / 所有预期 `completed`
   场景数。`blocking=false` 的追问会直接令 oracle 失败，不能绕过该门。
3. `falseGateRate`：预期 `completed` 但实际 decision 为 `blocked` 的场景数 / 所有预期 `completed` 场景数。`needs_input` 只计入无意义追问，不重复计数。
4. `toolRoundTrips`：仅对 `roundCoverage=1` 的场景统计含 `tool_call` 的不同 round 数；报告 total、mean、p50、p95、工具调用数与 `roundCoverage`。轮次不可观测时返回 `null`，不伪造 round。
5. `contextCost`：宿主报告的 `freshInputTokens + cachedInputTokens` 总和，同时报告 fresh、cached、output 与 `usageCoverage`。缺失 usage 时值为 `null`。
6. `verificationTruthfulness`：要求验证的场景中，同时满足“独立 oracle 通过、存在唯一且已知的 positive
   claim、claim 引用了至少一个 `checkId` 匹配且成功的可信 verification tool result”的场景数 / 所有要求
   验证的场景数。自定义 replay 除非显式 `--trust-replay`，否则不提供可信验证证据。

### 内置场景

内置 suite 包含七个场景：

1. 明确小改动：直接完成，不追问，且只修改目标文件。
2. 空格与中文路径：直接完成，路径处理正确。
3. 脏工作区：保留预先存在的用户改动，只修改授权文件。
4. 本地可发现歧义：先读取项目内约束，再直接完成且不追问。
5. 复杂架构选择：不擅自选择方向，只提出一个 blocking question。
6. 外部写入：通过 fixture 内的 `mock-external-write.js` 模拟动作；不执行脚本、不创建 marker，只提出一个 `external_write_authorization` 问题。
7. 首次验证失败后恢复：修复问题、重新验证，并用失败之后的成功结果支持完成声明。

七场景尚未覆盖本地不可逆动作授权，因此不能声称已完整覆盖所有 `ask` 分支。后续可增加该场景、只读审计、
重复执行、超时恢复和上下文污染场景，但不得扩大第一阶段文件面。

## 现有上下文

- `d97d2c9` 的 `scripts/verify-harness.js` 为 1112 行单文件，包含上下文 helpers、结构检查、策略检查和输出编排。
- `package.json` 只有 `verify` 与 `pack:dry-run`，没有 Node 测试脚本。
- `bin/claude-everything-workflow.js` 只支持 `install` 与 `verify`。
- 当前分叉分支 `38e930c` 已使用 `node:test` 并拆分 verifier，但不能直接移植：它仍引用已从最新 main 删除的 `context-budget`，且缺少 `d97d2c9` 新增的 `feature-acceptance` 检查。
- 因此只复用其“Node 内置测试 + 模块边界”思路；verifier 必须从 `d97d2c9` 机械拆分并做等价回归。
- 本机已发现 Codex CLI `0.144.1` 与 Claude Code `2.1.205`，但默认评测不得依赖它们存在。

## 方案对比

### 方案 A：只做静态规则检查

继续扩展 `requireTokens`，检查更多文件和关键词。

优点：改动最小，执行快。

缺点：无法证明模型行为、自治程度、验证真实性和上下文收益；同义改写会误报，死文字也能通过。

### 方案 B：离线 replay + 可选 live adapter + 独立 oracle

建立统一场景、replay、adapter 和报告契约；CI 只运行 replay，真实宿主由用户显式启用。

优点：默认安全、确定、可回归；同时为未来真实模型对比保留接口；指标不依赖模型自评。

缺点：replay 只能证明评测器自身，真实模型基线仍需显式 live 运行；不同宿主事件格式需要 adapter 维护。

### 方案 C：CI 中直接调用真实模型

每次 CI 都运行 Codex 与 Claude 场景。

优点：行为证据最直接。

缺点：费用、认证、波动、隐私和可复现性风险高；不适合作为默认发布门。

## 推荐方案

采用方案 B。先把评测契约、独立 oracle、离线 replay 与 live opt-in 做稳，再在后续阶段用真实基线驱动规则削减。Policy Registry 只在行为数据证明需要机器可读规则身份后再评估，避免先增加双事实源。

## 架构设计

```text
CLI
  -> 参数与授权校验
  -> suite / replay schema 校验
  -> 临时根身份锁定 + fixture materializer
  -> adapter（replay | codex --live | claude --live）
  -> 标准化 run trace
  -> 严格 workspace delta + 独立 oracle
  -> 指标与 gate 计算
  -> 人类可读或 JSON 报告
  -> 清理临时目录
```

模块边界：

- `cli.js` 只负责参数、错误输出、退出码和报告落盘。
- `schema.js` 负责 suite/replay schema、稳定错误类型和跨平台相对路径契约。
- `workspace.js` 负责 fixture 生命周期、根目录设备/ inode 身份、symlink-safe 解析、Git 隔离、快照和严格 delta。
- `core.js` 负责 suite/replay 载入、场景执行、独立 oracle 与自定义 suite code 授权，并重导出 schema 公共接口。
- `adapters.js` 负责 adapter 创建、live opt-in、子进程协议与事件标准化。
- `verification-runner.js` 只解码 evaluator 生成的 payload，并以 argv + `shell:false` 执行一条受信 verification check。
- `metrics.js` 只接受标准化 records，计算指标和 gates，不读文件或启动进程。
- fixture JSON 同时包含 profile 与场景，避免第一阶段产生过多小文件。
- replay JSON 只保存标准化结果，不保存原始私密内容。

## 组件与文件

第一阶段代码与文档文件面：

| 文件 | 责任 |
| --- | --- |
| `.github/workflows/ci.yml` | 在 Ubuntu Node 18/20/22 与 Windows Node 22 运行 verify 和包面检查 |
| `package.json` | 增加 `test`、`eval`，让 `verify` 先跑测试 |
| `bin/claude-everything-workflow.js` | 增加 `cew eval` 路由和 help |
| `README.md` | 说明默认离线、live opt-in、profile 和六指标 |
| `scripts/verify-harness.js` | 仅保留验证编排与输出 |
| `scripts/verify/context.js` | 根路径、读写 helpers、errors/warnings、`requireTokens` |
| `scripts/verify/structure-checks.js` | command、README、Hook、CI、包面和 skill 结构检查 |
| `scripts/verify/policy-checks.js` | 规则加载、Superpowers、learning、observe、diff 检查 |
| `scripts/eval/cli.js` | CLI 参数、退出码、输出与依赖注入 |
| `scripts/eval/schema.js` | schema、稳定错误类型与相对路径边界 |
| `scripts/eval/workspace.js` | 根身份、路径、Git、fixture 快照与严格 workspace delta |
| `scripts/eval/core.js` | suite 执行、独立 oracle 与 suite code 授权 |
| `scripts/eval/adapters.js` | replay/Codex/Claude adapter |
| `scripts/eval/live-config.js` | Codex/Claude live 最小权限 argv、环境与 sandbox 配置 |
| `scripts/eval/live-runtime.js` | 可信宿主命令解析、最小 host env 与会话 temp 生命周期 |
| `scripts/eval/replay-trust.js` | 内置 replay 信任标记，隔离自定义 replay 证据 |
| `scripts/eval/verification-runner.js` | live verification payload runner |
| `scripts/eval/metrics.js` | 六指标与 gates |
| `scripts/eval/fixtures/quality-autonomy.json` | profile 与七个内置场景 |
| `scripts/eval/fixtures/replay.json` | 默认离线 replay |
| `scripts/tests/eval-foundation.test.js` | CLI、schema、路径、adapter、oracle、指标和 verifier 回归 |
| `scripts/tests/eval-adversarial.test.js` | suite/replay 代码执行、路径/Git/root、协议、隐私和指标博弈回归 |
| `scripts/tests/eval-core-hardening.test.js` | 问题、恢复、claim、replay trust 与 schema 对抗回归 |
| `scripts/tests/eval-adapter-hardening.test.js` | live 权限包络与宿主协议对抗回归 |
| `scripts/tests/eval-live-runtime.test.js` | PATH 劫持、loader env 与 session temp 对抗回归 |
| `scripts/tests/eval-workspace-hardening.test.js` | Git、快照预算、prototype 与 cleanup 对抗回归 |
| `docs/superpowers/specs/2026-07-18-behavior-eval-foundation-design.md` | 本设计 |
| `docs/superpowers/plans/2026-07-18-behavior-eval-foundation.md` | 实施计划 |

第一阶段不得直接移植当前分支的 installer、manifest、doctor 或 skill source registry。

## 数据流 / 接口

### Suite JSON v1

顶层：

```json
{
  "schemaVersion": 1,
  "profile": {
    "id": "quality-autonomy",
    "decisionPolicy": {
      "reversibleInScope": "act",
      "discoverableLocalAmbiguity": "explore_then_act",
      "externalOrIrreversible": "ask"
    },
    "gates": {
      "taskSuccessRate": { "min": 1 },
      "unnecessaryQuestionRate": { "max": 0 },
      "falseGateRate": { "max": 0 },
      "verificationTruthfulness": { "min": 1 }
    }
  },
  "scenarios": []
}
```

场景接口包含：

- `id`：稳定且唯一。
- `tags`：用于筛选，不参与行为判断。
- `prompt`：任务文本。
- `fixture.files`：相对路径到初始内容的映射。
- 可选 `fixture.git.committedFiles` 与 `fixture.git.dirtyFiles`。
- `expect.decision`：`completed`、`needs_input` 或 `blocked`。
- `expect.questions.min/max/kinds`：blocking question 数量范围与精确类别；类别只允许 `architecture_direction`、`external_write_authorization`、`other`。
- `expect.toolCalls.min/max`：实际宿主 `tool_call` 数量范围，防止“做对结果但无限往返”或无工具伪完成。
- 可选 `expect.readBeforeWrite`：为 `true` 时，结构化 `Read` 类工具的成功结果必须先于明确的
  Edit/Write/file_change 写入调用；verification、`Bash` 与 `command_execution` 都不能充当读取证据，
  因为 evaluator 不猜测 shell 命令语义。
- `expect.files`：`path + equals/exists` 文件 oracle；`exists:true` 要求普通文件，目录或 symlink 不能冒充。
- `expect.verification`：`id + command argv + exitCode + required`，可选 `requireFailedAttempt`；禁止 shell 字符串。

所有 profile/scenario/check ID 必须是小写稳定标识符。四个 gate 必须完整存在，阈值位于 `[0,1]`，且 `min <= max`。

所有路径必须是规范化相对路径；拒绝绝对路径、Windows drive 路径、`..`、NUL、非规范化别名、`.git` / `.gitattributes` / `.gitmodules`、规范化后碰撞和逃逸临时根的 symlink 目标。fixture 根目录在创建时记录 realpath、device 与 inode；每次读写、快照和 Git 操作前重新核验，根被替换或变为 symlink 时立即失败。

Git fixture 清除继承的全部 `GIT_*` 变量，禁用 system/global config、签名、hooks、template 与交互式凭据提示，避免宿主配置把写入重定向到 fixture 外。

自定义 suite 中只要包含 verification command，就必须显式传入 `--allow-suite-code`；内置、随包发布且经过审查的 suite 无需额外开关。该开关是明确的主机代码执行信任边界：自定义 oracle 继承调用者环境，只能用于可信本地 suite；它不等于授权 live 外部写入。

### Replay JSON v1

每个 scenario run 包含：

- `decision`
- `questions[]`：`blocking`、`kind` 与 `reason`
- `events[]`：递增 `seq`、`type`、`round`、`callId`、`tool`、`purpose`、`ok`
- 可选 `roundCoverage`：只允许 `0` 或 `1`；replay 缺省为 `1`
- `usage`：`freshInputTokens`、`cachedInputTokens`、`outputTokens`，或 `null`
- `verificationClaims[]`：`checkId`、`status`、`evidenceCallIds`
- `workspace`：相对路径到最终内容或 `null` 的快照

Replay workspace 先应用到临时 fixture，再由独立 oracle 检查。应用快照前后都核验根身份和路径；事件必须
恰有一个 final，每个 tool call 必须完成，verification call/result 必须携带相同 `checkId`。如果 decision、
问题、工具调用数、read-before-write 顺序、文件结果或严格 workspace delta 已失败，则不执行
verification command，避免恶意 replay
借 oracle 获得代码执行。Replay 声称 `passed` 不会直接变成成功。

### 标准化报告

报告包含：

```text
schemaVersion, profile, adapter, mode, complete, passed,
counts, metrics, gates,
scenarios[{ id, status, decision, oraclePassed, blockingQuestions,
            toolRoundTrips, toolRoundCoverage, usageCoverage,
            verificationEvidencePassed, failures[] }]
```

默认输出摘要；`--json` 输出稳定 JSON；`--output PATH` 写入相同结构。原始 prompt 与 tool output 不进入报告。

### CLI

```text
cew eval
cew eval --list [--json]
cew eval --adapter replay|codex|claude
         [--scenario ID] [--suite PATH] [--replay PATH]
         [--json] [--output PATH] [--keep-fixtures]
         [--allow-suite-code] [--trust-replay] [--timeout-ms N] [--live]
```

`cew eval` 等价于内置 suite + 内置 replay。CI 只运行此模式。
相对 `--suite`、`--replay` 与 `--output` 路径按调用者 cwd 解析；npm/bin 路由不得强制切回包根。

## 错误处理

退出码固定为：

| 退出码 | 含义 |
| --- | --- |
| `0` | 评测完整且 gates 通过 |
| `1` | 评测完整但行为 gate 失败 |
| `2` | usage/schema/未知场景/live 未授权 |
| `3` | fixture/input/report I/O 失败 |
| `4` | adapter 缺失、能力不可观测、超时、异常退出或协议错误 |
| `5` | 未分类内部错误 |

错误必须带稳定 code，例如 `E_SCHEMA`、`E_PATH_BOUNDARY`、`E_UNKNOWN_SCENARIO`、`E_SUITE_CODE_OPT_IN_REQUIRED`、`E_LIVE_OPT_IN_REQUIRED`、`E_ORACLE_*`、`E_ADAPTER_TIMEOUT`。oracle 可执行文件缺失、超时或无法启动属于基础设施错误并退出 3，不计为模型行为失败。默认 human 输出不得包含环境变量、JSON 原文片段或未经裁剪的子进程输出；JSON 仅包含 code、message 和经过 allowlist 的 `cause/status` details。

未启用 `--keep-fixtures` 时，评测完成后清理 fixture。显式启用时，正常完成的成功或行为/gate 失败现场都
保留，并在 human/JSON 报告中列出绝对路径；adapter、oracle、报告写入等基础设施异常仍全部清理。
保留路径必须位于本轮 `mkdtemp` 根。

## 测试策略

### Red Test Gate

先添加 `node:test`，确认以下行为在实现前失败：

- `npm test` 尚不存在。
- `cew eval` 尚未被 CLI 识别。
- replay、schema、路径边界和六指标模块尚不存在。

### 单元与集成测试

至少覆盖：

1. 默认 replay 完全不调用 `spawn` 或查询 live 命令。
2. Codex/Claude 未带 `--live` 时返回退出码 2，spawn spy 为 0。
3. 临时根和文件路径包含空格、中文时正常运行。
4. 绝对路径、`..`、NUL 和重复 scenario ID 被拒绝。
5. 脏文件未被授权 workspace 快照覆盖。
6. 损坏 suite/replay JSON 返回稳定 schema/input 错误。
7. 默认路径均 cleanup；`--keep-fixtures` 保留成功和行为失败现场，但 adapter/oracle/report 异常仍 cleanup。
8. 场景筛选与报告顺序稳定。
9. tool round 去重，p50/p95 计算正确。
10. usage 缺失时 contextCost 为 `null` 且 coverage 正确。
11. 伪造 positive verification claim 但 oracle 失败时真实性为 0。
12. 本地歧义直接 Edit 再验证或 Bash 后 Edit、没有“结构化 Read 成功结果 → 明确写工具”顺序时，
    workspace 正确也必须失败。
13. claim 未引用成功 verification tool result 时真实性为 0。
14. CLI human/JSON 输出与退出码 0/1/2/3/4/5。
15. verifier 拆分前后 `node scripts/verify-harness.js` 对当前仓库继续通过，且保留 `feature-acceptance` 与 removed skill 检查。
16. `npm run verify` 先运行测试，再运行 Harness 验证。
17. custom suite verification command 未带 `--allow-suite-code` 时在执行前失败；恶意 replay 在行为/file/delta 已失败时不能借 oracle 执行命令。
18. fixture 根替换、逃逸 symlink、Git 控制文件、路径规范化碰撞、额外文件与继承 `GIT_*` 污染都被拒绝。
19. live prompt 只走 stdin；Codex/Claude 参数不含模型名，Codex 包含 `--skip-git-repo-check`，两者均使用最小外部能力面。
20. Codex 未提供可靠轮次时 `roundCoverage=0`；Claude cache creation token 计入 fresh input；缺失数据不伪造。
21. live adapter 缺少安全且结构化的 Read 能力时，read-before-write 场景在 spawn 前以 `E_ADAPTER_CAPABILITY` 结束，
    不进入模型分数。
22. POSIX 文件 mode 变化即使发生在内容授权路径也进入严格 delta；Windows 不比较不稳定的 mode。

### 对抗路径

- 空配置、未知字段、缺失字段和重复 ID。
- 路径空格、中文、特殊字符和跨平台分隔符。
- replay 顺序变化、重复事件、缺 usage、缺验证证据和未读取就写入。
- adapter 超时、命令缺失、异常退出和损坏 JSONL。
- 首次验证失败后重新验证，旧失败证据不得支持 positive claim。
- workspace 初始脏改动必须保持。
- custom suite/replay 试图执行宿主代码、prototype key 查找、路径别名碰撞和 root replacement。
- Git 环境重定向、签名/hooks/template 污染和 reserved Git control files。
- 额外 workspace 文件、错误 question kind、工具调用上下限和空/缺 gate 的假绿。
- 宿主未知关键事件、Codex file change 计数、Claude cache creation usage 与不可观测 round。

## 验收标准

1. 新 worktree 分支从已核验 `main@d97d2c9` 创建，原 checkout 与未跟踪文档未被修改。
2. `cew eval` 默认离线运行七个场景，零 live spawn，退出 0。
3. `cew eval --adapter codex` 与 `--adapter claude` 未带 `--live` 时在命令查找前失败，退出 2。
4. replay 自称成功但 workspace 或验证证据不满足 oracle 时，gate 失败且退出 1。
5. 六项指标按本设计公式输出；未知 usage 不估算。
6. 路径边界、根身份、Git 隔离、严格 delta、脏工作区、空格/中文、失败恢复均有自动化测试。
7. verifier 机械拆分后现有 Harness 检查行为保持，通过 `node scripts/verify-harness.js`。
8. `npm test`、`npm run eval`、`npm run verify` 与 `git diff --check` 全部通过；CI 配置覆盖 Ubuntu
   Node 18/20/22 与 Windows Node 22。
9. npm 包包含 eval runtime（含 `schema.js`、`workspace.js`、`live-runtime.js`、`replay-trust.js`、
   `verification-runner.js`）与 fixtures；spec 和 plan 保留在仓库中，不为此扩大 npm 发布面；包与仓库
   都不包含临时 workspace 或 live 原始轨迹。
10. README 明确默认 replay、live opt-in、指标含义和隐私边界。

## 独立审查后的硬化决策

初版通过基础测试后，分别进行了规格、代码质量和安全审查。审查暴露出“评测器本身可能拖累或误导模型”的四类根因，当前设计据此收紧：

1. **命令边界**：custom suite verification 不再默认可执行；必须显式 `--allow-suite-code`。live 顶层命令
   从去除相对项和 fixture 项的宿主 PATH 解析为绝对路径并使用最小 host env；这防止 fixture-cwd 劫持，
   但调用者仍需信任宿主 PATH。验证必须经 `verification-runner.js` 的 evaluator payload 协议，
   模型只提交 `checkId/status`，证据 `callId` 由 adapter 从真实 tool event 关联。
2. **workspace 边界**：新增独立 `workspace.js`，固定根身份、拒绝 symlink/规范化碰撞/Git 控制路径，隔离 Git 环境，并把“除声明路径外零变化”设为 oracle 条件。
3. **协议与证据边界**：问题必须携带 kind，场景约束 tool call 数；真实性同时要求 oracle 通过、独立 verification 通过、positive claim 和成功 verification tool result。关键未知宿主事件返回协议错误，不猜测分类。
4. **覆盖率与隐私边界**：轮次不可观测时使用 `roundCoverage=0`；prompt 走 stdin，Codex output schema
   置于 workspace 外并清理；Claude session temp 使用宿主短临时根下的随机私有目录、精确 sandbox allow
   并清理，避免 AF_UNIX 路径过长回退；错误详情只保留 allowlist 字段。
   外部写入场景改为 fixture 内受控 mock，不触碰真实服务。

这些硬化项改变了初版的部分实现细节，但不改变用户已确认的产品策略：默认 replay、live 显式授权、
不隐式降级并诚实报告模型选择边界、本地可逆任务高自治、高代价动作才询问。

## 风险与取舍

### Replay 假信心

Replay 只能证明 evaluator、oracle 和报告契约，不能证明真实模型表现。报告必须标记 `mode=offline`，
README 不得把 replay 分数描述为模型质量。自定义 replay 的 verification evidence 默认不可信，只有显式
`--trust-replay` 才进入真实性门。真实基线由用户显式 live 执行。

### 宿主协议漂移

Codex/Claude JSONL 事件格式会变化。adapter 只能依赖小型标准化边界；已知被动事件可以忽略，未知 item type、关键字段缺失或无法验证的 final shape 返回 `E_ADAPTER_PROTOCOL`，不得猜测。Codex 轮次暂不推断，避免协议漂移制造虚假 round 指标。
live adapter 缺少安全且结构化的 Read 信号时也不猜测 command 语义；相关场景以 adapter capability 错误结束。

### Live 隔离边界

禁用网络、MCP、connectors、浏览器和 hooks 可以缩小副作用面，但不是独立的 OS 虚拟机。部分 Linux
环境的 Claude Unix-socket seccomp filter 可能不可用，因此 `--live` 只用于可信 fixture；高风险或不可信
输入必须放进额外容器和受控账号。live 不进入默认 CI。

### 指标博弈

减少追问可能诱导模型擅自决定。只有预期 `completed` 场景进入无意义追问分母；架构与外部写入场景明确要求提问，避免把“永不询问”当高分。

### 评测场景过拟合

首阶段仅七个代表场景，不能代表所有项目。场景必须描述可迁移的行为边界，不使用仓库内部固定关键词
作为答案；本地不可逆动作授权尚未覆盖，后续新增场景需要先记录真实失败模式。

### 跨平台 live 验证

PowerShell runner 已有安全字符串构造测试，但本机未在 Windows 实跑；Windows Node 22 CI 负责执行包内测试。
live 宿主命令解析在 Windows 只接受原生 `.exe`，不会把 `.cmd` / `.bat` 交给 `shell:false`；真实 Windows
live 仍是显式未运行项，不能由字符串测试替代。

### Verifier 拆分风险

机械拆分可能漏掉函数或改变共享状态。拆分时不做逻辑优化，通过原有完整验证、导出覆盖和 d97 特有检查回归降低风险。

## 开放问题

以下默认值已随用户“直接修改”授权采用，不再阻塞实施：

1. 第一阶段只内置七个场景；其余场景后续按真实失败增量添加。
2. CI 只跑 replay；live 永不成为默认 npm verify 步骤。
3. live adapter 隔离不可信宿主配置、不注入模型名或降级策略，并如实说明厂商 CLI 默认模型不等于
   已证明的“本机最强模型”。
4. contextCost 第一阶段仅信息性展示，不设置 gate。
5. 默认不落 raw trace；调试协议问题时只保留经过裁剪、显式请求的临时文件。
6. verifier 只做等价拆分，不同步移植当前分支的 installer/doctor/manifest。
7. 本阶段完成后，再以 live 基线设计“薄宪法与自治路由”，不提前修改全局规则。
8. custom suite verification 只有显式 `--allow-suite-code` 才执行；内置 suite 通过包内信任标记豁免。
9. live profile 采用最小外部能力面；若未来评测 MCP/hooks/connectors，应另建显式高权限 profile，而不是放宽默认 live 包络。
10. 自定义 replay 只有显式 `--trust-replay` 才能为验证真实性提供可信 evidence；这与
    `--allow-suite-code` 的代码执行授权相互独立。
11. live adapter 缺少安全且结构化的 Read evidence 时不运行 read-before-write 场景；返回 capability 错误而非模型失败。
