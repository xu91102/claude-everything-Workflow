# Worktree 操作参考

仅在需要具体操作时读取。隔离触发条件、基线和提交授权以 `rules/05-git-workflow.md` 为准。

先检查仓库状态，优先复用属于当前任务的合适工作区，不覆盖用户改动：

```sh
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse --show-toplevel
git worktree list
```

需要新建时，按 Git 规则确认任务基线，替换以下占位符；Codex 分支默认用 `codex/` 前缀：

```sh
git worktree add ../<repo>-<task> -b codex/<task> <base-ref>
```

不得嵌套 worktree。后续实现、测试、审查在任务工作区完成；依赖仅按项目需要安装。交付时报告工作区、分支、基线和验证结果。

用户授权清理后，确认任务已合并或放弃、目标工作区无待保留改动，再执行：

```sh
git worktree remove <worktree-path>
git branch -d codex/<task>
```

清理前核对解析后的绝对路径，确保目标属于本次授权范围。不得强制删除用户改动；`git branch -D` 仅在用户明确允许删除未合并分支时使用。
