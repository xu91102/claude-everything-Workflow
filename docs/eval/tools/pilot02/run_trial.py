#!/usr/bin/env python3
"""Run one benchmark trial for one task under one harness cell, then score it."""
import argparse, json, os, re, shutil, signal, subprocess, time, xml.etree.ElementTree as ET

ROOT = "/tmp/cew-eval"
HOME_CEW = f"{ROOT}/homes/cew-home"
HOME_CODEX_BASE = f"{ROOT}/homes/codex-base"
HOME_CLAUDE_BASE = f"{ROOT}/homes/claude-base"
PROXY = "http://127.0.0.1:7890"

CELLS = {
    "gpt-base": {"kind": "codex", "home": HOME_CODEX_BASE, "codex_home": f"{HOME_CODEX_BASE}/.codex"},
    "gpt-cew": {"kind": "codex", "home": HOME_CEW, "codex_home": f"{HOME_CEW}/.codex"},
    "gpt-lite": {"kind": "codex", "home": f"{ROOT}/homes/cew-lite", "codex_home": f"{ROOT}/homes/cew-lite/.codex"},
    "gpt-trim": {"kind": "codex", "home": f"{ROOT}/homes/cew-trim", "codex_home": f"{ROOT}/homes/cew-trim/.codex"},
    "gpt-fixed": {"kind": "codex", "home": f"{ROOT}/homes/cew-fixed", "codex_home": f"{ROOT}/homes/cew-fixed/.codex"},
    "opus-base": {"kind": "claude", "home": HOME_CLAUDE_BASE},
    "opus-cew": {"kind": "claude", "home": HOME_CEW},
}

CODEX_CONFIG = """model = "gpt-6.1-sol"
model_reasoning_effort = "high"
approval_policy = "never"
sandbox_mode = "workspace-write"
suppress_unstable_features_warning = true

[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = true
base_url = "http://127.0.0.1:15721/v1"
experimental_bearer_token = "xuyuhang-miqvhms6-z2245if95rpu2wygyfox3agifyei5xef"
"""


def sh(args, cwd=None, env=None, input=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, env=env, input=input)


def ensure_homes():
    os.makedirs(f"{HOME_CODEX_BASE}/.codex", exist_ok=True)
    with open(f"{HOME_CODEX_BASE}/.codex/config.toml", "w") as f:
        f.write(CODEX_CONFIG)
    os.makedirs(f"{HOME_CLAUDE_BASE}/.claude", exist_ok=True)
    for h in (HOME_CLAUDE_BASE, HOME_CEW):
        p = f"{h}/.claude.json"
        if not os.path.exists(p):
            with open(p, "w") as f:
                json.dump({"hasCompletedOnboarding": True, "hasTrustDialogAccepted": True}, f)
    # CEW codex home needs the same model provider config
    with open(f"{HOME_CEW}/.codex/config.toml", "w") as f:
        f.write(CODEX_CONFIG)


