# Install script: builds the project and runs the freshest NSIS installer.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    & "$PSScriptRoot/build.ps1"
    $bundleRoot = Join-Path $PSScriptRoot 'src-tauri/target/release/bundle'
    if (-not (Test-Path $bundleRoot)) { throw "Bundle directory not found: $bundleRoot" }
    $installer = Get-ChildItem -Path $bundleRoot -Recurse -Include '*.exe', '*.msi' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $installer) { throw 'No installer found in target/release/bundle.' }
    Write-Host "Launching installer: $($installer.FullName)" -ForegroundColor Green
    Start-Process -FilePath $installer.FullName
} finally {
    Pop-Location
}
