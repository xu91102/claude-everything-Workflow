# Git 提交规范

需要创建、复用或清理 worktree 的具体命令时，按需读取 `references/git-worktrees.md`；隔离条件和授权边界仍以本规则为准。

## Worktree 分支开发 (CRITICAL)

- 按用户改动保护、并行写入、受保护分支、实验隔离和回退需求决定隔离方式，不以“新功能”标签或文件数量强制创建 worktree。
- 已有安全任务分支或属于本任务且基线正确的 worktree 可以复用。当前 checkout 干净且只需分支隔离时可创建任务分支；存在覆盖用户改动、并行互相破坏或实验无法安全回退的风险时使用独立 worktree。
- 创建 worktree 前必须检查当前仓库状态，确认基础分支、当前分支和未提交改动。
- 基础分支优先服从用户指定、现有任务基线和可查明的仓库约定，记录可恢复的 HEAD；只有基线确实不明且影响范围时才询问。需要最新远端状态时 fetch 并检查差异，不强制切换、重置或覆盖工作区，不把 `origin/main` 当作通用基线。复用进行中的任务时保留已记录的基线。
- 需要独立 worktree 时，实现、验证、审查、提交都在任务 worktree 内完成，不改原始 checkout。
- 不创建嵌套 worktree，不丢弃或覆盖用户已有改动。

## 提交格式 (CRITICAL)

使用 `<type>(<scope>): <subject>`：`feat` 新功能、`fix` 修复、`docs` 文档、`style` 不影响逻辑的格式调整、`refactor` 重构、`perf` 性能、`test` 测试、`chore` 构建或工具。提交信息必须描述实际改动，例如 `feat(user): 添加用户登录功能`。

## 提交检查清单

提交前确认：提交信息符合规范；代码已通过 lint；只暂存本次任务相关文件；PR 前验证结果已记录。代码与安全禁止项统一见 `rules/07-forbidden.md`。

## Superpowers 本地工件

- Superpowers 生成的 Spec 和本地 tickets 仅用于本地工作流，无论保存位置都不得暂存或提交。
- 默认目录 `docs/superpowers/` 由 `.gitignore` 保留在本地；PR 只包含实现、测试和长期维护文档。

## PR 授权边界

- 不在 `main`、`master`、`prod` 等受保护分支直接提交。
- 用户明确要求推送分支时可直接执行；创建 PR、合并 PR 需要相应明确授权，已授权不重复确认。
- 用户要求提交、推送、创建 PR 时，读取 `commands/pr.md` 和 `rules/common/pr-automation.md`；后者只维护 PR 的 CI、制品和描述，不重复本文件的 Git 与授权规则。
