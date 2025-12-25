# Stop-VIBE.ps1
$ErrorActionPreference = "SilentlyContinue"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$pidfile = Join-Path $root "logs\pids.json"

if (Test-Path $pidfile) {
  $pids = Get-Content $pidfile | ConvertFrom-Json
  if ($pids.backend)  { Stop-Process -Id $pids.backend  -Force }
  if ($pids.frontend) { Stop-Process -Id $pids.frontend -Force }
  Remove-Item $pidfile -Force
  Write-Host "✅ V.I.B.E. stopped cleanly."
} else {
  Write-Host "No active PID file — nothing to stop."
}

