import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { s3Storage } from '@/lib/s3-client';
import { optimizeImage, isSupportedImageFormat } from '@/lib/image-optimizer';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const type = formData.get('type') as string || 'general'; // product, character, general
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    }

    const uploadedFiles: { key: string; url: string; fileName: string; fileType: string; fileSize: number; originalSize?: number; compressionRatio?: number }[] = [];

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        continue; // 跳过不支持的文件类型
      }

      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer();
      const originalBuffer = Buffer.from(arrayBuffer);
      const originalSize = originalBuffer.length;

      // 图片优化（转换为 WebP）
      let optimizedBuffer: Buffer;
      let contentType: string;
      let extension: string;
      let compressionRatio = 0;

      if (isSupportedImageFormat(file.type)) {
        try {
          const result = await optimizeImage(originalBuffer, {
            maxWidth: 2048,
            maxHeight: 2048,
            quality: 85,
            convertToWebP: true,
          });
          optimizedBuffer = result.buffer;
          contentType = result.mimeType;
          extension = result.extension;
          compressionRatio = result.compressionRatio;
          
          console.log(`[上传优化] ${file.name}: ${originalSize} -> ${result.optimizedSize} bytes (压缩 ${compressionRatio}%)`);
        } catch (optimizeError) {
          // 优化失败，使用原始文件
          console.warn(`[上传优化] 优化失败，使用原始文件: ${optimizeError}`);
          optimizedBuffer = originalBuffer;
          contentType = file.type;
          extension = file.name.split('.').pop() || 'jpg';
        }
      } else {
        optimizedBuffer = originalBuffer;
        contentType = file.type;
        extension = file.name.split('.').pop() || 'jpg';
      }

      // 生成文件名（使用 WebP 扩展名）
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${type}/${timestamp}_${randomStr}.${extension}`;

      // 上传到对象存储
      const key = await s3Storage.uploadFile({
        fileContent: optimizedBuffer,
        fileName,
        contentType,
      });

      // 生成访问URL（有效期1年）
      const url = await s3Storage.generatePresignedUrl({
        key,
        expireTime: URL_EXPIRE_TIME, // 1年
      });

      uploadedFiles.push({
        key,
        url,
        fileName: file.name,
        fileType: contentType,
        fileSize: optimizedBuffer.length,
        originalSize,
        compressionRatio,
      });
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: '没有有效的文件被上传' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      urls: uploadedFiles.map(f => f.url),
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('图片上传失败:', error);
    return NextResponse.json(
      { error: '图片上传失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
