# Claude Everything Workflow

> 一套通用的 Prompt 工程模板，可直接复制到 `~/.claude/` 使用。
> 学习 [everything-claude-code](https://github.com/affaan-m/everything-claude-code) 的最佳 Harness 工程实践。

## 快速安装

### Windows

```powershell
Copy-Item -Recurse .\claude-everything-Workflow\* $env:USERPROFILE\.claude\ -Force
```

### macOS / Linux

```bash
cp -r ./claude-everything-Workflow/* ~/.claude/
```

## 目录结构

```
claude-everything-Workflow/
├── README.md                   # 本文档
├── CLAUDE.md                   # 全局配置入口
├── settings.json               # 旧版 Hooks 配置 (向后兼容)
│
├── rules/                      # 规则（始终遵循）
│   ├── 01-base.md              # 基础设定
│   ├── 02-code-size.md         # 代码规模约束
│   ├── 03-architecture.md      # 架构原则
│   ├── 04-error-handling.md    # 错误处理
│   ├── 05-git-workflow.md      # Git 规范
│   ├── 06-comments.md          # 注释规范
│   ├── 07-forbidden.md         # 禁止事项
│   ├── agents.md               # 代理使用规则
│   └── common/                 # 通用最佳实践
│       ├── performance.md      # Token 优化 & 模型选择
│       └── hooks.md            # Hook 系统最佳实践
│
├── agents/                     # 代理（专业任务委托）
│   ├── architect.md            # 架构师
│   ├── code-reviewer.md        # 代码审查员
│   ├── tdd-guide.md            # TDD 指导
│   ├── e2e-runner.md           # E2E / Playwright（可选 Agent Browser）
│   ├── harness-optimizer.md    # Harness 配置调优
│   └── ...                     # 其他专业代理
│
├── commands/                   # 命令（斜杠快捷入口）
│   ├── learn-eval.md           # /learn-eval 提取模式 (含质量门)
│   ├── evolve.md               # /evolve 演化
│   ├── prune.md                # /prune 清理过期直觉
│   ├── instinct-status.md      # /instinct-status 状态
│   ├── instinct-export.md      # /instinct-export 导出
│   ├── instinct-import.md      # /instinct-import 导入
│   ├── plan.md                 # /plan 实施计划
│   ├── verify.md               # /verify 验证
│   ├── code-review.md          # /code-review 审查
│   ├── tdd.md                  # /tdd 测试驱动开发
│   └── e2e.md                  # /e2e 端到端（Playwright）
│
├── contexts/                   # 上下文（模式切换）
│   ├── dev.md                  # 开发模式
│   ├── research.md             # 研究模式
│   └── review.md               # 审查模式
│
├── scripts/                    # 跨平台脚本
│   ├── lib/                    # 共享工具库
│   │   ├── utils.js            # 路径/stdin/日期/frontmatter 工具
│   │   └── hook-flags.js       # Hook Profile 控制
│   └── hooks/                  # Hook 实现
│       ├── run-with-flags.js   # Hook 运行时控制器
│       ├── commit-quality.js   # Pre-commit 质量门
│       ├── session-start.js    # 会话启动上下文
│       └── session-end.js      # 会话结束持久化
│
├── skills/
│   ├── e2e-testing/            # Playwright E2E 模式（POM、CI、制品）
│   │   └── SKILL.md
│   ├── continuous-learning-v2/ # 自主学习系统
│   │   ├── SKILL.md            # 技能说明
│   │   ├── config.json         # 配置
│   │   ├── agents/             # Observer Agent
│   │   └── hooks/              # 增强观察脚本
│   └── learned/                # 学习到的模式
│
├── hooks/                      # 钩子脚本
│   ├── hooks.json              # 统一 Hook 配置 (含 ID/描述)
│   ├── README.md               # Hook 文档
│   ├── check-console-log.js    # console.log 检测
│   ├── evaluate-session.js     # 会话评估
│   ├── observe.js              # 工具调用观察
│   └── review-confidence.js    # 置信度审查报告
│
└── homunculus/                 # 自主学习系统
    ├── instincts/
    │   ├── personal/           # 个人直觉
    │   └── inherited/          # 导入直觉
    └── evolved/
        ├── skills/             # 演化的技能
        ├── commands/
        └── agents/
```

## 可用命令

| 命令 | 功能 |
|------|------|
| `/plan` | 创建实施计划，等待确认 |
| `/tdd` | 测试驱动开发流程 |
| `/e2e` | 端到端测试（Playwright；可配合 e2e-runner） |
| `/verify` | 运行全面验证检查 |
| `/code-review` | 代码审查 |
| `/learn-eval` | 从会话提取模式 (含质量门评估) |
| `/evolve` | 演化模式为高级结构 |
| `/prune` | 清理过期待定直觉 |
| `/instinct-status` | 查看学习状态 |
| `/instinct-export` | 导出直觉分享 |
| `/instinct-import` | 导入他人直觉 |

## Hook Profile 控制

通过环境变量控制 Hook 行为:

```bash
# minimal | standard | strict (默认: standard)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook (逗号分隔 ID)
export ECC_DISABLED_HOOKS="pre:bash:commit-quality"
```

## Continuous Learning v2

### 工作流程

```
会话活动 → Hooks 观察 → observations.jsonl
                            ↓
                     Observer Agent (Haiku)
                            ↓
                     instincts/personal/
                  ↓                    ↓
           /evolve 聚类        /prune 清理
                  ↓
           evolved/skills/commands/agents/
```

### 置信度系统

| 分数 | 含义 | AI 行为 |
|------|------|---------|
| 0.3 | 试探性 | 建议但不强制 |
| 0.5 | 中等 | 相关时应用 |
| 0.7 | 强 | 主动应用 |
| 0.9 | 核心 | 始终应用 |

> 置信度不会因时间流逝自动衰减。使用 `review-confidence.js` 审查、`/prune` 清理。

## 使用流程

```
1. 复制到 ~/.claude/
2. 使用 /plan 规划功能
3. 使用 /tdd 实现代码
4. 关键路径使用 /e2e 或委派 e2e-runner 维护 Playwright
5. 使用 /verify 验证
6. 使用 /code-review 审查
7. 使用 /learn-eval 积累模式
8. 使用 /evolve 演化
9. 使用 /prune 定期清理
10. 使用 /instinct-export 分享
```
