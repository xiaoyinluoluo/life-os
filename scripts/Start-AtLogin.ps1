param([ValidateRange(0, 30)][int]$DelaySeconds = 5)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$logFile = Join-Path $runtimeDirectory 'autostart.log'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcherPath = Join-Path $PSScriptRoot 'Manage-LifeOS.ps1'
"$(Get-Date -Format o) Life OS login startup" | Set-Content -LiteralPath $logFile -Encoding UTF8
if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }

for ($attempt = 1; $attempt -le 6; $attempt++) {
    "Attempt $attempt" | Add-Content -LiteralPath $logFile -Encoding UTF8
    # File redirection keeps persistent child services out of a native output pipe.
    # Wait only for the launcher itself, not its long-running descendants.
    $outputFile = Join-Path $runtimeDirectory 'autostart-launcher.out.log'
    $errorFile = Join-Path $runtimeDirectory 'autostart-launcher.error.log'
    $runner = Start-Process -FilePath $powershellPath -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $launcherPath + '"'), '-NoBrowser') -WindowStyle Hidden -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile -PassThru
    $null = $runner.Handle  # cache native handle before a short-lived process exits
    $runner.WaitForExit()
    $runner.Refresh()
    $exitCode = $runner.ExitCode
    if ($null -eq $exitCode) { throw 'Unable to read the launcher exit code.' }
    Get-Content -LiteralPath $outputFile -ErrorAction SilentlyContinue | Out-File -LiteralPath $logFile -Append -Encoding UTF8
    Get-Content -LiteralPath $errorFile -ErrorAction SilentlyContinue | Out-File -LiteralPath $logFile -Append -Encoding UTF8
    $runner.Dispose()
    if ($exitCode -eq 0) {
        "$(Get-Date -Format o) READY http://127.0.0.1:5173/" | Add-Content -LiteralPath $logFile -Encoding UTF8
        exit 0
    }
    if ($attempt -lt 6) { Start-Sleep -Seconds 10 }
}
"Startup failed. Check service logs or run Start-LifeOS.cmd manually." | Add-Content -LiteralPath $logFile -Encoding UTF8
exit 1
