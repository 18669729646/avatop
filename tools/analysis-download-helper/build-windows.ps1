param(
  [string]$Version = "0.1.7"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $Root "..\..")
$DistRoot = Join-Path $Root "dist"
$ExeName = "analysis-download-helper.exe"

Remove-Item -Recurse -Force -LiteralPath $DistRoot -ErrorAction SilentlyContinue

Push-Location $Root
try {
  python -m PyInstaller --noconfirm --noconsole --onefile --icon (Join-Path $ProjectRoot "src\app\favicon.ico") --name analysis-download-helper --collect-all yt_dlp helper.py
} finally {
  Pop-Location
}

$ZipPath = Join-Path $DistRoot "analysis-download-helper-$Version.zip"
$ExePath = Join-Path $DistRoot $ExeName
if (!(Test-Path $ExePath)) {
  throw "Missing build output: $ExePath"
}

for ($attempt = 1; $attempt -le 5; $attempt++) {
  try {
    Start-Sleep -Seconds 1
    Compress-Archive -Path $ExePath -DestinationPath $ZipPath -Force
    break
  } catch {
    if ($attempt -eq 5) {
      throw
    }
    Start-Sleep -Seconds 2
  }
}

Write-Host "Built $ZipPath"
