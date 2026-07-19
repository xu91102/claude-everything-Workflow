"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { claudeEnvironment, codexEnvironment } = require("./live-config");
const { EvalError } = require("./schema");

function pathApi(platform = process.platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function pathContains(root, candidate, api = pathApi()) {
  const relative = api.relative(api.resolve(root), api.resolve(candidate));
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${api.sep}`) &&
    !api.isAbsolute(relative)
  );
}

function realDirectory(entry) {
  try {
    const real = fs.realpathSync(entry);
    return fs.statSync(real).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

function sanitizeHostPath({ source = process.env, workspace, platform = process.platform }) {
  const api = pathApi(platform);
  const trustedWorkspace = fs.realpathSync(workspace);
  const raw = source.PATH ?? source.Path ?? "";
  const directories = [];
  for (const value of String(raw).split(api.delimiter)) {
    const entry = value.replace(/^"|"$/g, "");
    if (!entry || !api.isAbsolute(entry)) continue;
    const real = realDirectory(entry);
    if (!real || pathContains(trustedWorkspace, real, api)) continue;
    if (!directories.includes(real)) directories.push(real);
  }
  return directories.join(api.delimiter);
}

function executableNames(name, _source, platform) {
  if (platform !== "win32") return [name];
  if (path.win32.extname(name)) return [name];
  return [`${name}.exe`];
}

function usableExecutable(candidate, platform) {
  try {
    const mode = platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK;
    fs.accessSync(candidate, mode);
    const real = fs.realpathSync(candidate);
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

function resolveHostExecutable({
  name,
  workspace,
  source = process.env,
  platform = process.platform,
}) {
  const api = pathApi(platform);
  const trustedWorkspace = fs.realpathSync(workspace);
  const safePath = sanitizeHostPath({ source, workspace, platform });
  for (const directory of safePath.split(api.delimiter).filter(Boolean)) {
    for (const executable of executableNames(name, source, platform)) {
      const candidate = usableExecutable(api.join(directory, executable), platform);
      if (candidate && !pathContains(trustedWorkspace, candidate, api)) return candidate;
    }
  }
  throw new EvalError("E_ADAPTER_MISSING", `${name} executable was not found`, 4);
}

function validateResolvedCommand(command, workspace) {
  if (!path.isAbsolute(command)) {
    throw new EvalError("E_ADAPTER_MISSING", "live executable must be absolute", 4);
  }
  const real = usableExecutable(command, process.platform);
  if (!real || pathContains(fs.realpathSync(workspace), real)) {
    throw new EvalError("E_ADAPTER_MISSING", "live executable is not trusted", 4);
  }
  return real;
}

function createSessionTemp() {
  try {
    // Claude 的 Bash 会创建 AF_UNIX socket；长 temp 路径会回退到未授权目录并误报命令失败。
    const base = fs.realpathSync(process.platform === "win32" ? os.tmpdir() : "/tmp");
    const sessionTemp = fs.mkdtempSync(path.join(base, "cew-"));
    if (process.platform !== "win32") fs.chmodSync(sessionTemp, 0o700);
    return fs.realpathSync(sessionTemp);
  } catch (error) {
    throw new EvalError("E_ADAPTER_PROTOCOL", "cannot prepare live session temp", 4, {
      cause: error.code,
    });
  }
}

function cleanupSessionTemp(sessionTemp) {
  if (!sessionTemp) return;
  try {
    fs.rmSync(sessionTemp, { recursive: true, force: true });
  } catch (error) {
    throw new EvalError("E_ADAPTER_PROTOCOL", "cannot clean live session temp", 4, {
      cause: error.code,
    });
  }
}

function prepareLiveRuntime({
  name,
  workspace,
  source = process.env,
  resolveCommand = resolveHostExecutable,
}) {
  const safePath = sanitizeHostPath({ source, workspace });
  const safeSource = { ...source, PATH: safePath };
  const command = validateResolvedCommand(
    resolveCommand({ name, workspace, source: safeSource }),
    workspace,
  );
  const sessionTemp = name === "claude" ? createSessionTemp() : null;
  const environment = name === "claude"
    ? claudeEnvironment(safeSource, sessionTemp)
    : codexEnvironment(safeSource);
  return {
    command,
    environment,
    cleanup() {
      cleanupSessionTemp(sessionTemp);
    },
  };
}

module.exports = {
  prepareLiveRuntime,
  resolveHostExecutable,
  sanitizeHostPath,
};
