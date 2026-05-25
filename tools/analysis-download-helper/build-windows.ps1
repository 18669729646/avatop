param(
  [string]$Version = "0.1.3",
  [string]$YtDlpPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $Root "..\..")
$DistRoot = Join-Path $Root "dist"
$BundleDir = Join-Path $DistRoot "analysis-download-helper-$Version"
$BinDir = Join-Path $BundleDir "bin"

function Resolve-ToolPath {
  param([string]$Name, [string]$ExplicitPath)
  if ($ExplicitPath) {
    if (!(Test-Path -LiteralPath $ExplicitPath)) {
      throw "$Name not found at $ExplicitPath"
    }
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (!$cmd) {
    $cmd = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
  }
  if (!$cmd) {
    throw "$Name was not found. Install it or pass -${Name}Path."
  }
  return $cmd.Source
}

$YtDlp = Resolve-ToolPath "yt-dlp" $YtDlpPath

Remove-Item -Recurse -Force -LiteralPath $DistRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

Push-Location $Root
try {
  python -m PyInstaller --noconfirm --onedir --name analysis-download-helper helper.py
} finally {
  Pop-Location
}

Copy-Item -Recurse -Force -Path (Join-Path $Root "dist\analysis-download-helper\*") -Destination $BundleDir
Copy-Item -LiteralPath $YtDlp -Destination (Join-Path $BinDir "yt-dlp.exe")
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
