---
name: evidence-research
description: 针对工程问题检索高可信第一方证据，并把逐项可追溯的结论保存为仓库 Markdown 研究记录。
---

# Evidence Research

把阅读工作与实现分离。可在用户授权并行 agent 时后台执行，否则主 agent 按同一协议完成。

## When to Use

答案依赖外部文档、标准、版本行为或需要留下可审计研究记录时使用。

## How It Works

1. 将问题改写为可证伪的 claims、时间范围和停止条件。
2. 优先 **primary sources**：官方文档、标准、论文、源代码、release notes 与第一方 API。
3. 技术事实追到拥有该行为的源；二手材料只用于发现线索，不作为最终依据。
4. 对每项结论记录直接 **citation**、版本/日期、适用条件和冲突证据。
5. 区分事实、基于来源的 inference、未知项和建议；不得把推断伪装成 source claim。
6. 写成单个 **Markdown** 文件，遵循仓库既有研究目录；没有约定时先使用本地 workflow
   artifact 并报告路径。
7. 新鲜度敏感的结论必须重新联网验证；无法访问来源时明确标记未验证。

研究文件服务于后续 grilling/Spec，不自动改变代码、依赖或外部系统。

## Example

“核实 Node 20 对该 API 的官方支持状态”只使用官方文档、release notes 与源代码并逐项 citation。

## Exit

事实已由本地一手证据完整证明时返回 `NOT_APPLICABLE`。其他情况返回 `RESEARCH_READY`、
`CONFLICTING_EVIDENCE` 或 `NOT_RUN`，附文件路径、来源范围和未知项。
