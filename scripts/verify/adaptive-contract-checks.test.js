"use strict";

const assert = require("node:assert/strict");
const { createHarnessContext } = require("./core");
const { runAdaptiveContractChecks } = require("./adaptive-contract-checks");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

function verify(file, transform) {
  const context = createHarnessContext(root);
  const read = context.read;
  context.read = (name) => name === file ? transform(read(name)) : read(name);
  runAdaptiveContractChecks(context);
  return context.errors;
}

assert.deepEqual(verify(), []);
const regressions = [
  ["README.md", (s) => s + "\n没有 failing test，不写行为代码", /obsolete method gate/],
  ["skills/continuous-learning-v2/agents/observer.md", (s) => s + "\n使用 Haiku 以提高成本效益", /obsolete method gate/],
  ["skills/implement/SKILL.md", (s) => s + "\n只有 clean baseline 才进入实施", /obsolete method gate/],
  ["rules/common/context-hygiene.md", (s) => s + "\n最多进行三轮检索", /obsolete method gate/],
  ["rules/common/testing.md", (s) => s.replace("不人为制造 RED", "先制造 RED"), /missing adaptive contract/],
  ["rules/05-git-workflow.md", (s) => s + "\n单文件新功能也不例外", /obsolete method gate/],
  ["skills/using-superpowers/SKILL.md", (s) => s.replace("persistent data/schema migration", ""), /missing adaptive contract/],
  ["agents/harness-optimizer.md", (s) => s.replaceAll("审计和咨询默认只读", "审计可编辑"), /missing adaptive contract/],
  ["skills/test-driven-development/SKILL.md", (s) => s.replace("用户或目标项目明确要求 TDD 时严格执行", ""), /missing adaptive contract/],
  ["skills/code-review/SKILL.md", (s) => s.replace("explicit request for independent review", ""), /missing adaptive contract/],
  ["skills/spec-gate/SKILL.md", (s) => s.replace("the user has explicitly approved it", ""), /missing adaptive contract/],
  ["agents/e2e-runner.md", (s) => s.replace("---\n", "---\nmodel: haiku\n"), /inherit user model/],
  ["rules/common/performance.md", (s) => s + "\n活跃工具少于 80 个", /obsolete method gate/],
];
for (const [file, transform, expected] of regressions) {
  assert.match(verify(file, transform).join("\n"), expected, file);
}
console.log(`Adaptive static contract checks passed (${regressions.length} injected regressions); model evaluation NOT RUN.`);
