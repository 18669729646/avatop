import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { s3Storage } from '@/lib/s3-client';

/**
 * 刷新签名 URL
 * 接收 key 数组，返回新的签名 URL
 * 
 * POST /api/s3Storage/refresh-url
 * Body: { keys: string[] }
 * Response: { success: true, urlMap: { [key: string]: string } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'keys 参数不能为空' },
        { status: 400 }
      );
    }

    // 过滤无效的 key
    const validKeys = keys.filter(key => {
      if (!key || typeof key !== 'string') return false;
      // 跳过已经是完整 URL 的
      if (key.startsWith('http')) return false;
      // 跳过 base64 数据
      if (key.startsWith('data:')) return false;
      return true;
    });

    if (validKeys.length === 0) {
      return NextResponse.json({
        success: true,
        urlMap: {},
        message: '没有需要刷新的有效 key',
      });
    }

    console.log(`[Refresh-URL] 刷新 ${validKeys.length} 个 URL`);

    // 并行生成所有签名 URL
    const urlMap: Record<string, string> = {};
    
    await Promise.all(
      validKeys.map(async (key: string) => {
        try {
          const url = await s3Storage.generatePresignedUrl({
            key,
            expireTime: URL_EXPIRE_TIME, // 1年有效期
          });
          urlMap[key] = url;
        } catch (error) {
          console.error(`[Refresh-URL] 生成 URL 失败: ${key}`, error);
          urlMap[key] = ''; // 失败时返回空字符串
        }
      })
    );

    const successCount = Object.values(urlMap).filter(url => url).length;
    console.log(`[Refresh-URL] 成功刷新 ${successCount}/${validKeys.length} 个 URL`);

    return NextResponse.json({
      success: true,
      urlMap,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[Refresh-URL] Error:', error);
    return NextResponse.json(
      { success: false, error: '刷新 URL 失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 批量刷新单个图片的 URL（GET 请求，用于简单场景）
 * GET /api/s3Storage/refresh-url?key=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json(
      { success: false, error: 'key 参数不能为空' },
      { status: 400 }
    );
  }

  // 跳过已经是完整 URL 的
  if (key.startsWith('http')) {
    return NextResponse.json({
      success: true,
      url: key,
      key,
      message: '已经是完整 URL，无需刷新',
    });
  }

  // 跳过 base64 数据
  if (key.startsWith('data:')) {
    return NextResponse.json({
      success: true,
      url: key,
      key,
      message: 'base64 数据，无需刷新',
    });
  }

  try {
    const url = await s3Storage.generatePresignedUrl({
      key,
      expireTime: URL_EXPIRE_TIME, // 1年有效期
    });

    return NextResponse.json({
      success: true,
      url,
      key,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error(`[Refresh-URL] 生成 URL 失败: ${key}`, error);
    return NextResponse.json(
      { success: false, error: '生成 URL 失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
