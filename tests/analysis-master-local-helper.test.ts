import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
  ANALYSIS_LOCAL_HELPER_MAX_BYTES,
  ANALYSIS_LOCAL_HELPER_URL,
  buildAnalysisLocalHelperRequest,
} from '../src/lib/analysis-master-local-helper';

describe('analysis master local helper request', () => {
  it('builds a minimal local helper request that reuses existing upload APIs', () => {
    const request = buildAnalysisLocalHelperRequest({
      sourceUrl: ' https://www.tiktok.com/@maker/video/123 ',
      projectName: '  Test Project  ',
      saasBaseUrl: 'https://app.example.com/',
      authToken: 'jwt-token',
      chunkSize: ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
    });

    assert.equal(ANALYSIS_LOCAL_HELPER_URL, 'http://127.0.0.1:17321');
    assert.equal(ANALYSIS_LOCAL_HELPER_CHUNK_SIZE, 512 * 1024);
    assert.equal(ANALYSIS_LOCAL_HELPER_MAX_BYTES, 100 * 1024 * 1024);
    assert.deepEqual(request, {
      sourceUrl: 'https://www.tiktok.com/@maker/video/123',
      projectName: 'Test Project',
      saasBaseUrl: 'https://app.example.com',
      authToken: 'jwt-token',
      chunkSize: 512 * 1024,
      maxBytes: 100 * 1024 * 1024,
    });
  });

  it('uses smaller chunks for the local helper without changing manual upload chunks', () => {
    const pageSource = readFileSync('src/app/analysis-master/page.tsx', 'utf8');

    assert.match(pageSource, /chunkSize:\s*ANALYSIS_LOCAL_HELPER_CHUNK_SIZE/);
    assert.match(pageSource, /const CHUNK_SIZE = 5 \* 1024 \* 1024/);
  });

  it('rejects missing auth token before contacting the helper', () => {
    assert.throws(
      () => buildAnalysisLocalHelperRequest({
        sourceUrl: 'https://www.tiktok.com/@maker/video/123',
        projectName: 'Link project',
        saasBaseUrl: 'https://app.example.com',
        authToken: null,
        chunkSize: ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
      }),
      /请先登录/
    );
  });
});
