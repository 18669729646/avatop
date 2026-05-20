import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeAnalysisBatchImportTask } from '../src/lib/analysis-master-batch-processor';

function createFakeSupabase() {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

  const chain = {
    eq() {
      return chain;
    },
  };

  const supabase = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { supabase, updates };
}

describe('analysis master batch processor', () => {
  it('processes rows independently and keeps running after a row failure', async () => {
    const { supabase, updates } = createFakeSupabase();
    const projectQueue: Array<{ projectId: string; userId: string; triggerProcessing: boolean }> = [];
    const progressEvents: Array<Record<string, unknown>> = [];
    const logs: Array<Record<string, unknown>> = [];
    let projectIndex = 0;

    const task = {
      id: 'task-batch-1',
      user_id: 'user-1',
      started_at: '2026-05-20T00:00:00.000Z',
      params: {
        batchId: 'batch-1',
        sourceFileName: 'batch.xlsx',
        totalRows: 2,
        imports: [
          { sourceUrl: 'https://www.tiktok.com/@a/video/1', metadata: { 标题: 'A' } },
          { sourceUrl: 'https://www.tiktok.com/@b/video/2', metadata: { 标题: 'B' } },
        ],
      },
    };

    await executeAnalysisBatchImportTask(task, supabase, {
      createAnalysisProjectFromLink: async ({ sourceUrl, name }) => ({
        id: `project-${++projectIndex}`,
        name: name || `project-${projectIndex}`,
        sourceType: 'link',
        sourceUrl,
        videoKey: null,
        videoUrl: null,
        videoDuration: null,
        fileSize: 123,
        audioKey: null,
        audioUrl: null,
        audioDuration: null,
        audioFileSize: 0,
        status: 'draft',
        result: null,
        error: null,
        importMetadata: {},
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      enqueueAnalysisTaskForProject: async ({ projectId, userId, triggerProcessing }) => {
        projectQueue.push({ projectId, userId, triggerProcessing: Boolean(triggerProcessing) });
        if (projectId === 'project-2') {
          throw new Error('enqueue failed');
        }
        return { taskId: `analysis-${projectId}` };
      },
      triggerBackgroundProcessing: async () => undefined,
      broadcastTaskUpdate: (event) => {
        progressEvents.push(event as Record<string, unknown>);
      },
      logInfo: (_scope, message, payload) => {
        logs.push({ message, payload });
      },
    });

    assert.equal(projectQueue.length, 2);
    assert.deepEqual(projectQueue, [
      { projectId: 'project-1', userId: 'user-1', triggerProcessing: false },
      { projectId: 'project-2', userId: 'user-1', triggerProcessing: false },
    ]);

    const progressUpdates = updates.filter(item => item.table === 'task_queue' && item.values.status === 'running');
    assert.equal(progressUpdates.length, 2);
    assert.equal((progressUpdates[0].values.result as { createdRows: number }).createdRows, 1);
    assert.equal((progressUpdates[0].values.result as { failedRows: number }).failedRows, 0);
    assert.equal((progressUpdates[1].values.result as { createdRows: number }).createdRows, 1);
    assert.equal((progressUpdates[1].values.result as { failedRows: number }).failedRows, 1);

    const finalUpdate = updates.findLast(item => item.table === 'task_queue' && item.values.status === 'success');
    assert.ok(finalUpdate);
    assert.equal((finalUpdate!.values.result as { createdRows: number }).createdRows, 1);
    assert.equal((finalUpdate!.values.result as { failedRows: number }).failedRows, 1);
    assert.equal((finalUpdate!.values.result as { failedItems: Array<{ sourceUrl: string; error: string }> }).failedItems[0].sourceUrl, 'https://www.tiktok.com/@b/video/2');

    const failedProjectUpdate = updates.find(item => item.table === 'analysis_master_projects' && item.values.status === 'failed');
    assert.ok(failedProjectUpdate);
    assert.equal(failedProjectUpdate?.values.error, 'enqueue failed');

    assert.equal(progressEvents.length >= 3, true);
    assert.equal(logs[0]?.message, '批量导入完成');
  });
});
