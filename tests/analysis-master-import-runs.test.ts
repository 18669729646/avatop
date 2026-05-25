import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnalysisMasterImportRunCreate,
  buildAnalysisMasterImportRunProgress,
  buildAnalysisMasterImportRunToken,
  buildAnalysisMasterItemClaimPatch,
  buildAnalysisMasterItemFailPatch,
  buildAnalysisMasterItemSuccessPatch,
} from '../src/lib/analysis-master-import-runs';

describe('analysis master import runs', () => {
  it('creates one run with placeholder projects and items for single or batch imports', () => {
    const result = buildAnalysisMasterImportRunCreate({
      userId: 'user-1',
      mode: 'batch',
      sourceFileName: 'batch.xlsx',
      imports: [
        { sourceUrl: 'https://www.tiktok.com/@a/video/1', metadata: { title: 'A' } },
        { sourceUrl: 'https://www.tiktok.com/@b/video/2', metadata: { title: 'B' } },
      ],
      now: '2026-05-25T00:00:00.000Z',
      randomToken: 'runner-token',
      idFactory: (prefix, index) => `${prefix}-${index}`,
    });

    assert.equal(result.run.id, 'am-run-0');
    assert.equal(result.run.user_id, 'user-1');
    assert.equal(result.run.mode, 'batch');
    assert.equal(result.run.status, 'pending');
    assert.equal(result.run.total_items, 2);
    assert.equal(result.run.runner_token, 'runner-token');
    assert.equal(result.projects.length, 2);
    assert.equal(result.projects[0].id, 'am-project-0');
    assert.equal(result.projects[0].status, 'downloading');
    assert.equal(result.items[0].id, 'am-item-0');
    assert.equal(result.items[0].run_id, 'am-run-0');
    assert.equal(result.items[0].project_id, 'am-project-0');
    assert.equal(result.items[0].status, 'pending');
    assert.deepEqual(result.items[0].metadata, { title: 'A' });
  });

  it('builds claim and finish patches with retry semantics', () => {
    assert.deepEqual(buildAnalysisMasterItemClaimPatch({
      workerId: 'helper-1',
      attempt: 1,
      now: '2026-05-25T00:00:01.000Z',
    }), {
      status: 'running',
      worker_id: 'helper-1',
      attempts: 1,
      error: null,
      started_at: '2026-05-25T00:00:01.000Z',
      updated_at: '2026-05-25T00:00:01.000Z',
    });

    assert.deepEqual(buildAnalysisMasterItemFailPatch({
      error: 'download failed',
      attempts: 1,
      maxRetries: 1,
      now: '2026-05-25T00:00:02.000Z',
    }), {
      status: 'pending',
      error: 'download failed',
      attempts: 1,
      updated_at: '2026-05-25T00:00:02.000Z',
    });

    assert.deepEqual(buildAnalysisMasterItemFailPatch({
      error: 'download failed again',
      attempts: 2,
      maxRetries: 1,
      now: '2026-05-25T00:00:03.000Z',
    }), {
      status: 'failed',
      error: 'download failed again',
      attempts: 2,
      completed_at: '2026-05-25T00:00:03.000Z',
      updated_at: '2026-05-25T00:00:03.000Z',
    });

    assert.deepEqual(buildAnalysisMasterItemSuccessPatch({
      now: '2026-05-25T00:00:04.000Z',
    }), {
      status: 'completed',
      error: null,
      completed_at: '2026-05-25T00:00:04.000Z',
      updated_at: '2026-05-25T00:00:04.000Z',
    });
  });

  it('summarizes item counts into run status', () => {
    assert.deepEqual(buildAnalysisMasterImportRunProgress({
      total: 3,
      completed: 2,
      failed: 1,
      running: 0,
      now: '2026-05-25T00:00:05.000Z',
    }), {
      status: 'completed',
      completed_items: 2,
      failed_items: 1,
      updated_at: '2026-05-25T00:00:05.000Z',
      completed_at: '2026-05-25T00:00:05.000Z',
    });

    assert.equal(buildAnalysisMasterImportRunToken('run-1', 'token-1'), 'run-1:token-1');
  });
});
