param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $IsWindows) {
    Write-Host "PowerShell installer fixture skipped: Windows is required for junction coverage."
    exit 0
}

$RepositoryRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Installer = Join-Path $RepositoryRoot "scripts\install.ps1"
$PowerShell = (Get-Process -Id $PID).Path
$FixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "cew 安装 fixture $([guid]::NewGuid())"
$OriginalUserProfile = $env:USERPROFILE

function Invoke-Installer {
    param(
        [string]$FixtureHome,
        [string[]]$Arguments = @("-ClaudeOnly")
    )

    $env:USERPROFILE = $FixtureHome
    & $PowerShell -NoProfile -ExecutionPolicy Bypass -File $Installer @Arguments |
        ForEach-Object { Write-Host $_ }
    $Status = $LASTEXITCODE
    return $Status
}

try {
    $CleanHome = Join-Path $FixtureRoot "clean home"
    New-Item -ItemType Directory -Path $CleanHome -Force | Out-Null

    $FirstStatus = Invoke-Installer -FixtureHome $CleanHome
    if ($FirstStatus -ne 0) {
        throw "Clean PowerShell install failed with exit code $FirstStatus"
    }
    $InstalledSkill = Join-Path $CleanHome ".claude\skills\using-superpowers\SKILL.md"
    if (-not (Test-Path -LiteralPath $InstalledSkill -PathType Leaf)) {
        throw "Clean PowerShell install did not copy using-superpowers"
    }

    $SecondStatus = Invoke-Installer -FixtureHome $CleanHome
    if ($SecondStatus -ne 0) {
        throw "Repeated PowerShell install failed with exit code $SecondStatus"
    }
    $UnknownFile = Join-Path $CleanHome ".claude\skills\writing-plans\user-notes.md"
    Set-Content -LiteralPath $UnknownFile -Value "keep me"
    $UnknownStatus = Invoke-Installer -FixtureHome $CleanHome
    if ($UnknownStatus -ne 0 -or -not (Test-Path -LiteralPath $UnknownFile)) {
        throw "Repeated PowerShell install did not preserve an unknown file"
    }

    $SymlinkHome = Join-Path $FixtureRoot "junction home"
    $InstallRoot = Join-Path $SymlinkHome ".claude"
    $ExternalSkills = Join-Path $FixtureRoot "external skills"
    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $ExternalSkills -Force | Out-Null
    New-Item `
        -ItemType Junction `
        -Path (Join-Path $InstallRoot "skills") `
        -Target $ExternalSkills | Out-Null

    $JunctionStatus = Invoke-Installer -FixtureHome $SymlinkHome
    if ($JunctionStatus -eq 0) {
        throw "PowerShell installer accepted a junctioned skills target"
    }
    if ((Get-ChildItem -LiteralPath $ExternalSkills -Force).Count -ne 0) {
        throw "PowerShell installer wrote through a junction before rejecting it"
    }

    $RootJunctionHome = Join-Path $FixtureRoot "root junction home"
    $ExternalRoot = Join-Path $FixtureRoot "external install root"
    New-Item -ItemType Directory -Path $RootJunctionHome -Force | Out-Null
    New-Item -ItemType Directory -Path $ExternalRoot -Force | Out-Null
    New-Item `
        -ItemType Junction `
        -Path (Join-Path $RootJunctionHome ".claude") `
        -Target $ExternalRoot | Out-Null
    $RootJunctionStatus = Invoke-Installer -FixtureHome $RootJunctionHome
    if (
        $RootJunctionStatus -eq 0 -or
        (Get-ChildItem -LiteralPath $ExternalRoot -Force).Count -ne 0
    ) {
        throw "PowerShell installer wrote before rejecting a junctioned install root"
    }

    $TargetOnlyHome = Join-Path $FixtureRoot "target only home"
    $TargetOnlyScripts = Join-Path $TargetOnlyHome ".claude\scripts"
    $ExternalObsolete = Join-Path $FixtureRoot "external obsolete"
    New-Item -ItemType Directory -Path $TargetOnlyScripts -Force | Out-Null
    New-Item -ItemType Directory -Path $ExternalObsolete -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $ExternalObsolete "run-with-flags.js") -Value "must stay"
    New-Item `
        -ItemType Junction `
        -Path (Join-Path $TargetOnlyScripts "hooks") `
        -Target $ExternalObsolete | Out-Null
    $TargetOnlyStatus = Invoke-Installer -FixtureHome $TargetOnlyHome
    if ($TargetOnlyStatus -eq 0 -or -not (Test-Path -LiteralPath (Join-Path $ExternalObsolete "run-with-flags.js"))) {
        throw "PowerShell installer missed a target-only obsolete junction"
    }

    $GlobalHome = Join-Path $FixtureRoot "global preflight home"
    $GlobalCodex = Join-Path $GlobalHome ".codex"
    $GlobalExternal = Join-Path $FixtureRoot "global external"
    New-Item -ItemType Directory -Path $GlobalCodex -Force | Out-Null
    New-Item -ItemType Directory -Path $GlobalExternal -Force | Out-Null
    New-Item `
        -ItemType Junction `
        -Path (Join-Path $GlobalCodex "skills") `
        -Target $GlobalExternal | Out-Null
    $GlobalStatus = Invoke-Installer -FixtureHome $GlobalHome -Arguments @()
    if ($GlobalStatus -eq 0 -or (Test-Path -LiteralPath (Join-Path $GlobalHome ".claude"))) {
        throw "PowerShell installer wrote Claude before Codex preflight failed"
    }

    $ActiveHome = Join-Path $FixtureRoot "active custom home"
    $ActiveSkill = Join-Path $ActiveHome ".claude\skills\using-superpowers\SKILL.md"
    New-Item -ItemType Directory -Path (Split-Path -Parent $ActiveSkill) -Force | Out-Null
    Set-Content -LiteralPath $ActiveSkill -Value "user customized active skill"
    $ActiveStatus = Invoke-Installer -FixtureHome $ActiveHome
    $ActiveBackups = Get-ChildItem -LiteralPath (Split-Path -Parent $ActiveSkill) -Filter "SKILL.md.distribution-backup-*"
    if ($ActiveStatus -ne 0 -or $ActiveBackups.Count -ne 1) {
        throw "PowerShell installer did not back up a customized active file"
    }

    $ConfigCollisionHome = Join-Path $FixtureRoot "config collision home"
    $ConfigRoot = Join-Path $ConfigCollisionHome ".claude"
    $ConfigTarget = Join-Path $ConfigRoot "AGENTS.md"
    $ConfigContent = "custom root instructions`n"
    $ExternalConfigBackup = Join-Path $FixtureRoot "external config backup"
    New-Item -ItemType Directory -Path $ConfigRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $ExternalConfigBackup -Force | Out-Null
    [System.IO.File]::WriteAllText($ConfigTarget, $ConfigContent)
    $ConfigDigest = (Get-FileHash -LiteralPath $ConfigTarget -Algorithm SHA256).Hash.ToLower()
    $ConfigBackup = "$ConfigTarget.distribution-backup-$($ConfigDigest.Substring(0, 12))"
    Set-Content -LiteralPath (Join-Path $ExternalConfigBackup "sentinel") -Value "external sentinel"
    New-Item -ItemType Junction -Path $ConfigBackup -Target $ExternalConfigBackup | Out-Null
    $ConfigCollisionStatus = Invoke-Installer -FixtureHome $ConfigCollisionHome
    if (
        $ConfigCollisionStatus -eq 0 -or
        [System.IO.File]::ReadAllText($ConfigTarget) -ne $ConfigContent -or
        -not (Test-Path -LiteralPath (Join-Path $ExternalConfigBackup "sentinel"))
    ) {
        throw "PowerShell installer accepted an unsafe top-level backup collision"
    }

    $RetiredHome = Join-Path $FixtureRoot "retired custom home"
    $RetiredRoot = Join-Path $RetiredHome ".claude"
    $RetiredSkill = Join-Path $RetiredRoot "skills\brainstorming\SKILL.md"
    $Sentinel = Join-Path $RetiredRoot "AGENTS.md"
    New-Item -ItemType Directory -Path (Split-Path -Parent $RetiredSkill) -Force | Out-Null
    Set-Content -LiteralPath $RetiredSkill -Value "user customized retired skill"
    Set-Content -LiteralPath $Sentinel -Value "do not replace"
    $RetiredStatus = Invoke-Installer -FixtureHome $RetiredHome
    $RetiredBackups = Get-ChildItem -LiteralPath (Split-Path -Parent $RetiredSkill) -Filter "SKILL.md.retired-backup-*"
    if (
        $RetiredStatus -eq 0 -or
        (Get-Content -LiteralPath $Sentinel -Raw).Trim() -ne "do not replace" -or
        $RetiredBackups.Count -ne 1
    ) {
        throw "PowerShell installer did not stop before merging a customized retired file"
    }

    Remove-Item -LiteralPath $RetiredSkill -Force
    $RetryStatus = Invoke-Installer -FixtureHome $RetiredHome
    if (
        $RetryStatus -ne 0 -or
        -not (Test-Path -LiteralPath (Join-Path $RetiredRoot "skills\using-superpowers\SKILL.md")) -or
        -not (Test-Path -LiteralPath $RetiredBackups[0].FullName)
    ) {
        throw "PowerShell installer could not retry after a preserved retired-file conflict"
    }

    $UpgradeHome = Join-Path $FixtureRoot "published upgrade home"
    $PublishedMetadata = Join-Path $UpgradeHome ".claude\skills\brainstorming\agents\openai.yaml"
    New-Item -ItemType Directory -Path (Split-Path -Parent $PublishedMetadata) -Force | Out-Null
    [System.IO.File]::WriteAllText(
        $PublishedMetadata,
        "interface:`n  display_name: `"Brainstorming`"`n  short_description: `"Explore intent, requirements, and design before implementation`"`n"
    )
    $UpgradeStatus = Invoke-Installer -FixtureHome $UpgradeHome
    if (
        $UpgradeStatus -ne 0 -or
        (Test-Path -LiteralPath $PublishedMetadata) -or
        -not (Test-Path -LiteralPath (Join-Path $UpgradeHome ".claude\skills\using-superpowers\SKILL.md"))
    ) {
        throw "PowerShell installer could not upgrade the published 0.1.9 retirement baseline"
    }

    Write-Host "PowerShell installer fixtures passed."
} finally {
    $env:USERPROFILE = $OriginalUserProfile
    if (Test-Path -LiteralPath $FixtureRoot) {
        Remove-Item -LiteralPath $FixtureRoot -Recurse -Force
    }
}
