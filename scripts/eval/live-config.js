"use strict";

const os = require("node:os");
const path = require("node:path");

const QUESTION_KINDS = [
  "architecture_direction",
  "external_write_authorization",
  "other",
];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "questions", "verificationClaims"],
  properties: {
    decision: {
      type: "string",
      enum: ["completed", "needs_input", "blocked"],
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blocking", "kind", "reason"],
        properties: {
          blocking: { type: "boolean" },
          kind: { type: "string", enum: QUESTION_KINDS },
          reason: { type: "string" },
        },
      },
    },
    verificationClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["checkId", "status"],
        properties: {
          checkId: { type: "string" },
          status: { type: "string", enum: ["passed", "failed"] },
        },
      },
    },
  },
};

const CLAUDE_CREDENTIAL_FILES = [
  "~/.aws",
  "~/.azure",
  "~/.config/gcloud",
  "~/.docker/config.json",
  "~/.git-credentials",
  "~/.kube",
  "~/.netrc",
  "~/.npmrc",
  "~/.ssh",
];
const CLAUDE_ENV_ALLOWLIST = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "CLAUDE_CONFIG_DIR",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOGNAME",
  "NODE_EXTRA_CA_CERTS",
  "NO_COLOR",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SSL_CERT_FILE",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "WINDIR",
];
const CODEX_ENV_ALLOWLIST = [
  "ALL_PROXY",
  "APPDATA",
  "CODEX_API_KEY",
  "CODEX_HOME",
  "HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "LOGNAME",
  "NO_COLOR",
  "NO_PROXY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_ORGANIZATION",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SystemRoot",
  "TERM",
  "USER",
  "USERPROFILE",
  "WINDIR",
  "all_proxy",
  "http_proxy",
  "https_proxy",
  "no_proxy",
];

function tomlString(value) {
  return JSON.stringify(value);
}

function codexFilesystemPolicy({ home, runnerPath }) {
  const rules = [
    `${tomlString(home)}="deny"`,
    `${tomlString(os.tmpdir())}="deny"`,
    `${tomlString(process.execPath)}="read"`,
    `${tomlString(runnerPath)}="read"`,
    '":slash_tmp"="deny"',
    '":tmpdir"="deny"',
    '":workspace_roots"={"."="write",".git"="read"}',
  ];
  return `permissions.cew_eval.filesystem={${rules.join(",")}}`;
}

function codexShellEnvironment({
  source = process.env,
  platform = process.platform,
  executable = process.execPath,
  delimiter = path.delimiter,
} = {}) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const executableRoot = pathApi.parse(executable).root || "C:\\";
  const systemBins = platform === "win32"
    ? [pathApi.join(executableRoot, "Windows", "System32")]
    : ["/usr/bin", "/bin"];
  const values = {
    PATH: [...new Set([pathApi.dirname(executable), ...systemBins])]
      .join(delimiter),
  };
  for (const name of ["LANG", "LC_ALL", "LC_CTYPE"]) {
    if (source[name]) values[name] = source[name];
  }
  const entries = Object.entries(values)
    .map(([name, value]) => `${tomlString(name)}=${tomlString(value)}`);
  return `shell_environment_policy.set={${entries.join(",")}}`;
}

function codexArgs({
  workspace,
  schemaPath,
  runnerPath = path.join(__dirname, "verification-runner.js"),
  home = os.homedir(),
}) {
  const args = [
    "--ask-for-approval",
    "never",
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "-c",
    'default_permissions="cew_eval"',
    "-c",
    'permissions.cew_eval.extends=":read-only"',
    "-c",
    codexFilesystemPolicy({ home, runnerPath }),
    "-c",
    "permissions.cew_eval.network.enabled=false",
    "-c",
    'shell_environment_policy.inherit="none"',
    "-c",
    codexShellEnvironment(),
    "-c",
    "mcp_servers={}",
    "-c",
    'web_search="disabled"',
  ];
  // 用户配置可能启动 MCP/Hook 或重定向 provider，因此使用 Codex 内置默认模型。
  // 若没有独立且可信的模型选择输入，Foundation 无法安全判断本机“最强”模型。
  for (const feature of disabledCodexFeatures()) args.push("--disable", feature);
  args.push("--cd", workspace, "--output-schema", schemaPath, "-");
  return args;
}

