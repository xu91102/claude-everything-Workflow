# Hooks 说明

## 已配置 Hooks

### 1. PreCompact Hook - 保留硬性规则

**触发时机**：上下文压缩前

**目的**：防止长对话中代码规模约束被遗忘

**行为**：在 stderr 输出硬性规则提醒，不阻塞压缩

**脚本**：`.claude/hooks/preserve-rules.js`

### 2. Stop Hook - 最终文件规模检查

**触发时机**：会话结束时

**目的**：检查所有源文件是否超过 600 行限制

**行为**：扫描所有源代码文件（排除 node_modules、dist 等），报告超限文件

**检查范围**：
- TypeScript: `*.ts`, `*.tsx`
- JavaScript: `*.js`, `*.jsx`
- Vue: `*.vue`
- Python: `*.py`
- Java: `*.java`

## 手动测试

### 测试 PreCompact Hook

```bash
node .claude/hooks/preserve-rules.js < /dev/null
```

### 测试 Stop Hook

```bash
find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.vue' -o -name '*.py' -o -name '*.java' \) -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' | xargs wc -l 2>/dev/null | awk '$1 > 600 && $2 != "total" {print "⚠️  " $2 " 有 " $1 " 行，超过 600 行限制！"}'
```

## Hook Profile 控制

通过环境变量控制 Hook 行为：

```bash
# 设置 profile (minimal | standard | strict)
export ECC_HOOK_PROFILE=standard

# 禁用特定 Hook
export ECC_DISABLED_HOOKS="preserve-critical-rules,final-size-check"
```

## 配置位置

Hooks 配置在 `.claude/settings.json` 中：

```json
{
  "hooks": {
    "preCompact": [...],
    "stop": [...]
  }
}
```

## 工作原理

1. **PreCompact Hook**：在上下文即将压缩时，强制提醒硬性规则，确保规则不会因上下文衰减而遗忘
2. **Stop Hook**：在会话结束时做最终验证，捕获所有超限文件

## 已知问题

当前仓库中已发现超限文件：
- `scripts/verify-harness.js` (872 行)

建议拆分该文件。
