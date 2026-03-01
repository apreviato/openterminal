# OpenTerminal - Windows installer (PowerShell 5+)
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$RepoRoot   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$OTRoot     = Join-Path $RepoRoot 'packages\opencode'
$InstallDir = Join-Path $env:USERPROFILE '.openterminal\bin'

function To-Posix($p) { '/' + $p[0].ToString().ToLower() + '/' + $p.Substring(3).Replace('\','/') }
$OTRootPosix     = To-Posix $OTRoot
$InstallDirPosix = To-Posix $InstallDir

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { Write-Error 'bun not found. Install from https://bun.sh'; exit 1 }
if (-not (Test-Path (Join-Path $OTRoot 'src\index.ts'))) { Write-Error 'Source not found - run from repo root.'; exit 1 }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# .cmd wrapper (PowerShell/CMD) - captures %CD% before bun changes it
$CmdPath  = Join-Path $InstallDir 'openterminal.cmd'
$asciiEnc = [System.Text.Encoding]::ASCII
[System.IO.File]::WriteAllLines($CmdPath, @('@echo off', 'set "OPENTERMINAL_CWD=%CD%"', ('bun run --cwd "' + $OTRoot + '" --conditions=browser ./src/index.ts %*')), $asciiEnc)
Write-Host ('Created (CMD/PS): ' + $CmdPath) -ForegroundColor DarkGray

# bash shim (git bash) - no BOM, exports OPENTERMINAL_CWD before bun changes PWD
$BashPath = Join-Path $InstallDir 'openterminal'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($BashPath, @('#!/usr/bin/env bash', 'export OPENTERMINAL_CWD="$PWD"', ('exec bun run --cwd ''' + $OTRootPosix + ''' --conditions=browser ./src/index.ts "$@"')), $utf8NoBom)
$gitBash = 'C:\Program Files\Git\bin\bash.exe'
if (Test-Path $gitBash) { & $gitBash -c ('chmod +x ''' + $InstallDirPosix + '/openterminal''') 2>$null }
Write-Host ('Created (bash):   ' + $BashPath) -ForegroundColor DarkGray

# Windows user PATH
$up = [Environment]::GetEnvironmentVariable('PATH','User'); if ($null -eq $up) { $up = '' }
if ($up -notlike ('*' + $InstallDir + '*')) {
    [Environment]::SetEnvironmentVariable('PATH', $InstallDir + ';' + $up, 'User')
    $env:PATH = $InstallDir + ';' + $env:PATH
    Write-Host 'Added to Windows user PATH (restart terminal for CMD/PS)' -ForegroundColor DarkGray
} else { Write-Host 'Already in PATH' -ForegroundColor DarkGray }

# git bash ~/.bashrc
$Bashrc = Join-Path $env:USERPROFILE '.bashrc'
$PathLine = 'export PATH="' + $InstallDirPosix + ':$PATH"'
if (Test-Path $Bashrc) {
    if ((Get-Content $Bashrc -Raw) -notlike ('*' + $InstallDirPosix + '*')) {
        Add-Content $Bashrc ("n" + $PathLine)
        Write-Host 'Added to ~/.bashrc (git bash)' -ForegroundColor DarkGray
    } else { Write-Host '~/.bashrc already configured' -ForegroundColor DarkGray }
} else { Write-Host ('~/.bashrc not found. Add manually: ' + $PathLine) -ForegroundColor Yellow }

Write-Host ''
Write-Host 'OK  openterminal installed' -ForegroundColor Green
Write-Host ''
Write-Host '  PowerShell/CMD : open a new terminal, type openterminal'
Write-Host '  Git Bash       : run source ~/.bashrc, type openterminal'
Write-Host ''
Write-Host '    cd <your-project>'
Write-Host '    openterminal'
Write-Host ''
