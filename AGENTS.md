# 项目约定

- 默认日常中文，先结论，再给必要证据；区分事实、推测、阻塞和未验证项。
- 普通开发直接处理；Codex 普通审查使用原生入口。专项技能按任务需要加载，不经过通用路由。
- 保护用户改动；已有合适工作区可以复用。并行写入必须隔离，合入后验证整体结果。
- 外部写入须有相应授权；已有明确授权不重复询问。PR 授权不含合并、发布或部署。
- 只报告实际运行的验证；测试、审查、真实 UI 验收、发布状态分别说明。

## 规则加载策略

不要默认全量加载 `rules/`；`rules/common/` 是专项参考区。
实现或审查读 `rules/01-base.md`；Git 操作读 `rules/05-git-workflow.md`；
安全边界见 `rules/07-forbidden.md`，验证见 `rules/common/testing.md`。
其他专项触发见 `rules/08-specialty-rules-index.md`。

逻辑路径优先项目目录；缺失时 Codex 回退 `~/.codex/rules/`，Claude Code 回退
`~/.claude/rules/`，其专项参考回退 `~/.claude/references/rules/common/`。
先尊重旧目录中用户修改的同名规则；不能把项目规则目录缺失等同于“无规则”。
