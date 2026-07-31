---
name: merge-conflict-resolution
description: 按双方 primary source 与变更意图逐 hunk 解决正在进行的 merge/rebase，并完成验证与 continue。
---

# Merge Conflict Resolution

只在 Git 已处于 merge/rebase 冲突状态时使用。目标是完成当前操作；**never abort**，也不以
`ours`/`theirs` 粗暴覆盖。

## When to Use

`git status` 明确显示正在 merge/rebase 且存在 unresolved paths 时使用。

## How It Works

1. 读取 `git status`、操作类型、冲突文件、两侧 commits 与当前 branch 目的。
2. 为每个 hunk 找双方 **primary source**：原 commit、Issue/PR、Spec、测试和关联代码。
3. 写下 left intent、right intent、是否兼容；能组合时保留双方意图，不能时选择符合当前
   merge/rebase 目标的一方并记录 trade-off，不发明第三种产品行为。
4. 编辑并逐文件确认 conflict markers 全部消失；检查 rename/delete、二进制、生成文件与
   modify/delete 等非文本冲突。
5. 运行仓库发现到的 format、typecheck、tests 和针对冲突语义的回归检查。
6. 仅 stage 已解决文件；复核 staged diff 后执行 `git merge --continue` 或
   `git rebase --continue`，直到操作完成。
7. 若缺少决定语义所需的用户选择，保持当前可恢复状态并返回 `BLOCKED`，不 abort、不提交猜测。

完成报告列出每个冲突的意图来源、选择、验证命令和剩余风险。

## Example

同一 handler 一侧加入 auth、另一侧改变错误合同：追到各自 Spec 与测试后组合两种意图。

## Exit

Git 不在冲突状态时返回 `NOT_APPLICABLE`。其他情况返回 `MERGE_COMPLETED`、
`REBASE_COMPLETED`、`BLOCKED` 或 `VERIFICATION_FAILED`，不 abort。
