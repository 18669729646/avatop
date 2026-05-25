import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAnalysisMasterBatchLocalImport } from '../src/lib/analysis-master-import-queue';

describe('analysis master import queue', () => {
  it('runs rows with concurrency limit and retries failed rows once with the same project id', async () => {
    let active = 0;
    let maxActive = 0;
    const attempts = new Map<string, number>();
    const helperRequests: Array<{ sourceUrl: string; projectId?: string; rowIndex?: number }> = [];

    const result = await runAnalysisMasterBatchLocalImport(
      {
        batchId: 'batch-1',
        sourceFileName: 'batch.xlsx',
        imports: [
          { sourceUrl: 'https://www.tiktok.com/@a/video/1', metadata: { 椤圭洰鍚嶇О: 'A' } },
          { sourceUrl: 'https://www.tiktok.com/@b/video/2', metadata: { 椤圭洰鍚嶇О: 'B' } },
          { sourceUrl: 'https://www.tiktok.com/@c/video/3', metadata: { 椤圭洰鍚嶇О: 'C' } },
          { sourceUrl: 'https://www.tiktok.com/@d/video/4', metadata: { 椤圭洰鍚嶇О: 'D' } },
        ],
        saasBaseUrl: 'https://app.example.com',
        authToken: 'jwt-token',
      },
      {
        authFetch: async () => {
          throw new Error('authFetch should not be called in this test');
        },
        executeRow: async ({ sourceUrl, projectId, batchContext }) => {
          helperRequests.push({
            sourceUrl,
            projectId,
            rowIndex: batchContext?.rowIndex,
          });

          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise(resolve => setTimeout(resolve, 10));
          active -= 1;

          const attemptKey = sourceUrl;
          const attempt = attempts.get(attemptKey) || 0;
          attempts.set(attemptKey, attempt + 1);

          if (sourceUrl.endsWith('/2') && attempt === 0) {
            const error = new Error('helper failed once') as Error & { projectId?: string };
            error.projectId = 'project-b';
            throw error;
          }

          if (sourceUrl.endsWith('/4')) {
            const error = new Error('helper failed twice') as Error & { projectId?: string };
            error.projectId = projectId || 'project-d';
            throw error;
          }

          return {
            projectId: projectId || `project-${sourceUrl.slice(-1)}`,
            project: { id: projectId || `project-${sourceUrl.slice(-1)}`, status: 'draft', error: null },
            helperRequest: { sourceUrl } as never,
            helperData: { ok: true },
          };
        },
      }
    );

    assert.equal(maxActive <= 3, true);
    assert.equal(result.total, 4);
    assert.equal(result.createdRows, 3);
    assert.equal(result.failedRows, 1);
    assert.equal(result.failedItems.length, 1);
    assert.equal(result.failedItems[0].sourceUrl, 'https://www.tiktok.com/@d/video/4');
    assert.equal(result.failedItems[0].error, 'helper failed twice');
    assert.equal(result.rowResults[1].attempts, 2);
    assert.equal(result.rowResults[1].projectId, 'project-b');
    assert.equal(result.rowResults[3].attempts, 2);
    assert.equal(result.rowResults[3].status, 'failed');
    assert.deepEqual(
      helperRequests.filter(item => item.sourceUrl.endsWith('/2')).map(item => item.projectId),
      [undefined, 'project-b']
    );
  });
});
