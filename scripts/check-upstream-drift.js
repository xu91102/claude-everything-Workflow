#!/usr/bin/env node
"use strict";

const https = require("https");
const manifest = require("./upstream-capabilities.json");

const apiRoot =
  process.env.CEW_UPSTREAM_API_ROOT ||
  "https://api.github.com/repos/mattpocock/skills";
const latestCommitEndpoint =
  process.env.CEW_UPSTREAM_COMMIT_API || `${apiRoot}/commits/main`;
const engineeringPrefix = "skills/engineering/";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "claude-everything-workflow-drift-check",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const request = https.get(
      url,
      {
        headers,
        timeout: 10000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

function engineeringFiles(tree) {
  const entries = Array.isArray(tree) ? tree : tree?.tree;
  if (!Array.isArray(entries)) {
    throw new Error("tree response did not contain entries");
  }
  return new Map(
    entries
      .filter(
        (entry) =>
          entry?.type === "blob" &&
          typeof entry.path === "string" &&
          entry.path.startsWith(engineeringPrefix),
      )
      .map((entry) => [entry.path, entry.sha]),
  );
}

function capabilityForPath(file) {
  const relative = file.slice(engineeringPrefix.length);
  const parts = relative.split("/");
  return parts.length >= 2 ? parts[0] : "_catalog";
}

function compareEngineeringTrees(pinnedTree, latestTree) {
  const pinned = engineeringFiles(pinnedTree);
  const latest = engineeringFiles(latestTree);
  const files = {
    added: [...latest.keys()].filter((file) => !pinned.has(file)).sort(),
    removed: [...pinned.keys()].filter((file) => !latest.has(file)).sort(),
    changed: [...latest.keys()]
      .filter((file) => pinned.has(file) && pinned.get(file) !== latest.get(file))
      .sort(),
  };
  const pinnedCapabilities = new Set(
    [...pinned.keys()].map(capabilityForPath).filter((item) => item !== "_catalog"),
  );
  const latestCapabilities = new Set(
    [...latest.keys()].map(capabilityForPath).filter((item) => item !== "_catalog"),
  );
  const addedCapabilities = [...latestCapabilities]
    .filter((item) => !pinnedCapabilities.has(item))
    .sort();
  const removedCapabilities = [...pinnedCapabilities]
    .filter((item) => !latestCapabilities.has(item))
    .sort();
  const changedCandidates = new Set(
    [...files.added, ...files.removed, ...files.changed].map(capabilityForPath),
  );
  const capabilities = {
    added: addedCapabilities,
    removed: removedCapabilities,
    changed: [...changedCandidates]
      .filter(
        (item) =>
          item === "_catalog" ||
          (pinnedCapabilities.has(item) && latestCapabilities.has(item)),
      )
      .sort(),
  };
  return { files, capabilities };
}

async function commitTreeSha(commitSha) {
  const commit = await fetchJson(`${apiRoot}/git/commits/${commitSha}`);
  const treeSha = commit?.tree?.sha;
  if (!/^[a-f0-9]{40}$/.test(treeSha || "")) {
    throw new Error(`commit ${commitSha} did not contain a tree sha`);
  }
  return treeSha;
}

async function main() {
  try {
    const latest = await fetchJson(latestCommitEndpoint);
    if (!/^[a-f0-9]{40}$/.test(latest.sha || "")) {
      throw new Error("response did not contain a commit sha");
    }
    if (latest.sha === manifest.upstream.commit) {
      console.log(`UP_TO_DATE ${latest.sha}`);
      return;
    }

    const [pinnedTreeSha, latestTreeSha] = await Promise.all([
      commitTreeSha(manifest.upstream.commit),
      commitTreeSha(latest.sha),
    ]);
    const [pinnedTree, latestTree] = await Promise.all([
      fetchJson(`${apiRoot}/git/trees/${pinnedTreeSha}?recursive=1`),
      fetchJson(`${apiRoot}/git/trees/${latestTreeSha}?recursive=1`),
    ]);
    if (pinnedTree?.truncated || latestTree?.truncated) {
      throw new Error("recursive tree response was truncated");
    }
    const drift = compareEngineeringTrees(pinnedTree, latestTree);
    console.log(
      `DRIFT_DETECTED pinned=${manifest.upstream.commit} latest=${latest.sha}`,
    );
    console.log(`ENGINEERING_DRIFT ${JSON.stringify(drift)}`);
  } catch (error) {
    console.log(
      `NOT_RUN ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { compareEngineeringTrees, main };
