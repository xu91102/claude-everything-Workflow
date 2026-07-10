param(
    [switch]$ClaudeOnly,
    [switch]$CodexOnly,
    [switch]$DryRun,
    [ValidateSet("core", "coding", "full")]
    [string]$Profile = "full"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$Installer = Join-Path $RootDir "scripts\install-manager.js"
$Arguments = @($Installer, "install", "--profile", $Profile)

if ($ClaudeOnly) {
    $Arguments += "--claude-only"
}
if ($CodexOnly) {
    $Arguments += "--codex-only"
}
if ($DryRun) {
    $Arguments += "--dry-run"
}

& node @Arguments
exit $LASTEXITCODE
