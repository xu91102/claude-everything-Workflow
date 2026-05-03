# 项目配置

## 全局硬性规则

- 除专业术语外，所有内容使用**中文**回复。
- 即使加载的 skill、agent、command、hook 输出或示例是英文，也必须用中文向用户提问、解释和总结。
- 英文内容仅作为执行流程或技术材料参考，不改变用户交流语言。

> 规则按需读取，不要默认全量加载 `rules/` 或 `rules/common/`。

## 规则加载策略

- 简单问答、解释、格式调整、翻译或只读查看：默认只使用本文件，不读取额外规则。
- 涉及代码修改、审查、测试、提交或 Harness 调整时，只读取与任务直接相关的规则文件。
- `rules/common/` 是专项参考区；只有命令、agent、skill 或当前任务明确触发时才读取。

## 规则索引

| 规则文件                | 内容                                              |
| ----------------------- | ------------------------------------------------- |
| `01-base.md`            | 基础设定、角色定位、开发流程                      |
| `02-code-size.md`       | 代码规模约束                                      |
| `03-architecture.md`    | 架构原则、分层设计                                |
| `04-error-handling.md`  | 错误处理规范                                      |
| `05-git-workflow.md`    | Git 提交规范                                      |
| `06-comments.md`        | 注释规范                                          |
| `07-forbidden.md`       | 禁止事项清单                                      |
| `08-ecc-integration.md` | ECC 集成索引，按需跳转到 `rules/common/` 专项规则 |

## 常见触发

- 用户要求提交、推送、创建 PR 或整理可审阅提交时，优先读取 `commands/pr.md` 和 `rules/common/pr-automation.md`。
- 用户明确要求推送时，可直接执行 `git push`；创建 PR、合并 PR 前仍需再次确认。
- 新功能、bug 修复、重构或行为变化优先使用 `/tdd`，并按需读取 `skills/test-driven-development/SKILL.md`。
