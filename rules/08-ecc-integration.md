## Agent 使用原则 (CRITICAL)

**核心理念**: 按任务复杂度选择是否路由到专业 agent。简单、明确、低风险的任务优先由当前 agent 直接完成；复杂、跨领域或需要独立视角的任务再委派给专业 agent。

| 场景         | 使用 Agent        | 时机            |
| ------------ | ----------------- | --------------- |
| 复杂功能实现 | planner           | 开始编码前      |
| 架构决策     | architect         | 设计阶段        |
| 代码质量审查 | code-reviewer     | 编写代码后      |
| 安全审查     | security-reviewer | 提交前          |
| 测试驱动开发 | tdd-guide         | 新功能/bug 修复 |
| 端到端测试   | e2e-runner        | 关键用户路径、Playwright 维护与执行 |
| 构建错误     | build-resolver    | 编译失败时      |

**并行执行**: 仅当任务复杂、相互独立且用户明确允许或收益明显时,并行启动多个 agents。不要为了简单任务或轻量检查启动额外 agent。

## Hook 自动化系统

### Hook 类型

| 类型        | 触发时机     | 用途                           |
| ----------- | ------------ | ------------------------------ |
| PreToolUse  | 工具执行前   | 验证、参数检查、阻止危险操作   |
| PostToolUse | 工具执行后   | 自动格式化、质量检查、反馈循环 |
| Stop        | 会话结束时   | 最终验证、状态持久化           |
| PreCompact  | 上下文压缩前 | 保存关键信息                   |

### 退出码约定

| 退出码 | 含义                         |
| ------ | ---------------------------- |
| 0      | 成功继续,stderr 作为警告     |
| 2      | 阻止工具调用 (仅 PreToolUse) |
| 非零   | 错误但不阻止                 |

### Hook Profile 控制

```bash
# minimal | standard | strict (默认: standard)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook
export ECC_DISABLED_HOOKS="pre:bash:commit-quality,post:edit:console-log"
```

## 性能优化策略 (CRITICAL)

### 模型选择

| 模型   | 适用场景                              | 成本 |
| ------ | ------------------------------------- | ---- |
| Haiku  | 轻量 agent、高频调用、Worker agent    | 低   |
| Sonnet | 主要开发工作、多 agent 编排、复杂编码 | 中   |
| Opus   | 深度架构推理、复杂分析、研究任务      | 高   |

**默认使用 Sonnet**,仅在需要深度推理时切换 Opus

**上下文窗口管理**:

- MCP 工具描述消耗 Token,控制同时启用的 MCP 数量 (<10)
- 控制活跃工具数 (<80)
- 使用 `disabledMcpServers` 禁用未使用的 MCP

### 战略压缩时机

**适合压缩**:

- 研究/探索完成后,实施前
- 完成里程碑后,开始下一个前
- 调试完成后,继续功能开发前
- 失败方案后,尝试新方案前

**不适合压缩**:

- 实施过程中 (会丢失变量名、文件路径、部分状态)

### 上下文窗口低区域

避免在上下文窗口的最后 20% 执行:

- 大规模重构
- 跨多文件的功能实现
- 复杂交互调试

低上下文敏感度任务:

- 单文件编辑
- 独立工具类创建
- 文档更新
- 简单 Bug 修复

## Skills 工作流系统

### Skills 结构

```bash
~/.claude/skills/
  coding-standards.md    # 语言最佳实践
  tdd-workflow/          # 多文件 skill 包含 SKILL.md
  security-review/       # 基于检查清单的 skill
  backend-patterns/      # 后端设计模式
  frontend-patterns/     # 前端设计模式
```

### Skill 格式

每个 skill 必须包含:

- **When to Use**: 何时使用此 skill
- **How It Works**: 工作原理
- **Examples**: 实际示例
- **Codemaps**: 代码库导航地图 (可选)

### 持续学习

使用 `/learn` 从会话中自动提取可复用模式保存为 skills

## 安全优先原则 (CRITICAL)

### 必须遵守

| 规则         | 说明                               |
| ------------ | ---------------------------------- |
| 输入验证     | 所有外部输入必须验证               |
| 敏感信息保护 | 禁止硬编码 API keys/tokens/secrets |
| 安全检查     | 不绕过验证 hooks                   |
| 沙箱隔离     | 危险操作使用沙箱环境               |

### AgentShield 集成

提交前自动运行安全扫描:

- SQL 注入检测
- XSS 漏洞检测
- 敏感信息泄露检测
- 依赖漏洞扫描

## 测试驱动开发 (CRITICAL)

### TDD 工作流

```
1. 理解需求 → 编写测试
2. 运行测试 → 确认失败
3. 实现功能 → 最小化实现
4. 运行测试 → 确认通过
5. 重构代码 → 保持测试通过
```

### 测试要求

| 要求     | 标准             |
| -------- | ---------------- |
| 覆盖率   | ≥ 80%            |
| 测试先行 | 实现前必须有测试 |
| 关键路径 | 100% 覆盖        |
| 提交前   | 所有测试必须通过 |

### 端到端测试 (E2E)

- **技能**: `skills/e2e-testing/SKILL.md` — Playwright 目录结构、POM、配置、CI、制品、flake 处理。
- **代理**: `e2e-runner` — 优先 Agent Browser，回退 Playwright；编写/维护 spec、本地重复跑测、隔离不稳定用例。
- **入口**: `/e2e`（`commands/e2e.md`）— 委派上述技能；复杂或从零搭建时可 spawn `e2e-runner`。
- 与单元/集成测试并列：关键业务路径在合并前应有 E2E 覆盖或明确缺口与跟进项。

## 不可变性原则

优先使用显式状态转换而非直接修改:

```typescript
// CORRECT: 不可变更新
const newState = { ...oldState, field: newValue };

// WRONG: 直接修改
oldState.field = newValue;
```

## 计划先于执行

复杂变更必须分解为明确的阶段:

1. **理解阶段**: 阅读相关代码,理解现有架构
2. **设计阶段**: 对复杂架构决策使用 architect agent 设计方案
3. **规划阶段**: 对跨多文件或多阶段变更使用 planner agent 制定实施计划
4. **实施阶段**: 增量实现,每步保持可运行
5. **验证阶段**: 测试和安全审查

## Agent 编排最佳实践

### 并行任务执行

复杂任务中,对相互独立且收益明显的操作使用并行执行:

```markdown
# 正确: 并行执行

并行启动 3 个 agents:

1. Agent 1: auth.ts 的安全分析
2. Agent 2: 缓存系统的性能审查
3. Agent 3: utils.ts 的类型检查

# 错误: 不必要的串行执行

先 agent 1,然后 agent 2,然后 agent 3
```

### 多视角分析

对于复杂问题,可按需使用分角色子 agents:

- 事实审查员
- 高级工程师
- 安全专家
- 一致性审查员
- 冗余检查员

## 权限管理

- 为受信任的、定义明确的计划启用自动接受
- 探索性工作时禁用
- 不使用 `dangerously-skip-permissions` 标志
- 在 `~/.claude.json` 中配置 `allowedTools`

## 跨平台支持

- 使用 Node.js 脚本而非 shell 脚本
- 自动检测包管理器 (npm/pnpm/yarn/bun)
- 支持 Windows/macOS/Linux
