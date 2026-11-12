param([switch]$CheckOnly, [switch]$SkipInstall, [switch]$NonInteractive)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskPython = Get-Command python -ErrorAction SilentlyContinue
if (-not $taskPython) { throw 'Install Python 3.13, add it to PATH, then reopen PowerShell.' }
$taskArgs = @((Join-Path $taskRoot 'scripts/setup.py'))
if ($CheckOnly) { $taskArgs += '--check-only' }
if ($SkipInstall) { $taskArgs += '--skip-install' }
if ($NonInteractive) { $taskArgs += '--non-interactive' }
& $taskPython.Source @taskArgs
exit $LASTEXITCODE
