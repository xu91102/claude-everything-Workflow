# Claude Code Bootstrap

## 全局硬性规则

- 除专业术语外，所有内容使用**中文**回复。
- 即使加载的 skill、agent、command、hook 输出或示例是英文，也必须用中文向用户提问、解释和总结。

> 规则按需读取，不要默认全量加载 `rules/` 或 `rules/common/`。

## 规则加载策略

- 本文件只保留 Claude Code 启动所需的最小 bootstrap；完整规则索引以 [`AGENTS.md`](./AGENTS.md) 为准。
- 执行 `/init` 或首次接手本地项目时，必须按 [`AGENTS.md`](./AGENTS.md) 的项目初始化约束评估并准备对应语言的 LSP / 语言服务器。
- 默认不全量读取 `rules/`。涉及代码修改、审查、测试、提交或 Harness 调整时，只读取与当前任务直接相关的规则文件。
- 规则路径解析顺序：先检查当前项目根目录 `rules/`；若项目无 `rules/` 或目标规则文件不存在，必须回退到用户级规则目录：Codex 使用 `~/.codex/rules/`，Claude Code 使用 `~/.claude/rules/`。
- 当本文件由用户级配置注入到没有 `rules/` 的项目时，不能把项目规则目录缺失等同于“无规则”；必须继续检查对应的用户级规则目录。
- 回退只改变查找位置，不改变按需读取原则；仍然只读取当前任务直接相关的规则文件。
- `rules/common/` 是专项参考区；只有命令、agent、skill 或当前任务明确触发时才读取。
