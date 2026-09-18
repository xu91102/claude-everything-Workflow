# Claude Everything Workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/xu91102/claude-everything-Workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/xu91102/claude-everything-Workflow/actions/workflows/ci.yml)

**面向 Claude Code 和 Codex 的可复用工程工作流。**

[English](README.md) · **简体中文**

让编程 Agent 用一致的方法排查问题、实现改动、审查结果，并清楚报告实际验证了什么。Claude Everything Workflow（CEW）将规则、任务技能、命令入口和辅助脚本打包为可安装的 Agent Harness，也就是围绕 Agent 的指令与工具体系。

CEW 使用你已有的项目和模型，不提供模型，也不替代 Claude Code 或 Codex。首页提供中英文版本，分发的工作流指令目前以中文为主。

[安装](#安装) · [如何使用](#如何使用) · [设计原则](#设计原则) · [文档](#文档)

## 它能做什么

| 场景 | CEW 提供的支持 |
| --- | --- |
| 交付改动 | 从明确需求到实现、审查、验证的完整路径。 |
| 排查故障 | 调用链追踪、可检验假设、定向实验，以及有证据的根因报告。 |
| 审查代码 | 基于固定版本和明确范围，按风险选择审查深度。 |
| 处理较大任务 | 按需使用正式设计、依赖任务、隔离并行执行和交接。 |
| 控制上下文 | 精简入口，只加载与当前任务有关的详细材料。 |
| 如实报告进展 | 区分已定位、已修复、测试通过、CI 通过和已发布。 |

## 安装

### 环境要求

- 已安装并配置 Claude Code 和/或 Codex。
- Node.js **18+**，以及 npm/npx。
- macOS/Linux：Bash 和 `rsync`。Windows：PowerShell；Git Bash/WSL 配有 Bash 和 `rsync` 时也可使用 shell 安装器。

### 从 npm 安装

先预览，再安装到两个宿主：

```sh
npx claude-everything-workflow install --dry-run
npx claude-everything-workflow install
```

只安装到其中一个：

```sh
npx claude-everything-workflow install --claude-only
npx claude-everything-workflow install --codex-only
```

### 从源码安装

```sh
git clone https://github.com/xu91102/claude-everything-Workflow.git
cd claude-everything-Workflow
npm install --ignore-scripts --no-package-lock
node bin/claude-everything-workflow.js install --dry-run
node bin/claude-everything-workflow.js install
```

命令行、shell 和 PowerShell 入口共用一个按宿主裁剪的 Node.js 安装器，同样支持 `--claude-only` 和 `--codex-only`。npm 命令安装已发布版本；源码命令安装当前 checkout 中的内容。

### 安装会修改什么

| 宿主 | 安装目录 | 接入方式 |
| --- | --- | --- |
| Claude Code | `~/.claude/` | 共享工作流文件、`CLAUDE.md` 入口、规则，以及合并后的 hooks 配置。 |
| Codex | `~/.codex/` | 专项技能、必要规则和 `AGENTS.md`；不安装通用路由或 Claude hooks。 |

安装修改的是用户级目录，可能影响多个项目。顶层配置内容不同时会先备份；共享目录中的同名文件按仓库版本同步。未知文件通常保留，已登记的退役文件按明确清单清理。升级前请备份对共享文件的个人修改。不要直接复制整个 `rules/` 目录，安装器会处理两个宿主不同的规则加载位置。

## 如何使用

直接用自然语言描述任务；Codex 直接开发，只有专项任务才加载对应技能。

```text
提出任务 → 读取现场 → 选择相关工作流
        → 排查 / 实现 → 审查 → 验证 → 报告证据
```

例如：

> 排查这个请求为什么偶发失败。沿实际调用链验证不同解释，确认根因后修复，报告验证结果和仍未验证的部分。

明确、低风险的工作走较短路径；未决用户选择、正式设计和回退成本高的工作需要更多确认与验证。需要时可使用跨会话任务与并行代理。普通开发直接进行；专项验收与授权边界见[项目规则](AGENTS.md)。

| 入口 | 用途 |
| --- | --- |
| `/to-spec` | 编写正式工程设计，交由用户批准。 |
| Codex 原生审查 / 专项 `code-review` | 按明确范围和固定基线审查改动。 |
| `/verify` | 运行相关验证。 |
| `/pr` | 在用户授权内整理提交与 PR。 |
| `/learn`（选装） | 显式管理可复用学习及其评估。 |

除 Codex 原生审查外，其余为仓库命令定义，是否显示为斜杠命令取决于宿主；也可以用自然语言提出相同需求。

## 设计原则

1. **先有证据，再下结论。** 合理猜测不等于根因，本地检查通过也不等于生产发布成功。
2. **选择最短的适用流程。** 按任务和风险安排流程与验证，不为套模板而制造文档。
3. **按需加载上下文。** 入口保持精简，专项规则、技能和参考资料只在相关任务中读取。
4. **尊重项目约定与用户控制。** 保护现有改动，服从目标项目的明确要求。安装技能不自动授权发布、外部写入或破坏性操作。
5. **每项规则只有一个维护入口。** 路由、Git 边界和验证要求分别由指定来源维护，避免多套规则互相冲突。

这些指令用于引导 Agent 行为，不是运行时安全隔离，也不保证每次都能找到根因。仓库检查验证结构与约定，真实任务效果需要单独评估。

## 目录结构

```text
claude-everything-Workflow/
├── README.md             # 英文首页
├── README.zh-CN.md       # 中文首页
├── LICENSE               # MIT 许可证
├── AGENTS.md             # 共享规则入口
├── CLAUDE.md             # Claude Code 入口
├── skills/               # 任务工作流
├── rules/                # 项目及专项规则
├── commands/             # 命令入口
├── agents/               # 专业代理定义
├── hooks/                # Hook 实现
├── scripts/              # 安装与校验脚本
├── references/           # 详细指南及参考材料
└── harness/              # Skill 元数据与职责登记
```

## 文档

- [Skill 分类索引](skills/README.md)：可用工作流及其分类。
- [排障工作流](skills/systematic-debugging/SKILL.md)：调查方法与完成条件。
- [验证规则](rules/common/testing.md)：声明完成前需要哪些证据。

## 开发与贡献

在已安装依赖的源码目录运行：

```sh
npm run verify
npm run test:manifest
npm run test:invocation
npm run test:continuation
npm run test:install-rules
npm run verify:upstream
npm run pack:dry-run
```

`verify:upstream` 检查已登记的上游能力映射，不代表与最新上游完全一致。`npx claude-everything-workflow verify` 检查已发布的分发包，而不是当前业务项目。两者都不能证明 Agent 的真实任务效果。

提交贡献时说明问题与预期行为，保持改动范围集中，并列出实际运行的检查。具体要求见 [Git 规则](rules/05-git-workflow.md)。

## 致谢

项目参考了 [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)、[Superpowers](https://github.com/obra/superpowers) 和 [Matt Pocock 的 skills](https://github.com/mattpocock/skills)，并按本项目的工作流进行适配。

## 许可证

采用 [MIT 开源许可证](LICENSE)。Copyright © 2026 xu91102。

## 按宿主裁剪

普通开发、审查、恢复、压缩和技能发现交给 Codex 原生入口；保留专项验收、隔离和授权约束。
两端默认不安装 handoff 和 continuous-learning-v2；需要时使用
`cew install --with-skill handoff` 或 `--with-skill continuous-learning-v2`。
安装测试用 `--home DIR` 指向临时目录。默认不启用学习 Hook。
[原生能力核实与边界](references/codex-native-capabilities.md)记录了本机版本和官方来源。

PowerShell 对应参数为 `-CodexOnly`、`-ClaudeOnly`、`-DryRun`、`-InstallHome` 和
`-WithSkill handoff,continuous-learning-v2`。升级只删除内容匹配已知分发版本的旧文件；
个人修改与未知文件保留并提示，可能仍会被宿主加载。Codex 不写 config.toml，
Claude 合并设置时保留个人环境变量、MCP 与同事件 hooks。
