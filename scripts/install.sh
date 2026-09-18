#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# One host-profile implementation shared with PowerShell; no global writes during --dry-run.
exec node "$ROOT_DIR/scripts/install-host.js" "$@"
