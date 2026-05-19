import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { s3Storage } from '@/lib/s3-client';

/**
 * 下载远程图片并保存到对象存储
 * 用于将第三方 API 返回的图片 URL 转换为我们自己存储的 URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, fileName, contentType } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL 不能为空' }, { status: 400 });
    }

    console.log(`[存储下载] 开始下载图片: ${url.substring(0, 100)}...`);

    // 下载远程图片
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL 格式不正确' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: '仅支持 http/https URL' }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`[存储下载] 下载失败: ${response.status}`);
      return NextResponse.json(
        { error: `下载图片失败: ${response.status}` },
        { status: 500 }
      );
    }

    // 获取图片数据
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 确定 content type
    const resolvedContentType = contentType || response.headers.get('content-type') || 'image/png';
    
    // 生成文件名
    const extension = resolvedContentType.split('/')[1] || 'png';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const resolvedFileName = fileName || `downloaded/${timestamp}_${randomStr}.${extension}`;

    console.log(`[存储下载] 图片大小: ${(buffer.length / 1024).toFixed(2)}KB`);

    // 上传到对象存储（使用统一的 s3Storage 实例）
    const uploadResult = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: resolvedFileName,
      contentType: resolvedContentType,
    });
    
    // 生成签名 URL
    const uploadUrl = await s3Storage.generatePresignedUrl({
      key: uploadResult,
      expireTime: URL_EXPIRE_TIME, // 1年
    });

    if (!uploadUrl) {
      console.error('[存储下载] 上传失败');
      return NextResponse.json(
        { error: '上传到对象存储失败' },
        { status: 500 }
      );
    }

    console.log(`[存储下载] 上传成功: ${uploadUrl}`);

    return NextResponse.json({
      success: true,
      data: {
        url: uploadUrl,
        size: buffer.length,
        contentType: resolvedContentType,
      },
    });
  } catch (error) {
    console.error('[存储下载] 处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '下载保存图片失败' },
      { status: 500 }
    );
  }
}
