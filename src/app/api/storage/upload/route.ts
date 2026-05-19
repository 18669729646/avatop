import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { s3Storage } from '@/lib/s3-client';

/**
 * 上传文件到对象存储
 * 接收 base64 编码的文件内容，上传后返回 key、签名 URL 和文件大小
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'files 参数不能为空' },
        { status: 400 }
      );
    }

    const results: Array<{ key: string; url: string; size: number; generatedAt?: number }> = [];

    for (const file of files) {
      const { base64Data, fileName, contentType, remoteUrl } = file;

      // 支持 remoteUrl 或 base64Data
      if (!fileName || (!base64Data && !remoteUrl)) {
        results.push({ key: '', url: '', size: 0 });
        continue;
      }

      if (remoteUrl) {
        try {
          const parsedUrl = new URL(remoteUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            results.push({ key: '', url: '', size: 0 });
            continue;
          }
        } catch {
          results.push({ key: '', url: '', size: 0 });
          continue;
        }
      }

      try {
        let buffer: Buffer;
        let finalContentType = contentType || 'application/octet-stream';

        if (remoteUrl) {
          // 从远程 URL 下载文件
          console.log(`[Storage Upload] Downloading from remote URL: ${remoteUrl.substring(0, 100)}...`);
          const response = await fetch(remoteUrl);
          if (!response.ok) {
            throw new Error(`下载远程文件失败: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          
          // 从响应头获取 content-type
          const responseContentType = response.headers.get('content-type');
          if (responseContentType && !contentType) {
            finalContentType = responseContentType;
          }
        } else if (base64Data) {
          // 将 base64 转换为 Buffer
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          results.push({ key: '', url: '', size: 0 });
          continue;
        }

        const fileSize = buffer.length;

        // 上传文件到对象存储
        const actualKey = await s3Storage.uploadFile({
          fileContent: buffer,
          fileName,
          contentType: finalContentType,
        });

        // 生成签名 URL
        const url = await s3Storage.generatePresignedUrl({
          key: actualKey,
          expireTime: URL_EXPIRE_TIME, // 1年有效期
        });

        results.push({ key: actualKey, url, size: fileSize, generatedAt: Date.now() });
      } catch (error) {
        console.error(`[Storage Upload] Failed to upload file: ${fileName}`, error);
        results.push({ key: '', url: '', size: 0 });
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Storage Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: '上传文件失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
