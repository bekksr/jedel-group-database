param([switch]$CheckStartup, [int]$BackendPort = 8000, [int]$FrontendPort = 4200)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskPython = Join-Path $taskRoot 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Run scripts/setup-windows.ps1 first.' }
$taskArgs = @((Join-Path $taskRoot 'scripts/start.py'), '--backend-port', $BackendPort, '--frontend-port', $FrontendPort)
if ($CheckStartup) { $taskArgs += '--check-startup' }
& $taskPython @taskArgs
exit $LASTEXITCODE
