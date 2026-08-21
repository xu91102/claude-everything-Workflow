# CEW 项目规则

本文件只描述 `claude-everything-Workflow` 仓库相对全局 CEW Bootstrap 的差异。安装到用户目录的全局入口来自 `templates/global/AGENTS.md`，不要把本文件作为全局模板复制。若当前环境未加载全局 CEW Bootstrap，先读取该模板，再应用本文件的项目差异。

## 仓库职责

- 本仓库发布 Claude Code 与 Codex 共用的 rules、skills、agents、commands、hooks 和安装器；修改 Harness 时保持双平台语义一致。
- `skills/using-superpowers/SKILL.md` 是流程路由的唯一来源。Rules 只保存长期政策和项目不变量，不复制 skill 的状态机或执行步骤。
- `skills/` 保存按需自动触发的流程，`commands/` 保存用户显式触发的入口、参数和专属流程；同一协议只能有一个权威来源。`agents/` 只用于需要隔离上下文的委托角色。
- 新增或修改能力时同步检查 README、安装器、npm 发布面和 Harness 静态验证，避免仓库内容与安装结果漂移。

## 实施约束

- Harness、脚本和安装行为必须兼容 Windows、macOS 与 Linux；优先使用 Node.js 或各平台已有入口，避免只在单一 shell 可用的实现。
- 不默认为子目录增加 `AGENTS.md`；只有该目录存在独立约束或验证方式时，才增加短小的差异文件。
- Git、worktree、提交和 PR 授权遵循 `rules/05-git-workflow.md`；当前任务相关规则按 `rules/08-specialty-rules-index.md` 加载。

## 验证

- Harness 一致性：`npm run verify`
- npm 发布面：`npm run pack:dry-run`
- 安装行为：`bash scripts/install.sh --dry-run` 和 `powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -DryRun`
