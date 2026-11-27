param(
    [switch]$ClaudeOnly,
    [switch]$CodexOnly,
    [switch]$AntigravityOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ($args.Count -gt 0) {
    throw "Unknown option: $($args[0])"
}
$selectedOnly = @()
if ($ClaudeOnly) { $selectedOnly += "-ClaudeOnly" }
if ($CodexOnly) { $selectedOnly += "-CodexOnly" }
if ($AntigravityOnly) { $selectedOnly += "-AntigravityOnly" }
if ($selectedOnly.Count -gt 1) {
    throw "$($selectedOnly -join ' and ') cannot be used together"
}

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }

if (-not $HomeDir) {
    throw "USERPROFILE or HOME is required"
}

$InstallClaude = ($selectedOnly.Count -eq 0) -or [bool]$ClaudeOnly
$InstallCodex = ($selectedOnly.Count -eq 0) -or [bool]$CodexOnly
$InstallAntigravity = ($selectedOnly.Count -eq 0) -or [bool]$AntigravityOnly
$ExplicitAntigravity = [bool]$AntigravityOnly
$BackupId = Get-Date -Format 'yyyyMMddHHmmss'

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
        [string]$Destination,
        [string]$InstallRoot
    )

    if (-not (Test-Path -LiteralPath $Destination)) {
        return
    }

    $sourceHash = Get-FileHash -LiteralPath $Source -Algorithm SHA256
    $destHash = Get-FileHash -LiteralPath $Destination -Algorithm SHA256
    if ($sourceHash.Hash -eq $destHash.Hash) {
        return
    }

    $backupRoot = Join-Path $InstallRoot ".cew-backups"
    $existingBackupRoot = Get-Item -LiteralPath $backupRoot -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingBackupRoot -and ($existingBackupRoot.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing symlinked backup directory: $backupRoot"
    }

    $relative = [IO.Path]::GetFileName($Destination)
    $backupDir = Join-Path $backupRoot $BackupId
    $backup = Join-Path $backupDir $relative
    Write-Host "Backup: $Destination -> $backup"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$backupDir'" `
        -Action { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
    Invoke-InstallCommand `
        -Description "Copy-Item '$Destination' '$backup'" `
        -Action { Copy-Item -LiteralPath $Destination -Destination $backup -Force }
}

function Copy-ConfigFile {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$InstallRoot
    )

    Backup-IfChanged -Source $Source -Destination $Destination -InstallRoot $InstallRoot
    Invoke-InstallCommand `
        -Description "Copy-Item '$Source' '$Destination'" `
        -Action { Copy-Item -LiteralPath $Source -Destination $Destination -Force }
}

