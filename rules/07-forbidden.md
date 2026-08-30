# 禁止事项 (CRITICAL)

## 代码禁止

- `console.log`、`debugger`、`@ts-ignore`、`@ts-nocheck` 和 `any` 由 Hook 静态检查（`hooks/check-console-log.js`，随编辑触发）；`dynamic`、循环依赖和 emoji 属于审查判断项。
- 它们分别破坏类型安全、隐藏问题、增加耦合或带来编码、性能问题。

## 安全禁止

- 硬编码密钥、API key、token、secret 或密码（改用环境变量）、SQL 字符串拼接（改用参数化）、未校验任何外部输入、明文密码（改用 hash）、绕过验证或质量门 Hook，以及提交调试代码。
- 危险操作必须在沙箱或等价隔离环境中执行；安全敏感改动提交前按风险检查 SQL 注入、XSS、敏感信息泄露和依赖漏洞。

## 提交禁止

- `node_modules` 等依赖目录、`.env` 等敏感配置、`dist`/`build` 等应由 CI 生成的产物，以及无提交信息的提交。

## 违规检查

发现违规时立即指出问题，解释原因并提供修复方案。
