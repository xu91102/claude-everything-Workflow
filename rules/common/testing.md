# 测试与验证

## 默认策略

- 先识别仓库已有的 lint、format、单测、类型、构建和 E2E 命令，不发明替代流程。
- 中间步骤运行覆盖当前改动面的最小验证；完成、跨模块、高风险、发布或 PR 前升级到完整相关质量门。
- 无法运行某项检查时，说明原因、替代证据和剩余风险；不得把未运行写成通过。
- monorepo 的 consumer 依赖内部构建产物时，先构建对应上游 package。

## 验证分层

1. 仓库卫生：临时文件、调试残留、敏感配置和无关改动。
2. Lint / Format：风格、导入和静态问题。
3. 单元或组件测试：本次行为、边界和错误路径。
4. 类型与构建：跨模块接口和真实产物。
5. E2E：核心用户路径、认证、跨服务和发布冒烟。

覆盖率与最终质量门服从目标项目配置；关键路径合并前必须覆盖或明确缺口。不为低风险文档或纯配置整理
制造没有行为价值的测试；使用解析、配置校验或既有验证器。全量 build 成本高时先用更窄检查反馈。

## 行为变化

新功能、bug 修复、重构引起的行为变化和公共 API 变化使用 `skills/test-driven-development/SKILL.md`；本规则不复制 RED/GREEN/REFACTOR 步骤。

复杂、高风险或行为变化按需读取 `rules/09-first-principles-adversarial-testing.md`，覆盖异常状态、重复执行、权限、路径、跨平台和外部依赖失败。

## 端到端测试

Playwright 的组织、等待、POM、CI 制品和 flake 处理以 `skills/e2e-testing/SKILL.md` 为准；探索工具不能替代可重复的 E2E。本地多 worktree 运行时隔离端口和环境变量，启动服务必须等待 Web/API ready。CI 失败时保留 trace、screenshot、HTML report 和 `test-results`。
