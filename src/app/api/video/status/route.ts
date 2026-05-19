import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const apiKey = request.headers.get('X-Internal-Api-Key') || searchParams.get('apiKey');
    const taskId = searchParams.get('taskId');
    const baseUrl = searchParams.get('baseUrl') || 'https://yunwu.ai';
    
    if (!apiKey) {
      console.error('[Video Status] Missing API Key');
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }
    
    if (!taskId) {
      console.error('[Video Status] Missing taskId');
      return NextResponse.json(
        { error: '任务ID不能为空' },
        { status: 400 }
      );
    }

    console.log(`[Video Status] Querying task: ${taskId}`);

    // 尝试多种查询方式
    const queryUrls = [
      // 方式1: GET /v1/videos/{taskId} (OpenAI风格，正确格式)
      { method: 'GET', url: `${baseUrl}/v1/videos/${taskId}`, useBody: false },
      // 方式2: POST /v1/video/query
      { method: 'POST', url: `${baseUrl}/v1/video/query`, useBody: true },
      // 方式3: GET /v1/video/{taskId}
      { method: 'GET', url: `${baseUrl}/v1/video/${taskId}`, useBody: false },
    ];

    for (const queryConfig of queryUrls) {
      console.log(`[Video Status] Trying ${queryConfig.method} ${queryConfig.url}`);
      
      try {
        const fetchOptions: RequestInit = {
          method: queryConfig.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        };

        if (queryConfig.useBody) {
          fetchOptions.body = JSON.stringify({ task_id: taskId });
        }

        const response = await fetch(queryConfig.url, fetchOptions);
        const contentType = response.headers.get('content-type') || '';
        
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.log(`[Video Status] Non-JSON response (${response.status}):`, text.substring(0, 200));
          continue; // 尝试下一种方式
        }

        if (response.ok) {
          console.log(`[Video Status] Success with ${queryConfig.method} ${queryConfig.url}`);
          console.log('[Video Status] Full response:', JSON.stringify(data).substring(0, 500));
          
          // 提取失败原因（如果状态是失败）
          let errorInfo = null;
          if (data.status === 'failed' || data.status === 'error') {
            errorInfo = data.error?.message 
              || data.message 
              || data.detail?.error 
              || (data.error && typeof data.error === 'string' ? data.error : null)
              || '视频生成失败';
          }
          
          // 尝试多种可能的视频URL字段
          const videoUrl = data.video_url 
            || data.url 
            || data.detail?.video_url 
            || data.content?.video_url
            || data.result?.video_url;
          
          // 尝试多种可能的缩略图URL字段
          const thumbnailUrl = data.thumbnail_url 
            || data.thumbnailUrl
            || data.detail?.thumbnail_url 
            || data.content?.thumbnail_url
            || data.result?.thumbnail_url
            || data.cover_url
            || data.coverUrl;
          
          console.log('[Video Status] Extracted video_url:', videoUrl ? videoUrl.substring(0, 100) + '...' : 'not found');
          console.log('[Video Status] Extracted thumbnail_url:', thumbnailUrl ? thumbnailUrl.substring(0, 100) + '...' : 'not found');
          
          console.log('[Video Status] Result:', JSON.stringify({
            id: data.id || taskId,
            status: data.status,
            hasVideo: !!videoUrl,
            hasThumbnail: !!thumbnailUrl,
            error: errorInfo
          }));
          
          // 确保返回的数据包含完整信息
          const result = {
            ...data,
            video_url: videoUrl,
            url: videoUrl,
            thumbnail_url: thumbnailUrl,
            thumbnailUrl: thumbnailUrl,
            error_message: errorInfo
          };
          
          return NextResponse.json(result);
        } else if (response.status === 404 || response.status === 400) {
          // URL不对，尝试下一种方式
          console.log(`[Video Status] ${queryConfig.method} failed with ${response.status}, trying next...`);
          continue;
        } else {
          // 其他错误，直接返回
          console.error('[Video Status] API error:', JSON.stringify(data));
          return NextResponse.json(
            { error: data.error?.message || data.error || data.message || `API 请求失败: ${response.status}` },
            { status: response.status }
          );
        }
      } catch (err) {
        console.error(`[Video Status] ${queryConfig.method} ${queryConfig.url} failed:`, err);
        continue; // 尝试下一种方式
      }
    }

    // 所有方式都失败了
    console.error('[Video Status] All query methods failed');
    return NextResponse.json(
      { error: '无法查询视频状态，请检查API文档或联系API提供商' },
      { status: 500 }
    );
    
  } catch (error) {
    return errorResponse('video/status', 'GET', error);
  }
}
