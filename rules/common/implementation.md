# 实施实践

## 不可变性原则

优先使用显式状态转换而非直接修改：

```typescript
// CORRECT: 不可变更新
const newState = { ...oldState, field: newValue }

// WRONG: 直接修改
oldState.field = newValue
```

## 跨平台支持

- 使用 Node.js 脚本而非脆弱 shell 语法。
- 自动检测包管理器：npm、pnpm、yarn、bun。
- 支持 Windows、macOS、Linux。

## 实施控制

- 每个阶段都应有可验证结果。
- 实施过程中避免无关重构。
- 低上下文剩余时只做单文件编辑、文档更新或简单 bug 修复。
