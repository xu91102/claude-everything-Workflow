# 安装与专项工作流

普通开发直接使用宿主能力。Codex 普通审查用原生入口，不加载通用流程包装。
原生能力核实与保留边界见 [Codex 能力对照](codex-native-capabilities.md)。

## 按宿主安装

运行 `cew install --codex-only` 或 `cew install --claude-only`；先加 `--dry-run` 可查看操作。
安装到临时目录测试：`cew install --home /tmp/cew-test-profile`，不要用真实全局配置做测试。
PowerShell 对应 `-CodexOnly`、`-ClaudeOnly`、`-DryRun`、`-InstallHome`。
两种入口和 npm CLI 共用 `scripts/install-host.js`，以 `harness/manifest.json` 为安装清单。

Codex 只安装专项技能、必要参考和规则；不安装 using-superpowers、Claude hooks、通用学习脚本或验证器。
Claude Code 保留 hooks 和显式工作流咨询入口；专项规则放入 `~/.claude/references/rules/common/`，按需读取。
两端均默认不安装 handoff 和 continuous-learning-v2。选装示例：

```sh
cew install --codex-only --with-skill handoff
cew install --claude-only --with-skill continuous-learning-v2
```

PowerShell 用 `-WithSkill handoff,continuous-learning-v2`。学习 Hook 仅在 Claude 选装学习系统时接入。
Codex 选装学习系统只提供手动管理能力，不声称能自动运行 Claude Hook。
原生会话恢复、压缩、技能发现和安装不由 CEW 再提供教程或实现。

升级按已知分发内容摘要删除重复文件；个人修改和未知文件保留并提示，可能仍会被宿主加载。
更新选中路径前备份不同内容，拒绝穿过符号链接写入。不会写 Codex 的 config.toml 或启用其 hooks。
Claude 设置合并保留用户环境变量、MCP 和同一事件的个人 hooks。

## 保留的专项价值

- Spec：显式正式设计或高风险边界，需要用户批准后实施；澄清不能扩大授权。
- Tickets：行为验收、真实 blocker、claim/resolve 和外部写入授权；implement 仅用于 ticket。
- 独立审查：固定基点下按风险选择自审、独立或双轴审查；普通 Codex review 不等价于 Spec 验收。
- 并行：写入隔离和集成验证；已有适合的工作区可以复用。
- 测试：选择或明确要求 TDD 时保留 RED 证据；调试保留定向实验与反证；E2E 保留可重复流程与失败制品。
- 真实验收：PASS / FAIL / BLOCKED / NOT RUN、截图/日志证据和二次复核。
- 授权与真实报告：没有新鲜验证证据，不声明完成、通过、已修复或 ready；没有 verify，不进入 PR。

## Skill 分类索引

见 `skills/README.md`；物理目录保持平铺以兼容发现。
只有学习产物使用物理分类目录 `skills/learn/<category>/`。
选装学习系统后，观察、候选和迁移来源不直接成为规则；经过评估才保存学习产物。
它不是 Codex 原生 memory 的等价替代；默认不后台学习。

## Skill 迁移说明

`discover-unknowns-zh` 已退休；决策压力测试保留在 `grilling`。
`iterative-retrieval` 已退休；普通检索与上下文管理使用宿主能力。
`research`、`find-skills`、`project-context`、`using-git-worktrees` 和 `verification-before-completion` 不再分发。
`prototype` 和 `to-tickets` 保留专项边界；`implementation-notes`、`explainer` 和 `quiz` 工件链不再属于项目流程。
`skill-creator` 已退休；项目作者约定见 `rules/common/skills-learning.md`。
历史上游能力记录在 scripts/upstream-capability-map.json；它不证明与最新宿主完全等价。

## 验证与 npm 发布

运行 README 中的验证命令。结构测试、安装测试不等于真实模型行为评测。
版本号通过 PR 更新；ci.yml 使用 npm 受信任的发布商，npm 发布成功后才创建对应 tag。
PR 授权不含合并或发布。
