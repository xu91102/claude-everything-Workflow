# Claude Everything Workflow

> 一套通用的 Prompt 工程模板，可直接复制到 `~/.claude/` 使用。

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
├── settings.json               # Hooks 配置
│
├── rules/                      # 规则（始终遵循）
│   ├── 01-base.md              # 基础设定
│   ├── 02-code-size.md         # 代码规模约束
│   ├── 03-architecture.md      # 架构原则
│   ├── 04-error-handling.md    # 错误处理
│   ├── 05-git-workflow.md      # Git 规范
│   ├── 06-comments.md          # 注释规范
│   └── 07-forbidden.md         # 禁止事项
│
├── agents/                     # 代理（专业任务委托）
│   ├── architect.md            # 架构师
│   ├── code-reviewer.md        # 代码审查员
│   └── tdd-guide.md            # TDD 指导
│
├── commands/                   # 命令（斜杠快捷入口）
│   ├── learn.md                # /learn 提取模式
│   ├── evolve.md               # /evolve 演化
│   ├── instinct-status.md      # /instinct-status 状态
│   ├── instinct-export.md      # /instinct-export 导出
│   ├── instinct-import.md      # /instinct-import 导入
│   ├── plan.md                 # /plan 实施计划
│   ├── verify.md               # /verify 验证
│   ├── code-review.md          # /code-review 审查
│   └── tdd.md                  # /tdd 测试驱动开发
│
├── contexts/                   # 上下文（模式切换）
│   ├── dev.md                  # 开发模式
│   ├── research.md             # 研究模式
│   └── review.md               # 审查模式
│
├── skills/
│   ├── continuous-learning-v2/ # 自主学习系统
│   │   ├── SKILL.md            # 技能说明
│   │   ├── config.json         # 配置
│   │   ├── agents/
│   │   │   ├── observer.md     # Observer Agent (Haiku)
│   │   │   └── start-observer.sh
│   │   └── hooks/
│   │       └── observe-v2.js   # 增强观察脚本
│   └── learned/                # 学习到的模式
│
├── hooks/                      # 钩子脚本
│   ├── README.md
│   ├── check-console-log.js
│   ├── evaluate-session.js
│   └── observe.js
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
| `/verify` | 运行全面验证检查 |
| `/code-review` | 代码审查 |
| `/learn` | 从会话提取模式 |
| `/evolve` | 演化模式为高级结构 |
| `/instinct-status` | 查看学习状态 |
| `/instinct-export` | 导出直觉分享 |
| `/instinct-import` | 导入他人直觉 |

## Continuous Learning v2

### 工作流程

```
会话活动 → Hooks 观察 → observations.jsonl
                            ↓
                     Observer Agent (Haiku)
                            ↓
                     instincts/personal/
                            ↓
                     /evolve 聚类
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

## 使用流程

```
1. 复制到 ~/.claude/
2. 使用 /plan 规划功能
3. 使用 /tdd 实现代码
4. 使用 /verify 验证
5. 使用 /code-review 审查
6. 使用 /learn 积累模式
7. 使用 /evolve 演化
8. 使用 /instinct-export 分享
```
