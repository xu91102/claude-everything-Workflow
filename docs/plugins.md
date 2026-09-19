# 插件安装与更新

CEW 提供 Claude Code 和 Codex 两种插件清单，复用仓库现有 `skills/`、`commands/`、`agents/`、规则及脚本，不维护另一套工作流副本。npm 安装方式继续保留。

下列 GitHub 安装命令需要本次插件文件已经合并并推送到远端；本地开发可先按本文末尾验证。

## Claude Code

在 Claude Code 中执行：

```text
/plugin marketplace add xu91102/claude-everything-Workflow
/plugin install claude-everything-workflow@cew
```

重启会话后，可调用插件中的技能和命令入口：

```text
/claude-everything-workflow:using-superpowers 帮我排查这个请求失败的问题
/claude-everything-workflow:code-review
```

更新已安装版本：

```text
/plugin marketplace update cew
/plugin update claude-everything-workflow@cew
```

更新后重启会话。插件提供编辑检查和提交质量 hook，沿用 `ECC_HOOK_PROFILE`、`ECC_DISABLED_HOOKS` 控制。不默认开启持续学习观察 hook。

## Codex

在支持 `codex plugin` 的 CLI 中执行：

```sh
codex plugin marketplace add xu91102/claude-everything-Workflow
codex plugin add claude-everything-workflow@cew
```

也可以添加市场后，在应用插件目录中选择 CEW 安装。开启新任务，在技能选择器中选择本插件的 `using-superpowers`，并描述工程任务：

```text
使用 Claude Everything Workflow 插件中的 using-superpowers 技能，帮我实现这个改动……
```

该入口保留原有工作流，不增加插件专用的上下文加载逻辑。Codex 版提供技能和随包参考文件，不自动注册 Claude 专用 hooks 或 `commands/` 原生斜杠命令。

更新 GitHub 市场快照，再安装最新快照中的插件，并开启新任务：

```sh
codex plugin marketplace upgrade cew
codex plugin add claude-everything-workflow@cew
```

CLI 命令以宿主版本为准；缺少 `plugin` 子命令时使用支持插件的应用版本或继续使用 npm 安装。

## 与 npm 安装的区别

| 项目 | 插件安装 | npm 安装 |
| --- | --- | --- |
| 文件位置 | 宿主管理的插件目录或缓存 | `~/.claude/`、`~/.codex/` |
| 全局入口配置 | 不覆盖已有入口和设置 | 安装器备份并同步入口，Claude hooks 合并进设置 |
| 工作流 | 宿主发现插件技能，保留原有规则查找方式 | 从用户级目录按需加载 |
| Claude hooks | 插件生命周期内启用基础检查 | 原有安装器配置 |
| 停用 | 用宿主插件管理功能禁用或卸载 | 按原有全局配置管理 |

插件不会自动加载随包的 `AGENTS.md` 或注册 `rules/`，也不提供额外的资源路径适配；这些文件被打包不等于其规则已生效。需要全局入口和规则安装时使用 npm 安装器。只使用插件时，跨文件工作流仍需目标项目或用户已有配置提供可解析的规则及参考路径，不能视为与 npm 安装完全等价。

同一宿主建议选一种方式，避免同名技能和 Claude hooks 重复。已有 npm 安装不会被插件自动迁移或删除；学习系统仍需显式配置。脚本声明的可选外部工具和依赖也不会因安装插件自动安装。基础检查脚本需要 Node.js 18+；运行仓库校验器需要安装 package.json 中的依赖。

## 本地验证和维护

在仓库根目录运行：

```sh
npm install --ignore-scripts --no-package-lock
npm run verify
npm run test:plugins
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
claude --plugin-dir .
```

Codex 本地验证使用 `codex plugin marketplace add <仓库绝对路径>` 后安装 `claude-everything-workflow@cew`，并在新任务选择工作流入口。测试环境应使用独立的宿主配置目录，避免影响日常安装。

仓库根目录就是插件包，因此两个市场都引用 `./`；保留仓库原名和现有源码布局，不能只复制清单。发布时同步调整 `package.json`、`.claude-plugin/plugin.json`、`.codex-plugin/plugin.json` 三处版本号，`npm run test:plugins` 会检查一致性。插件更新由用户刷新市场和更新插件触发，不承诺后台自动拉取。

格式依据：[Claude 插件参考](https://code.claude.com/docs/en/plugins-reference)、[OpenAI 插件打包文档](https://developers.openai.com/plugins/build/plugins)。

已知校验差异：plugin-creator 的 Python 校验器把 `skills/` 下每个非隐藏目录都当成独立技能，因此会将既有 `skills/learn/` 学习归档报为缺少 `SKILL.md`。该目录不是技能，不为消除这个提示添加假入口；仍保留原有归档和安装约定。验收结合两个宿主的原生安装结果、技能元数据和插件清单检查，不能将该 Python 校验报告为全部通过。
