# Workflow Install And Learning Path Design

## 背景

当前 Workflow 已有 Superpowers 风格开发闭环、安装脚本、rules、commands、agents、skills 和 hooks。`node scripts/verify-harness.js` 可以通过，但只覆盖了部分显性一致性。只读审计发现仍存在流程层风险：README 目录树与实际文件漂移、Claude/Codex 安装口径容易误解、学习产物路径与 Continuous Learning v2 叙述存在分裂、安装后真实形态缺少验证。

本设计用于收敛这些流程问题，后续实现只修改 Harness/流程配置层，不改业务代码。

## 目标

1. 明确 Claude 与 Codex 的安装能力对等边界。
2. 统一学习产物权威路径为 `skills/learn/<category>/`。
3. 修正 README、commands、rules 和验证脚本之间的流程口径。
4. 补强 `scripts/verify-harness.js`，让它能发现文档、安装脚本、hook 配置和学习路径漂移。
5. 保持现有安装方式和 Superpowers 门禁兼容，避免引入高成本默认行为。

## 非目标

1. 不把 Claude Code 的 `settings.json` 作为 Codex 的 active config 安装到 `~/.codex`。
2. 不实现 Codex 原生 hooks 或 automation adapter。
3. 不配置外部 MCP，也不修改用户已有 MCP 配置。
4. 不处理当前工作区未跟踪的 `.claude/` 目录，除非后续任务明确要求。
5. 不改 agents、skills、commands 的职责模型，只修正流程一致性和验证覆盖。

## 运行时分层设计

Claude 与 Codex 的“对等”定义为：两边都获得同一套可读、可复用的 Workflow 材料；自动 hook 接入按运行时实际支持能力分层。

共享安装内容：

- `AGENTS.md`
- `rules/`
- `agents/`
- `commands/`
- `scripts/`
- `hooks/`
- `skills/`
- `homunculus/`
- `references/`

Claude Code 额外安装：

- `CLAUDE.md`
- 合并后的 `settings.json`
- `settings.json` 中 hook 命令路径转换到目标 `~/.claude/...`

Codex 安装策略：

- 不默认安装 Claude Code `settings.json`。
- README 明确 Codex 当前安装共享 Workflow 材料；Claude Code hooks 不会因为复制本仓文件而在 Codex 中自动触发。
- 如果未来 Codex 提供原生 hooks 或 automation 配置，应新增明确 adapter，而不是复用 Claude Code `settings.json`。

## 学习路径设计

`skills/learn/<category>/` 是学习产物的权威保存路径。

规则：

- 全局学习模式保存到用户级 `skills/learn/<category>/`。
- 项目学习模式保存到项目级 `.claude/skills/learn/<category>/` 或后续等价的项目配置目录。
- 禁止直接把学习产物平铺到 `skills/learn/` 根目录。
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 是观察、候选和迁移来源，不是最终学习产物的权威路径。
- 经人工确认或命令质量门通过后，稳定模式沉淀到 `skills/learn/<category>/`。
- 只有高频、稳定、可组合的模式才进一步演化为正式 `skills/`、`commands/` 或 `agents/`。

仓库应保留基础分类目录，至少包括：

- `skills/learn/pr/`
- `skills/learn/testing/`
- `skills/learn/debugging/`

空目录可用 `.gitkeep` 保留。

## 文档一致性设计

README 需要明确以下口径：

- Claude Code 与 Codex 的安装目标和运行时差异。
- `settings.json` 是 Claude Code hook 入口，不是 Codex active config。
- Codex 与 Claude 共享 rules、skills、commands、agents、hooks 脚本材料，但 hooks 自动触发取决于运行时。
- Continuous Learning v2 的观察数据可以作为候选来源，学习产物最终以 `skills/learn/<category>/` 为准。
- README 目录树只列出仓库真实存在的文件和目录。

commands 与 rules 需要保持同一口径：

