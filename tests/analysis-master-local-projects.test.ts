import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnalysisMasterPlaceholderProjectUpsert,
  buildAnalysisMasterProjectStatusPatch,
} from '../src/lib/analysis-master-projects';
import { buildAnalysisMasterUploadInitSession } from '../src/lib/analysis-master-upload-session';

describe('analysis master local-helper project lifecycle', () => {
  it('builds a placeholder project row in downloading state', () => {
    const row = buildAnalysisMasterPlaceholderProjectUpsert({
      projectId: 'am-1',
      userId: 'user-1',
      name: 'Batch row 1',
      sourceUrl: 'https://www.tiktok.com/@maker/video/123',
      importMetadata: {
        batchId: 'batch-1',
        rowIndex: '0',
      },
      now: '2026-05-25T00:00:00.000Z',
    });

    assert.equal(row.id, 'am-1');
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.status, 'downloading');
    assert.equal(row.source_type, 'link');
    assert.equal(row.source_url, 'https://www.tiktok.com/@maker/video/123');
    assert.deepEqual(row.import_metadata, {
      batchId: 'batch-1',
      rowIndex: '0',
    });
  });

  it('builds a status patch for download failure on the same project id', () => {
    const patch = buildAnalysisMasterProjectStatusPatch({
      status: 'download_failed',
      error: '视频解析失败，请检查当前网络环境后重试。',
      now: '2026-05-25T00:00:00.000Z',
    });

    assert.equal(patch.status, 'download_failed');
    assert.equal(patch.error, '视频解析失败，请检查当前网络环境后重试。');
    assert.equal(patch.updated_at, '2026-05-25T00:00:00.000Z');
  });

  it('reuses the caller supplied project id when building upload init state', () => {
    const session = buildAnalysisMasterUploadInitSession({
      userId: 'user-1',
      fileName: 'source.mp4',
      fileSize: 1024,
      chunkSize: 512 * 1024,
      totalChunks: 1,
      name: 'Batch row 1',
      sourceUrl: 'https://www.tiktok.com/@maker/video/123',
      projectId: 'am-existing',
      now: '2026-05-25T00:00:00.000Z',
    });

    assert.equal(session.projectId, 'am-existing');
    assert.equal(session.key, 'analysis-master/user-1/am-existing/1779667200000.mp4');
    assert.equal(session.session.projectId, 'am-existing');
    assert.equal(session.session.sourceUrl, 'https://www.tiktok.com/@maker/video/123');
  });
});
