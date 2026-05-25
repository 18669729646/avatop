import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAnalysisMasterLocalImport } from '../src/lib/analysis-master-local-import';

describe('analysis master local import executor', () => {
  it('reuses the placeholder project id when the helper succeeds', async () => {
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> | null }> = [];

    const authFetch = async (input: string, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
      calls.push({ url: input, method: init?.method, body });

      if (input.endsWith('/api/analysis-master/projects') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'am-placeholder-1',
            status: 'downloading',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (input.endsWith('/api/analysis-master/projects/am-placeholder-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'am-placeholder-1',
            status: 'downloading',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`unexpected authFetch call: ${input}`);
    };

    const helperFetch = async (): Promise<Response> => new Response(JSON.stringify({
      success: true,
      data: {
        id: 'am-placeholder-1',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await runAnalysisMasterLocalImport(
      {
        sourceUrl: 'https://www.tiktok.com/@maker/video/123',
        projectName: 'Link row',
        saasBaseUrl: 'https://app.example.com',
        authToken: 'jwt-token',
      },
      {
        authFetch,
        helperFetch,
      }
    );

    assert.equal(result.projectId, 'am-placeholder-1');
    assert.equal(result.helperRequest.projectId, 'am-placeholder-1');
    assert.equal(result.helperRequest.batchId, undefined);
    assert.equal(result.helperRequest.rowIndex, undefined);
  });

  it('marks the placeholder project as download_failed when the helper fails', async () => {
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> | null }> = [];

    const authFetch = async (input: string, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
      calls.push({ url: input, method: init?.method, body });

      if (input.endsWith('/api/analysis-master/projects') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'am-placeholder-2',
            status: 'downloading',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (input.endsWith('/api/analysis-master/projects/am-placeholder-2') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'am-placeholder-2',
            status: 'download_failed',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`unexpected authFetch call: ${input}`);
    };

    const helperFetch = async (): Promise<Response> => new Response(JSON.stringify({
      success: false,
      error: '视频解析失败，请检查当前网络环境后重试。',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    await assert.rejects(
      () => runAnalysisMasterLocalImport(
        {
          sourceUrl: 'https://www.tiktok.com/@maker/video/123',
          projectName: 'Link row',
          saasBaseUrl: 'https://app.example.com',
          authToken: 'jwt-token',
        },
        {
          authFetch,
          helperFetch,
        }
      ),
      /视频解析失败/
    );

    const updateCall = calls.find(item => item.url === '/api/analysis-master/projects/am-placeholder-2' && item.method === 'PUT');
    assert.ok(updateCall);
    assert.equal(updateCall?.body?.status, 'download_failed');
    assert.equal(updateCall?.body?.error, '视频解析失败，请检查当前网络环境后重试。');
  });

  it('reuses an existing project id when retrying the same row', async () => {
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> | null }> = [];

    const authFetch = async (input: string, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
      calls.push({ url: input, method: init?.method, body });

      if (input.endsWith('/api/analysis-master/projects/am-reuse-1') && init?.method === 'PUT') {
        return new Response(JSON.stringify({
          success: true,
          data: {
            id: 'am-reuse-1',
            status: 'downloading',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`unexpected authFetch call: ${input}`);
    };

    const helperFetch = async (): Promise<Response> => new Response(JSON.stringify({
      success: true,
      data: {
        id: 'am-reuse-1',
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await runAnalysisMasterLocalImport(
      {
        sourceUrl: 'https://www.tiktok.com/@maker/video/123',
        projectName: 'Link row',
        saasBaseUrl: 'https://app.example.com',
        authToken: 'jwt-token',
        projectId: 'am-reuse-1',
      },
      {
        authFetch,
        helperFetch,
      }
    );

    assert.equal(result.projectId, 'am-reuse-1');
    assert.equal(result.helperRequest.projectId, 'am-reuse-1');
    assert.equal(calls.some(item => item.url.endsWith('/api/analysis-master/projects') && item.method === 'POST'), false);
    const reuseCall = calls.find(item => item.url === '/api/analysis-master/projects/am-reuse-1' && item.method === 'PUT');
    assert.ok(reuseCall);
    assert.equal(reuseCall?.body?.status, 'downloading');
  });
});
