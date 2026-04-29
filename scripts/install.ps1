param(
    [switch]$ClaudeOnly,
    [switch]$CodexOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

if (-not $HomeDir) {
    throw "USERPROFILE or HOME is required"
}

$InstallClaude = -not $CodexOnly
$InstallCodex = -not $ClaudeOnly

function Invoke-InstallCommand {
    param(
        [scriptblock]$Action,
        [string]$Description
    )

    if ($DryRun) {
        Write-Host "[dry-run] $Description"
        return
    }

    & $Action
}

function Backup-IfChanged {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Destination)) {
        return
    }

    $sourceHash = Get-FileHash -LiteralPath $Source -Algorithm SHA256
    $destHash = Get-FileHash -LiteralPath $Destination -Algorithm SHA256
    if ($sourceHash.Hash -eq $destHash.Hash) {
        return
    }

    $backup = "$Destination.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Host "Backup: $Destination -> $backup"
    Invoke-InstallCommand `
        -Description "Copy-Item '$Destination' '$backup'" `
        -Action { Copy-Item -LiteralPath $Destination -Destination $backup -Force }
}

function Copy-ConfigFile {
    param(
        [string]$Source,
        [string]$Destination
    )

    Backup-IfChanged -Source $Source -Destination $Destination
    Invoke-InstallCommand `
        -Description "Copy-Item '$Source' '$Destination'" `
        -Action { Copy-Item -LiteralPath $Source -Destination $Destination -Force }
}

function Copy-DirectoryMerge {
    param(
        [string]$Name,
        [string]$DestinationRoot
    )

    $sourceDir = Join-Path $RootDir $Name
    if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
        return
    }

    $destDir = Join-Path $DestinationRoot $Name
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$destDir'" `
        -Action { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    Invoke-InstallCommand `
        -Description "Copy-Item '$sourceDir\*' '$destDir' -Recurse -Force" `
        -Action { Copy-Item -Path (Join-Path $sourceDir '*') -Destination $destDir -Recurse -Force }
}

function Install-SharedDirs {
    param([string]$Destination)

    $dirs = @(
        "rules",
        "agents",
        "commands",
        "contexts",
        "scripts",
        "hooks",
        "skills",
        "homunculus"
    )

    foreach ($dir in $dirs) {
        Copy-DirectoryMerge -Name $dir -DestinationRoot $Destination
    }
}

function Install-ClaudeWorkflow {
    $dest = Join-Path $HomeDir ".claude"

    Write-Host "Installing Claude workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Copy-ConfigFile -Source (Join-Path $RootDir "CLAUDE.md") -Destination (Join-Path $dest "CLAUDE.md")
    Copy-ConfigFile -Source (Join-Path $RootDir "settings.json") -Destination (Join-Path $dest "settings.json")
    Install-SharedDirs -Destination $dest
}

function Install-CodexWorkflow {
    $dest = Join-Path $HomeDir ".codex"

    Write-Host "Installing Codex workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Copy-ConfigFile -Source (Join-Path $RootDir "AGENTS.md") -Destination (Join-Path $dest "AGENTS.md")
    Install-SharedDirs -Destination $dest
}

if ($InstallClaude) {
    Install-ClaudeWorkflow
}

if ($InstallCodex) {
    Install-CodexWorkflow
}

Write-Host "Install complete."