function Copy-ClaudeSettings {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$InstallRoot
    )

    Backup-IfChanged -Source $Source -Destination $Destination -InstallRoot $InstallRoot

    if ($DryRun) {
        Write-Host "[dry-run] Merge '$Source' into '$Destination' preserving existing user hooks, env and mcpServers"
        Write-Host "[dry-run] Purge legacy hook paths while merging Claude settings"
        return
    }

    $mergeScript = Join-Path $RootDir "scripts\merge-claude-settings.cjs"
    & node $mergeScript $Source $Destination --windows-paths
    if ($LASTEXITCODE -ne 0) {
        throw "Claude settings merge failed with exit code $LASTEXITCODE"
    }
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
    $existingDest = Get-Item -LiteralPath $destDir -Force -ErrorAction SilentlyContinue
    if ($null -ne $existingDest -and ($existingDest.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing to merge into symlinked destination: $destDir"
    }

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
        "agents",
        "commands",
        "scripts",
        "hooks",
        "skills",
        "references",
        "harness"
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
        "scripts\install-rules.js",
        "scripts\install-antigravity.js",
        "scripts\legacy-common-rule-hashes.json",
        "scripts\eval-scenarios.js",
        "scripts\verify-harness.js",
        "scripts\verify\core.js",
        "scripts\verify\metadata-checks.js",
        "scripts\verify\repository-checks.js",
        "scripts\verify\runtime-checks.js",
        "scripts\verify\workflow-checks.js",
        "scripts\verify\scenario-checks.js",
        "scripts\verify\scenario-checks.test.js",
        "scripts\verify\skill-manifest-checks.js",
        "scripts\verify\skill-manifest-checks.test.js",
        "scripts\verify\skill-invocation.test.js",
        "scripts\verify\install-rules.test.js",
        "scripts\verify\learning.test.js",
        "scripts\verify\plugin-distribution.test.js"
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

function Test-InstallRoot {
    param([string]$Destination)

    $existing = Get-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    if ($null -ne $existing -and ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing symlinked install root: $Destination"
    }
}

function Install-ClaudeWorkflow {
    $dest = Join-Path $HomeDir ".claude"

    Write-Host "Installing Claude workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Remove-ObsoleteWorkflowPaths -Destination $dest
    Copy-ConfigFile -Source (Join-Path $RootDir "CLAUDE.md") -Destination (Join-Path $dest "CLAUDE.md") -InstallRoot $dest
    Copy-ConfigFile -Source (Join-Path $RootDir "AGENTS.md") -Destination (Join-Path $dest "AGENTS.md") -InstallRoot $dest
    $settingsPath = Join-Path $dest "settings.json"
    Copy-ClaudeSettings -Source (Join-Path $RootDir "settings.json") -Destination $settingsPath -InstallRoot $dest
    Install-SharedDirs -Destination $dest
    Install-WorkflowRules -Destination $dest -HostName "claude-code"
    Remove-RetiredSkills -Destination $dest
    Remove-PackageOnlyPaths -Destination $dest
    Complete-WorkflowBackups -Destination $dest
}

function Install-CodexWorkflow {
    $dest = Join-Path $HomeDir ".codex"

    Write-Host "Installing Codex workflow to $dest"
    Invoke-InstallCommand `
        -Description "New-Item -ItemType Directory '$dest'" `
        -Action { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

    Remove-ObsoleteWorkflowPaths -Destination $dest
    Copy-ConfigFile -Source (Join-Path $RootDir "AGENTS.md") -Destination (Join-Path $dest "AGENTS.md") -InstallRoot $dest
    Install-SharedDirs -Destination $dest
    Install-WorkflowRules -Destination $dest -HostName "codex"
    Remove-RetiredSkills -Destination $dest
    Remove-PackageOnlyPaths -Destination $dest
    Complete-WorkflowBackups -Destination $dest
}

function Test-AntigravityInstallRoot {
    Test-InstallRoot -Destination (Join-Path $HomeDir ".gemini")
    Test-InstallRoot -Destination (Join-Path $HomeDir ".gemini\config")
    Test-InstallRoot -Destination (Join-Path $HomeDir ".gemini\config\plugins")
    Test-InstallRoot -Destination (Join-Path $HomeDir ".gemini\config\plugins\claude-everything-workflow")
}

function Install-AntigravityWorkflow {
    $antigravityArgs = @((Join-Path $RootDir "scripts\install-antigravity.js"), $HomeDir, "--backup-id", $BackupId)
    if ($DryRun) { $antigravityArgs += "--dry-run" }
    & node @antigravityArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Antigravity plugin installation failed with exit code $LASTEXITCODE"
    }
}

function Install-WorkflowRules {
    param([string]$Destination, [string]$HostName)

    $ruleArgs = @((Join-Path $RootDir "scripts\install-rules.js"), $HostName, $Destination, "--backup-id", $BackupId)
    if ($DryRun) { $ruleArgs += "--dry-run" }
    & node @ruleArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Rule installation failed with exit code $LASTEXITCODE"
    }
}

function Complete-WorkflowBackups {
    param([string]$Destination)

    $backupArgs = @((Join-Path $RootDir "scripts\install-rules.js"), "--finalize-backups", $Destination, "--backup-id", $BackupId)
    if ($DryRun) { $backupArgs += "--dry-run" }
    & node @backupArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Backup finalization failed with exit code $LASTEXITCODE"
    }
}

function Resolve-AntigravityInstall {
    if (-not $script:InstallAntigravity -or $ExplicitAntigravity) {
        return
    }

    $geminiDir = Join-Path $HomeDir ".gemini"
    $item = Get-Item -LiteralPath $geminiDir -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        Write-Host "Skipping Antigravity plugin sync ($geminiDir not found; use -AntigravityOnly to install)."
        $script:InstallAntigravity = $false
        return
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (-not $item.PSIsContainer)) {
        Write-Host "Skipping Antigravity plugin sync ($geminiDir is not a regular directory; use -AntigravityOnly to inspect)."
        $script:InstallAntigravity = $false
    }
}

Resolve-AntigravityInstall

if ($InstallClaude) {
    Test-InstallRoot -Destination (Join-Path $HomeDir ".claude")
}
if ($InstallCodex) {
    Test-InstallRoot -Destination (Join-Path $HomeDir ".codex")
}
if ($InstallAntigravity) {
    Test-AntigravityInstallRoot
}

Test-RetiredSkillManifest

if ($InstallClaude) {
    Install-ClaudeWorkflow
}

if ($InstallCodex) {
    Install-CodexWorkflow
}

if ($InstallAntigravity) {
    Install-AntigravityWorkflow
}

Write-Host "Install complete."
