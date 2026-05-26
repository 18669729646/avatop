import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeServerDownloadApisForTest,
  selectTikHubApiConfigForTest,
} from '../src/lib/server-config';
import { mergeDefaultApiIds } from '../src/lib/default-api-ids';

describe('video download API config', () => {
  it('prefers the default TikHub config stored in system_config downloadApis', () => {
    const config = selectTikHubApiConfigForTest(
      [
        {
          id: 'download-other',
          name: 'Other downloader',
          type: 'download',
          provider: 'other',
          apiKey: 'other-key',
          baseUrl: 'https://other.example.com',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'download-tikhub',
          name: 'TikHub',
          type: 'download',
          provider: 'tikhub',
          apiKey: 'db-tikhub-key',
          baseUrl: 'https://api.tikhub.io',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      'download-tikhub',
      {
        apiKey: 'env-key',
        baseUrl: 'https://env.example.com',
        provider: 'tikhub',
      }
    );

    assert.deepEqual(config, {
      apiKey: 'db-tikhub-key',
      baseUrl: 'https://api.tikhub.io',
      provider: 'tikhub',
    });
  });

  it('falls back to environment config when the database key is masked', () => {
    const config = selectTikHubApiConfigForTest(
      [
        {
          id: 'download-tikhub',
          name: 'TikHub',
          type: 'download',
          provider: 'tikhub',
          apiKey: 'tikh****1234',
          baseUrl: 'https://api.tikhub.io',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      'download-tikhub',
      {
        apiKey: 'env-key',
        baseUrl: 'https://env.example.com',
        provider: 'tikhub',
      }
    );

    assert.deepEqual(config, {
      apiKey: 'env-key',
      baseUrl: 'https://env.example.com',
      provider: 'tikhub',
    });
  });

  it('does not clear existing default model IDs when only the default downloader changes', () => {
    const defaults = mergeDefaultApiIds(
      {
        defaultTextApiId: 'text-db',
        defaultImageApiId: 'image-db',
        defaultVideoApiId: 'video-db',
        defaultDownloadApiId: 'download-old',
      },
      {
        defaultDownloadApiId: 'download-new',
      }
    );

    assert.deepEqual(defaults, {
      defaultTextApiId: 'text-db',
      defaultImageApiId: 'image-db',
      defaultVideoApiId: 'video-db',
      defaultDownloadApiId: 'download-new',
    });
  });

  it('uses environment download APIs independently when database downloader config is missing', () => {
    const merged = mergeServerDownloadApisForTest(
      [],
      undefined,
      [
        {
          id: 'download-env',
          name: 'TikHub env',
          type: 'download',
          provider: 'tikhub',
          apiKey: 'env-download-key',
          baseUrl: 'https://env.tikhub.example',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      'download-env'
    );

    assert.equal(merged.downloadApis.length, 1);
    assert.equal(merged.downloadApis[0].apiKey, 'env-download-key');
    assert.equal(merged.defaultDownloadApiId, 'download-env');
  });
});
