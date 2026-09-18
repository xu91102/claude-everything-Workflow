param(
    [switch]$ClaudeOnly,
    [switch]$CodexOnly,
    [switch]$DryRun,
    [string]$InstallHome,
    [string[]]$WithSkill = @()
)
$ErrorActionPreference = "Stop"
if ($ClaudeOnly -and $CodexOnly) { throw "Host flags are mutually exclusive" }
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$InstallArgs = @((Join-Path $RootDir "scripts\install-host.js"))
if ($ClaudeOnly) { $InstallArgs += "--claude-only" }
if ($CodexOnly) { $InstallArgs += "--codex-only" }
if ($DryRun) { $InstallArgs += "--dry-run" }
if ($InstallHome) { $InstallArgs += @("--home", $InstallHome) }
foreach ($skill in $WithSkill) { $InstallArgs += @("--with-skill", $skill) }
& node @InstallArgs
if ($LASTEXITCODE -ne 0) { throw "Installation failed with exit code $LASTEXITCODE" }
