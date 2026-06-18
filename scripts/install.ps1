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
        return
    }

    $sourceSettings = Get-Content -LiteralPath $Source -Raw | ConvertFrom-Json
    $existingSettings = if (Test-Path -LiteralPath $Destination) {
        Get-Content -LiteralPath $Destination -Raw | ConvertFrom-Json
    } else {
        [pscustomobject]@{}
    }

    $merged = [ordered]@{}

    foreach ($property in $existingSettings.PSObject.Properties) {
        $merged[$property.Name] = $property.Value
    }

    foreach ($property in $sourceSettings.PSObject.Properties) {
        $merged[$property.Name] = $property.Value
    }

    $env = [ordered]@{}
    if ($sourceSettings.PSObject.Properties.Name -contains "env") {
        foreach ($property in $sourceSettings.env.PSObject.Properties) {
            $env[$property.Name] = $property.Value
        }
    }
    if ($existingSettings.PSObject.Properties.Name -contains "env") {
        foreach ($property in $existingSettings.env.PSObject.Properties) {
            $env[$property.Name] = $property.Value
        }
    }
    if ($env.Count -gt 0) {
        $merged["env"] = $env
    }

    $mcpServers = [ordered]@{}
    if ($sourceSettings.PSObject.Properties.Name -contains "mcpServers") {
        foreach ($property in $sourceSettings.mcpServers.PSObject.Properties) {
            $mcpServers[$property.Name] = $property.Value
        }
    }
    if ($existingSettings.PSObject.Properties.Name -contains "mcpServers") {
        foreach ($property in $existingSettings.mcpServers.PSObject.Properties) {
            $mcpServers[$property.Name] = $property.Value
        }
    }
    if ($mcpServers.Count -gt 0) {
        $merged["mcpServers"] = $mcpServers
    }

    [pscustomobject]$merged | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Destination -Encoding UTF8
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
        "scripts\install.ps1"
    )

    foreach ($relative in $packageOnlyFiles) {
        $target = Join-Path $Destination $relative
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Invoke-InstallCommand `
                -Description "Remove-Item '$target'" `
                -Action { Remove-Item -LiteralPath $target -Force }
        }
    }
}

function Remove-ObsoleteWorkflowPaths {
    param([string]$Destination)

    $obsoleteFiles = @(
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
        "hooks\runtime\session-utils.js"
    )

    foreach ($relative in $obsoleteFiles) {
        $target = Join-Path $Destination $relative
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Invoke-InstallCommand `
                -Description "Remove-Item '$target'" `
                -Action { Remove-Item -LiteralPath $target -Force }
        }
    }

    foreach ($relative in @("scripts\hooks", "scripts\lib")) {
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
    Remove-PackageOnlyPaths -Destination $dest
}

if ($InstallClaude) {
    Install-ClaudeWorkflow
}

if ($InstallCodex) {
    Install-CodexWorkflow
}

Write-Host "Install complete."
