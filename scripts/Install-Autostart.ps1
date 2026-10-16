param([switch]$Disable, [switch]$Status)
$ErrorActionPreference = 'Stop'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'Life OS - AutoStart.lnk'
$projectRoot = Split-Path -Parent $PSScriptRoot
$entryPath = Join-Path $PSScriptRoot 'Start-AtLogin.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$expectedArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $entryPath + '"'
$shell = New-Object -ComObject WScript.Shell

if (Test-Path -LiteralPath $shortcutPath) {
    $current = $shell.CreateShortcut($shortcutPath)
    if ($current.TargetPath -ne $powershellPath -or $current.Arguments -ne $expectedArguments) {
        throw "A different startup entry uses this name. It has been preserved: $shortcutPath"
    }
}
if ($Status) {
    if (Test-Path -LiteralPath $shortcutPath) { Write-Output "ENABLED: $shortcutPath" }
    else { Write-Output 'DISABLED: no Life OS login startup entry' }
    exit 0
}
if ($Disable) {
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    Write-Output 'Life OS login startup disabled. Running services and data are unchanged.'
    exit 0
}
if (-not (Test-Path -LiteralPath $entryPath)) { throw 'Start-AtLogin.ps1 is missing.' }
New-Item -ItemType Directory -Path $startupDirectory -Force | Out-Null
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = $expectedArguments
$shortcut.WorkingDirectory = $projectRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start Life OS development services after user login (local machine only).'
$shortcut.Save()
Write-Output "ENABLED: $shortcutPath"
Write-Output 'Life OS will start in the background after this user logs in. No browser opens automatically.'
