# ECC 集成索引

本文件只保留 ECC 相关规则索引，避免默认加载过多细节。需要对应场景时再读取专项规则。

| 专项规则 | 内容 |
| --- | --- |
| `common/agent-orchestration.md` | Agent 使用、规划、并行编排 |
| `common/hooks.md` | Hook 类型、退出码、Profile、权限 |
| `common/performance.md` | 模型选择、MCP、上下文压缩、Token 成本 |
| `common/skills-learning.md` | Skills 工作流、持续学习、按需学习 |
| `common/security.md` | 安全优先原则、安全扫描 |
| `common/testing.md` | TDD、E2E、验证策略 |
| `common/implementation.md` | 不可变性、跨平台、实施阶段控制 |

## 默认原则

- 简单任务优先由当前 agent 直接完成。
- 复杂、跨领域或需要独立视角时，再读取对应专项规则并考虑委派 agent。
- 不为轻量任务加载完整 ECC 规则集。
