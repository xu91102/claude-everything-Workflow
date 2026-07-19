"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  SNAPSHOT_LIMITS,
  createFixture,
  snapshotTree,
  unexpectedWorkspaceChanges,
} = require("../eval/workspace");

function gitScenario(id = "git-hardening") {
  return {
    id,
    fixture: {
      files: {},
      git: {
        committedFiles: { "target.txt": "before\n" },
        dirtyFiles: { "user.txt": "user change\n" },
      },
    },
  };
}

function trustedTestGit() {
  const drive = path.parse(process.execPath).root || "C:\\";
  const candidates = process.platform === "win32"
    ? [path.join(drive, "Program Files", "Git", "cmd", "git.exe")]
    : ["/usr/bin/git", "/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runTestGit(workspace, args) {
  const result = spawnSync(trustedTestGit(), args, {
    cwd: workspace,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
}

test(
  "Git fixture ignores executable and loader injection from the caller environment",
  { skip: process.platform === "win32" },
  async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cew-git-path-probe-"));
    const marker = path.join(temp, "malicious-git-ran");
    const fakeGit = path.join(temp, "git");
    fs.writeFileSync(fakeGit, `#!/bin/sh\ntouch ${JSON.stringify(marker)}\nexit 99\n`);
    fs.chmodSync(fakeGit, 0o755);

    const names = ["PATH", "LD_PRELOAD", "DYLD_INSERT_LIBRARIES", "NODE_OPTIONS"];
    const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    Object.assign(process.env, {
      PATH: temp,
      LD_PRELOAD: path.join(temp, "missing.so"),
      DYLD_INSERT_LIBRARIES: path.join(temp, "missing.dylib"),
      NODE_OPTIONS: `--require=${path.join(temp, "missing.js")}`,
    });

    let fixture;
    try {
      fixture = await createFixture({ scenario: gitScenario() });
      assert.equal(fs.existsSync(path.join(fixture.workspace, ".git")), true);
      assert.equal(fs.existsSync(marker), false);
    } finally {
      for (const name of names) {
        if (original[name] === undefined) delete process.env[name];
        else process.env[name] = original[name];
      }
      if (fixture) await fixture.cleanup();
      fs.rmSync(temp, { recursive: true, force: true });
    }
  },
);

test("Git status is stable but an unauthorized commit changes protected metadata", async () => {
  const fixture = await createFixture({ scenario: gitScenario("git-metadata") });
  try {
    runTestGit(fixture.workspace, ["status", "--porcelain"]);
    const afterStatus = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, afterStatus, []),
      [],
    );

    runTestGit(fixture.workspace, ["add", "."]);
    runTestGit(fixture.workspace, [
      "-c",
      "user.name=Probe",
      "-c",
      "user.email=probe@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "unauthorized",
    ]);
    const afterCommit = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, afterCommit, []),
      [".git"],
    );
  } finally {
    await fixture.cleanup();
  }
});

test("Git index flags are protected even when staged blobs stay unchanged", async () => {
  const fixture = await createFixture({ scenario: gitScenario("git-index-flags") });
  try {
    runTestGit(fixture.workspace, [
      "update-index",
      "--assume-unchanged",
      "target.txt",
    ]);
    const after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, after, []),
      [".git"],
    );
  } finally {
    await fixture.cleanup();
  }
});

test("Git config and hook mutations change protected metadata", async () => {
  const fixture = await createFixture({ scenario: gitScenario("git-control-files") });
  const config = path.join(fixture.workspace, ".git", "config");
  const originalConfig = fs.readFileSync(config);
  const hooks = path.join(fixture.workspace, ".git", "hooks");
  try {
    fs.appendFileSync(config, "\n[probe]\n\tvalue = changed\n");
    let after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, after, []),
      [".git"],
    );

    fs.writeFileSync(config, originalConfig);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, snapshotTree(fixture.identity), []),
      [],
    );

    fs.mkdirSync(hooks, { recursive: true });
    fs.writeFileSync(path.join(hooks, "post-commit"), "#!/bin/sh\nexit 0\n");
    after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, after, []),
      [".git"],
    );
  } finally {
    await fixture.cleanup();
  }
});

test("snapshot has no prototype and does not hide a case-variant .GIT directory", async () => {
  const fixture = await createFixture({
    scenario: { id: "case-variant-git", fixture: { files: {} } },
  });
  try {
    assert.equal(Object.getPrototypeOf(fixture.baseline), null);
    const upperGit = path.join(fixture.workspace, ".GIT");
    fs.mkdirSync(upperGit);
    fs.writeFileSync(path.join(upperGit, "payload"), "unexpected\n");
    const after = snapshotTree(fixture.identity);
    assert.deepEqual(
      unexpectedWorkspaceChanges(fixture.baseline, after, []),
      [".GIT", ".GIT/payload"],
    );
  } finally {
    await fixture.cleanup();
  }
});

