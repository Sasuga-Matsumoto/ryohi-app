# Set environment variables for Android development (persisted at User scope).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup-env.ps1
# After running, close and reopen your terminal.

[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")

$path = [Environment]::GetEnvironmentVariable("Path", "User")
$additions = @(
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
  "$env:LOCALAPPDATA\Android\Sdk\emulator"
)
foreach ($p in $additions) {
  if ($path -notlike "*$p*") {
    $path = "$path;$p"
  }
}
[Environment]::SetEnvironmentVariable("Path", $path, "User")

Write-Host ""
Write-Host "OK: env vars set." -ForegroundColor Green
Write-Host "  ANDROID_HOME = $env:LOCALAPPDATA\Android\Sdk"
Write-Host "  JAVA_HOME    = C:\Program Files\Android\Android Studio\jbr"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Close this terminal"
Write-Host "  2. Open a new terminal"
Write-Host "  3. Run: adb --version"
Write-Host "         java --version"
Write-Host ""
