import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('analysis download helper is packaged as a lightweight yt-dlp-only build', () => {
  const helper = readFileSync('tools/analysis-download-helper/helper.py', 'utf8');
  const buildScript = readFileSync('tools/analysis-download-helper/build-windows.ps1', 'utf8');
  const page = readFileSync('src/app/analysis-master/page.tsx', 'utf8');

  assert.match(
    helper,
    /best\[ext=mp4\]\[acodec!=none\]\[vcodec!=none\]\/best\[acodec!=none\]\[vcodec!=none\]\/best/,
  );
  assert.doesNotMatch(helper, /resolve_tool\("ffmpeg"\)/);
  assert.doesNotMatch(helper, /--merge-output-format/);
  assert.doesNotMatch(helper, /--ffmpeg-location/);
  assert.match(helper, /Access-Control-Allow-Private-Network/);
  assert.match(helper, /Access-Control-Allow-Origin", "\*"/);
  assert.match(helper, /COMPLETE_UPLOAD_TIMEOUT_SECONDS = 600/);
  assert.match(helper, /helper_log\("complete upload start"/);
  assert.match(helper, /helper_log\("complete upload done"/);
  assert.match(helper, /response dropped:/);
  assert.match(helper, /success response dropped:/);
  assert.match(helper, /Shell_NotifyIconW/);
  assert.match(helper, /tray/i);

  assert.match(buildScript, /--noconsole/);
  assert.match(buildScript, /favicon\.ico/);
  assert.doesNotMatch(buildScript, /FfmpegPath/);
  assert.doesNotMatch(buildScript, /ffmpeg\.exe/);

  assert.match(page, /analysis-download-helper-0\.1\.5\.zip/);
});
