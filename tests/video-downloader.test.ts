import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVideoDownloadHeadersForTest,
  extractTikHubDownloadInfoForTest,
  getVideoDownloadAttemptPlanForTest,
} from '../src/lib/video-downloader';

describe('video downloader provider planning', () => {
  it('uses TikHub first for TikTok links in auto mode and keeps yt-dlp as fallback', () => {
    const plan = getVideoDownloadAttemptPlanForTest('https://www.tiktok.com/@maker/video/123', 'auto');

    assert.deepEqual(plan, ['tikhub', 'yt-dlp']);
  });

  it('uses TikHub first for Douyin links in auto mode and keeps yt-dlp as fallback', () => {
    const plan = getVideoDownloadAttemptPlanForTest('https://v.douyin.com/example/', 'auto');

    assert.deepEqual(plan, ['tikhub', 'yt-dlp']);
  });

  it('keeps non TikTok-like links on yt-dlp in auto mode', () => {
    const plan = getVideoDownloadAttemptPlanForTest('https://www.youtube.com/watch?v=abc123', 'auto');

    assert.deepEqual(plan, ['yt-dlp']);
  });
});

describe('TikHub response parsing', () => {
  it('extracts download URL and metadata from common nested TikHub payloads', () => {
    const info = extractTikHubDownloadInfoForTest({
      data: {
        aweme_detail: {
          desc: 'Hair brush demo',
          duration: 16000,
          author: {
            nickname: 'Creator',
          },
          video: {
            cover: {
              url_list: ['https://cdn.example.com/cover.jpeg'],
            },
            play_addr: {
              url_list: ['https://cdn.example.com/video.mp4'],
            },
          },
        },
      },
    });

    assert.deepEqual(info, {
      videoUrl: 'https://cdn.example.com/video.mp4',
      title: 'Hair brush demo',
      duration: 16,
      uploader: 'Creator',
      thumbnail: 'https://cdn.example.com/cover.jpeg',
    });
  });
});

describe('video download request headers', () => {
  it('does not send the ssstik referer when downloading TikHub extracted video URLs', () => {
    const headers = buildVideoDownloadHeadersForTest({ referer: undefined });

    assert.equal(headers.Referer, undefined);
    assert.equal(headers['User-Agent'].includes('Mozilla'), true);
  });
});
