# Git 与 worktree 政策

## 隔离与基础分支

- 除只读分析、单文件修改和窄范围文档调整外，代码、配置或 Harness 改动使用独立 worktree；具体检查和创建过程由 `skills/using-git-worktrees/SKILL.md` 所有。
- 创建 worktree 前检查当前仓库、分支和 staged、unstaged、untracked 状态，不覆盖或迁移用户改动，不创建嵌套 worktree。
- 开发新功能时，除非用户明确指定其他基础分支，先获取远端 `main`，再从最新 `origin/main` 创建任务分支。仓库不存在 `main` 时先确认替代基础分支。
- 不在 `main`、`master`、`prod` 等受保护分支直接提交。

## 提交与外部操作

- 提交格式优先服从目标项目约定；本仓库使用 `<type>(<scope>): <subject>`。只暂存当前任务文件，并记录真实验证结果。
- Commit、push、创建或合并 PR 都遵循用户授权；一次授权不自动扩大到下一项外部操作。
- 用户要求 PR 时读取 `commands/pr.md` 和 `rules/common/pr-automation.md`；后者只拥有 PR 的 CI、制品和描述政策。

## Superpowers 本地工件

- Superpowers 生成的 Spec 和本地 tickets 仅用于本地工作流，无论保存位置都不得暂存或提交。
- 默认目录 `docs/superpowers/` 由 `.gitignore` 保留在本地；PR 只包含实现、测试和长期维护文档。
