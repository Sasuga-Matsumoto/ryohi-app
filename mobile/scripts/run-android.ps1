# Build + install + launch app on Android emulator with env vars forced.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\run-android.ps1

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"

Write-Host ""
Write-Host "=== Env vars ===" -ForegroundColor Cyan
Write-Host "  JAVA_HOME    = $env:JAVA_HOME"
Write-Host "  ANDROID_HOME = $env:ANDROID_HOME"
Write-Host ""

Write-Host "=== Connected Android devices ===" -ForegroundColor Cyan
adb devices
Write-Host ""

$mobileDir = Join-Path $PSScriptRoot ".."
Set-Location $mobileDir
Write-Host "=== Current dir ===" -ForegroundColor Cyan
Write-Host "  $(Get-Location)"
Write-Host ""

Write-Host "=== Build start ===" -ForegroundColor Yellow
Write-Host "  First run takes 15-30 min. Long silent periods are normal."
Write-Host ""
npx expo run:android
