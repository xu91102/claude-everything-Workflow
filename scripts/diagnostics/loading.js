"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { options, hash, normalize } = require("./capabilities");
const source = path.resolve(__dirname, "../..");
const cases = require("../../harness/loading/cases.json").cases;

function inventory(roots) {
  const files = new Map();
  function visit(root, relative) {
    const file = path.join(root, relative);
    let stat;
    try { stat = fs.statSync(file); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    if (stat.isDirectory()) {
      // Source references may be symlinks; don't recursively follow directory links.
      if (fs.lstatSync(file).isSymbolicLink()) return;
      for (const name of fs.readdirSync(file).sort()) visit(root, path.join(relative, name));
    } else if (stat.isFile() && relative.endsWith(".md")) {
      const body = normalize(fs.readFileSync(file, "utf8"));
      if (!body.trim()) return;
      const logical = relative.split(path.sep).join("/").replace(/^\.(?:agents|claude)\/skills\//, "skills/");
      const digest = hash(body);
      const key = digest;
      const item = files.get(key) || { path: logical, sha256: digest, body, aliases: [], candidatePaths: [], reads: 0 };
      if (!item.aliases.includes(logical)) item.aliases.push(logical);
      item.candidatePaths.push(file);
      files.set(key, item);
    }
  }
  for (const root of roots) for (const dir of ["AGENTS.md", "CLAUDE.md", "rules", "skills", "references", "agents", "commands", ".agents/skills", ".claude/skills"]) visit(root, dir);
  return [...files.values()];
}

function analyze({ trace, caseId, roots = [] }) {
  const scenario = cases.find((item) => item.id === caseId);
  if (!scenario) throw new Error(`Unknown case: ${caseId}; choose ${cases.map((c) => c.id).join(", ")}`);
  const content = fs.readFileSync(trace, "utf8");
  const events = content.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`Invalid JSONL at line ${i + 1}`); }
  });
  if (!events.length) throw new Error("Empty trace");
  const files = inventory([...new Set([source, ...roots.map((root) => path.resolve(root))])]);
  let commands = 0;
  let completed = false;
  let usage = null;
  for (const event of events) {
    if (event.type === "turn.completed") {
      completed = true;
      if (event.usage) {
        usage ||= {};
        for (const [key, value] of Object.entries(event.usage)) {
          if (typeof value === "number") usage[key] = (usage[key] || 0) + value;
        }
      }
    }
    if (["turn.started", "turn.failed", "error"].includes(event.type)) completed = false;
    if (event.type !== "item.completed" || event.item?.type !== "command_execution") continue;
    commands++;
    const body = normalize(event.item.aggregated_output || "");
    const matches = [];
    for (const file of files) {
      let offset = 0;
      let position;
      while ((position = body.indexOf(file.body, offset)) !== -1) {
        matches.push({ file, start: position, end: position + file.body.length });
        offset = position + file.body.length;
      }
    }
    // Prefer the longer installed variant over a contained reference body. One output span
    // represents one read even if the same text exists at several candidate paths.
    const selected = [];
    matches.sort((a, b) => b.file.body.length - a.file.body.length);
    for (const match of matches) {
      if (selected.some((other) => match.start < other.end && other.start < match.end)) continue;
      selected.push(match);
      match.file.reads++;
    }
  }
  const observed = files.filter((file) => file.reads).map(({ body, ...file }) => ({
    ...file, charactersPerRead: body.length,
    observedCharacters: body.length * file.reads, repeatedCharacters: body.length * (file.reads - 1),
    estimatedTokens: Math.ceil(body.length * file.reads / 4),
  }));
  const violations = observed.filter((file) => scenario.forbidden.some((prefix) => file.aliases.some((alias) => alias.startsWith(prefix))))
    .map((file) => ({ path: file.path, reads: file.reads }));
  return {
    schemaVersion: 1, caseId, label: scenario.label, traceHash: hash(content),
    reference: { version: require("../../package.json").version, root: source },
    coverage: "full-file-tool-output-only", sampleStatus: completed ? "COMPLETE" : "INCOMPLETE",
    assessment: !completed ? "INSUFFICIENT_EVIDENCE" : violations.length ? "VIOLATION_OBSERVED" : "NO_VIOLATION_OBSERVED",
    limitations: ["Host-injected context, partial or transformed reads and other tool types are not counted.",
      "candidatePaths locate matching content, not proof of which installed copy the host selected.",
      "Characters/4 is an estimate, not measured model tokens or proven savings. Host usage covers the entire turn.",
      "Read assertions do not prove successful behavior, safety or verification; review the transcript against the case."],
    summary: {
      commands, uniqueFiles: observed.length, reads: observed.reduce((n, file) => n + file.reads, 0),
      observedCharacters: observed.reduce((n, file) => n + file.observedCharacters, 0),
      repeatedCharacters: observed.reduce((n, file) => n + file.repeatedCharacters, 0),
      estimatedTokens: observed.reduce((n, file) => n + file.estimatedTokens, 0), actualFileTokens: null,
    },
    hostUsage: usage, violations, files: observed, review: scenario.review,
  };
}

function main(args) {
  try {
    const opts = options(args, ["--trace", "--case", "--root", "--json", "--help"], ["--root"]);
    if (opts["--help"]) {
      console.log("cew loading --trace FILE --case ID [--root DIR] [--json]\nCases: " + cases.map((c) => c.id).join(", ") + "\nCodex exec --json input. Exit 0: no forbidden read observed, 1: forbidden read/incomplete trace, 2: invalid input.");
      return;
    }
    if (!opts["--trace"] || !opts["--case"]) throw new Error("--trace and --case are required");
    const report = analyze({ trace: opts["--trace"], caseId: opts["--case"], roots: opts["--root"] });
    if (opts["--json"]) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`${report.label}: ${report.assessment} (${report.coverage})`);
      console.log(`${report.summary.uniqueFiles} files, ${report.summary.reads} reads, ${report.summary.observedCharacters} characters; repeated ${report.summary.repeatedCharacters}`);
      for (const file of report.files) console.log(`  ${file.reads}x ${file.path} (${file.sha256})`);
      for (const violation of report.violations) console.log(`Unexpected read: ${violation.path}`);
      report.limitations.forEach((item) => console.log(item));
    }
    process.exitCode = report.assessment === "NO_VIOLATION_OBSERVED" ? 0 : 1;
  } catch (error) {
    console.error(`loading: ${error.message}`);
    process.exitCode = 2;
  }
}
module.exports = { main, analyze };
