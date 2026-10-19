#!/usr/bin/env python3
"""Compose the hidden-test hard set: fix-type tasks from validated candidates + originals."""
import json, subprocess

ROOT = "/tmp/cew-eval"
PICK = [
    "more-itertools-21d3d88", "more-itertools-1b7f033",
    "itsdangerous-910a7a9", "itsdangerous-f966a62", "itsdangerous-6c58e96",
    "python-slugify-c9e9698", "python-slugify-df37f92",
    "more-itertools-0841e57", "more-itertools-3082c06",
    "humanize-19726a0",
]
ORIGINALS = ["humanize-381", "more-itertools-1247", "itsdangerous-sha1"]

cand = {t["id"]: t for t in json.load(open(f"{ROOT}/tasks.hard.candidates.json"))}
orig = {t["id"]: t for t in json.load(open(f"{ROOT}/tasks.validated.json"))}

out = []
for tid in PICK:
    t = dict(cand[tid])
    body = subprocess.run(["git", "log", "-1", "--format=%b", t["commit"]],
                          cwd=f"{ROOT}/repos/{t['repo']}", capture_output=True, text=True).stdout.strip()
    t["issue"] = t["subject"] + (("\n\n" + body[:600]) if body else "")
    t["origin"] = "mined"
    out.append(t)

for tid in ORIGINALS:
    t = dict(orig[tid])
    t["origin"] = "pilot01"
    out.append(t)

json.dump(out, open(f"{ROOT}/tasks.hard.json", "w"), indent=2, ensure_ascii=False)
print(f"{len(out)} tasks")
for t in out:
    print(f'{t["id"]:26s} {t["lines"] if "lines" in t else "-":>4} {t["subject"][:58]}')
