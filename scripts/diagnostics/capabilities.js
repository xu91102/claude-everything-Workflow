"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { Parser } = require("commonmark");
const { parseFrontmatter } = require("../verify/skill-manifest-checks");

const source = path.resolve(__dirname, "../..");
const normalize = (value) => value.replace(/\r\n/g, "\n");
const hash = (value) => crypto.createHash("sha256").update(normalize(value)).digest("hex");
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const within = (root, file) => file === root || file.startsWith(root + path.sep);

function read(file) {
  try {
    if (!fs.statSync(file).isFile()) return { status: "NOT_FILE" };
    return { status: "READABLE", body: fs.readFileSync(file, "utf8") };
  } catch (error) {
    return { status: error.code === "ENOENT" ? "MISSING" : "UNREADABLE", error: error.code };
  }
}

function comparison(expected, actual) {
  const current = read(actual);
  const original = read(expected);
  return {
    status: current.status !== "READABLE" ? current.status : original.status !== "READABLE" ? "NO_REFERENCE"
      : hash(original.body) === hash(current.body) ? "MATCH" : "DIFFERENT",
    expectedHash: original.body === undefined ? null : hash(original.body),
    actualHash: current.body === undefined ? null : hash(current.body),
  };
}

function options(args, allowed, repeat = []) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.includes(key)) throw new Error(`Unknown option: ${key}`);
    if (key === "--json" || key === "--help") { result[key] = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value: ${key}`);
    if (repeat.includes(key)) (result[key] ||= []).push(value);
    else if (key in result) throw new Error(`Repeated option: ${key}`);
    else result[key] = value;
  }
  return result;
}

function pluginRoots(searchRoot, host, issues) {
  const found = [];
  const seen = new Set();
  let count = 0;
  function visit(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      const real = fs.realpathSync(dir);
      if (seen.has(real)) return;
      seen.add(real);
      if (++count > 4000) throw new Error("scan limit");
      const manifest = read(path.join(dir, host === "codex" ? ".codex-plugin/plugin.json" : ".claude-plugin/plugin.json"));
      if (manifest.status === "READABLE") {
        const metadata = JSON.parse(manifest.body);
        if (metadata.name === "claude-everything-workflow") {
          found.push({ path: dir, kind: "plugin-cache", activation: "UNVERIFIED" });
          return;
        }
      }
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code !== "ENOENT") issues.push({ code: "SCAN_INCOMPLETE", path: dir, reason: error.code || error.message });
      return;
    }
    for (const entry of entries) if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
      visit(path.join(dir, entry.name), depth + 1);
    }
  }
  visit(searchRoot, 0);
  return found;
}

// Only concrete, distributed paths are dependencies. Project artifacts and external URLs are not.
// A missing new relative Markdown link in a personal skill is still reported, never silently accepted.
function references(body, relative) {
  const found = new Set();
  const local = new Set();
  const add = (target, link = false) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(target) || /[<>*{}$]/.test(target)) return;
    target = target.split("#")[0];
    let resolved;
    const sibling = path.posix.normalize(path.posix.join(path.posix.dirname(relative), target));
    if (isFile(path.join(source, sibling))) resolved = sibling;
    else if (isFile(path.join(source, target))) resolved = target;
    else if (/^(?:skills|rules|agents|commands|scripts|hooks|harness)\//.test(target)) resolved = path.posix.normalize(target);
    else if (link || target.startsWith("references/")) resolved = sibling;
    if (!resolved) return;
    if (resolved.startsWith("../")) { local.add(target); return; }
    found.add(resolved);
  };
  for (const match of body.matchAll(/\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) add(match[1], true);
  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    if (/^(?:skills|rules|references|agents|commands|scripts|hooks|harness)\/[\w./-]+\.[\w]+$/.test(match[1])) add(match[1]);
  }
  const walker = new Parser().parse(body).walker();
  let event;
  while ((event = walker.next())) {
    if (!event.entering || event.node.type !== "code_block") continue;
    for (const match of event.node.literal.matchAll(/(?:^|[\s`(])((?:skills|rules|references|agents|commands|scripts|hooks|harness)\/[\w./-]+\.[\w]+)/g)) add(match[1]);
  }
  return { paths: [...found].sort(), unresolved: [...local] };
}

function dependencyPath(relative, root, hostRoot, project, host) {
  if (!relative.startsWith("rules/")) return path.join(root, relative);
  const candidates = [path.join(project, relative), path.join(hostRoot, relative)];
  if (host === "claude" && relative.startsWith("rules/common/")) candidates.push(path.join(hostRoot, "references", relative));
  // Plugin-bundled rules are not an automatic fallback: AGENTS.md does not define one.
  return candidates.find((file) => fs.existsSync(file)) || candidates.at(-1);
}

function skillMetadata(body, name) {
  try {
    const parsed = parseFrontmatter(body || "");
    if (!parsed || parsed.name !== name || typeof parsed.description !== "string" || !parsed.description.trim()) {
      return { status: "INVALID", reason: "Missing or mismatched name/description" };
    }
    return { status: "VALID" };
  } catch { return { status: "INVALID", reason: "Invalid frontmatter YAML" }; }
}

