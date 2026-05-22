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

  assert.doesNotMatch(buildScript, /FfmpegPath/);
  assert.doesNotMatch(buildScript, /ffmpeg\.exe/);

  assert.match(page, /analysis-download-helper-0\.1\.2\.zip/);
  assert.match(page, /下载轻量解析组件/);
});
