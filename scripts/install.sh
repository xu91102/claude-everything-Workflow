#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${HOME:?HOME is required}"

INSTALL_CLAUDE=1
INSTALL_CODEX=1
DRY_RUN=0

usage() {
    cat <<'EOF'
Usage: scripts/install.sh [options]

Options:
  --claude-only   Only install to ~/.claude
  --codex-only    Only install to ~/.codex
  --dry-run       Print operations without writing files
  -h, --help      Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --claude-only)
            INSTALL_CLAUDE=1
            INSTALL_CODEX=0
            ;;
        --codex-only)
            INSTALL_CLAUDE=0
            INSTALL_CODEX=1
            ;;
        --dry-run)
            DRY_RUN=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '[dry-run] %q' "$1"
        shift
        for arg in "$@"; do
            printf ' %q' "$arg"
        done
        printf '\n'
    else
        "$@"
    fi
}

backup_if_changed() {
    local src="$1"
    local dest="$2"

    if [ ! -f "$dest" ] || cmp -s "$src" "$dest"; then
        return
    fi

    local backup="${dest}.bak.$(date +%Y%m%d%H%M%S)"
    echo "Backup: $dest -> $backup"
    run cp "$dest" "$backup"
}

copy_file() {
    local src="$1"
    local dest="$2"

    backup_if_changed "$src" "$dest"
    run cp "$src" "$dest"
}

copy_claude_settings() {
    local src="$1"
    local dest="$2"

    backup_if_changed "$src" "$dest"
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "[dry-run] merge '$src' into '$dest' preserving existing env and mcpServers, purging legacy hook paths"
        return
    fi

    node - "$src" "$dest" <<'NODE'
const fs = require('fs')

const [, , sourcePath, destinationPath] = process.argv
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const existing = fs.existsSync(destinationPath)
    ? JSON.parse(fs.readFileSync(destinationPath, 'utf8'))
    : {}

// 清理旧版 Hook 路径模式，避免合并后残留不存在的文件引用
const LEGACY_HOOK_PATTERNS = [
    'scripts/hooks/run-with-flags.js',
    'scripts/hooks/commit-quality.js',
    'scripts/hooks/session-start.js',
    'scripts/hooks/session-end.js',
    'scripts/lib/hook-flags.js',
    'scripts/lib/utils.js',
    'hooks/observe.js',
    'hooks/review-confidence.js',
    'hooks/session-start.js',
    'hooks/session-end.js',
    'hooks/evaluate-session.js',
    'hooks/pre-compact.js',
    'hooks/runtime/session-utils.js'
]

function isLegacyHook(hookDef) {
    if (typeof hookDef !== 'object' || !hookDef.command) return false
    return LEGACY_HOOK_PATTERNS.some(p => hookDef.command.includes(p))
}

function filterHooks(hooksArray) {
    if (!Array.isArray(hooksArray)) return hooksArray
    return hooksArray.map(entry => {
        if (!entry || !Array.isArray(entry.hooks)) return entry
        const filtered = entry.hooks.filter(h => !isLegacyHook(h))
        return { ...entry, hooks: filtered }
    }).filter(entry => entry.hooks && entry.hooks.length > 0)
}

function cleanHooks(hooksObj) {
    if (!hooksObj || typeof hooksObj !== 'object') return hooksObj
    const cleaned = {}
    for (const [eventType, entries] of Object.entries(hooksObj)) {
        const filtered = filterHooks(entries)
        if (filtered.length > 0) {
            cleaned[eventType] = filtered
        }
    }
    return cleaned
}

const merged = {
    ...existing,
    ...source,
    env: {
        ...(source.env || {}),
        ...(existing.env || {})
    },
    mcpServers: {
        ...(source.mcpServers || {}),
        ...(existing.mcpServers || {})
    },
    // hooks 以 source 为权威，清理 existing 中的旧版残留
    hooks: cleanHooks({
        ...(existing.hooks || {}),
        ...(source.hooks || {})
    })
}

fs.writeFileSync(destinationPath, JSON.stringify(merged, null, 2) + '\n')
NODE
    chmod 600 "$dest"
}

copy_dir() {
    local name="$1"
    local dest_root="$2"

    if [ ! -d "$ROOT_DIR/$name" ]; then
        return
    fi

    run mkdir -p "$dest_root/$name"
    run rsync -a "$ROOT_DIR/$name/" "$dest_root/$name/"
}

require_rsync() {
    if [ "$DRY_RUN" -eq 1 ]; then
        return
    fi

    if ! command -v rsync >/dev/null 2>&1; then
        echo "rsync is required. Please install rsync and retry." >&2
        exit 1
    fi
}

install_shared_dirs() {
    local dest="$1"

    copy_dir rules "$dest"
    copy_dir agents "$dest"
    copy_dir commands "$dest"
    copy_dir scripts "$dest"
    copy_dir hooks "$dest"
    copy_dir skills "$dest"
    copy_dir homunculus "$dest"
    copy_dir references "$dest"
}

remove_package_only_paths() {
    local dest="$1"

    for file in \
        "scripts/install.sh" \
        "scripts/install.ps1"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done
}

remove_obsolete_workflow_paths() {
    local dest="$1"
    local file
    local dir

    for file in \
        "scripts/hooks/run-with-flags.js" \
        "scripts/hooks/commit-quality.js" \
        "scripts/hooks/session-start.js" \
        "scripts/hooks/session-end.js" \
        "scripts/lib/hook-flags.js" \
        "scripts/lib/utils.js" \
        "hooks/review-confidence.js" \
        "hooks/session-start.js" \
        "hooks/session-end.js" \
        "hooks/evaluate-session.js" \
        "hooks/pre-compact.js" \
        "hooks/runtime/session-utils.js"
    do
        if [ -f "$dest/$file" ]; then
            run rm -f "$dest/$file"
        fi
    done

    for dir in "scripts/hooks" "scripts/lib"; do
        if [ -d "$dest/$dir" ] && [ -z "$(find "$dest/$dir" -mindepth 1 -print -quit)" ]; then
            run rmdir "$dest/$dir"
        fi
    done
}

install_claude() {
    local dest="$HOME_DIR/.claude"

    echo "Installing Claude workflow to $dest"
    run mkdir -p "$dest"
    remove_obsolete_workflow_paths "$dest"
    copy_file "$ROOT_DIR/CLAUDE.md" "$dest/CLAUDE.md"
    copy_file "$ROOT_DIR/AGENTS.md" "$dest/AGENTS.md"
    copy_claude_settings "$ROOT_DIR/settings.json" "$dest/settings.json"
    install_shared_dirs "$dest"
    remove_package_only_paths "$dest"
}

install_codex() {
    local dest="$HOME_DIR/.codex"

    echo "Installing Codex workflow to $dest"
    run mkdir -p "$dest"
    remove_obsolete_workflow_paths "$dest"
    copy_file "$ROOT_DIR/AGENTS.md" "$dest/AGENTS.md"
    install_shared_dirs "$dest"
    remove_package_only_paths "$dest"
}

require_rsync

if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    install_claude
fi

if [ "$INSTALL_CODEX" -eq 1 ]; then
    install_codex
fi

echo "Install complete."
