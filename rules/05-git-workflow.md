# Git 提交规范

## Worktree 分支开发 (CRITICAL)

- 开发新功能必须使用独立 `git worktree` 和任务分支，单文件新功能也不例外；已有属于本任务且基线正确的 worktree 直接复用。
- 非新功能按隔离需要判断：存在可能被覆盖的用户改动、并行写入、受保护分支上的实现或高风险改动时使用 worktree。干净任务分支上的普通修复、文档或配置整理不按文件数量强制创建。
- 创建 worktree 前必须检查当前仓库状态，确认基础分支、当前分支和未提交改动。
- 为新功能新建 worktree 时，除非用户明确指定其他基础分支，必须先拉取最新远端 `main`，再从最新 `origin/main` 创建工作区和任务分支；不得以过期的本地 `main` 或其他功能分支作为基础。仓库不存在 `main` 时，先向用户确认替代基础分支。复用正在执行本任务的 worktree 时保留已记录的基线，不因远端推进重置进行中的工作。
- 需要隔离时，实现、验证、审查、提交都在任务 worktree 内完成，不改原始 checkout。
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
- 用户明确要求推送分支时可直接执行；创建 PR、合并 PR 前必须向用户确认。
- 用户要求提交、推送、创建 PR 时，读取 `commands/pr.md` 和 `rules/common/pr-automation.md`；后者只维护 PR 的 CI、制品和描述，不重复本文件的 Git 与授权规则。
