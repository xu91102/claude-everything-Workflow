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

`quick` 只执行项目识别和构建/类型检查；`full` 执行完整流程；`pre-pr` 在 `full` 基础上补充 PR 风险、制品和描述建议。

按以下顺序执行：

1. **项目识别**
   - 读取 `package.json`、workspace 配置、CI 配置和 README
   - 确认包管理器、monorepo package、已有脚本

2. **仓库卫生**
    - 检查临时文件、备份文件、调试残留
    - 检查 hooks / command / agent 配置引用是否存在
    - 对本仓库 Harness 配置运行 `node scripts/verify-harness.js`

3. **Lint 检查**
   - 运行代码检查器
   - 报告警告和错误

4. **测试套件**
   - 优先运行相关单测
   - PR 前运行仓库规定的 server/web/package 测试
   - 报告通过/失败数量
   - 报告覆盖率（如项目已配置）

5. **构建检查**
   - 运行项目构建命令
   - 失败则报告错误并停止

6. **类型检查**
   - 运行 TypeScript 类型检查
   - 报告所有错误（文件:行号）

7. **E2E 检查**
   - 若项目已配置 Playwright，运行 E2E（如 `npx playwright test` 或 `package.json` 中的脚本）
   - 失败时报告 trace、screenshot、HTML report、test-results 路径

8. **Console.log 审计**
   - 搜索源文件中的 console.log
   - 报告位置

9. **Git 状态**
   - 显示未提交的更改
   - 显示自上次提交后修改的文件

## 输出格式

```
验证结果: [通过/失败]

构建:    [OK/失败]
类型:    [OK/X 错误]
Lint:    [OK/X 问题]
测试:    [X/Y 通过, Z% 覆盖率]
E2E:     [OK/失败/未配置]
日志:    [OK/X 个 console.log]

可提交 PR: [是/否]
```

## 参数

- `quick` - 仅构建 + 类型
- `full` - 所有检查（默认）
- `pre-commit` - 提交相关检查
- `pre-pr` - 完整检查 + 安全扫描

## PR 前补充

`pre-pr` 模式需要读取 `rules/common/pr-automation.md`，并输出：

- 已运行命令和结果
- 未运行检查及原因
- 失败制品路径
- 剩余风险和建议的 PR 描述