function disabledCodexFeatures() {
  return [
    "hooks",
    "apps",
    "browser_use",
    "browser_use_external",
    "computer_use",
    "in_app_browser",
    "plugins",
    "remote_plugin",
    "image_generation",
    "multi_agent",
    "shell_snapshot",
  ];
}

function credentialSettings(env = process.env) {
  const sensitive = /(token|secret|password|passwd|api_?key|private_?key|credential|cookie|auth|header)/i;
  const files = [...CLAUDE_CREDENTIAL_FILES];
  if (env.CLAUDE_CONFIG_DIR) files.push(env.CLAUDE_CONFIG_DIR);
  return {
    files: [...new Set(files)].map((file) => ({ path: file, mode: "deny" })),
    envVars: Object.keys(env)
      .filter((name) => sensitive.test(name))
      .sort()
      .map((name) => ({ name, mode: "deny" })),
  };
}

function pathContains(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function claudeSettings({ workspace, runnerPath, environment }) {
  const home = os.homedir();
  const sessionTemp = environment?.CLAUDE_CODE_TMPDIR;
  const writableScopes = [workspace, sessionTemp].filter(Boolean);
  const deniedRoots = [...new Set([
    home,
    os.tmpdir(),
    "/var/run",
    "/run",
    "/private/var/run",
    "/tmp",
    "/private/tmp",
    "/var/tmp",
    "/private/var/tmp",
  ])];
  return {
    autoMemoryEnabled: false,
    disableAgentView: true,
    disableAllHooks: true,
    disableArtifact: true,
    disableClaudeAiConnectors: true,
    permissions: {
      deny: [
        "WebFetch",
        "WebSearch",
        "Agent",
        "mcp__*",
        "Edit(.git/**)",
      ],
    },
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: true,
      network: { allowedDomains: [] },
      filesystem: {
        denyRead: deniedRoots,
        allowRead: [...writableScopes, runnerPath, process.execPath],
        denyWrite: [
          // 默认 sandbox 仍拒绝 cwd 外写入；这里只避免父级 deny 覆盖精确 allow。
          ...deniedRoots.filter((root) =>
            !writableScopes.some((scope) => pathContains(root, scope))),
          path.join(workspace, ".git"),
        ],
        allowWrite: writableScopes,
      },
      credentials: credentialSettings(environment),
    },
  };
}

function claudeArgs({
  workspace,
  runnerPath = path.join(__dirname, "verification-runner.js"),
  environment = claudeEnvironment(),
}) {
  // safe mode 保留厂商内置默认模型；不从不可信宿主配置推断“最强”模型。
  return [
    "--safe-mode",
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--input-format",
    "text",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--strict-mcp-config",
    "--mcp-config",
    JSON.stringify({ mcpServers: {} }),
    "--tools",
    "Bash",
    "--allowedTools",
    "Bash",
    "--no-chrome",
    "--disable-slash-commands",
    "--settings",
    JSON.stringify(claudeSettings({ workspace, runnerPath, environment })),
    "--json-schema",
    JSON.stringify(OUTPUT_SCHEMA),
  ];
}

function selectEnvironment(source, names) {
  const environment = {};
  for (const name of names) {
    if (source[name] !== undefined) environment[name] = source[name];
  }
  return environment;
}

function claudeEnvironment(source = process.env, sessionTemp) {
  const environment = selectEnvironment(source, CLAUDE_ENV_ALLOWLIST);
  if (sessionTemp) {
    for (const name of ["TEMP", "TMP", "TMPDIR"]) environment[name] = sessionTemp;
    environment.CLAUDE_CODE_TMPDIR = sessionTemp;
    environment.CLAUDE_TMPDIR = sessionTemp;
  }
  environment.CLAUDE_CODE_DISABLE_AUTO_MEMORY = "1";
  environment.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS = "1";
  environment.CLAUDE_CODE_SKIP_PROMPT_HISTORY = "1";
  return environment;
}

function codexEnvironment(source = process.env) {
  return selectEnvironment(source, CODEX_ENV_ALLOWLIST);
}

module.exports = {
  OUTPUT_SCHEMA,
  claudeArgs,
  claudeEnvironment,
  codexArgs,
  codexEnvironment,
  codexShellEnvironment,
};
