---
description: 提交、推送和创建 Pull Request 的标准工作流
---

# /pr - 提交与创建 PR

把当前授权范围内的改动整理成可审阅的 PR。进入前须有 `/verify` 或等价证据。
遵守已生效的项目与用户规则；没有适用规则时使用[随包验证契约](../references/verification.md)、
[PR 契约](../references/pr-automation.md)和 [Git 与授权规则](../references/git-workflow.md)。

## 使用方式

`/pr` 检查当前改动；`/pr --draft` 创建草稿；`/pr --staged` 只处理已暂存内容；可附提交标题。
`--staged` 不主动修改暂存区；若交付所需文件未暂存，先询问用户。

## 流程

1. 读取项目入口与 `git status --short --branch`，确认分支、基线和 task-owned 改动，保留无关用户改动。
2. 查看项目脚本与 CI，按[验证契约](../references/verification.md)选择适用层级，不复制固定命令清单。
3. 复用覆盖最终状态的有效证据，补齐受影响的必要检查；失败先修复可安全修复的问题，再验证。
4. 按 [PR 契约](../references/pr-automation.md)处理 `FAIL / BLOCKED / NOT RUN`；获准继续不等于通过。
5. 只暂存当前任务相关文件，以 conventional commit 提交。
6. 按 [Git 与授权规则](../references/git-workflow.md)确认相应授权后推送或创建 PR；不重复索要已有授权。
7. 回读当前提交的 CI，报告 PR 链接、实际结果、未运行项和剩余风险。

若工作来自 tracker ticket，加入不会误触发关闭的 ticket reference 和验证摘要。
创建 PR does not authorize closing、resolve、改 label 或解锁其他 ticket；沿用原任务的外部写授权边界。

## PR 描述

优先使用仓库模板；没有模板时说明背景、核心改动、验证、风险与回滚。
描述面向未读过会话的审阅者，只记录最终实现、真实证据和影响。

## 约束

- 不在受保护分支直接提交，不混入敏感配置、生成产物或无关改动。
- 必需检查失败不得宣称 ready 或可以合并；明确获准时完整披露后继续草稿，检查结果保持原状。
- 创建 PR 不授权合并或发布；授权与隔离边界统一由 [Git 契约](../references/git-workflow.md)维护。