function candidate(skill, root, hostRoot, project, host) {
  const file = path.join(root.path, skill.path);
  const content = comparison(path.join(source, skill.path), file);
  const actual = read(file);
  const metadata = skillMetadata(actual.body, skill.name);
  const expected = read(path.join(source, skill.path));
  const refs = references((expected.body || "") + "\n" + (actual.body || ""), skill.path);
  const dependencies = refs.paths.map((relative) => {
    const target = dependencyPath(relative, root.path, hostRoot, project, host);
    return { reference: relative, path: target, ...comparison(path.join(source, relative), target) };
  });
  const manifest = comparison(path.join(source, "harness/manifest.json"), path.join(root.path, "harness/manifest.json"));
  const unavailable = dependencies.some((item) => !["MATCH", "DIFFERENT", "NO_REFERENCE"].includes(item.status));
  return {
    path: file, realPath: fs.realpathSync(file), kind: root.kind, selection: "UNVERIFIED",
    manifestMatch: manifest.status === "MATCH", manifestStatus: manifest.status, content, metadata,
    readiness: actual.status !== "READABLE" || metadata.status === "INVALID" || unavailable ? "BLOCKED"
      : refs.unresolved.length || dependencies.some((item) => item.status === "NO_REFERENCE") ? "UNVERIFIED" : "STATIC_READY",
    dependencies, unresolvedReferences: refs.unresolved,
  };
}

function diagnose({ host = "all", home, project = process.cwd(), plugins = [] } = {}) {
  if (!["all", "codex", "claude"].includes(host)) throw new Error("--host must be all, codex or claude");
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "harness/manifest.json"), "utf8"));
  const issues = [];
  const hosts = (host === "all" ? ["codex", "claude"] : [host]).map((name) => {
    const userHome = path.resolve(home || os.homedir());
    const hostRoot = path.resolve(home ? path.join(userHome, `.${name}`)
      : (name === "codex" ? process.env.CODEX_HOME : process.env.CLAUDE_CONFIG_DIR) || path.join(userHome, `.${name}`));
    const roots = [
      { path: hostRoot, kind: "user-copy" },
      { path: path.resolve(project, `.${name}`), kind: "project" },
      ...(name === "codex" ? [
        { path: path.join(userHome, ".agents"), kind: "shared-user" },
        { path: path.resolve(project, ".agents"), kind: "shared-project" },
      ] : []),
      ...pluginRoots(path.join(hostRoot, "plugins/cache"), name, issues),
      ...plugins.map((dir) => ({ path: path.resolve(dir), kind: "explicit-plugin", activation: "UNVERIFIED" })),
    ];
    const skills = manifest.skills.map((skill) => {
      const seen = new Set();
      const candidates = [];
      for (const root of roots) {
        const file = path.join(root.path, skill.path);
        if (!fs.existsSync(file)) continue;
        const real = fs.realpathSync(file);
        if (seen.has(real)) continue;
        seen.add(real);
        const item = candidate(skill, root, hostRoot, project, name);
        candidates.push(item);
        const manifestPath = path.join(root.path, "harness/manifest.json");
        if (!item.manifestMatch && !issues.some((issue) => issue.host === name && issue.path === manifestPath)) {
          issues.push({ code: "MANIFEST_" + item.manifestStatus, host: name, path: manifestPath });
        }
        if (item.content.status !== "MATCH") issues.push({ code: "BODY_" + item.content.status, host: name, skill: skill.name, path: file });
        if (item.readiness !== "STATIC_READY") issues.push({ code: "DEPENDENCIES_" + item.readiness, host: name, skill: skill.name, path: file });
        for (const dep of item.dependencies.filter((dep) => dep.status === "DIFFERENT")) {
          issues.push({ code: "DEPENDENCY_DIFFERENT", host: name, skill: skill.name, path: dep.path });
        }
      }
      if (candidates.length > 1) issues.push({ code: "DUPLICATE_CANDIDATES", host: name, skill: skill.name });
      return { name: skill.name, discovery: candidates.length ? "DISCOVERED" : "NOT_FOUND", candidates };
    });
    const discovered = skills.filter((skill) => skill.candidates.length).length;
    if (!discovered) issues.push({ code: "NO_INSTALLATION_FOUND", host: name });
    else for (const skill of skills.filter((skill) => !skill.candidates.length)) issues.push({ code: "SKILL_NOT_FOUND", host: name, skill: skill.name });
    return { host: name, hostRoot, discovered, roots, skills };
  });
  return {
    schemaVersion: 1, reference: { root: source, version: require("../../package.json").version, manifestHash: hash(JSON.stringify(manifest)) },
    scope: "Read-only disk inspection; host selection, conditional execution and external tools are unverified. STATIC_READY covers direct concrete local references only.",
    hosts, issues,
  };
}

function main(args) {
  try {
    const opts = options(args, ["--host", "--home", "--project", "--plugin-root", "--json", "--help"], ["--plugin-root"]);
    if (opts["--help"]) {
      console.log("cew doctor [--host all|codex|claude] [--home DIR] [--project DIR] [--plugin-root DIR] [--json]\nRead-only; exit 0: no findings, 1: findings, 2: invalid input. Candidate discovery does not prove host selection.");
      return;
    }
    const report = diagnose({ host: opts["--host"], home: opts["--home"], project: opts["--project"], plugins: opts["--plugin-root"] });
    if (opts["--json"]) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`CEW ${report.reference.version} — read-only capability diagnosis`);
      for (const host of report.hosts) {
        console.log(`${host.host}: ${host.discovered}/${host.skills.length} skills discovered; host selection UNVERIFIED`);
        for (const skill of host.skills) for (const item of skill.candidates) {
          console.log(`  ${skill.name}: ${item.content.status}, ${item.readiness} — ${item.path}`);
          for (const dep of item.dependencies.filter((dep) => dep.status !== "MATCH")) console.log(`    ${dep.status}: ${dep.path}`);
        }
      }
      for (const issue of report.issues) console.log(`${issue.code}: ${issue.host || ""} ${issue.skill || ""} ${issue.path || ""}`);
      console.log(report.scope);
    }
    process.exitCode = report.issues.length ? 1 : 0;
  } catch (error) {
    console.error(`doctor: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = { diagnose, main, options, hash, normalize };
