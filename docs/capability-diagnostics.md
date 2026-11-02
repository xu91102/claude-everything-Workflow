# 实际能力诊断与加载采样

诊断沿用 `cew`，不修改个人文件，不修复或升级安装。它补充源码校验 `cew verify`，不替代真实任务验收。没有新增常驻规则、Hook 或技能路由。

## 只读检查安装

在当前源码目录执行，或把下面的 `node bin/claude-everything-workflow.js` 换成已安装的 `cew`：

```sh
node bin/claude-everything-workflow.js doctor --host codex
node bin/claude-everything-workflow.js doctor --host claude --json
node bin/claude-everything-workflow.js doctor --host codex --project /path/to/project --plugin-root /path/to/plugin --json
```

对照版本是运行命令所在的分发包或 checkout；不会联网推测“最新版”。报告记录该位置、包版本、正文与引用文件的 SHA-256 指纹。比较前仅统一 CRLF/LF 换行，不忽略其他正文差异。登记表相同也会独立比较每个技能正文。

默认检查两个宿主。`--host codex|claude` 限定宿主；`--home DIR` 使用 DIR 下的 `.codex` / `.claude`，便于隔离验证。未传 `--home` 时尊重 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`。`--project` 默认当前调用目录，不是 CLI 包的目录。

检查项目和用户级技能目录、Codex 的 `.agents/skills`，以及宿主 `plugins/cache` 中能确认包名的 CEW 插件。插件缓存扫描最多六层、4000 个目录，不递归跟随目录软链接；自定义目录、marketplace checkout 或其他宿主位置用可重复的 `--plugin-root` 显式指定。扫描错误会作为 finding 报告。扫描不是宿主完整配置解析；禁用和旧缓存也可能出现。

| 字段 | 含义 |
| --- | --- |
| `DISCOVERED` / `NOT_FOUND` | 磁盘上发现或未发现入口 |
| `MATCH` / `DIFFERENT` / `NO_REFERENCE` | 内容与对照版本一致、有差异，或个人引用在分发包中没有对照；不判断旧安装还是个人修改 |
| `STATIC_READY` | 入口及直接、具体的本地引用可读，仅为静态前置条件 |
| `BLOCKED` / `UNVERIFIED` | 引用缺失、不可读，或引用超出可确认范围 |
| `selection: UNVERIFIED` | 未证明宿主实际选择了该副本 |
| `DUPLICATE_CANDIDATES` | 同一宿主有多份物理副本；不等于确认重复加载 |

相同物理文件的软链接别名会去重。规则路径沿用 `AGENTS.md`：项目优先，再用户目录；Claude 专项规则先保留个人 `rules/common`，再回退 `references/rules/common`。插件包里的规则不自动充当用户规则回退。

引用检查覆盖正文中具体的 Markdown 链接、代码格式文件路径和路由代码块内的文件路径；合并对照正文与实际正文里的引用，避免旧安装漏掉新依赖。它包含条件分支的潜在直接引用，不递归推断整个执行图，不解析脚本依赖、自然语言里的动态路径、系统工具、账号、权限或生产环境。因此 `STATIC_READY` 不是“已执行通过”，也不能保证每个条件分支可运行。实际正文的相对引用会结合候选技能目录解析；存在但没有分发对照的个人文件报告为 `NO_REFERENCE` / `UNVERIFIED`。分发正文的引用仍独立核对，避免同名根目录文件掩盖技能内的缺失依赖。差异只报告，不覆盖。

退出码：`0` 无发现项，`1` 有差异、缺失或重复候选，`2` 参数或诊断本身出错。缺少一个宿主的安装也会报告；只使用一个宿主时传 `--host`。

## 五类加载基线

[harness/loading/cases.json](../harness/loading/cases.json) 保存普通问答、小修复、正式设计、执行验收、建立验收能力五类自然语言请求。它是采样用例，不是第二套路由表。没有改变自然语言触发或安全、审查、验证规则。

```sh
codex exec --json '你的自然语言任务' > /private/local/trace.jsonl
node bin/claude-everything-workflow.js loading --trace /private/local/trace.jsonl --case small-fix --json
```

实际操作应在相应的隔离项目运行第一条命令。额外的 `--root DIR` 将实际安装或项目里的规则、技能及参考文件加入比对，可重复使用；默认仅对照当前包。读取有个人修改的安装时传入其宿主根目录，才能匹配那份正文。

报告只从 Codex CLI 的 `item.completed / command_execution / aggregated_output` 中匹配完整正文，输出逻辑路径、候选物理路径、内容指纹、读取次数、累计及重复字符量。项目 `.agents/skills/`、`.claude/skills/` 统一为 `skills/` 逻辑路径，再应用用例的禁止读取前缀；`candidatePaths` 保留实际位置。它不从命令字符串或文件名出现推测“已读”。CRLF/LF 归一后匹配；一个完整正文在输出里出现两次，计为两次。相同内容的候选副本不重复计费，也不能由此判断宿主选择。

**观测边界：** 宿主自动注入、部分读取、加行号或其他变形输出、其他工具类型及上下文压缩不在统计内。这是完整文件工具输出的下界，不是完整会话上下文账单。`actualFileTokens` 留空，字符数除以四只是粗略估算；宿主 usage 单独记录整个 turn 的用量，不归因到某份文件，也不据此声称节省量。

`NO_VIOLATION_OBSERVED` 只表示没有观察到该用例禁止的完整正文；不是任务或安全验收通过。缺少 `turn.completed` 是 `INSUFFICIENT_EVIDENCE`。仍要按用例的 `review` 核对最终行为、必要规则和验证证据。实际总 Token 节省须后续在相同任务、宿主和模型条件下做对照实测。

退出码：`0` 未观察到禁止读取，`1` 观察到禁止读取或会话不完整，`2` 输入/格式错误。输入目前仅支持 Codex CLI JSONL，Claude 轨迹未适配。

## 可选的真实模型采样

```sh
node scripts/diagnostics/sample-loading.js --output docs/superpowers/evidence/loading-run-1
# 只运行一种
node scripts/diagnostics/sample-loading.js --output docs/superpowers/evidence/loading-run-2 --case small-fix
```

这会消耗当前 Codex CLI 账号的模型额度，默认顺序启动五个独立会话，沿用当前宿主配置和技能；不会被 `verify`、诊断、测试或 CI 自动调用。它创建本次所属的临时 Git 项目，保留轨迹、错误、结果和工作成果用于复核。每次调用最多三分钟，可用 `--timeout-ms 1000..180000` 下调；模型调用失败即停止，不自动循环重试。输出目录必须尚不存在，避免覆盖历史证据。

采样项目只包含 Node 标准库、一个公开函数及测试；执行验收用例有现成入口，建立验收用例没有。为使完整读取可观测，项目说明要求用不截断的 `cat` 读取材料，每次最多三份，但不要求加载任何额外文件。这是受控采样，不能代表所有真实项目或桌面 App。自动报告的行为审核初始为 `NOT_RUN`，复核后另行记录，不把模型自报完成当作通过。

原始轨迹可能包含用户上下文和路径，只保存在本地忽略目录；长期报告只保留必要统计和证据指纹，不提交原始会话。复核后只清理输出中列明的本次临时项目，按项目约定保留证据；不删除用户的安装或其他任务工作区。

首轮实测结果见[五类加载基线](loading-baseline-2026-11-02.md)，其中三类完整、两类超时；没有 Token 节省结论。
