---
description: 运行全面验证检查
---

# /verify - 代码验证

对当前代码库运行全面验证。

## 使用方式

```
/verify          # 完整检查
/verify quick    # 仅构建+类型
/verify pre-pr   # PR 前全面检查
```

## 验证流程

按以下顺序执行：

1. **构建检查**
   - 运行项目构建命令
   - 失败则报告错误并停止

2. **类型检查**
   - 运行 TypeScript 类型检查
   - 报告所有错误（文件:行号）

3. **Lint 检查**
   - 运行代码检查器
   - 报告警告和错误

4. **测试套件**
   - 运行所有测试
   - 报告通过/失败数量
   - 报告覆盖率
   - 若项目已配置 Playwright，运行 E2E（如 `npx playwright test` 或 `package.json` 中的脚本）

5. **Console.log 审计**
   - 搜索源文件中的 console.log
   - 报告位置

6. **Git 状态**
   - 显示未提交的更改
   - 显示自上次提交后修改的文件

## 输出格式

```
验证结果: [通过/失败]

构建:    [OK/失败]
类型:    [OK/X 错误]
Lint:    [OK/X 问题]
测试:    [X/Y 通过, Z% 覆盖率]
日志:    [OK/X 个 console.log]

可提交 PR: [是/否]
```

## 参数

- `quick` - 仅构建 + 类型
- `full` - 所有检查（默认）
- `pre-commit` - 提交相关检查
- `pre-pr` - 完整检查 + 安全扫描
