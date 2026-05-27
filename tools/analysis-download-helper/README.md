# Analysis Download Helper MVP

This is the minimal local helper for Analysis Master link imports.

It solves one problem only: download a public video on the user's Windows machine and upload it through the existing SaaS chunk upload APIs.

## Run locally

For development, install `yt-dlp`, then run:

```powershell
python helper.py
```

When packaged for Windows, the helper starts in the system tray with no separate console window. The tray menu includes status, open log, and exit.

Health check:

```text
http://127.0.0.1:17321/health
```

## API

- `GET /health`
- `POST /v1/download`

`POST /v1/download` receives:

```json
{
  "sourceUrl": "https://www.tiktok.com/...",
  "projectName": "链接分析项目",
  "saasBaseUrl": "https://example.com",
  "authToken": "jwt-token",
  "chunkSize": 5242880,
  "maxBytes": 104857600
}
```

The helper never stores the SaaS token. Do not log request bodies in production builds.

## Build Windows package

Run from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File tools\analysis-download-helper\build-windows.ps1
```

The build script creates:

```text
tools/analysis-download-helper/dist/analysis-download-helper-0.1.7.zip
```

The zip contains a single executable:

- `analysis-download-helper.exe`

This one-file package does not include `ffmpeg`. It asks `yt-dlp` to download a single file that already contains both audio and video. A small number of links may fail if the source platform only exposes separate audio and video streams.
