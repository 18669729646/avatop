import { NextRequest, NextResponse } from 'next/server';

/**
 * 获取支持的视频模型列表
 * 从云雾 API 官方文档获取
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const apiKey = request.headers.get('X-Internal-Api-Key') || searchParams.get('apiKey');
    const baseUrl = searchParams.get('baseUrl') || 'https://yunwu.ai';

    if (!apiKey) {
      // 如果没有提供 API Key，返回默认模型列表
      return NextResponse.json({
        models: getDefaultVideoModels(),
        source: 'default'
      });
    }

    // 尝试从 API 获取模型列表
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // 过滤出视频模型
        // OpenAI 格式返回: { data: [{ id: "model-name", object: "model", ... }] }
        let models: string[] = [];
        
        if (data.data && Array.isArray(data.data)) {
          // 过滤视频相关模型（包含 veo 关键字）
          models = data.data
            .filter((model: { id: string }) => 
              model.id && (
                model.id.toLowerCase().includes('veo') ||
                model.id.toLowerCase().includes('video')
              )
            )
            .map((model: { id: string }) => model.id)
            .sort();
        }

        if (models.length > 0) {
          return NextResponse.json({
            models,
            source: 'api'
          });
        }
      }
    } catch (apiError) {
      console.error('[Video Models API] 调用失败:', apiError);
    }

    // API 调用失败，返回默认列表
    return NextResponse.json({
      models: getDefaultVideoModels(),
      source: 'default'
    });

  } catch (error) {
    console.error('[Video Models API] 错误:', error);
    return NextResponse.json({
      models: getDefaultVideoModels(),
      source: 'default'
    });
  }
}

/**
 * 默认视频模型列表（从官方文档整理）
 * 参考: https://yunwu.apifox.cn/api-370109881
 */
function getDefaultVideoModels(): string[] {
  return [
    // OpenAI 格式模型（/v1/videos 端点）
    'veo_3_1',
    'veo_3_1-fast',
    'veo_3_1-lite',
    'veo_3_1-lite-4K',
    'veo_3_1-pro',
    
    // 云雾格式模型（/v1/video/create 端点）
    'veo2',
    'veo2-fast',
    'veo2-fast-frames',
    'veo2-fast-components',
    'veo2-pro',
    'veo2-pro-components',
    'veo3',
    'veo3-fast',
    'veo3-fast-frames',
    'veo3-frames',
    'veo3-pro',
    'veo3-pro-frames',
    'veo3.1',
    'veo3.1-fast',
    'veo3.1-fast-components',
    'veo3.1-pro',
    'veo3.1-4k',
    'veo3.1-pro-4k',
  ];
}
