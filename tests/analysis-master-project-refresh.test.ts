import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRefreshAnalysisProjectDetails } from '../src/lib/analysis-master-project-refresh';

describe('analysis master project detail refresh', () => {
  const baseProject = {
    id: 'project-1',
    status: 'draft',
    error: null,
    videoKey: 'video-key',
    videoUrl: 'https://cdn.example.com/video.mp4?signature=old',
    audioKey: 'audio-key',
    audioUrl: 'https://cdn.example.com/audio.mp3?signature=old',
    optimisticStatus: undefined,
    result: null,
    videoDuration: 15,
    audioDuration: 15,
    fileSize: 1024,
  };

  it('does not refresh when only presigned media URLs change', () => {
    assert.equal(
      shouldRefreshAnalysisProjectDetails(baseProject, {
        ...baseProject,
        videoUrl: 'https://cdn.example.com/video.mp4?signature=new',
        audioUrl: 'https://cdn.example.com/audio.mp3?signature=new',
      }),
      false
    );
  });

  it('refreshes when the underlying media key changes', () => {
    assert.equal(
      shouldRefreshAnalysisProjectDetails(baseProject, {
        ...baseProject,
        audioKey: 'new-audio-key',
      }),
      true
    );
  });
});
