#Requires -Version 7
$ErrorActionPreference = "Stop"

Write-Host "=== V.I.B.E. Build 1 — bootstrap ===" -ForegroundColor Cyan

# --- paths & logs ---
$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$logs     = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$pidfile  = Join-Path $logs "pids.json"

function Wait-Port {
  param(
    [int]$Port,
    [string]$Label,
    [int]$TimeoutSec = 90
  )
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $test = Test-NetConnection -ComputerName "127.0.0.1" -Port $Port -WarningAction SilentlyContinue
    if ($test.TcpTestSucceeded) {
      Write-Host ("    {0} OK on :{1}" -f $Label, $Port)
      return $true
    }
    Start-Sleep -Milliseconds 750
  }
  Write-Warning "⚠ $Label did not open port $Port yet (continuing)"
  return $false
}

# -----------------------------------------------------------
# 1) Ensure Ollama daemon is running (CPU ONLY)
# -----------------------------------------------------------
Write-Host "[1/4] Ensuring Ollama daemon is running…"

$env:OLLAMA_NO_GPU = "1"
$env:OLLAMA_MAX_LOADED_MODELS = "1"

$svc = Get-Service -Name "ollama" -ErrorAction SilentlyContinue
if ($svc) {
  try { Start-Service -Name ollama -ErrorAction SilentlyContinue } catch {}
  Write-Host "    Ollama service OK"
}
else {
  if (-not (Get-Process -Name "ollama" -ErrorAction SilentlyContinue)) {
    Start-Process -WindowStyle Hidden -FilePath "ollama" -ArgumentList "serve" -WorkingDirectory $root | Out-Null
    Start-Sleep -Seconds 1
  }
  Write-Host "    Ollama (user-mode) OK"
}

# Verify Ollama
$tags = try { curl.exe --silent http://127.0.0.1:11434/api/tags } catch { "" }
if (-not $tags) { throw "Ollama daemon not responding on :11434." }

# -----------------------------------------------------------
# 2) Start backend (MODEL LOCKED CLEANLY)
# -----------------------------------------------------------
Write-Host "[2/4] Starting backend (PORT 3001)…"

$env:PORT           = "3001"
$env:OLLAMA_HOST    = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL   = "llama3.2:1b"
$env:OLLAMA_NUM_GPU = "0"

# IMPORTANT: no PRIMARY override yet
Remove-Item Env:OLLAMA_PRIMARY_MODEL -ErrorAction SilentlyContinue

$backendOut = Join-Path $logs "backend.out.log"
$backendErr = Join-Path $logs "backend.err.log"

$backendProc = Start-Process `
  -FilePath "node" `
  -ArgumentList "server.mjs" `
  -WorkingDirectory $backend `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError  $backendErr `
  -PassThru -WindowStyle Hidden

# -----------------------------------------------------------
# 3) Backend health check
# -----------------------------------------------------------
Write-Host "[3/4] Backend health check…"
Wait-Port -Port 3001 -Label "backend"
$health = curl.exe --silent http://localhost:3001/api/health
Write-Host "    $health"

# -----------------------------------------------------------
# 4) Start frontend (Vite 5173)
# -----------------------------------------------------------
Write-Host "[4/4] Starting frontend (Vite 5173)…"

Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
  ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }

$frontendOut = Join-Path $logs "frontend.out.log"
$frontendErr = Join-Path $logs "frontend.err.log"

$frontendProc = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList "/c npm run dev -- --host --port 5173 --strictPort" `
  -WorkingDirectory $frontend `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError  $frontendErr `
  -PassThru

Wait-Port -Port 5173 -Label "frontend (vite)" -TimeoutSec 120

# -----------------------------------------------------------
# Save PIDs
# -----------------------------------------------------------
@{
  backend  = $backendProc.Id
  frontend = $frontendProc.Id
} | ConvertTo-Json | Set-Content -Path $pidfile -Encoding UTF8

# -----------------------------------------------------------
# Ready
# -----------------------------------------------------------
Write-Host "=== Ready: http://localhost:5173 ===" -ForegroundColor Green
Start-Process "http://localhost:5173"
Write-Host "Logs -> $logs"



