import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAnalysisProjectFromLink, AnalysisMasterProjectError } from '../src/lib/analysis-master-projects';

describe('analysis master project creation', () => {
  it('cleans up uploaded video and audio objects when persistence fails', async () => {
    const deletedKeys: string[] = [];
    let insertCalls = 0;

    await assert.rejects(
      createAnalysisProjectFromLink(
        {
          userId: 'user-1',
          sourceUrl: 'https://www.tiktok.com/@maker/video/123',
          name: 'Cleanup test',
        },
        {
          downloadVideoFromUrl: async () => ({
            buffer: Buffer.from('video-bytes'),
            contentType: 'video/mp4',
            fileName: 'source.mp4',
            title: 'Source title',
            duration: 12,
            provider: 'ssstik',
          }),
          checkStorageQuota: async () => ({
            allowed: true,
            usedBytes: 0,
            quotaBytes: 1024 * 1024 * 1024,
            usedMB: 0,
            quotaMB: 1024,
            percentUsed: 0,
          }),
          uploadFile: async () => 'video-key',
          generatePresignedUrl: async ({ key }) => `https://cdn.example.com/${key}`,
          deleteFile: async (key) => {
            deletedKeys.push(key);
            return true;
          },
          extractAudioFromBuffer: async () => ({
            audioKey: 'audio-key',
            audioUrl: 'https://cdn.example.com/audio-key',
            audioDuration: 9,
            audioFileSize: 1024,
          }),
          getSupabaseClient: () =>
            ({
              from() {
                return {
                  insert() {
                    insertCalls += 1;
                    return {
                      select() {
                        return {
                          single: async () => ({
                            data: null,
                            error: { message: 'insert failed' },
                          }),
                        };
                      },
                    };
                  },
                };
              },
            }) as never,
          logApiError: () => undefined,
          logInfo: () => undefined,
        }
      ),
      (error: unknown) => error instanceof AnalysisMasterProjectError && error.message === '创建分析项目失败'
    );

    assert.equal(insertCalls, 1);
    assert.deepEqual(deletedKeys.sort(), ['audio-key', 'video-key']);
  });
});
