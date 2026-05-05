# Build script: produces a release Tauri bundle (NSIS + MSI installers).
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path node_modules)) {
        Write-Host 'Installing npm dependencies...' -ForegroundColor Cyan
        npm install
    }
    Write-Host 'Building Tauri release bundle...' -ForegroundColor Cyan
    pnpm run tauri:build
} finally {
    Pop-Location
}