test(
  "snapshot detects mode changes on preserved and content-authorized files",
  { skip: process.platform === "win32" },
  async () => {
    const fixture = await createFixture({ scenario: gitScenario("mode-change") });
    const userFile = path.join(fixture.workspace, "user.txt");
    const targetFile = path.join(fixture.workspace, "target.txt");
    try {
      fs.chmodSync(userFile, fs.statSync(userFile).mode ^ 0o100);
      let after = snapshotTree(fixture.identity);
      assert.deepEqual(
        unexpectedWorkspaceChanges(fixture.baseline, after, ["target.txt"]),
        ["user.txt"],
      );

      fs.chmodSync(userFile, fs.statSync(userFile).mode ^ 0o100);
      fs.chmodSync(targetFile, fs.statSync(targetFile).mode ^ 0o100);
      after = snapshotTree(fixture.identity);
      assert.deepEqual(
        unexpectedWorkspaceChanges(fixture.baseline, after, ["target.txt"]),
        ["target.txt"],
      );
    } finally {
      await fixture.cleanup();
    }
  },
);

test("fixture rejects a file above the snapshot read limit with a stable error", async () => {
  const content = "x".repeat(SNAPSHOT_LIMITS.maxFileBytes + 1);
  await assert.rejects(
    () => createFixture({
      scenario: {
        id: "oversized-file",
        fixture: { files: { "large.txt": content } },
      },
    }),
    { code: "E_SNAPSHOT_LIMIT", exitCode: 3 },
  );
});

test("snapshot rejects directory nesting above the explicit depth limit", async () => {
  const fixture = await createFixture({
    scenario: { id: "deep-tree", fixture: { files: {} } },
  });
  try {
    let current = fixture.workspace;
    for (let depth = 0; depth <= SNAPSHOT_LIMITS.maxDepth; depth += 1) {
      current = path.join(current, "d");
      fs.mkdirSync(current);
    }
    assert.throws(
      () => snapshotTree(fixture.identity),
      { code: "E_SNAPSHOT_LIMIT", exitCode: 3 },
    );
  } finally {
    await fixture.cleanup();
  }
});

test("snapshot rejects a tree above the explicit entry limit", async () => {
  const fixture = await createFixture({
    scenario: { id: "wide-tree", fixture: { files: {} } },
  });
  try {
    for (let index = 0; index <= SNAPSHOT_LIMITS.maxEntries; index += 1) {
      fs.writeFileSync(path.join(fixture.workspace, `f-${index}`), "");
    }
    assert.throws(
      () => snapshotTree(fixture.identity),
      { code: "E_SNAPSHOT_LIMIT", exitCode: 3 },
    );
  } finally {
    await fixture.cleanup();
  }
});

test("entry limiting does not allocate an unbounded readdirSync result", async () => {
  const fixture = await createFixture({
    scenario: { id: "streamed-tree", fixture: { files: { "one.txt": "1\n" } } },
  });
  const originalReadDirectory = fs.readdirSync;
  fs.readdirSync = () => {
    throw new Error("unbounded directory read");
  };
  try {
    const after = snapshotTree(fixture.identity);
    assert.equal(after["one.txt"].type, "file");
  } finally {
    fs.readdirSync = originalReadDirectory;
    await fixture.cleanup();
  }
});

test("fixture cleanup remains retryable after a transient remove failure", async () => {
  const fixture = await createFixture({
    scenario: { id: "cleanup-retry", fixture: { files: {} } },
  });
  const originalRemove = fs.promises.rm;
  let attempts = 0;
  fs.promises.rm = async (...args) => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error("busy");
      error.code = "EBUSY";
      throw error;
    }
    return originalRemove(...args);
  };
  try {
    await assert.rejects(
      () => fixture.cleanup(),
      {
        code: "E_FIXTURE",
        exitCode: 3,
        details: { cause: "EBUSY" },
      },
    );
    assert.equal(fs.existsSync(fixture.identity.tempRoot), true);
    await fixture.cleanup();
    assert.equal(fs.existsSync(fixture.identity.tempRoot), false);
  } finally {
    fs.promises.rm = originalRemove;
    await originalRemove(fixture.identity.tempRoot, { recursive: true, force: true });
  }
});
