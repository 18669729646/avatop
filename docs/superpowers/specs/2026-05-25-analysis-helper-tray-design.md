# Analysis Download Helper Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows Analysis Download Helper run as a tray app with no separate window, while keeping status, logs, and exit controls available from the tray menu.

**Architecture:** Keep the helper as a single Windows Python executable that starts the local HTTP server in the background and keeps the main thread alive with a tray icon loop. Use a bundled tray icon asset, file-based logging, and a small tray menu with status, open-log, and exit actions. Do not add autostart, remote control, or a second UI surface.

**Tech Stack:** Python stdlib, `pystray`, `Pillow`, `PyInstaller`, existing helper HTTP endpoints, Windows shell APIs.

---

## File Map

- `tools/analysis-download-helper/helper.py`
  - Owns the HTTP server, background worker startup, tray icon lifecycle, tray menu actions, and file logging.
- `tools/analysis-download-helper/build-windows.ps1`
  - Builds the packaged helper with no console window, copies the tray icon asset into the bundle, and emits the final zip.
- `tools/analysis-download-helper/README.md`
  - Documents tray-mode startup, tray menu behavior, and the new packaged output.
- `tests/analysis-download-helper-lite.test.ts`
  - Verifies the lightweight build still excludes `ffmpeg`, now also checks tray packaging and no-console build flags.
- `tests/analysis-download-helper-tray.test.ts`
  - New source-level regression test for tray menu strings, logging hooks, and graceful exit behavior.
- `public/analysis-helper/analysis-download-helper-0.1.5.zip`
  - New published package that users download from the SaaS page.

## Design Choices

1. Use a real tray icon instead of a hidden console process.
   This gives the user a visible running state, a place to open logs, and a clean exit path.
2. Keep the local HTTP server in the same process.
   This avoids adding IPC, a second executable, or a service install flow.
3. Use file logging instead of stdout.
   The helper will run without a console window, so logs need a durable location the user can open from the tray menu.

## Task 1: Add tray lifecycle and file logging

**Files:**
- Modify `tools/analysis-download-helper/helper.py`
- Add `tests/analysis-download-helper-tray.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('helper ships with tray lifecycle and file logging hooks', () => {
  const helper = readFileSync('tools/analysis-download-helper/helper.py', 'utf8');

  assert.match(helper, /pystray/);
  assert.match(helper, /Pillow|Image\.open|Image\.new/);
  assert.match(helper, /open log/i);
  assert.match(helper, /tray/i);
  assert.match(helper, /logging/i);
  assert.match(helper, /exit/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/analysis-download-helper-tray.test.ts`

Expected: FAIL because the current helper does not define tray lifecycle or file logging hooks.

- [ ] **Step 3: Implement the minimal tray runtime**

Use the existing helper process, but restructure startup so it:
- creates a file logger under the helper bundle directory, for example `logs/helper.log`
- starts the HTTP server on a background thread
- creates a tray icon from a bundled image asset
- shows a tray menu with `状态`, `打开日志`, and `退出`
- keeps the main thread in the tray loop until `退出` is clicked
- shuts the server down cleanly on exit

Concrete behavior to implement:

```python
def open_log():
    os.startfile(str(LOG_FILE))

def show_status():
    helper_log(f"status: running on http://{HOST}:{PORT}")

def on_exit(icon, item):
    shutdown_event.set()
    server.shutdown()
    icon.stop()
```

The tray icon should be loaded from the bundle, not embedded in code.
The helper should still answer `GET /health` and `POST /v1/download` exactly as before.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec tsx --test tests/analysis-download-helper-tray.test.ts tests/analysis-download-helper-lite.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/analysis-download-helper/helper.py tests/analysis-download-helper-tray.test.ts
git commit -m "feat: add tray runtime to analysis helper"
```

## Task 2: Package the helper as a tray app

**Files:**
- Modify `tools/analysis-download-helper/build-windows.ps1`
- Modify `tools/analysis-download-helper/README.md`
- Modify `tests/analysis-download-helper-lite.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that the build script uses the no-console mode and that the bundle includes the tray icon asset:

```ts
assert.match(buildScript, /--noconsole/);
assert.match(buildScript, /logo\.png/);
assert.match(page, /analysis-download-helper-0\.1\.5\.zip/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec tsx --test tests/analysis-download-helper-lite.test.ts`

Expected: FAIL until the build script and published package are updated.

- [ ] **Step 3: Implement the packaging changes**

Update the build script so it:
- passes `--noconsole` to PyInstaller
- copies `public/logo.png` into the helper bundle as the tray icon asset
- keeps the bundled `yt-dlp.exe`
- emits `analysis-download-helper-0.1.5.zip`

Update the README so it documents:
- the helper runs from the tray without a separate window
- the tray menu items and what they do
- the new package filename

Keep `start-helper.bat` only as a compatibility launcher if it remains in the bundle, but do not make it the documented default launch path.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm exec tsx --test tests/analysis-download-helper-lite.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/analysis-download-helper/build-windows.ps1 tools/analysis-download-helper/README.md tests/analysis-download-helper-lite.test.ts
git commit -m "feat: package analysis helper as tray app"
```

## Task 3: Publish the new helper package

**Files:**
- Create: `public/analysis-helper/analysis-download-helper-0.1.5.zip`
- Modify: `public/analysis-helper/analysis-download-helper-0.1.4.zip` removal or replacement as part of the release update

- [ ] **Step 1: Build the Windows package**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools\analysis-download-helper\build-windows.ps1 -Version 0.1.5
```

Expected: creates `tools/analysis-download-helper/dist/analysis-download-helper-0.1.5.zip`.

- [ ] **Step 2: Copy the published zip into `public/analysis-helper/`**

Expected final published asset:

```text
public/analysis-helper/analysis-download-helper-0.1.5.zip
```

- [ ] **Step 3: Verify the published asset matches the page link**

Run:

```bash
pnpm exec tsx --test tests/analysis-download-helper-lite.test.ts
```

Expected: PASS, confirming the SaaS page link and published asset stay aligned.

- [ ] **Step 4: Commit**

```bash
git add public/analysis-helper/analysis-download-helper-0.1.5.zip public/analysis-helper/analysis-download-helper-0.1.4.zip
git commit -m "chore: publish tray helper 0.1.5"
```

## Verification

Before marking the tray work complete:
- `pnpm exec tsx --test tests/analysis-download-helper-lite.test.ts tests/analysis-download-helper-tray.test.ts`
- `python -m py_compile tools/analysis-download-helper/helper.py`
- `pnpm ts-check`
- `pnpm lint`
- `pnpm next build`

Manual check:
- launch the helper
- confirm no separate console window appears
- confirm the tray icon is visible
- confirm `GET /health` still works
- confirm a download request still succeeds
- confirm `打开日志` opens the helper log file
- confirm `退出` shuts down the helper cleanly

## Risks

- `pystray` and `Pillow` must be available in the build environment; otherwise packaging fails.
- Windows tray behavior depends on the executable being built without a console window.
- If the helper is started from a `.bat` file, the batch launcher can still flash a console; the documented default should be the tray-capable `.exe`.
- The tray status/log behavior must not interfere with the existing upload flow or the helper HTTP contract.
