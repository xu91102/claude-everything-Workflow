---
description: 运行全面验证检查
---

# /verify - 代码验证

`/verify` 是 Superpowers 风格闭环中的 Verify Gate。提交、推送或创建 PR 前，必须有明确验证结果：已运行检查、未运行检查及原因、失败项、剩余风险，以及是否可以进入 `/pr`。

按改动范围和所选模式运行验证，项目已有命令优先。

## 使用方式

```
/verify          # 完整检查
/verify full     # 完整相关检查（默认）
/verify quick    # 仅构建+类型
/verify pre-pr   # PR 前全面检查
```

## 验证流程

`quick` 只执行项目识别和构建/类型检查；`full` 执行完整流程；`pre-pr` 在 `full` 基础上补充 PR 风险、制品和描述建议。

完整相关检查的范围和顺序统一以 `rules/common/testing.md` 为准，不在此复制质量门。具体执行：

- 先读取项目配置与 CI，识别现有命令；`quick` 只运行已有构建和类型检查，不能单独证明 PR 全部就绪。
- `full` / `pre-pr` 按引用规则执行；仓库卫生包含 Hook、command、agent 引用检查，本仓库运行 `node scripts/verify-harness.js`。
- 每项记录命令、退出码和结果；不适用或无法执行的检查说明原因，不伪装通过。
- E2E 失败时保留项目已有的 trace、screenshot、HTML report 和 test-results 路径。
- 结束时检查 Git 状态，确认验证对应最终改动。

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
- `pre-pr` - 完整相关检查 + 下方 PR 前补充

## PR 前补充

`pre-pr` 模式需要读取 `rules/common/pr-automation.md`，并输出：

- 已运行命令和结果
- 未运行检查及原因
- 失败制品路径
- 剩余风险和建议的 PR 描述
