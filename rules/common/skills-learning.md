# Skills 与持续学习

## Skills 工作流

正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构，以兼容 Claude Code、Codex 和安装脚本的发现方式；分类维护在 `skills/README.md`，不要把正式 skill 物理嵌套到分类目录下。

Skill 创建和更新遵循本规则；开放生态中的 skill 查找和安装由 `find-skills` 处理。

每个 skill 包含 **When to Use**、**How It Works** 和 **Examples**；**Codemaps** 可选。

创建或修改 skill 时：

- 目录名和 frontmatter `name` 使用小写 kebab-case；frontmatter 只保留发现和触发字段，`description` 同时说明能力与触发场景，触发条件不可只放正文。
- 正文用指令式表达，只写模型不能可靠推导的流程、边界和验证契约；详细参考拆到一层 `references/`，由 `SKILL.md` 说明何时读取。
- 只在确定性、重复性或高风险操作需要时增加 `scripts/`，新增脚本必须实际验证；不创建额外 README、安装指南或变更日志，正式索引统一在 `skills/README.md`。
- 修改后运行 `npm run verify`，确认 skill 目录、frontmatter、引用资源和安装包面均可发现。

### 路由权威来源

- 非平凡任务开始前读取 `skills/using-superpowers/SKILL.md`，不要因为多文件或普通复杂度加载完整 process skill 链。
- 全局门禁以 `rules/01-base.md` 为准；ticket/SDD 调度以 `rules/common/agent-orchestration.md` 和当前
  `SKILL.md` 为准。本文件不复制运行时路由、Spec Gate 或外部授权契约。
- 不凭记忆执行 skill；skill 可能已更新，必须读取当前 `SKILL.md`。
- 用户直接指令、`AGENTS.md`、`CLAUDE.md` 和项目规则优先于 skill；冲突影响结果时要说明。

## 按需学习

- 默认不后台学习，不持续采集大上下文。
- 解决非平凡问题后，优先使用 `/learn eval --preview` 评估是否值得保存。
- 确认模式可复用后，再运行 `/learn eval` 保存。
- 学习产物必须按分类保存到 `skills/learn/<category>/`，例如 `skills/learn/pr/xxx.md`；禁止直接平铺到 `skills/learn/` 根目录。
- `homunculus`、project instincts、global instincts 和 `observations.jsonl` 只作为观察、候选或迁移来源；最终可复用学习产物以 `skills/learn/<category>/` 为准。
- 后台观察或 observer 只在明确需要时开启。

## 外部 Skill 仓库学习

从外部 skill、agent 或 command 仓库学习时，先提炼模式，再决定是否落地：

1. 识别它修复的具体 agent 失败模式，例如需求未澄清、未复现就修复、测试铺太开、架构建议泛泛而谈。
2. 映射到本项目已有层次：`rules/` 放长期硬规则，`skills/` 放自动触发能力，`agents/` 放隔离委托，`commands/` 放用户主动入口，`hooks/` 放可验证的自动检查。
3. 优先保存为 `skills/learn/<category>/` 下的学习模式，验证确实高频、稳定、可组合后再演化为正式 skill、agent 或 command。
4. 不整段复制外部仓库内容；只保留触发条件、交付契约、验证闭环和本项目特定约束。
5. 涉及 README、命令入口、发布清单或安装脚本时，同步更新验证脚本，防止索引漂移。

评估问题：

- 是否有明确触发条件和退出条件？
- 是否能减少上下文噪音或工具误用？
- 是否有可运行的测试、脚本、审查清单或人工验收标准？
- 是否和现有规则重复，应该吸收而不是新增？
- 是否符合本项目中文交流和高风险操作确认规则？
