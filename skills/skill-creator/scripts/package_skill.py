#!/usr/bin/env python3
"""Validate and package a skill as a deterministic .skill zip."""

import sys
import zipfile
from pathlib import Path

from quick_validate import validate_skill


def main():
    if len(sys.argv) not in (2, 3):
        raise SystemExit("usage: package_skill.py SKILL_DIR [OUTPUT_DIR]")
    skill = Path(sys.argv[1]).resolve()
    ok, message = validate_skill(skill)
    if not ok:
        raise SystemExit(message)
    output = Path(sys.argv[2] if len(sys.argv) == 3 else ".").resolve()
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f"{skill.name}.skill"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for item in sorted(skill.rglob("*")):
            if not item.is_file() or "__pycache__" in item.parts:
                continue
            info = zipfile.ZipInfo(str(item.relative_to(skill.parent)))
            info.date_time = (1980, 1, 1, 0, 0, 0)
            info.external_attr = 0o644 << 16
            bundle.writestr(info, item.read_bytes())
    print(archive)


if __name__ == "__main__":
    main()