- `/learn-eval` 继续以 `skills/learn/<category>/` 为保存目标。
- `/evolve` 读取 `skills/learn/<category>/` 以及必要的候选来源，但不能把候选来源描述为最终学习产物路径。
- `rules/common/skills-learning.md` 明确 `skills/learn/<category>/` 是沉淀路径。

## 验证脚本设计

`scripts/verify-harness.js` 增加以下检查。

### README 目录树检查

- README 中列出的关键文件或目录必须存在。
- 对可选或示意路径应使用明确文字说明，不放进“当前目录结构”树。
- 当前应能发现 `hooks/README.md` 这类不存在条目。

### 安装脚本一致性检查

- PowerShell 与 Bash 的共享目录安装列表必须一致。
- Claude 安装路径必须处理 `CLAUDE.md` 和 `settings.json`。
- Codex 安装路径必须安装 `AGENTS.md` 和共享目录。
- Codex 安装路径不得默认复制 Claude Code `settings.json`，除非未来有明确 Codex adapter。
- README 必须说明 Codex 不会自动启用 Claude Code hooks。

### Hook 配置检查

- `settings.json` 中引用的 hook 脚本必须存在于仓库。
- `settings.json` 的默认命令只应指向 Claude Code 的 `~/.claude/...` 模板路径，安装到 Windows 时由 PowerShell 脚本转换为绝对路径。
- 验证脚本不要求 Codex 消费 `settings.json`。

### 学习路径检查

- `skills/learn/` 必须存在。
- `skills/learn/` 下应至少存在 `pr`、`testing`、`debugging` 分类目录。
- 除占位文件和分类说明外，学习产物不得直接放在 `skills/learn/` 根目录。
- README、commands 和 rules 不能把 `homunculus` instincts 描述为最终学习产物权威路径。

### Superpowers 门禁检查

- 保持现有 Spec Gate、User Review Gate、Plan Gate、Red Test Gate、Task Review Gate、Verify Gate、PR Gate 检查。
- 可追加检查 spec/plan 默认目录文案，但不强制仓库必须已有业务 spec 或 plan。

## 实施影响面

预计涉及文件：

- `README.md`
- `commands/evolve.md`
- `commands/learn-eval.md`
- `rules/common/skills-learning.md`
- `scripts/verify-harness.js`
- `scripts/install.ps1`
- `scripts/install.sh`
- `skills/learn/pr/.gitkeep`
- `skills/learn/testing/.gitkeep`
- `skills/learn/debugging/.gitkeep`

如果实际实现发现某个文件无需改动，应在实施计划中删去对应任务。

## 验证方式

实施完成后至少运行：

```powershell
node scripts\verify-harness.js
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun
bash scripts/install.sh --dry-run
git diff --check
```

人工核对：

- README 的安装目标、Hook Profile、Continuous Learning v2、使用流程四段口径一致。
- Codex 文档没有暗示 Claude Code hooks 会自动触发。
- 学习路径统一指向 `skills/learn/<category>/`。

## 风险与缓解

风险：过度追求安装形态一致，导致 Codex 被描述成支持 Claude Code hooks。

缓解：把对等定义限制为共享 Workflow 材料；自动 hook 接入按运行时能力分层。

风险：学习路径从 `homunculus` 叙述收敛到 `skills/learn/<category>/` 后，旧观察数据来源被误删。

缓解：明确 `homunculus` 和 instincts 是候选来源与迁移来源，不是最终沉淀路径。

风险：验证脚本过度解析 README，导致文案微调频繁误报。

缓解：只检查关键路径、关键口径和安装脚本结构，不做完整 Markdown AST 严格校验。

## 成功标准

- Claude/Codex 安装策略在 README 和脚本中语义一致。
- Codex 不再被描述为自动消费 Claude Code `settings.json`。
- 学习产物路径统一为 `skills/learn/<category>/`。
- `verify-harness.js` 能捕获当前发现的流程漂移类别。
- 所有验证命令通过，未跟踪 `.claude/` 不被纳入本次改动。
