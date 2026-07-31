---
name: skill-creator
description: 创建、验证和打包仓库自包含的 Codex/Claude skill；适用于新增或维护 SKILL.md、脚本与参考材料。
---

# Skill Creator

这是仓库内的 **self-contained** fallback；不能依赖宿主预装同名系统 skill。

## When to Use

用户要新增、更新、验证或打包一个可复用 skill 时使用。

## Create

1. 明确可观察触发条件、输入、输出、权限边界与失败状态。
2. 选择唯一 kebab-case 名称，避免与现有 `skills/*` 冲突。
3. 可用标准库脚手架创建目录：

   ```bash
   python3 skills/skill-creator/scripts/init_skill.py <name> --path skills
   ```

4. 保持 `SKILL.md` 精炼；长参考放 `references/`，确定性自动化放 `scripts/`。
5. 为 Codex 增加 `agents/openai.yaml`，并保证 invocation mode 与 frontmatter 一致。
6. 更新 `skills/README.md` 和仓库 Harness。

## Validate and Package

```bash
python3 skills/skill-creator/scripts/quick_validate.py skills/<name>
python3 skills/skill-creator/scripts/package_skill.py skills/<name> dist
```

验证失败必须修复后再打包。不得把 secrets、缓存、worktree 状态或无关大文件打进产物。
涉及行为变化时遵循 `test-driven-development`；声称完成前运行仓库验证。

## Example

“创建一个只读日志审计 skill”先定义触发与权限边界，再生成 skeleton、补测试并打包。

## Exit

返回 `SKILL_READY`、`VALIDATION_FAILED` 或 `BLOCKED_BY_UNRESOLVED_CONTRACT`，并列出产物和验证。
