import { NextRequest, NextResponse } from 'next/server';
import { longRunningAgent } from '@/lib/fetch-agent';
import { getServerVideoApiByBaseUrlOrModel } from '@/lib/server-config';

/**
 * 视频任务单轮轮询 API
 * 每次调用只做一轮状态查询，返回标准化后的结果。
 * 由 process/route.ts 在循环中调用，确保每次轮询都用最新代码。
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');
  const baseUrl = searchParams.get('baseUrl');
  const model = searchParams.get('model');
  const isOpenAI = searchParams.get('isOpenAI') === 'true';

  if (!videoId) {
    return NextResponse.json({ success: false, error: '缺少 videoId' }, { status: 400 });
  }

  try {
    if (isOpenAI) {
      // OpenAI/极客智坊格式
      let apiKey = searchParams.get('apiKey');
      let apiBaseUrl = baseUrl;

      // 如果没传 apiKey，从服务端配置读取
      if (!apiKey || apiKey === 'undefined') {
        const videoApi = await getServerVideoApiByBaseUrlOrModel(
          apiBaseUrl || undefined,
          model || undefined
        );
        if (videoApi) {
          apiKey = videoApi.apiKey;
          if (!apiBaseUrl) apiBaseUrl = videoApi.baseUrl;
        }
      }

      if (!apiKey) {
        return NextResponse.json({ success: false, error: 'Missing API Key' }, { status: 400 });
      }

      // 拼接查询 URL
      let statusUrl: string;
      if (apiBaseUrl?.includes('/api/v1')) {
        statusUrl = `${apiBaseUrl}/videos/${videoId}`;
      } else {
        statusUrl = `${apiBaseUrl}/v1/videos/${videoId}`;
      }

      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.log(`[Poll Video] API error: ${errorText}`);
        return NextResponse.json({
          success: false,
          error: `API 返回 ${statusResponse.status}`,
          status: 'RUNNING',
        });
      }

      const rawData = await statusResponse.json();

      // 标准化状态
      const rawStatus = rawData.task_status || rawData.status;
      const normalizedStatus = rawStatus?.toUpperCase();

      // 提取视频 URL
      const firstResult = Array.isArray(rawData.video_result) ? rawData.video_result[0] : rawData.video_result;
      const videoUrl = rawData.video_url || rawData.url || firstResult?.url;
      const coverImageUrl = rawData.cover_image_url || rawData.thumbnail_url || rawData.thumbnailUrl || firstResult?.cover_image_url;

      const result: Record<string, unknown> = {
        success: true,
        status: normalizedStatus,
        video_url: videoUrl,
        cover_image_url: coverImageUrl,
        duration: firstResult?.duration || rawData.duration,
        model: rawData.model,
      };

      // 如果失败，提取错误信息
      if (normalizedStatus === 'FAILED') {
        result.error = rawData.error?.message || rawData.error_message || rawData.error || '视频生成失败';
      }

      return NextResponse.json(result);

    } else {
      // 云雾格式 - 通过本地 status route 查询
      const localBaseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`;
      const statusResponse = await fetch(
        `${localBaseUrl}/api/video/status?taskId=${videoId}&baseUrl=${encodeURIComponent(baseUrl || '')}`,
        {
          headers: { 'X-Internal-Api-Key': request.headers.get('X-Internal-Api-Key') || '' },
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        }
      );
      const statusData = await statusResponse.json();
      return NextResponse.json({
        success: true,
        ...statusData,
      });
    }
  } catch (error) {
    console.error('[Poll Video] 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      status: 'RUNNING', // 出错时返回 RUNNING，让调用方继续轮询
    });
  }
}
