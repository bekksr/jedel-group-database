$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install and start Docker Desktop with Docker Compose v2.' }
$taskEnv = Join-Path $taskRoot '.env'
if (Test-Path -LiteralPath $taskEnv) { Write-Host 'Preserved existing root .env.' }
else {
    $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $taskBytes = New-Object byte[] 48
        $taskRandom.GetBytes($taskBytes)
        $taskPassword = [Convert]::ToBase64String($taskBytes)
        $taskRandom.GetBytes($taskBytes)
        $taskSecret = [Convert]::ToBase64String($taskBytes)
        $taskTemplate = [IO.File]::ReadAllText((Join-Path $taskRoot '.env.example'))
        $taskContent = $taskTemplate.Replace('POSTGRES_PASSWORD=', 'POSTGRES_PASSWORD=' + $taskPassword).Replace('DJANGO_SECRET_KEY=', 'DJANGO_SECRET_KEY=' + $taskSecret)
        $taskStream = [IO.File]::Open($taskEnv, [IO.FileMode]::CreateNew)
        try { $taskWriter = New-Object IO.StreamWriter($taskStream); $taskWriter.Write($taskContent); $taskWriter.Dispose() } finally { $taskStream.Dispose() }
        Write-Host 'Created private root .env with independently generated development secrets.'
    } finally { $taskRandom.Dispose() }
}
Push-Location $taskRoot
try { docker compose config --quiet; if ($LASTEXITCODE -ne 0) { throw 'Compose configuration invalid; inspect private root .env and Docker installation.' } } finally { Pop-Location }
Write-Host 'Ready: docker compose up --build (from repository root). No services started or database records changed.'
