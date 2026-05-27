param(
  [string]$Version = "0.1.6"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $Root "..\..")
$DistRoot = Join-Path $Root "dist"
$BundleDir = Join-Path $DistRoot "analysis-download-helper-$Version"

Remove-Item -Recurse -Force -LiteralPath $DistRoot -ErrorAction SilentlyContinue

Push-Location $Root
try {
  python -m PyInstaller --noconfirm --noconsole --onedir --name analysis-download-helper --collect-all yt_dlp helper.py
} finally {
  Pop-Location
}

Copy-Item -Recurse -Force -Path (Join-Path $Root "dist\analysis-download-helper\*") -Destination $BundleDir
Copy-Item -LiteralPath (Join-Path $ProjectRoot "src\app\favicon.ico") -Destination (Join-Path $BundleDir "favicon.ico")
Copy-Item -LiteralPath (Join-Path $Root "README.md") -Destination (Join-Path $BundleDir "README.md")

$StartScript = @'
@echo off
cd /d %~dp0
analysis-download-helper.exe
'@
Set-Content -LiteralPath (Join-Path $BundleDir "start-helper.bat") -Value $StartScript -Encoding ASCII

$ZipPath = Join-Path $DistRoot "analysis-download-helper-$Version.zip"
for ($attempt = 1; $attempt -le 5; $attempt++) {
  try {
    Start-Sleep -Seconds 1
    Compress-Archive -Path (Join-Path $BundleDir "*") -DestinationPath $ZipPath -Force
    break
  } catch {
    if ($attempt -eq 5) {
      throw
    }
    Start-Sleep -Seconds 2
  }
}

Write-Host "Built $ZipPath"
