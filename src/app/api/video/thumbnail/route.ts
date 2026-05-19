import { NextRequest, NextResponse } from 'next/server';

/**
 * 视频缩略图生成 API
 * 由于环境没有 ffmpeg，此 API 返回错误
 * 客户端使用 VideoThumbnail 组件显示视频第一帧
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, taskId } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: '缺少视频 URL' }, { status: 400 });
    }

    // 由于环境没有 ffmpeg，无法生成缩略图
    // 客户端使用 VideoThumbnail 组件显示视频第一帧
    console.log(`[Thumbnail] 无法生成缩略图，环境不支持 ffmpeg`);
    
    return NextResponse.json({
      success: false,
      error: '环境不支持视频缩略图生成，请使用客户端方案',
    });
  } catch (error) {
    console.error('[Thumbnail] 错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '生成缩略图失败' 
      },
      { status: 500 }
    );
  }
}
