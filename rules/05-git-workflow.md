# Git 提交规范

## Worktree 分支开发 (CRITICAL)

- 除只读分析和单文件修改外，所有代码、配置、Harness 改动必须先创建独立 `git worktree` 和任务分支。
- 创建 worktree 前必须检查当前仓库状态，确认基础分支、当前分支和未提交改动。
- 不在原始 checkout 中做实现、测试和提交；实现、验证、审查、提交都应在任务 worktree 内完成。
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
