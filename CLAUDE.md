# 项目配置

> 详细规则请查看 `rules/` 目录。

## 规则索引

| 规则文件 | 内容 |
|----------|------|
| `01-base.md` | 基础设定、角色定位、开发流程 |
| `02-code-size.md` | 代码规模约束 |
| `03-architecture.md` | 架构原则、分层设计 |
| `04-error-handling.md` | 错误处理规范 |
| `05-git-workflow.md` | Git 提交规范 |
| `06-comments.md` | 注释规范 |
| `07-forbidden.md` | 禁止事项清单 |
| `08-ecc-integration.md` | (Agent-First、Hook 系统、性能优化、TDD) |

## Hook Profile 控制

通过环境变量控制 Hook 行为：

```bash
# minimal | standard | strict (默认: standard)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook
export ECC_DISABLED_HOOKS="hook-id-1,hook-id-2"
```

详见 [hooks/README.md](hooks/README.md)
