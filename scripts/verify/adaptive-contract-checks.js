"use strict";

// Static policy regression guards, not a model behavior evaluation or runtime permission layer.
const contracts = [
  ["README.md", ["Host profiles"], /没有 failing test，不写行为代码|新功能必须使用 worktree|Observer Agent \(Haiku\)/],
  ["skills/continuous-learning-v2/agents/observer.md", ["rules/common/performance.md"], /使用 Haiku 以提高成本效益/],
  ["rules/common/agent-orchestration.md", ["实施者不能充当自己的独立审查者", "并行写入", "整体回归"], /最多进行三轮检索|等待用户明确要求继续，不自行追加轮次/],
  ["rules/common/performance.md", ["尊重用户选择的模型与推理配置", "用户明确启用成本优先策略", "宿主权限", "用户预算"], /最低成本模型|少于 10 个 MCP|少于 80 个/],
  ["rules/common/testing.md", ["有效复现，继续修复", "已证实无关的历史失败", "验证受阻", "不人为制造 RED", "用户或目标项目明确要求时严格执行", "不得删除有效测试"], null],
  ["skills/implement/SKILL.md", ["rules/common/testing.md", "可以继续修复", "需要独立审查却无法启动时不得降级"], /只有 clean baseline 才进入实施/],
  ["rules/05-git-workflow.md", ["已有安全任务分支", "不丢弃或覆盖用户已有改动", "用户指定、现有任务基线", "不在 `main`、`master`、`prod` 等受保护分支直接提交"], /开发新功能必须使用独立|单文件新功能也不例外/],
  ["skills/spec-gate/SKILL.md", ["not section count or order", "the user has explicitly approved it", "migration safety"], /Use this section order/],
  ["agents/harness-optimizer.md", ["审计和咨询默认只读", "路由到本 agent 不构成写入授权", "未运行模型对照"], /72\/100|85\/100|预期影响: \+X 分/],
  ["skills/using-superpowers/SKILL.md", ["unless explicitly requested", "persistent data/schema migration", "irreversible external side effect"], /behavior change with a test path\?\s*-> test-driven-development/],
  ["skills/test-driven-development/SKILL.md", ["已有有效失败测试即满足 RED", "用户或目标项目明确要求 TDD 时严格执行"], null],
  ["skills/code-review/SKILL.md", ["explicit request for independent review", "cannot serve as its own independent reviewer"], null],
];

function runAdaptiveContractChecks({ exists, read, fail, managedFiles }) {
  for (const [file, required, obsolete] of contracts) {
    if (!exists(file)) {
      fail(`adaptive contract missing: ${file}`);
      continue;
    }
    const body = read(file);
    for (const token of required) {
      if (!body.includes(token)) fail(`${file}: missing adaptive contract: ${token}`);
    }
    if (obsolete?.test(body)) fail(`${file}: obsolete method gate`);
  }
  for (const file of managedFiles().filter((file) => /(?:^|\/)agents\/.*\.md$/.test(file))) {
    const header = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (header && /^model:\s*(?!inherit\s*$)\S+/m.test(header[1])) {
      fail(`${file}: bundled agents must inherit user model selection`);
    }
  }
  const config = JSON.parse(read("skills/continuous-learning-v2/config.json"));
  if (config.observer.model) fail("observer must inherit user model selection");
  const manifest = JSON.parse(read("harness/manifest.json"));
  if (!manifest.description.includes("不代表已有运行时强制保障")) fail("manifest must distinguish policy from runtime enforcement");
}

module.exports = { runAdaptiveContractChecks };
