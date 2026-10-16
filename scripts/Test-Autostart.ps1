param([switch]$RestartServices)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$entry = Join-Path $PSScriptRoot 'Start-AtLogin.ps1'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'Life OS - AutoStart.lnk'
if (-not (Test-Path -LiteralPath $shortcutPath)) { throw 'FAIL: login startup is not registered.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$expected = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $entry + '"'
if ($shortcut.TargetPath -ne $powershellPath -or $shortcut.Arguments -ne $expected -or $shortcut.WorkingDirectory -ne $projectRoot) {
    throw 'FAIL: startup shortcut target does not match this project.'
}
Write-Output 'PASS: current-user startup shortcut points to the correct launcher.'
if ($RestartServices) {
    & $powershellPath -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Manage-LifeOS.ps1') -Stop
    if ($LASTEXITCODE -ne 0) { throw 'FAIL: unable to stop tracked services.' }
    if (@(Get-NetTCPConnection -State Listen -LocalPort 8000,5173 -ErrorAction SilentlyContinue).Count -gt 0) { throw 'FAIL: ports still occupied.' }
    Write-Output 'PASS: services stopped, matching the unavailable state after reboot.'
}
& $powershellPath -NoProfile -ExecutionPolicy Bypass -File $entry -DelaySeconds 0
if ($LASTEXITCODE -ne 0) { throw 'FAIL: login entry could not restore services.' }
$response = Invoke-WebRequest http://127.0.0.1:5173/companion -UseBasicParsing -TimeoutSec 10
if ($response.StatusCode -ne 200) { throw 'FAIL: frontend page is unavailable.' }
$health = Invoke-RestMethod http://127.0.0.1:5173/api/health -TimeoutSec 10
if ($health.status -ne 'ok' -or $health.database -ne 'connected') { throw 'FAIL: API proxy or SQLite is unavailable.' }
$body = [Text.Encoding]::UTF8.GetBytes('{"message":"test learning direction"}')
$chat = Invoke-RestMethod http://127.0.0.1:5173/api/companion/chat -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 10
if (-not $chat.analysis -or -not $chat.suggestions -or -not $chat.next_actions) { throw 'FAIL: companion API is unavailable.' }
$stateFile = Join-Path $projectRoot '.runtime\processes.json'
$before = Get-Content -LiteralPath $stateFile -Raw
& $powershellPath -NoProfile -ExecutionPolicy Bypass -File $entry -DelaySeconds 0
if ($LASTEXITCODE -ne 0) { throw 'FAIL: repeated login startup failed.' }
if ($before -ne (Get-Content -LiteralPath $stateFile -Raw)) { throw 'FAIL: repeated login entry spawned duplicate processes.' }
Write-Output 'PASS: login recovery, frontend, API proxy, SQLite, Companion and duplicate-start protection.'
