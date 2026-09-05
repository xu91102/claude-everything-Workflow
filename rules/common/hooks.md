# Hooks 系统

## 契约

- `PreToolUse` 负责调用前校验或阻止；`PostToolUse` 负责调用后检查；`Stop` 负责必要的最终门；`PreCompact` 只保存高恢复价值状态。
- 自定义 Hook 从 stdin 读取 JSON；警告写 stderr，只有协议需要时写 stdout。
- 退出码 `0` 表示继续，`2` 仅供 `PreToolUse` 阻止调用，其他非零表示记录错误但不自动阻止。

## 摘要与 Profile

- 摘要字段以 `rules/common/context-hygiene.md` 为唯一来源；不按轮数机械总结，不保存完整 transcript，不覆盖用户规则和决策；敏感内容只记录风险和证据位置，不持久化原值。
- `ECC_HOOK_PROFILE` 支持 `minimal`、默认 `standard` 和 `strict`；`ECC_DISABLED_HOOKS` 禁用指定 Hook ID。
- 会阻止提交的质量门 Hook 默认关闭，只有团队明确需要时启用。
- `check-code-size` 与 `check-console-log` 是兼容性提示，不替代目标项目 lint 或类型规则；项目已有等价检查
  或约定不适用时，可用 `ECC_DISABLED_HOOKS` 关闭相应提示，不能借此绕过项目质量门。

## 权限

仅为受信任、定义明确的计划启用自动接受；探索性工作保持确认。禁止使用 `dangerously-skip-permissions`，工具权限使用受控配置。
