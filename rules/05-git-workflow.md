# Git 提交规范

## 提交格式 (CRITICAL)

```
<type>(<scope>): <subject>

type 类型：
feat:     新功能
fix:      修复 bug
docs:     文档更新
style:    代码格式调整（不影响逻辑）
refactor: 重构（不新增功能，不修复bug）
perf:     性能优化
test:     测试相关
chore:    构建/工具变更
```

## 提交示例

```bash
# CORRECT
feat(user): 添加用户登录功能
fix(cart): 修复购物车数量计算错误
docs(api): 更新接口文档

# WRONG
update code
fix bug
修改了一些东西
```

## 提交检查清单

提交前 ALWAYS 检查：
- [ ] 提交信息符合规范
- [ ] 无 console.log 调试代码
- [ ] 无硬编码的敏感信息
- [ ] 代码已通过 lint 检查
- [ ] 只暂存本次任务相关文件
- [ ] PR 前验证结果已记录

## PR 工作流

- 用户要求提交、推送、创建 PR 时，读取 `commands/pr.md` 和 `rules/common/pr-automation.md`。
- 不在 `main`、`master`、`prod` 等受保护分支直接提交。
- 推送分支、创建 PR、合并 PR 前必须向用户确认。
- PR 描述必须包含背景、核心改动、验证结果、风险与回滚。
