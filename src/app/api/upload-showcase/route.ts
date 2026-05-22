import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/db-pool';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { JWT_SECRET } from '@/lib/auth';

// 验证管理员权限
async function verifyAdmin(request: NextRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: '未登录' };
  }

  const token = authHeader.slice(7);
  let decoded: { userId: string; phone: string; role: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as typeof decoded;
  } catch {
    return { success: false, error: 'Token 无效或已过期' };
  }

  if (decoded.role !== 'admin') {
    return { success: false, error: '权限不足' };
  }

  return { success: true, userId: decoded.userId };
}

/**
 * 上传案例媒体文件
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '文件不能为空' },
        { status: 400 }
      );
    }

    // 检查文件类型
    const fileName = file.name.toLowerCase();
    const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.webm') || fileName.endsWith('.mov');
    const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.webp');

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { success: false, error: '只支持图片和视频文件' },
        { status: 400 }
      );
    }

    // 文件大小限制（100MB - 但实际受基础设施限制，建议 < 10MB）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      return NextResponse.json(
        { success: false, error: `文件大小为 ${sizeMB}MB。由于沙箱环境限制，建议上传小于 10MB 的文件。请压缩视频后再试。` },
        { status: 413 }
      );
    }

    // 生成文件路径
    const fileId = crypto.randomUUID();
    const fileExt = fileName.split('.').pop();
    const folder = isVideo ? 'showcase/videos' : 'showcase/thumbnails';
    const fileNameS3 = `${folder}/${fileId}.${fileExt}`;

    // 上传到 S3
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[Upload Showcase] 准备上传文件:', {
      fileName: fileNameS3,
      fileSize: buffer.length,
      contentType: file.type,
      bufferLength: buffer.length,
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucketName: process.env.COZE_BUCKET_NAME,
    });

    let key: string;
    try {
      key = await s3Storage.uploadFile({
        fileContent: buffer,
        fileName: fileNameS3,
        contentType: file.type,
      });
      console.log('[Upload Showcase] 上传成功，key:', key);
    } catch (uploadError) {
      console.error('[Upload Showcase] 上传失败:', uploadError);
      throw uploadError;
    }

    // 生成签名 URL（有效期 1 年）
    let url: string;
    try {
      url = await s3Storage.generatePresignedUrl({
        key,
        expireTime: URL_EXPIRE_TIME,
      });
      console.log('[Upload Showcase] 生成签名 URL 成功:', url.substring(0, 100) + '...');
    } catch (urlError) {
      console.error('[Upload Showcase] 生成 URL 失败:', urlError);
      throw urlError;
    }

    return NextResponse.json({
      success: true,
      data: {
        url,
        fileName: file.name,
        size: file.size,
        type: file.type,
        mediaType: isVideo ? 'video' : 'image',
      }
    });
  } catch (error) {
    console.error('[Upload Showcase File] Error:', error);
    return NextResponse.json(
      { success: false, error: '上传失败' },
      { status: 500 }
    );
  }
}
