import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAnalysisMasterDraftProject,
  loadAnalysisMasterDraftProjects,
  mergeAnalysisMasterProjects,
  saveAnalysisMasterDraftProjects,
} from '../src/lib/analysis-master-drafts';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key) || null : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe('analysis master drafts', () => {
  it('saves and restores drafts per user', () => {
    const storage = createMemoryStorage();
    const drafts = [
      createAnalysisMasterDraftProject({
        clientRequestId: 'req-1',
        name: 'Draft 1',
        sourceUrl: 'https://www.tiktok.com/@maker/video/1',
      }),
    ];

    saveAnalysisMasterDraftProjects(storage, 'user-1', drafts);
    const restored = loadAnalysisMasterDraftProjects(storage, 'user-1');

    assert.equal(restored.length, 1);
    assert.equal(restored[0].clientRequestId, 'req-1');
    assert.equal(restored[0].name, 'Draft 1');
    assert.equal(restored[0].sourceUrl, 'https://www.tiktok.com/@maker/video/1');
    assert.equal(restored[0].optimisticStatus, 'creating');
  });

  it('replaces matching drafts with server projects and keeps unmatched drafts on top', () => {
    const drafts = [
      createAnalysisMasterDraftProject({
        clientRequestId: 'req-1',
        name: 'Draft 1',
        sourceUrl: 'https://www.tiktok.com/@maker/video/1',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      createAnalysisMasterDraftProject({
        clientRequestId: 'req-2',
        name: 'Draft 2',
        sourceUrl: 'https://www.tiktok.com/@maker/video/2',
        optimisticStatus: 'failed',
        error: '创建失败',
        createdAt: '2026-05-20T00:01:00.000Z',
        updatedAt: '2026-05-20T00:01:00.000Z',
      }),
    ];

    const merged = mergeAnalysisMasterProjects(
      [
        {
          id: 'am-100',
          name: 'Draft 1',
          sourceType: 'link',
          sourceUrl: 'https://www.tiktok.com/@maker/video/1',
          status: 'draft',
          result: null,
          error: null,
          importMetadata: { clientRequestId: 'req-1' },
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:01:00.000Z',
        },
      ],
      drafts
    );

    assert.equal(merged.length, 2);
    assert.equal(merged[0].clientRequestId, 'req-2');
    assert.equal(merged[0].optimisticStatus, 'failed');
    assert.ok('id' in merged[1]);
    assert.equal((merged[1] as { id: string }).id, 'am-100');
    assert.equal(merged[1].optimisticStatus, undefined);
  });
});
