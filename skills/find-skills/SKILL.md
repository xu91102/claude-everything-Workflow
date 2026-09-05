---
name: find-skills
description: 仅在用户明确要求查找、比较、安装或更新 agent skill 时使用。
disable-model-invocation: true
---

# Find Skills

这是开放生态 Skill 的发现与安装入口，不是普通能力请求的默认路由。

## 触发边界

仅当用户明确说“找一个 skill”“比较 skill”“安装/卸载 skill”或“更新已安装 skill”时触发。
用户只描述想完成的专业任务时，先直接处理任务，不因“可能存在 skill”而搜索。

## 最小流程

1. 明确领域、目标行为和兼容平台。
2. 使用 `npx skills find <query>` 搜索，必要时查看 [skills.sh](https://skills.sh/)；
   具体 CLI 参数见 `references/skills-cli.md`。
3. 逐项核验来源仓库、维护状态、许可证、安装量或其他可复核质量信号；搜索结果本身不是推荐依据。
4. 展示候选、来源、用途、风险和安装命令。不要把时效性指标写成永久事实。
5. 只有用户明确授权安装或更新后，才执行 `npx skills add ...`、`check` 或 `update`；安装前说明目标范围。

## 输出

- 未找到：说明查询范围，并提供直接完成任务或创建新 Skill 的选项。
- 找到候选：给出最少必要的比较和可复核链接。
- 已安装或更新：报告实际命令、结果和未验证项，不回显凭据。

## Verify Quality Before Recommending

推荐前至少确认来源与内容可访问、能力与用户目标匹配、安装方式明确；高风险或权限敏感 Skill
需额外说明其工具权限和维护风险。不得仅凭排行榜、安装量或单条搜索摘要推荐。
