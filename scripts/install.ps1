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

function Copy-ClaudeSettings {
    param(
        [string]$Source,
        [string]$Destination
    )

    Backup-IfChanged -Source $Source -Destination $Destination

    if ($DryRun) {
        Write-Host "[dry-run] Merge '$Source' into '$Destination' preserving existing env and mcpServers"
        Write-Host "[dry-run] Purge legacy hook paths while merging Claude settings"
        return
    }

    $mergeScript = Join-Path $RootDir "scripts\merge-claude-settings.cjs"
    & node $mergeScript $Source $Destination
}

function Convert-ClaudeSettingsHookPaths {
    param([string]$SettingsPath)

    if ($DryRun) {
        Write-Host "[dry-run] Convert hook paths in '$SettingsPath' to Windows absolute paths"
        return
    }

    $settings = Get-Content -LiteralPath $SettingsPath -Raw | ConvertFrom-Json
    $claudeHome = Join-Path $HomeDir ".claude"

    function Update-Commands {
        param($Value)

        if ($null -eq $Value) {
            return
        }

        if ($Value -is [System.Array]) {
            foreach ($item in $Value) {
                Update-Commands -Value $item
            }
            return
        }

        if ($Value -isnot [psobject]) {
            return
        }

        if ($Value.PSObject.Properties.Name -contains "command" -and $Value.command -is [string]) {
            $Value.command = $Value.command.Replace('$HOME/.claude', $claudeHome)
        }

        foreach ($property in $Value.PSObject.Properties) {
            Update-Commands -Value $property.Value
        }
    }

    Update-Commands -Value $settings.hooks
    $settings | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $SettingsPath -Encoding UTF8
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
        "scripts",
        "hooks",
        "skills",
        "homunculus",
        "references"
    )

    foreach ($dir in $dirs) {
        Copy-DirectoryMerge -Name $dir -DestinationRoot $Destination
    }
}

function Remove-PackageOnlyPaths {
    param([string]$Destination)

    $packageOnlyFiles = @(
        "scripts\install.sh",
        "scripts\install.ps1",
        "scripts\verify-harness.js",
        "scripts\verify\core.js",
        "scripts\verify\grilling-spec-gate-checks.js",
        "scripts\verify\metadata-checks.js",
        "scripts\verify\repository-checks.js",
        "scripts\verify\runtime-checks.js",
        "scripts\verify\workflow-checks.js",
        "scripts\verify\workflow-ownership-fixtures.js",
        "scripts\verify\workflow-ownership.js"
    )

    foreach ($relative in $packageOnlyFiles) {
        $target = Join-Path $Destination $relative
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Invoke-InstallCommand `
                -Description "Remove-Item '$target'" `
                -Action { Remove-Item -LiteralPath $target -Force }
        }
    }

    $verifyDirectory = Join-Path $Destination "scripts\verify"
    if (Test-Path -LiteralPath $verifyDirectory -PathType Container) {
        $children = Get-ChildItem -LiteralPath $verifyDirectory -Force
        if ($children.Count -eq 0) {
            Invoke-InstallCommand `
                -Description "Remove-Item '$verifyDirectory'" `
                -Action { Remove-Item -LiteralPath $verifyDirectory -Force }
        }
    }
}

