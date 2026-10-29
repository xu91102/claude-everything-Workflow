# 相称审查

按实际风险与验证证据选择，不按文件数量、direct/formal 标签、模型或可用 agent 数决定。
项目或用户明确要求更强审查时沿用；`--mode self|independent|dual` 不能削弱必需审查。

| 模式 | 条件与动作 |
| --- | --- |
| self | 需求清楚、本地可逆且低风险，已有直接检查/相关测试覆盖结果，无未决风险或重复异常失败；核对原始需求、完整差异和证据即可，不加载独立提示或创建子代理 |
| independent | 跨模块行为、复杂依赖或算法重写、隐藏约束、本地验证后仍有证据缺口、重复异常失败或明确要求独立审查；one fresh read-only subagent 检查 Standards 与 Spec |
| dual | 鉴权、持久数据、破坏性操作、公共契约变更等高风险，或明确要求两个隔离轴；two parallel subagents 分别审查 Standards 与 Spec |

self 无需 subagent。其他模式用完整 Code Review Skill 固定包；实现者不能充当自己的独立审查者。
容量不足不构成降级理由：可继续安全实现/验证，但必需独立审查标 NOT RUN、交付门为 BLOCKED，不能宣称完成。
不能并发时 dual 可在 fresh context 顺序执行。证据不足先补本地验证；真实环境/权限缺口保持未完成，审查不替代验证，原始需求与兼容约束保持不变。
