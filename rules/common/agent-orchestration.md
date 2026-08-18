# Agent 编排

## Agent 使用原则

简单、明确、低风险的任务由当前 agent 直接完成；复杂、跨领域或需要独立视角时再委派。委派用于隔离一次性搜索、失败日志、排查分支和专项审查，主 agent 只接收结论、证据、风险和下一步。

| 场景 | 使用 Agent / Skill | 时机 |
| --- | --- | --- |
| 跨会话功能交付 | to-tickets | 已批准 Spec 或需求对话后 |
| 并行 frontier tickets | subagent-driven-development | router 判断至少两张 ticket 无依赖且写面不重叠 |
| 架构决策 | architect | 设计阶段 |
| 代码质量审查 | code-reviewer | 编写代码后 |
| 安全审查 | security-reviewer | 提交前 |
| 测试驱动开发 | tdd-guide | 新功能/bug 修复 |
| 端到端测试 | e2e-runner | 关键用户路径、Playwright 维护与执行 |
| 构建错误 | build-resolver | 编译失败时 |
| Harness 配置审计 | harness-optimizer | 规则、hooks、agents、skills 或命令入口需要优化时 |

## Tickets 先于跨会话执行

跨会话变更必须以可验收的依赖 tickets 分解；单会话变更直接实施：

1. 阅读相关代码；复杂架构决策才使用 architect agent。
2. `to-tickets` 形成 vertical slices、验收标准和 blocking edges，并经用户确认。
3. router 在授权范围内选择单张 frontier ticket 串行实施，或为多张独立 ticket 选择 SDD；SDD 为每张 ticket 创建 worker worktree 和 fresh subagent，将审查通过的 diff 汇入 controller-owned integration worktree 联合验证后再 resolve。
4. 进行测试和安全审查。

## 并行执行

仅当 router 证明至少两张已批准 frontier tickets 相互独立、写面不重叠且并行收益明确时，才并行启动多个 agents；不要为简单任务或轻量检查增加 agent。复杂问题可按需使用事实审查、高级工程、安全、一致性或冗余审查等分角色子 agents。

## Subagent 上下文契约

Fresh/Fork 选择、agent `description`、回传格式和外部写入边界的唯一来源是 `rules/common/context-hygiene.md`；本文件只定义角色调度与 ticket/SDD 的依赖、并行条件。