function Remove-ObsoleteWorkflowPaths {
    param([string]$Destination)

    $obsoleteFiles = @(
        "commands\e2e.md",
        "commands\evolve.md",
        "commands\grill.md",
        "commands\harness-audit.md",
        "commands\instinct-status.md",
        "commands\learn-eval.md",
        "commands\projects.md",
        "commands\promote.md",
        "commands\prune.md",
        "commands\setup-workflow.md",
        "commands\tdd.md",
        "scripts\hooks\run-with-flags.js",
        "scripts\hooks\commit-quality.js",
        "scripts\hooks\session-start.js",
        "scripts\hooks\session-end.js",
        "scripts\lib\hook-flags.js",
        "scripts\lib\utils.js",
        "hooks\review-confidence.js",
        "hooks\session-start.js",
        "hooks\session-end.js",
        "hooks\evaluate-session.js",
        "hooks\pre-compact.js",
        "hooks\runtime\session-utils.js",
        "rules\08-ecc-integration.md",
        "skills\subagent-driven-development\implementer-prompt.md",
        "skills\subagent-driven-development\task-reviewer-prompt.md",
        "skills\subagent-driven-development\scripts\sdd-workspace",
        "skills\subagent-driven-development\scripts\task-brief",
        "skills\subagent-driven-development\scripts\review-package"
    )

    foreach ($relative in $obsoleteFiles) {
        $target = Join-Path $Destination $relative
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Invoke-InstallCommand `
                -Description "Remove-Item '$target'" `
                -Action { Remove-Item -LiteralPath $target -Force }
        }
    }

    foreach ($relative in @("scripts\hooks", "scripts\lib", "skills\subagent-driven-development\scripts")) {
        $target = Join-Path $Destination $relative
        if (Test-Path -LiteralPath $target -PathType Container) {
            $children = Get-ChildItem -LiteralPath $target -Force
            if ($children.Count -eq 0) {
                Invoke-InstallCommand `
                    -Description "Remove-Item '$target'" `
                    -Action { Remove-Item -LiteralPath $target -Force }
            }
        }
    }
}

function Remove-RetiredSkills {
    param([string]$Destination)

    $cleanupScript = Join-Path $RootDir "scripts\cleanup-retired-skills.js"
    if ($DryRun) {
        & node $cleanupScript $Destination --dry-run
        if ($LASTEXITCODE -ne 0) {
            throw "Retired skill cleanup dry-run failed with exit code $LASTEXITCODE"
        }
        return
    }

    & node $cleanupScript $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "Retired skill cleanup failed with exit code $LASTEXITCODE"
    }
}

function Test-RetiredSkillManifest {
    $cleanupScript = Join-Path $RootDir "scripts\cleanup-retired-skills.js"
    & node $cleanupScript --validate
    if ($LASTEXITCODE -ne 0) {
        throw "Retired skill manifest validation failed with exit code $LASTEXITCODE"
    }
}

function Install-ClaudeWorkflow {
    $dest = Join-Path $HomeDir ".claude"

    Write-Host "Installing Claude workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Remove-ObsoleteWorkflowPaths -Destination $dest
    Copy-ConfigFile -Source (Join-Path $RootDir "CLAUDE.md") -Destination (Join-Path $dest "CLAUDE.md")
    Copy-ConfigFile -Source (Join-Path $RootDir "AGENTS.md") -Destination (Join-Path $dest "AGENTS.md")
    $settingsPath = Join-Path $dest "settings.json"
    Copy-ClaudeSettings -Source (Join-Path $RootDir "settings.json") -Destination $settingsPath
    Convert-ClaudeSettingsHookPaths -SettingsPath $settingsPath
    Install-SharedDirs -Destination $dest
    Remove-RetiredSkills -Destination $dest
    Remove-PackageOnlyPaths -Destination $dest
}

function Install-CodexWorkflow {
    $dest = Join-Path $HomeDir ".codex"

    Write-Host "Installing Codex workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Remove-ObsoleteWorkflowPaths -Destination $dest
    Copy-ConfigFile -Source (Join-Path $RootDir "AGENTS.md") -Destination (Join-Path $dest "AGENTS.md")
    Install-SharedDirs -Destination $dest
    Remove-RetiredSkills -Destination $dest
    Remove-PackageOnlyPaths -Destination $dest
}

Test-RetiredSkillManifest

if ($InstallClaude) {
    Install-ClaudeWorkflow
}

if ($InstallCodex) {
    Install-CodexWorkflow
}

Write-Host "Install complete."
