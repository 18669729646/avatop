# Analysis Download Helper MVP

This is the minimal local helper for Analysis Master link imports.

It solves one problem only: download a public video on the user's Windows machine and upload it through the existing SaaS chunk upload APIs.

## Run locally

For development, install `yt-dlp` and `ffmpeg`, then run:

```powershell
python helper.py
```

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
tools/analysis-download-helper/dist/analysis-download-helper-0.1.0.zip
```

The zip contains:

- `analysis-download-helper.exe`
- `start-helper.bat`
- `bin/yt-dlp.exe`
- `bin/ffmpeg.exe`
- `README.md`