def save_hidden_tests(task, out_dir):
    """Copy the tests from the real fix commit outside the checkout."""
    hidden = os.path.join(out_dir, "hidden")
    os.makedirs(hidden, exist_ok=True)
    for rel in task["test_files"]:
        blob = sh(["git", "show", f"{task['commit']}:{rel}"], cwd=f"{ROOT}/repos/{task['repo']}").stdout
        dest = os.path.join(hidden, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            f.write(blob)
    return hidden


def install_hidden_tests(run_dir, hidden):
    for root, _, files in os.walk(hidden):
        for name in files:
            src = os.path.join(root, name)
            rel = os.path.relpath(src, hidden)
            dest = os.path.join(run_dir, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(src, dest)


def prepare(task, run_dir, hidden=False):
    if os.path.exists(run_dir):
        shutil.rmtree(run_dir)
    repo = f"{ROOT}/repos/{task['repo']}"
    base = f"{task['commit']}^"
    r = sh(["git", "clone", "--quiet", "--no-hardlinks", repo, run_dir])
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    sh(["git", "checkout", "--quiet", "-B", "work", base], cwd=run_dir, )
    sh(["git", "remote", "remove", "origin"], cwd=run_dir)
    for tag in sh(["git", "tag"], cwd=run_dir).stdout.split():
        sh(["git", "tag", "-d", tag], cwd=run_dir)
    sh(["git", "reflog", "expire", "--expire=now", "--all"], cwd=run_dir)
    sh(["git", "gc", "--prune=now", "--quiet"], cwd=run_dir)
    if not hidden:
        patch = sh(["git", "diff", base, task["commit"], "--"] + task["test_files"], cwd=repo).stdout
        ap = subprocess.run(["git", "apply", "-"], cwd=run_dir, text=True, input=patch, capture_output=True)
        if ap.returncode != 0:
            raise RuntimeError(f"apply failed: {ap.stderr}")
    if task["repo"] == "humanize":
        vf = os.path.join(run_dir, "src/humanize/_version.py")
        with open(vf, "w") as f:
            f.write('__version__ = "0.0.0"\n')
        with open(os.path.join(run_dir, ".git/info/exclude"), "a") as f:
            f.write("\nsrc/humanize/_version.py\n")
    if not hidden:
        sh(["git", "add", "-A"], cwd=run_dir)
        sh(["git", "-c", "user.email=eval@local", "-c", "user.name=eval",
            "commit", "-qm", "Add regression tests for the reported issue"], cwd=run_dir)
    return run_dir


def test_env(cell):
    env = os.environ.copy()
    env["HOME"] = CELLS[cell]["home"]
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["HTTPS_PROXY"] = PROXY
    env["HTTP_PROXY"] = PROXY
    env["NO_PROXY"] = "127.0.0.1,localhost"
    if CELLS[cell]["kind"] == "codex":
        env["CODEX_HOME"] = CELLS[cell]["codex_home"]
    return env


def run_pytest(run_dir, repo, test_files=None, junit=""):
    py = f"{ROOT}/venvs/{repo}/bin/python"
    src = os.path.join(run_dir, "src")
    pp = src if os.path.isdir(src) else run_dir
    env = os.environ.copy()
    env["PYTHONPATH"] = pp
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env.pop("HTTP_PROXY", None)
    env["NO_PROXY"] = "127.0.0.1,localhost"
    args = [py, "-m", "pytest", "-q", "--tb=no", "-p", "no:cacheprovider",
            f"--junitxml={junit}"]
    args += test_files if test_files else []
    r = sh(args, cwd=run_dir, env=env)
    passed, failed, failed_names = 0, 0, []
    if os.path.exists(junit):
        root = ET.parse(junit).getroot()
        for tc in root.iter("testcase"):
            tid = f"{tc.get('classname')}::{tc.get('name')}"
            bad = tc.find("failure") is not None or tc.find("error") is not None
            if bad:
                failed += 1
                failed_names.append(tid)
            else:
                passed += 1
    return {"passed": passed, "failed": failed, "failed_names": failed_names,
            "exit": r.returncode, "tail": (r.stdout or "")[-500:]}


def run_agent(cell, run_dir, prompt, log_path, timeout):
    cfg = CELLS[cell]
    env = test_env(cell)
    if cfg["kind"] == "codex":
        cmd = ["codex", "exec", "--skip-git-repo-check", "--json", "-C", run_dir,
               "-m", "gpt-6.1-sol", "--dangerously-bypass-approvals-and-sandbox",
               "-c", 'approval_policy="never"', "-c", 'model_reasoning_effort="high"', prompt]
    else:
        cmd = ["claude", "-p", prompt, "--model", "opus",
               "--output-format", "json", "--dangerously-skip-permissions",
               "--max-turns", "80", "--settings", f"{ROOT}/clean-settings.json"]
        env.pop("ANTHROPIC_AUTH_TOKEN", None)
        env["ANTHROPIC_BASE_URL"] = "https://api.anthropic.com"
    t0 = time.time()
    with open(log_path, "w") as log:
        p = subprocess.Popen(cmd, cwd=run_dir, env=env, text=True,
                             stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        timed_out = False
        try:
            p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            p.wait()
    return {"exit": p.returncode, "timed_out": timed_out, "duration_s": round(time.time() - t0, 1),
            "log": log_path}


def parse_usage(cell, log_path):
    kind = CELLS[cell]["kind"]
    text = open(log_path, errors="ignore").read()
    if kind == "codex":
        usage = {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0,
                 "reasoning_output_tokens": 0}
        final = ""
        for line in text.splitlines():
            try:
                ev = json.loads(line)
            except Exception:
                continue
            if ev.get("type") == "turn.completed":
                for k in usage:
                    usage[k] += int(ev.get("usage", {}).get(k) or 0)
            if ev.get("type") == "item.completed":
                item = ev.get("item", {})
                if item.get("type") == "agent_message":
                    final = item.get("text", "")
        return usage, final
    # claude
    try:
        data = json.loads(text.strip().splitlines()[-1])
    except Exception:
        return {}, ""
    u = data.get("usage", {})
    usage = {
        "input_tokens": u.get("input_tokens", 0),
        "cached_input_tokens": u.get("cache_read_input_tokens", 0),
        "cache_write_tokens": u.get("cache_creation_input_tokens", 0),
        "output_tokens": u.get("output_tokens", 0),
        "turns": data.get("num_turns", 0),
        "cost_usd": data.get("total_cost_usd", 0),
    }
    return usage, data.get("result", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cell", required=True)
    ap.add_argument("--task", required=True)
    ap.add_argument("--timeout", type=int, default=720)
    ap.add_argument("--run", type=int, default=1)
    ap.add_argument("--tasks-file", default=f"{ROOT}/tasks.validated.json")
    ap.add_argument("--hidden-tests", action="store_true")
    a = ap.parse_args()
    ensure_homes()
    tasks = {t["id"]: t for t in json.load(open(a.tasks_file))}
    task = tasks[a.task]
    out_dir = f"{ROOT}/results/{a.task}/{a.cell}-r{a.run}"
    os.makedirs(out_dir, exist_ok=True)
    run_dir = f"{ROOT}/runs/{a.task}/{a.cell}-r{a.run}"
    prepare(task, run_dir, hidden=a.hidden_tests)
    hidden = save_hidden_tests(task, out_dir) if a.hidden_tests else None

    # base full-suite reference
    base_full = run_pytest(run_dir, task["repo"], None, f"{out_dir}/base-full.xml")

    if a.hidden_tests:
        prompt = (f"Fix this issue in the repository.\n\nIssue: {task.get('issue') or task.get('subject')}\n\n"
                  "The checkout does not contain tests for this issue. Do not add or modify tests. "
                  "Work only in the current checkout. Do not commit, push, or open a pull request. "
                  "A hidden test suite will verify the behavior.")
    else:
        prompt = (f"Fix this issue in the repository.\n\nIssue: {task.get('issue') or task.get('subject')}\n\n"
                  "Work only in the current checkout. Do not modify test files. "
                  "Do not commit, push, or open a pull request. "
                  "Run the relevant tests and make sure they pass.")
    agent = run_agent(a.cell, run_dir, prompt, f"{out_dir}/agent.log", a.timeout)

    # restore tests if the agent touched them, then collect diff
    status = sh(["git", "status", "--porcelain"], cwd=run_dir).stdout
    changed = {ln[3:].strip() for ln in status.splitlines() if len(ln) > 3}
    tests_modified = bool(changed & set(task["test_files"]))
    if task["test_files"]:
        sh(["git", "checkout", "HEAD", "--"] + task["test_files"])
    sh(["git", "add", "-A"], cwd=run_dir)
    numstat = sh(["git", "diff", "--cached", "--numstat", "HEAD"], cwd=run_dir).stdout
    files, added, deleted, src_files = [], 0, 0, []
    for ln in numstat.splitlines():
        parts = ln.split("\t")
        if len(parts) != 3:
            continue
        ad, de, f = parts
        files.append(f)
        if ad.isdigit():
            added += int(ad)
            deleted += int(de)
        if not ("test" in f):
            src_files.append(f)

    if hidden:
        install_hidden_tests(run_dir, hidden)
    target = run_pytest(run_dir, task["repo"], task["test_files"], f"{out_dir}/target.xml")
    after_full = run_pytest(run_dir, task["repo"], None, f"{out_dir}/after-full.xml")
    # new failures: failed after but not failed at base
    new_failures = sorted(set(after_full["failed_names"]) - set(base_full["failed_names"]))

    usage, final = parse_usage(a.cell, agent["log"])
    overclaim = bool(re.search(r"(all tests? (pass|passing)|tests? pass|everything passes|全部通过|测试通过)",
                               final, re.I)) and target["failed"] > 0
    result = {"task": a.task, "repo": task["repo"], "cell": a.cell, "run": a.run,
              "agent": agent, "usage": usage, "final_message": final[-4000:],
              "target": target, "base_full": {k: base_full[k] for k in ("passed", "failed")},
              "after_full": {k: after_full[k] for k in ("passed", "failed")},
              "new_failures": new_failures[:20], "tests_modified": tests_modified,
              "diff": {"files": files, "src_files": src_files, "added": added, "deleted": deleted,
                       "lines": added + deleted},
              "resolved": target["failed"] == 0 and target["passed"] > 0 and not new_failures,
              "overclaim": overclaim}
    json.dump(result, open(f"{out_dir}/result.json", "w"), indent=2, ensure_ascii=False)
    print(json.dumps({k: result[k] for k in ("task", "cell", "run", "resolved", "overclaim",
                                             "usage", "diff", "new_failures", "tests_modified")},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
