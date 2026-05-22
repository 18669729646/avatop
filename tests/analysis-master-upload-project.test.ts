import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAnalysisUploadProjectUpsert } from '../src/lib/analysis-master-upload-project';

describe('analysis master upload project upsert', () => {
  it('uses link source fields when helper upload includes a source URL', () => {
    const row = buildAnalysisUploadProjectUpsert({
      projectId: 'am-1',
      userId: 'user-1',
      name: 'Imported link',
      videoKey: 'video-key',
      videoUrl: 'https://cdn.example.com/video.mp4',
      videoDuration: 12,
      fileSize: 2048,
      sourceUrl: 'https://www.tiktok.com/@maker/video/123',
      audioKey: 'audio-key',
      audioUrl: 'https://cdn.example.com/audio.mp3',
      audioDuration: 10,
      audioFileSize: 512,
      now: '2026-05-22T00:00:00.000Z',
    });

    assert.equal(row.source_type, 'link');
    assert.equal(row.source_url, 'https://www.tiktok.com/@maker/video/123');
    assert.equal(row.status, 'draft');
    assert.equal(row.audio_key, 'audio-key');
  });

  it('keeps manual uploads as upload source when no source URL exists', () => {
    const row = buildAnalysisUploadProjectUpsert({
      projectId: 'am-2',
      userId: 'user-1',
      name: 'Manual upload',
      videoKey: 'video-key',
      videoUrl: '',
      videoDuration: 0,
      fileSize: 1024,
      now: '2026-05-22T00:00:00.000Z',
    });

    assert.equal(row.source_type, 'upload');
    assert.equal(Object.hasOwn(row, 'source_url'), false);
    assert.equal(Object.hasOwn(row, 'video_duration'), false);
    assert.equal(Object.hasOwn(row, 'audio_key'), false);
  });
});
