[CmdletBinding()]
param(
    [ValidateSet('viewer','buyer','approver','admin')][string]$Role = 'viewer',
    [switch]$CredentialDialog,
    [switch]$CopyToken,
    [switch]$DatabaseOnly,
    [int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
$backendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pythonPath = Join-Path $backendRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Project virtual environment is missing. Install backend/requirements.txt first.' }
if ($Port -ne 8000) { throw 'Use port 8000 to match the existing Angular proxy. No silent port switching is allowed.' }
$env:DJANGO_DEBUG = 'true'
if (-not $env:DB_NAME) { $env:DB_NAME = 'jedel_group_db' }
if ($env:DB_NAME -ne 'jedel_group_db') { throw 'This launcher is for the existing jedel_group_db database only.' }
if (-not $env:DB_HOST -or $env:DB_HOST.Trim() -eq 'localhost') { $env:DB_HOST = '127.0.0.1' }
if ($env:DB_HOST.Trim() -ne '127.0.0.1') { throw 'Expected DB_HOST=127.0.0.1 for this local development launcher.' }
$env:DB_HOST = '127.0.0.1'
if (-not $env:DB_PORT) { $env:DB_PORT = '5432' }
if ($env:DB_PORT.Trim() -ne '5432') { throw 'Expected DB_PORT=5432 for the existing PostgreSQL service.' }
$env:DB_PORT = '5432'
if (-not $env:DB_USER) { $env:DB_USER = 'postgres' }
$env:DB_USER = $env:DB_USER.Trim()
if ($CredentialDialog -or -not $env:DB_USER -or -not $env:DB_PASSWORD) {
    if ($CredentialDialog) {
        $credential = Get-Credential -UserName $env:DB_USER -Message 'Existing PostgreSQL role and password for jedel_group_db. These are NOT your ERP bearer token.'
        if ($null -eq $credential) { throw 'Database credential entry cancelled. Nothing was changed.' }
        $env:DB_USER = $credential.UserName
        $env:DB_PASSWORD = $credential.GetNetworkCredential().Password
        $credential = $null
    } else {
        if (-not $env:DB_USER) { $env:DB_USER = Read-Host 'Existing PostgreSQL role (username)' }
        if (-not $env:DB_PASSWORD) {
            $securePassword = Read-Host 'Existing PostgreSQL password (hidden)' -AsSecureString
            $env:DB_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
            $securePassword = $null
        }
    }
}
$roleVariables = @{ viewer='ERP_READ_TOKEN'; buyer='ERP_BUYER_TOKEN'; approver='ERP_APPROVER_TOKEN'; admin='ERP_WRITE_TOKEN' }
$tokenVariable = $roleVariables[$Role]
if (-not [Environment]::GetEnvironmentVariable($tokenVariable, 'Process')) {
    $randomBytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($randomBytes) } finally { $generator.Dispose() }
    $tokenValue = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    [Environment]::SetEnvironmentVariable($tokenVariable, $tokenValue, 'Process')
    $tokenValue = $null
}
Push-Location $backendRoot
try {
    & $pythonPath manage.py check
    if ($LASTEXITCODE -ne 0) { throw 'Django system checks failed.' }
    Write-Host ('Verifying ' + $env:DB_NAME + ' at ' + $env:DB_HOST + ':' + $env:DB_PORT + ' with the configured PostgreSQL role. Secret values are never printed.')
    try {
        & $pythonPath manage.py verify_connection --psql-only
        if ($LASTEXITCODE -ne 0) { throw 'Independent psql verification failed. No server restart or database writes occurred.' }
        & $pythonPath manage.py verify_connection --database-only
        if ($LASTEXITCODE -ne 0) { throw 'Django database verification failed after the psql preflight. No server restart or database writes occurred.' }
    } catch {
        # Windows PowerShell can turn native stderr into a terminating error
        # before LASTEXITCODE is checked. Clear stale input in both paths.
        Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
        Write-Host 'Cached database password cleared. The next run will prompt again; no server restart or database writes occurred.'
        throw
    }
    if ($DatabaseOnly) { return }
    Write-Host 'Database read-only verification passed. Waiting up to 30 seconds for the old Django instance on port 8000 to stop...'
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $probe = New-Object Net.Sockets.TcpClient
        try { $probe.Connect('127.0.0.1', $Port); $occupied = $true } catch { $occupied = $false } finally { $probe.Dispose() }
        if ($occupied) { Start-Sleep -Milliseconds 250 }
    } while ($occupied -and [DateTime]::UtcNow -lt $deadline)
    if ($occupied) { throw 'Port 8000 is occupied. Stop the existing Django development instance, then rerun this command in the same terminal. This launcher will never kill an unrelated process.' }
    $runtimeRoot = Join-Path $backendRoot '.runtime'
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $outLog = Join-Path $runtimeRoot 'development.stdout.log'
    $errLog = Join-Path $runtimeRoot 'development.stderr.log'
    $server = Start-Process -FilePath $pythonPath -ArgumentList @('-u','manage.py','runserver','127.0.0.1:8000','--noreload','--skip-migration-check') -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    $healthy = $false
    do {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health/' -TimeoutSec 2; $healthy = $health.status -eq 'ok' } catch { Start-Sleep -Milliseconds 250 }
    } while (-not $healthy -and -not $server.HasExited -and [DateTime]::UtcNow -lt $deadline)
    if (-not $healthy) { throw 'Development server did not become ready. Review backend/.runtime/development.stderr.log. Credentials were not printed.' }
    Write-Host ('Django is running with the configured credentials. PID: ' + $server.Id)
    & $pythonPath manage.py verify_connection --http-only --role $Role
    if ($LASTEXITCODE -ne 0) { throw 'Authenticated HTTP verification failed. The server remains running for diagnosis; inspect Settings and the reported status.' }
    if ($CopyToken) {
        Set-Clipboard -Value ([Environment]::GetEnvironmentVariable($tokenVariable, 'Process'))
        Write-Host 'Selected API token copied locally. Paste ONLY its value into Angular Settings, then Connect. Do not paste it into chat or source files.'
    } else {
        Write-Host ('To copy the token locally in this same terminal: Set-Clipboard -Value $env:' + $tokenVariable)
    }
    Write-Host 'Verified read-only SQL and authenticated direct/proxied GETs. Website: http://localhost:4200'
} finally { Pop-Location }
