$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskPython = Join-Path $taskRoot 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Run scripts/setup-windows.ps1 first.' }
& $taskPython (Join-Path $taskRoot 'scripts/start.py')
exit $LASTEXITCODE
