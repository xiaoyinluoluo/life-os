param([switch]$Stop, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.runtime'
$stateFile = Join-Path $runtimeDirectory 'processes.json'
$mutex = New-Object System.Threading.Mutex($false, 'Local\LifeOSDevelopmentLauncher')
$locked = $false

function Get-TrackedProcess($entry) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.id)" -ErrorAction SilentlyContinue
    if ($process -and $process.CreationDate.ToUniversalTime().ToString('o') -eq $entry.created) { return $process }
    return $null
}

function Stop-ProcessTree($process) {
    # Stop descendants only after confirming the tracked parent's identity.
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($process.ProcessId)" -ErrorAction SilentlyContinue)
    foreach ($child in $children) { Stop-ProcessTree $child }
    Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
}

function Save-State($entries) {
    ConvertTo-Json -InputObject @($entries) | Set-Content -LiteralPath $stateFile -Encoding UTF8
}

function Get-Listener($port) {
    return @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Test-Service($url) {
    try { return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { return $false }
}

try {
    $locked = $mutex.WaitOne(1000)
    if (-not $locked) { throw 'Another Life OS launcher is running. Please try again shortly.' }
    $entries = @()
    if (Test-Path -LiteralPath $stateFile) {
        $entries = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $entries = @($entries)
    }

    if ($Stop) {
        foreach ($entry in $entries) {
            $process = Get-TrackedProcess $entry
            if ($process) { Stop-ProcessTree $process }
        }
        if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
        Write-Host 'Life OS development services stopped. Your code and database are preserved.'
        exit 0
    }

    $pythonPath = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
    $vitePath = Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Backend .venv is missing. Follow README setup instructions.' }
    if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Frontend dependencies are missing. Run npm ci in frontend.' }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $entries = @($entries | Where-Object { Get-TrackedProcess $_ })

    $services = @(
        @{name='backend'; port=8000; exe=$pythonPath; args=@('-m','uvicorn','app.main:app','--reload','--host','127.0.0.1','--port','8000'); directory=(Join-Path $projectRoot 'backend'); url='http://127.0.0.1:8000/health'},
        @{name='frontend'; port=5173; exe=$nodePath; args=@(('"' + $vitePath + '"'),'--host','127.0.0.1'); directory=(Join-Path $projectRoot 'frontend'); url='http://127.0.0.1:5173/'}
    )
    # Validate both ports before starting either service.
    foreach ($service in $services) {
        $existing = @($entries | Where-Object { $_.name -eq $service.name })
        if (@(Get-Listener $service.port).Count -gt 0 -and $existing.Count -eq 0) {
            throw "Port $($service.port) is occupied by an unmanaged service. Stop that service first; this launcher will not stop unrelated programs."
        }
    }
    foreach ($service in $services) {
        if (@($entries | Where-Object { $_.name -eq $service.name }).Count -eq 0) {
            $process = Start-Process -FilePath $service.exe -ArgumentList $service.args -WorkingDirectory $service.directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory "$($service.name).out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$($service.name).error.log") -PassThru
            $identity = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
            if (-not $identity) { throw "Failed to launch $($service.name). Check .runtime logs." }
            $entries += [PSCustomObject]@{name=$service.name; id=$process.Id; created=$identity.CreationDate.ToUniversalTime().ToString('o')}
            Save-State $entries
        }
    }
    $deadline = (Get-Date).AddSeconds(30)
    do {
        foreach ($entry in $entries) {
            if (-not (Get-TrackedProcess $entry)) { throw "$($entry.name) exited during startup. Check .runtime logs." }
        }
        $ready = (Test-Service $services[0].url) -and (Test-Service $services[1].url)
        if ($ready) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if (-not $ready) { throw 'Startup timed out. Check .runtime logs, then use Stop-LifeOS.cmd before retrying.' }
    Write-Host 'Life OS is ready: http://127.0.0.1:5173/'
    Write-Host 'Services run in the background. Closing this window or browser does not stop them.'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173/' }
} catch {
    Write-Host "Life OS launcher: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
