import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, taskIds, baseUrl = 'https://yunwu.ai' } = body;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: '任务ID列表不能为空' },
        { status: 400 }
      );
    }

    console.log(`[Video Batch Status] Querying ${taskIds.length} tasks`);

    // 视频状态结果类型
    interface VideoStatusResult {
      status?: string;
      video_url?: string;
      url?: string;
      thumbnail_url?: string;
      error?: string;
      progress?: number;
      videoUrl?: string;
      thumbnailUrl?: string;
    }
    
    const results: Record<string, VideoStatusResult | undefined> = {};

    // 并发查询所有任务状态
    const queryPromises = taskIds.map(async (taskId: string) => {
      try {
        // 尝试多种查询方式
        const queryConfigs = [
          // 方式1: GET /v1/videos/{taskId} (OpenAI风格，正确格式)
          {
            method: 'GET',
            url: `${baseUrl}/v1/videos/${taskId}`,
            body: null
          },
          // 方式2: POST /v1/video/query
          {
            method: 'POST',
            url: `${baseUrl}/v1/video/query`,
            body: { task_id: taskId }
          },
          // 方式3: GET /v1/video/{taskId}
          {
            method: 'GET',
            url: `${baseUrl}/v1/video/${taskId}`,
            body: null
          },
        ];

        for (const config of queryConfigs) {
          try {
            const fetchOptions: RequestInit = {
              method: config.method,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
            };

            if (config.body) {
              fetchOptions.body = JSON.stringify(config.body);
            }

            const response = await fetch(config.url, fetchOptions);
            
            if (response.ok) {
              const data = await response.json();
              
              // 提取失败原因
              let errorMessage = null;
              if (data.status === 'failed' || data.status === 'error') {
                errorMessage = data.error?.message 
                  || data.message 
                  || data.detail?.error 
                  || (data.error && typeof data.error === 'string' ? data.error : null)
                  || '视频生成失败';
              }
              
              return {
                taskId,
                success: true,
                data: {
                  status: data.status,
                  videoUrl: data.video_url || data.content?.video_url || data.detail?.video_url,
                  thumbnailUrl: data.thumbnail_url || data.content?.thumbnail_url,
                  error: errorMessage,
                }
              };
            }
          } catch (err) {
            // 尝试下一种方式
            continue;
          }
        }

        // 所有方式都失败
        return {
          taskId,
          success: false,
          error: '查询失败'
        };
      } catch (err) {
        return {
          taskId,
          success: false,
          error: err instanceof Error ? err.message : '查询异常'
        };
      }
    });

    const queryResults = await Promise.all(queryPromises);
    
    // 整理结果
    queryResults.forEach(result => {
      if (result.success) {
        results[result.taskId] = result.data;
      } else {
        results[result.taskId] = { error: result.error };
      }
    });

    console.log(`[Video Batch Status] Completed: ${Object.keys(results).length} results`);
    
    return NextResponse.json({ results });
    
  } catch (error) {
    console.error('[Video Batch Status] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
