# Codex 原生能力核实

核实日期：2026-09-18。本机 `codex --version`：0.149.0；`codex --help` 列出 review、resume、fork、agents、plugin。
本次核实采用本机命令和官方文档，不把“模型通常会”视为功能等价，也未运行真实模型能力对照。

| 能力 | 证据 | CEW 调整与非等价边界 |
| --- | --- | --- |
| 普通审查 | 本机 `codex review --help`；[原生命令](https://learn.chatgpt.com/docs/developer-commands?surface=cli) | 删除 commands/code-review.md；保留固定范围的 Spec/ticket 验收与必要独立审查 |
| 会话恢复、分叉、压缩 | 本机 resume/fork；[原生命令](https://learn.chatgpt.com/docs/developer-commands?surface=cli) 列出 compact | 删除通用摘要教程；handoff 仅选装，用于明确要求的脱敏可移植交接 |
| 技能发现、按需加载、安装 | [Build skills](https://learn.chatgpt.com/docs/build-skills) 说明技能发现、渐进加载和 skill-installer | 不再自建发现/安装教程；CEW 安装器只负责自己分发包的宿主清单与迁移 |
| 子代理 | [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)；本会话提供代理工具 | 移除通用代理选择、创建和转发说明；保留授权、独立审查、并行写入隔离、集成验证。可用性受宿主设置影响 |
| 普通开发 | 当前宿主直接操作文件、终端、测试 | 不强制路由或 implement；这不是“所有专项流程均可删除”的等价结论 |
| 学习系统 | CEW 自有 observer/instinct 工具 | 与原生记忆不等价，保留手动选装而非删除；默认不安装、不启用学习 Hook |

测试、调试、Spec、E2E 的保留项是项目约束与可复核工件，不因模型更强而宣称已被原生完全替代。
官方文档与本机入口会演进；上述结论仅覆盖核实到的版本和可见功能。
