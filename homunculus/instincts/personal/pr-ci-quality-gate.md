---
id: pr-ci-quality-gate
trigger: "用户要求提交、推送、创建 PR 或发布前验证时"
confidence: 0.7
domain: "workflow"
source: "reference-project-analysis"
lastObserved: "2026-04-28"
---

# PR 前分层质量门

## 行为

在提交和创建 PR 前，先按改动范围运行分层验证，并把真实结果写入 PR 描述。

## 证据

- 参考项目使用独立 PR checks job 拆分 lint、test、e2e。
- E2E 配置包含 `globalSetup`、认证 fixture、worktree 环境读取和失败制品。
- PR 技能要求先检查分支、工作区状态、完整验证，再提交、推送和创建 PR。

## 步骤

1. 检查分支和工作区状态。
2. 识别项目已有脚本和 CI 配置。
3. 运行仓库卫生、lint、相关单测、build、关键路径 E2E。
4. 失败时修复并重跑相关验证。
5. 只暂存本次任务相关文件。
6. PR 描述记录背景、核心改动、验证结果、风险与回滚。
7. 推送和创建 PR 前向用户确认。
