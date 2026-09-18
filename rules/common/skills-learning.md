# Skills 与持续学习

## Skills 工作流

正式 skill 目录保持 `skills/<skill-name>/SKILL.md` 平铺结构；分类维护在 `skills/README.md`。Skill 创建和更新遵循本规则；开放生态中的 skill 查找和安装按用户明确请求使用宿主已有工具，安装前核对来源与所需权限。

- 目录名和 frontmatter `name` 使用小写 kebab-case；`description` 同时描述能力和触发场景。
- 正文只写模型不能可靠推导的流程、边界和验证；详细资料放一层 `references/`。
- 只有确定性、重复或高风险操作才增加 `scripts/`，新增脚本必须实际运行验证。
- 不增加独立 README、安装指南或变更日志；修改后运行 `npm run verify`。

## 按需学习

学习系统为可选安装，默认不安装或后台学习。先用 `/learn eval --preview` 评估；确认可复用后保存到 `skills/learn/<category>/`。观察、instinct 和 `observations.jsonl` 只是候选证据，最终可复用学习产物以该分类目录为准。

## 外部 Skill

先识别真实失败模式，再映射到现有 Rule、Skill、Agent、Command 或 Hook；优先吸收重复能力，不整段复制外部仓库。只有触发、退出、验证和复用价值稳定后才演化正式能力；涉及索引、发布或安装时同步验证脚本。
