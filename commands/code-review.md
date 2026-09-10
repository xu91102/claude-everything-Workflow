---
description: 基于固定基点和已确认范围，按风险选择自审、独立或双轴审查
---

# /code-review - 代码审查

读取 `skills/code-review/SKILL.md`，由它决定审查深度、上下文隔离和降级边界；不在命令中重写流程。

```text
/code-review <base> [--spec <path>] [--mode auto|self|independent|dual]
/code-review --worktree <base> --spec <path>
/code-review --staged
```

- `<base>` 是用户提供或实施流程记录的固定基点；两者都缺失且未用 `--staged` 时才询问。
- 分支包用 `git diff <base>...HEAD`；混合工作区用 `git diff <base>`，并加入任务所属 untracked 文件。
- `--staged` 使用 `git diff --cached`；不代表整个分支。
- `--spec <path>` 或调用方的范围合同都是有效需求来源；已有信息不重复询问。
- 默认由 Skill 按风险和验证证据选择；满足条件的简单任务可自审，双轴可并行或顺序隔离运行。模式参数不能降低必要审查，代理不可用也不能作为自审兜底。
- Standards 与 Spec 轴分别报告；缺少需求证据时说明 `NOT RUN`，不根据 diff 编造需求。

`$ARGUMENTS`
