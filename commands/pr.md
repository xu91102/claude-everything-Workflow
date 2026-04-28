---
description: 提交、推送和创建 Pull Request 的标准工作流
---

# /pr - 提交与创建 PR

把当前工作区中的有效改动整理成可提交、可审阅、可追踪的 PR。

## 使用方式

```text
/pr                         # 检查当前改动，准备提交和 PR
/pr --draft                 # 创建 Draft PR
/pr --staged                # 只处理已暂存内容
/pr "fix: 修复登录过期处理"   # 使用指定提交标题
```

使用 `--staged` 时，只审查和提交已暂存内容，不主动修改暂存区；如果发现完成 PR 所需文件尚未暂存，先询问用户。

## 先检查

1. 读取仓库根目录 `AGENTS.md`、`CLAUDE.md` 或同类项目指令。
2. 运行 `git status --short --branch`，确认当前不在 `main`、`master`、`prod` 等受保护分支。
3. 区分本次任务改动与无关脏文件；不要擅自回滚或混入用户改动。
4. 查看 `package.json`、CI 配置和 README，识别项目使用的包管理器与验证命令。

## 默认流程

1. 汇总本次改动范围。
2. 按 `rules/common/pr-automation.md` 选择验证命令。
3. 优先运行与改动范围匹配的最小验证。
4. PR 前补齐完整质量门：
   - 仓库卫生检查
   - lint / format check
   - 相关单测
   - 类型检查或 build
   - 关键路径 E2E
5. 修复可安全修复的失败项，并重跑相关验证。
6. 只暂存本次任务相关文件。
7. 使用 conventional commit 提交。
8. 推送分支和创建 PR 前，向用户确认外部写操作。
9. 创建 PR 后报告链接、验证结果、风险点和未运行检查。

## 验证选择

优先使用项目已有脚本，不发明新命令：

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

monorepo 中优先使用 filter 缩小范围：

```bash
pnpm --filter <pkg> test
pnpm --filter <pkg> build
```

如果项目有 Playwright，失败时收集 `playwright-report`、`test-results`、trace 和 screenshot 路径。

## PR 描述

没有模板时使用：

```markdown
## 背景

## 核心改动

## 验证
- 命令：结果

## 风险与回滚
```

## 约束

- 不要声称测试通过，除非确实执行过。
- 不要跳过失败检查直接提交，除非用户明确授权。
- 不要把无关文件混入提交。
- 不要在受保护分支直接提交。
- 推送、创建 PR、合并 PR 前必须再次确认。
