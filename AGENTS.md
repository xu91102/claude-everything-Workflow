# 项目协作

默认用日常中文，先说结论，再补必要的原因、影响和下一步。同一事实只说一次，简单任务短答，复杂任务按需展开。术语和错误码要说明对用户的影响，有歧义时保留原文并解释。区分已确认、推测和阻塞，进展只报新发现、阻塞和关键决定。长输出给关键片段、原文入口和实际退出码，避免从截断日志判断成功。

工程交付（实现、修复、测试、审查）先进入 `using-superpowers`，由它选择当前步骤。普通问答直接回答。以用户约定的交付和验收为准，说明证据覆盖到哪一步。

## 规则加载策略

不要默认全量加载 `rules/`。`rules/common/` 是专项参考区。已加载的规则直接沿用，Skill 或任务指向具体规则时直接读取；需要查找专项时才读 `rules/08-specialty-rules-index.md`。

- 实现或审查前看 `rules/01-base.md`。处理架构、兼容、共享逻辑、错误、代码规模或注释时看 `rules/02-implementation.md`，代码与安全禁项见 `rules/07-forbidden.md`。
- 分支隔离、提交、推送和发布授权见 `rules/05-git-workflow.md`。复杂或高风险改动的验证见 `rules/09-first-principles-adversarial-testing.md`。

先查项目中的同名文件。不能把项目规则目录缺失等同于“无规则”，按当前宿主回退：

- Codex 在 `~/.codex/rules/` 下按原相对路径查找。
- Claude Code 先用 `~/.claude/rules/` 中的同名规则，包括升级时保留的个人修改。其余在 `~/.claude/references/rules/` 下按原相对路径查找。
