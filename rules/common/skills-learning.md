# Skills 与持续学习

## Skills 工作流

正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构；分类维护在 `skills/README.md`。Skill 创建和更新遵循本规则；开放生态中的 skill 查找和安装由 `find-skills` 处理。

- 目录名和 frontmatter `name` 使用小写 kebab-case；`description` 同时描述能力和触发场景。
- 正文只写模型不能可靠推导的流程、边界和验证；详细资料放一层 `references/`。
- 只有确定性、重复或高风险操作才增加 `scripts/`，新增脚本必须实际运行验证。
- 不增加独立 README、安装指南或变更日志；修改后运行 `npm run verify`。

## 路由权威来源

- 非平凡任务读取 `skills/using-superpowers/SKILL.md`；不要因为多文件或普通复杂度加载完整 process skill 链。
- 全局门禁以 `rules/01-base.md` 为准；ticket/SDD 以 `rules/common/agent-orchestration.md` 和当前 Skill 为准。
- 不凭记忆执行 skill；用户指令、AGENTS/CLAUDE 和项目 Rules 优先。

## 按需学习

默认不后台学习。先用 `/learn eval --preview` 评估；确认可复用后保存到 `skills/learn/<category>/`。观察、instinct 和 `observations.jsonl` 只是候选证据，最终可复用学习产物以该分类目录为准。

## 外部 Skill

先识别真实失败模式，再映射到现有 Rule、Skill、Agent、Command 或 Hook；优先吸收重复能力，不整段复制外部仓库。只有触发、退出、验证和复用价值稳定后才演化正式能力；涉及索引、发布或安装时同步验证脚本。
