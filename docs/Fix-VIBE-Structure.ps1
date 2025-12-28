# ===============================
# Fix-VIBE-Structure.ps1
# Safe V.I.B.E. project normalizer
# ===============================

$ROOT = "C:\dev\VIBE"
$NESTED = "C:\dev\VIBE\VIBE"
$BACKUP = "C:\dev\VIBE\_backup_" + (Get-Date -Format "yyyyMMdd_HHmmss")

Write-Host "🔧 V.I.B.E. structure repair starting..." -ForegroundColor Cyan

# Create backup folder
New-Item -ItemType Directory -Path $BACKUP -Force | Out-Null

# --- BACKEND ---
if (Test-Path "$NESTED\backend") {
    Write-Host "📦 Found nested backend. Moving to backup..."
    Move-Item "$NESTED\backend" "$BACKUP\backend_nested" -Force
}

if (-not (Test-Path "$ROOT\backend")) {
    if (Test-Path "$BACKUP\backend_nested") {
        Write-Host "✅ Restoring backend to root..."
        Move-Item "$BACKUP\backend_nested" "$ROOT\backend" -Force
    }
}

# --- FRONTEND ---
if (Test-Path "$NESTED\frontend") {
    Write-Host "📦 Found nested frontend. Moving to backup..."
    Move-Item "$NESTED\frontend" "$BACKUP\frontend_nested" -Force
}

# Prefer root frontend if it has package.json
if (Test-Path "$ROOT\frontend\package.json") {
    Write-Host "✅ Root frontend confirmed"
} elseif (Test-Path "$BACKUP\frontend_nested\package.json") {
    Write-Host "⚠️ Root frontend missing package.json. Restoring nested frontend..."
    Move-Item "$BACKUP\frontend_nested" "$ROOT\frontend" -Force
}

# --- CLEAN EMPTY NESTED VIBE ---
if (Test-Path $NESTED) {
    Write-Host "🧹 Removing empty nested VIBE folder"
    Remove-Item $NESTED -Recurse -Force
}

Write-Host ""
Write-Host "✅ V.I.B.E. structure normalized" -ForegroundColor Green
Write-Host "📁 Backup saved at: $BACKUP"
Write-Host ""
Write-Host "NEXT STEPS:"
Write-Host "  cd C:\dev\VIBE\backend && npm run dev"
Write-Host "  cd C:\dev\VIBE\frontend && npm run dev"
