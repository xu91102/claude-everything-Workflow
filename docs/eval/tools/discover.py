#!/usr/bin/env python3
"""List candidate fix commits from a git repo: touch source + tests, small diff."""
import subprocess, sys, re, json

TEST_RE = re.compile(r"(^|/)(tests?|testing)/|(^|/)test_[^/]*\.py$|_test\.py$")
DOC_RE = re.compile(r"(^|/)(docs?|README|CHANGELOG|CONTRIBUTING|\.github)/|\.md$")


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True).stdout


def main(repo, limit=120):
    commits = run(["git", "log", "--no-merges", f"-n{limit}", "--format=%H"], repo).split()
    out = []
    for c in commits:
        subj = run(["git", "log", "-1", "--format=%s", c], repo).strip()
        if re.search(r"^(release|bump|version|merge)\b", subj, re.I):
            continue
        try:
            numstat = run(["git", "show", "--numstat", "--format=", c], repo).strip().splitlines()
        except subprocess.CalledProcessError:
            continue
        files, add, dele = [], 0, 0
        for line in numstat:
            parts = line.split("\t")
            if len(parts) != 3:
                continue
            a, d, f = parts
            if a == "-":
                continue
            files.append(f)
            add += int(a)
            dele += int(d)
        if not files or add + dele > 140 or add + dele < 4:
            continue
        if any(DOC_RE.search(f) for f in files):
            continue
        tests = [f for f in files if TEST_RE.search(f)]
        src = [f for f in files if not TEST_RE.search(f)]
        if not tests or not src:
            continue
        out.append({"commit": c, "subject": subj, "files": files, "tests": tests,
                    "src": src, "added": add, "deleted": dele})
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 120)
