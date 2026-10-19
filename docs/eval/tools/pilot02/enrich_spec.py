#!/usr/bin/env python3
"""Rewrite a task's issue text into a behavior contract.

The mined commit subjects are one-liners ("Add function `iequals`"), which are
not enough to determine the expected behavior. This pulls the docstrings of the
public functions added by the reference commit and uses them as the spec, while
tests stay hidden.
"""

import argparse
import json
import re
import subprocess
import textwrap

ROOT = "/tmp/cew-eval"
DEF_RE = re.compile(r"^\+\s*def ([a-z]\w*)\s*\(")
DOC_RE = re.compile(r'"""(.*?)"""', re.DOTALL)


def git(args, cwd):
    return subprocess.run(
        ["git"] + args, check=False, cwd=cwd, text=True, capture_output=True
    ).stdout


def blocks_for_commit(repo, commit, src_files):
    diff = git(["show", "--format=", commit, "--"] + src_files, f"{ROOT}/repos/{repo}")
    lines = diff.splitlines()
    out = []
    i = 0
    while i < len(lines):
        m = DEF_RE.match(lines[i])
        if not m:
            i += 1
            continue
        name = m.group(1)
        body = []
        j = i
        while j < len(lines) and j < i + 40:
            if j > i and DEF_RE.match(lines[j]):
                break
            if lines[j].startswith(("+", " ")):
                body.append(lines[j][1:])
            j += 1
        text = "\n".join(body)
        doc = DOC_RE.search(text)
        if doc:
            out.append(
                {
                    "name": name,
                    "signature": body[0].strip(),
                    "doc": doc.group(1).strip(),
                }
            )
        i = max(j, i + 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tasks-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--ids", default="", help="comma separated ids; default all")
    ap.add_argument("--only-repos", default="", help="comma separated repos to enrich")
    a = ap.parse_args()

    with open(a.tasks_file) as f:
        tasks = json.load(f)
    ids = {x for x in a.ids.split(",") if x}
    repos = {x for x in a.only_repos.split(",") if x}
    changed = 0
    for t in tasks:
        if ids and t["id"] not in ids:
            continue
        if repos and t["repo"] not in repos:
            continue
        blocks = blocks_for_commit(t["repo"], t["commit"], t.get("src") or t["files"])
        if not blocks:
            print(f"skip {t['id']}: no documented new def")
            continue
        spec = "\n\n".join(
            f"{b['signature']}\n{textwrap.dedent(b['doc'])}" for b in blocks
        )
        t["issue"] = (
            f"{t['subject']}\n\n"
            "Expected behavior (implement exactly this; a hidden test suite checks "
            "the documented behavior including edge cases):\n\n"
            f"{spec}"
        )
        t["spec_source"] = "docstring"
        changed += 1
        print(f"enriched {t['id']}: {len(blocks)} documented function(s)")
    with open(a.out, "w") as f:
        json.dump(tasks, f, indent=1, ensure_ascii=False)
    print(f"changed {changed}/{len(tasks)} -> {a.out}")


if __name__ == "__main__":
    main()
