---
name: continuous-learning-v2
description: 基于直觉的学习系统。用于配置或审查 Hook 观察、project/global instinct、置信度、项目推广、迁移和演化为 skills/commands/agents 的流程。
version: 2.1.0
---

# Continuous Learning v2.1

本 skill 只保留使用决策和关键边界；实现细节在 `scripts/learning/`、`hooks/`、`commands/` 和 `config.json` 中。

## 何时使用

- 配置或排查自动观察 Hook。
- 查看、审查、迁移 project/global instincts。
- 判断 project instinct 是否应推广到 global。
- 评估 instinct 是否应演化为 skill、command 或 agent。

## 核心模型

- **Observation**：Hook 记录工具调用，默认写入 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/projects/<project-id>/observations.jsonl`。
- **Project instinct**：默认作用域，只服务当前项目，避免跨项目污染。
- **Global instinct**：经用户确认后才跨项目应用。
- **Confidence**：`0.3/0.5/0.7/0.9`，不会因时间自动衰减；长期未观察只进入待审查。
- **Promotion**：先 `/learn promote --dry-run` 预览，再由用户确认是否 `--apply`。

## 数据布局

```text
${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/
├── projects.json
├── projects/<project-id>/
│   ├── observations.jsonl
│   └── instincts/{personal,inherited}/
└── global/
    └── instincts/{personal,inherited}/
```

旧版 `~/.claude/homunculus/instincts` 作为 legacy 来源兼容；需要迁移时先 dry-run。

## 命令

| 命令 | 作用 |
| --- | --- |
| `/learn eval` | 从当前会话提取可复用模式，保存前走质量门 |
| `/learn status --review` | 调用 `scripts/learning/review-confidence.js` 审查 project/global/legacy instincts |
| `/learn projects` | 调用 `scripts/learning/projects.js` 查看项目注册表 |
| `/learn promote --dry-run` | 调用 `scripts/learning/promote.js` 预览 project -> global |
| `/learn evolve` | 聚类 instinct，评估是否演化为 skill/command/agent |
| `/learn prune` | 只清理人工标记删除、拒绝或归档的 instinct |

## 脚本入口

- `skills/continuous-learning-v2/hooks/observe-v2.js`：Hook 观察入口。
- `scripts/learning/project-utils.js`：项目检测、数据根目录、注册表和 frontmatter 工具。
- `scripts/learning/review-confidence.js`：置信度审查报告。
- `scripts/learning/projects.js`：项目注册表。
- `scripts/learning/promote.js`：项目直觉推广预览/应用。
- `scripts/learning/migrate-homunculus.js`：legacy 迁移，默认 dry-run。

## 安全边界

- 默认不启用后台 observer；`observer.enabled` 保持 `false`，避免额外 token 和误学习。
- 不自动导入、导出、推广或删除 instinct。
- 不把 raw observations 当作可共享知识；共享前只处理 instinct。
- 不把 project instinct 自动提升为 global。

## 迁移

```bash
node scripts/learning/migrate-homunculus.js --dry-run
node scripts/learning/migrate-homunculus.js --scope project --apply
```

迁移只复制，不删除旧数据。需要全局化时先运行 `--scope global --dry-run`。
