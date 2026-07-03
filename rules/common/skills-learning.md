# Skills 与持续学习

## Skills 工作流

正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构，以兼容 Claude Code、Codex 和安装脚本的发现方式；分类维护在 `skills/README.md`，不要把正式 skill 物理嵌套到分类目录下。

每个 skill 应包含：

- **When to Use**：何时使用。
- **How It Works**：工作原理。
- **Examples**：实际示例。
- **Codemaps**：代码库导航地图，可选。

保持 skill 精简；详细参考内容应拆到 references，并按需读取。

### Superpowers 路由纪律

- 非平凡任务开始前，先用 `skills/using-superpowers/SKILL.md` 判断应加载的 process skill。
- process skill 优先于 implementation skill：先决定工作方法，再做代码、文档、测试或 PR 动作。
- 不凭记忆执行 skill；skill 可能已更新，必须读取当前 `SKILL.md`。
- 用户直接指令、`AGENTS.md`、`CLAUDE.md` 和项目规则优先于 skill；冲突影响结果时要说明。

## 按需学习

- 默认不后台学习，不持续采集大上下文。
- 解决非平凡问题后，优先使用 `/learn-eval --preview` 评估是否值得保存。
- 确认模式可复用后，再运行 `/learn-eval` 保存。
- 学习产物必须按分类保存到 `skills/learn/<category>/`，例如 `skills/learn/pr/xxx.md`；禁止直接平铺到 `skills/learn/` 根目录。
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 只作为观察、候选或迁移来源；最终可复用学习产物以 `skills/learn/<category>/` 为准。
- 后台观察或 observer 只在明确需要时开启。

## 外部 Skill 仓库学习

从外部 skill、agent 或 command 仓库学习时，先提炼模式，再决定是否落地：

1. 识别它修复的具体 agent 失败模式，例如需求未澄清、未复现就修复、测试铺太开、架构建议泛泛而谈。
2. 映射到本项目已有层次：`rules/` 放长期硬规则，`skills/` 放自动触发能力，`agents/` 放隔离委托，`commands/` 放用户主动入口，`hooks/` 放可验证的自动检查。
3. 优先保存为 `skills/learn/<category>/` 下的学习模式，验证确实高频、稳定、可组合后再演化为正式 skill、agent 或 command。
4. 不整段复制外部仓库内容；只保留触发条件、执行步骤、验证闭环和本项目特定约束。
5. 涉及 README、命令入口、发布清单或安装脚本时，同步更新验证脚本，防止索引漂移。

评估问题：

- 是否有明确触发条件和退出条件？
- 是否能减少上下文噪音或工具误用？
- 是否有可运行的测试、脚本、审查清单或人工验收标准？
- 是否和现有规则重复，应该吸收而不是新增？
- 是否符合本项目中文交流和高风险操作确认规则？
