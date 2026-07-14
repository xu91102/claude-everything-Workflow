#!/usr/bin/env node
"use strict";

const { errors, warnings } = require("./verify/context");
const {
  checkCommands,
  checkGitHubWorkflows,
  checkHookConfigReferences,
  checkInstallRuntimePolicy,
  checkLearningPathPolicy,
  checkNpmPackageSurface,
  checkReadmeTreePaths,
  checkRouterTargets,
  checkSkillCategoryIndex,
  checkSkillLinks,
} = require("./verify/structure-checks");
const {
  checkContinuousLearningV21,
  checkForbiddenCommandDrift,
  checkGitDiffWhitespace,
  checkObserveV2,
  checkRuleLoadingPolicy,
  checkScriptLayout,
  checkSuperpowersDevLoop,
} = require("./verify/policy-checks");

function writeList(title, items) {
  process.stderr.write(`${title}\n`);
  for (const item of items) process.stderr.write(`- ${item}\n`);
}

function main() {
  checkCommands();
  checkReadmeTreePaths();
  checkInstallRuntimePolicy();
  checkHookConfigReferences();
  checkGitHubWorkflows();
  checkLearningPathPolicy();
  checkSkillCategoryIndex();
  checkRouterTargets();
  checkNpmPackageSurface();
  checkSkillLinks();
  checkRuleLoadingPolicy();
  checkSuperpowersDevLoop();
  checkForbiddenCommandDrift();
  checkScriptLayout();
  checkContinuousLearningV21();
  checkObserveV2();
  checkGitDiffWhitespace();

  if (warnings.length > 0) writeList("Warnings:", warnings);
  if (errors.length > 0) {
    writeList("Harness verification failed:", errors);
    process.exit(1);
  }
  process.stdout.write("Harness verification passed.\n");
}

main();
