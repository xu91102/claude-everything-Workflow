#!/usr/bin/env node
"use strict";

const path = require("path");
const { createHarnessContext } = require("./verify/core");
const { runMetadataChecks } = require("./verify/metadata-checks");
const { runRepositoryChecks } = require("./verify/repository-checks");
const { runWorkflowChecks } = require("./verify/workflow-checks");
const { runRuntimeChecks } = require("./verify/runtime-checks");

function main() {
  const root = path.resolve(__dirname, "..");
  const context = createHarnessContext(root);

  runMetadataChecks(context);
  runRepositoryChecks(context);
  runWorkflowChecks(context);
  runRuntimeChecks(context);

  if (context.warnings.length > 0) {
    console.error("Warnings:");
    context.warnings.forEach((item) => console.error(`- ${item}`));
  }

  if (context.errors.length > 0) {
    console.error("Harness verification failed:");
    context.errors.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log("Harness verification passed.");
}

main();
