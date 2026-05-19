import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { s3Storage } from '@/lib/s3-client';
import { logInfo, logApiError } from '@/lib/logger';
import { checkStorageQuota } from '@/lib/storage-quota';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const storageCheck = await checkStorageQuota(auth.userId);
    if (!storageCheck.allowed) {
      return NextResponse.json({ error: storageCheck.error }, { status: 507 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请上传视频文件' }, { status: 400 });
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: '不支持的视频格式' }, { status: 400 });
    }

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: '视频文件不能超过 500MB' }, { status: 400 });
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'mp4';
    const s3Key = `video-remake/${auth.userId}/${timestamp}-${randomStr}.${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: s3Key,
      contentType: file.type,
    });

    const signedUrl = await s3Storage.generatePresignedUrl({
      key,
      expireTime: URL_EXPIRE_TIME,
    });

    if (projectId) {
      const client = getSupabaseClient();
      const { error } = await client
        .from('shortfilm_projects')
        .update({
          source_type: 'remake',
          source_video_key: key,
          source_video_url: signedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', auth.userId);

      if (error) {
        console.error('[Shortfilm Remake Upload] 更新项目失败:', error);
        return NextResponse.json({ error: '视频已上传但项目更新失败，请重试' }, { status: 500 });
      }
    }

    logInfo('api', '上传视频成功', { projectId, key, size: file.size }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        key,
        url: signedUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    logApiError('shortfilm/remake-upload', 'POST', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
