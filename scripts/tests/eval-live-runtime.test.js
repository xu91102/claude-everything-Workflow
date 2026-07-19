"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");

function loadRuntime() {
  return require(path.join(root, "scripts/eval/live-runtime.js"));
}

function writeExecutable(directory, name) {
  fs.mkdirSync(directory, { recursive: true });
  const extension = process.platform === "win32" ? ".exe" : "";
  const executable = path.join(directory, `${name}${extension}`);
  fs.writeFileSync(executable, process.platform === "win32" ? "test" : "#!/bin/sh\nexit 0\n");
  if (process.platform !== "win32") fs.chmodSync(executable, 0o755);
  return executable;
}

test("host command resolution ignores relative and fixture-controlled PATH entries", () => {
  const { resolveHostExecutable } = loadRuntime();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-host-command-"));
  const workspace = path.join(tempRoot, "fixture");
  const trustedBin = path.join(tempRoot, "trusted-bin");
  fs.mkdirSync(workspace);
  writeExecutable(workspace, "codex");
  const trusted = writeExecutable(trustedBin, "codex");
  const source = {
    PATH: [".", workspace, trustedBin].join(path.delimiter),
    PATHEXT: ".CMD;.EXE",
  };
  try {
    const command = resolveHostExecutable({
      name: "codex",
      workspace,
      source,
    });
    assert.equal(command, fs.realpathSync(trusted));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("host command resolution fails closed without a trusted absolute candidate", () => {
  const { resolveHostExecutable } = loadRuntime();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-host-missing-"));
  writeExecutable(workspace, "claude");
  try {
    assert.throws(
      () => resolveHostExecutable({
        name: "claude",
        workspace,
        source: { PATH: [".", workspace].join(path.delimiter) },
      }),
      { code: "E_ADAPTER_MISSING", exitCode: 4 },
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("eval never launches a fixture-cwd command from a relative host PATH", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cew-path-hijack-"));
  const extension = process.platform === "win32" ? ".cmd" : "";
  const command = path.join(tempRoot, `codex${extension}`);
  const marker = path.join(tempRoot, "launched.txt");
  const body = process.platform === "win32"
    ? `@echo launched>"${marker}"\r\n`
    : `#!/bin/sh\nprintf launched > "${marker}"\n`;
  fs.writeFileSync(command, body);
  if (process.platform !== "win32") fs.chmodSync(command, 0o755);
  try {
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "scripts/eval/cli.js"),
        "--adapter",
        "codex",
        "--live",
        "--scenario",
        "clear-small-edit",
        "--json",
      ],
      {
        cwd: tempRoot,
        encoding: "utf8",
        env: { ...process.env, PATH: "." },
      },
    );
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stdout, /E_ADAPTER_MISSING/);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("live runtimes scrub loader injection and isolate Claude session temp", () => {
  const { prepareLiveRuntime } = loadRuntime();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-runtime-env-"));
  const source = {
    PATH: path.dirname(process.execPath),
    HOME: os.homedir(),
    OPENAI_API_KEY: "openai-test-key",
    ANTHROPIC_API_KEY: "anthropic-test-key",
    CLAUDE_CONFIG_DIR: path.join(os.homedir(), ".claude-test"),
    NODE_OPTIONS: "--require=/tmp/inject.js",
    DYLD_INSERT_LIBRARIES: "/tmp/inject.dylib",
    LD_PRELOAD: "/tmp/inject.so",
    BASH_ENV: "/tmp/inject.sh",
    TMPDIR: os.tmpdir(),
  };
  const resolveCommand = () => process.execPath;
  const codex = prepareLiveRuntime({
    name: "codex",
    workspace,
    source,
    resolveCommand,
  });
  const claude = prepareLiveRuntime({
    name: "claude",
    workspace,
    source,
    resolveCommand,
  });
  try {
    assert.equal(codex.environment.OPENAI_API_KEY, "openai-test-key");
    assert.equal(codex.environment.NODE_OPTIONS, undefined);
    assert.equal(codex.environment.DYLD_INSERT_LIBRARIES, undefined);
    assert.equal(codex.environment.LD_PRELOAD, undefined);
    assert.equal(codex.environment.BASH_ENV, undefined);
    assert.equal(claude.environment.ANTHROPIC_API_KEY, "anthropic-test-key");
    assert.equal(claude.environment.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB, undefined);
    assert.equal(claude.environment.TMP, claude.environment.TMPDIR);
    assert.equal(claude.environment.TEMP, claude.environment.TMPDIR);
    assert.equal(path.relative(workspace, claude.environment.TMPDIR).startsWith(".."), true);
    assert.equal(fs.existsSync(claude.environment.TMPDIR), true);
  } finally {
    codex.cleanup();
    claude.cleanup();
    assert.equal(fs.existsSync(claude.environment.TMPDIR), false);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Claude session temp is short, private and explicitly sandboxed", () => {
  const { prepareLiveRuntime } = loadRuntime();
  const { claudeArgs } = require(path.join(root, "scripts/eval/live-config.js"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cew-runtime-temp-"));
  const runtime = prepareLiveRuntime({
    name: "claude",
    workspace,
    source: { PATH: path.dirname(process.execPath), HOME: os.homedir() },
    resolveCommand: () => process.execPath,
  });
  const sessionTemp = runtime.environment.CLAUDE_CODE_TMPDIR;
  try {
    assert.equal(path.relative(workspace, sessionTemp).startsWith(".."), true);
    if (process.platform !== "win32") {
      assert.ok(Buffer.byteLength(sessionTemp) <= 48, sessionTemp);
      assert.equal(fs.statSync(sessionTemp).mode & 0o777, 0o700);
    }
    const args = claudeArgs({ workspace, environment: runtime.environment });
    const settingsIndex = args.indexOf("--settings");
    const filesystem = JSON.parse(args[settingsIndex + 1]).sandbox.filesystem;
    assert.equal(filesystem.allowRead.includes(sessionTemp), true);
    assert.equal(filesystem.allowWrite.includes(sessionTemp), true);
    if (process.platform !== "win32") {
      const sessionRoot = path.dirname(sessionTemp);
      assert.equal(filesystem.denyRead.includes(sessionRoot), true);
      assert.equal(filesystem.denyWrite.includes(sessionRoot), false);
    }
  } finally {
    runtime.cleanup();
    assert.equal(fs.existsSync(sessionTemp), false);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
