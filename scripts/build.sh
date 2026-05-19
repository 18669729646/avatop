#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-offline --loglevel debug

echo "Installing yt-dlp for video link parsing..."
pip install -q yt-dlp 2>/dev/null || pip3 install -q yt-dlp 2>/dev/null || echo "Warning: yt-dlp install skipped (Python not available)"

echo "Building the project..."
pnpm next build

echo "Build completed successfully!"
