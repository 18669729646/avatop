import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/logger';
import { getServerVideoApiByBaseUrlOrModel } from '@/lib/server-config';

/**
 * OpenAI 格式的视频状态查询 API
 * 端点: GET /v1/videos/{video_id}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const headerApiKey = request.headers.get('X-Internal-Api-Key') || searchParams.get('apiKey');
    const videoId = searchParams.get('videoId');
    const baseUrl = searchParams.get('baseUrl') || 'https://yunwu.ai';
    const model = searchParams.get('model') || undefined;
    
    // 优先使用传入的 API Key，否则从服务端配置中获取
    let apiKey = headerApiKey;
    if (!apiKey) {
      const serverApi = await getServerVideoApiByBaseUrlOrModel(baseUrl, model);
      apiKey = serverApi?.apiKey || '';
    }
    
    // 极客智坊 baseUrl 含 /api/v1（如 https://geekai.co/api/v1）
    // 云眸等不含 /api/v1（如 https://yunwu.ai）
    const isGeekai = baseUrl.includes('/api/v1');
    const statusUrl = isGeekai
      ? `${baseUrl}/videos/${videoId}`
      : `${baseUrl}/v1/videos/${videoId}`;
    
    if (!apiKey) {
      console.error('[OpenAI Video Status] Missing API Key');
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }
    
    if (!videoId) {
      console.error('[OpenAI Video Status] Missing videoId');
      return NextResponse.json(
        { error: '视频ID不能为空' },
        { status: 400 }
      );
    }

    console.log(`[OpenAI Video Status] Querying video: ${videoId}, url: ${statusUrl}`);

    // 调用状态查询 API
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('[OpenAI Video Status] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: `API 返回非预期格式: ${text.substring(0, 200)}` },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('[OpenAI Video Status] API error:', JSON.stringify(data));
      return NextResponse.json(
        { error: data.error?.message || data.error || data.message || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    console.log('[OpenAI Video Status] Response:', JSON.stringify({
      id: data.id || data.task_id,
      task_status: data.task_status,
      status: data.status,
      progress: data.progress,
      hasVideo: !!(data.video_url || data.url || (Array.isArray(data.video_result) ? data.video_result[0]?.url : data.video_result?.url)),
    }));

    // 标准化响应格式
    // 极客智坊风格: task_status: "pending" | "running" | "succeed" | "failed"
    //              video_result: {url, cover_image_url, duration, revised_prompt}  ← 对象，不是数组
    // OpenAI 风格:  status: "queued" | "processing" | "completed" | "failed"
    //              video_url 或 url
    const rawStatus = data.task_status || data.status;
    const normalizedStatus = rawStatus?.toUpperCase();

    // 提取 video_result 中的字段
    // 官方文档 video_result 是对象 {url, cover_image_url, duration}
    // 但部分 API 可能返回数组格式，兼容两种情况
    const videoResult = Array.isArray(data.video_result) ? data.video_result[0] : data.video_result;

    const result = {
      ...data,
      // 统一状态字段（兼容大小写）
      status: normalizedStatus,
      task_status: normalizedStatus,
      // 统一视频 URL 字段
      video_url: data.video_url || data.url || videoResult?.url,
      url: data.video_url || data.url || videoResult?.url,
      // 统一封面图字段
      thumbnail_url: data.thumbnail_url || data.thumbnailUrl || videoResult?.cover_image_url,
      // 统一错误信息
      error_message: data.error?.message || data.error_message || data.error || data.message,
    };

    return NextResponse.json(result);
    
  } catch (error) {
    return errorResponse('video/openai-status', 'GET', error);
  }
}
