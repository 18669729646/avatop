import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('analysis download helper has tray lifecycle and log actions', () => {
  const helper = readFileSync('tools/analysis-download-helper/helper.py', 'utf8');

  assert.match(helper, /Shell_NotifyIconW/);
  assert.match(helper, /RegisterClassW/);
  assert.match(helper, /CreateWindowExW/);
  assert.match(helper, /WM_USER/);
  assert.match(helper, /open log/i);
  assert.match(helper, /exit/i);
  assert.match(helper, /log/i);
});
