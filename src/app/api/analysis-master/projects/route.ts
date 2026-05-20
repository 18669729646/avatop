import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { downloadVideoFromUrl } from '@/lib/video-downloader';
import { extractAudioFromBuffer } from '../upload/extract-audio';
import { logApiError, logInfo } from '@/lib/logger';

const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function createProjectId(): string {
  return `am-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    videoKey: row.video_key,
    videoUrl: row.video_url,
    videoDuration: row.video_duration,
    fileSize: row.file_size,
    audioKey: row.audio_key,
    audioUrl: row.audio_url,
    audioDuration: row.audio_duration,
    audioFileSize: row.audio_file_size,
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapProjectWithFreshUrl(row: Record<string, unknown>) {
  const mapped = mapProject(row);
  if (row.video_key) {
    try {
      mapped.videoUrl = await s3Storage.generatePresignedUrl({
        key: String(row.video_key),
        expireTime: URL_EXPIRE_TIME,
      });
    } catch {}
  }
  if (row.audio_key) {
    try {
      mapped.audioUrl = await s3Storage.generatePresignedUrl({
        key: String(row.audio_key),
        expireTime: URL_EXPIRE_TIME,
      });
    } catch {}
  }
  return mapped;
}

async function createFromLink(userId: string, body: Record<string, unknown>) {
  const sourceUrl = String(body.sourceUrl || body.url || '').trim();
  if (!sourceUrl) {
    return NextResponse.json({ error: '请提供视频链接' }, { status: 400 });
  }

  const projectId = createProjectId();
  const projectName = String(body.name || '分析大师项目');

  // 1. 立即创建项目（状态：下载中），不等下载完成
  const client = getSupabaseClient();
  const { data: insertData, error: insertError } = await client
    .from('analysis_master_projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: projectName,
      source_type: 'link',
      source_url: sourceUrl,
      status: 'downloading',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    logApiError('analysis-master/projects', 'createFromLink insert', insertError, { projectId }, userId);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }

  logInfo('api', '创建分析大师项目（下载中）', { projectId, sourceUrl }, userId);

  // 2. 立即返回，不等下载完成
  const immediateResult = mapProject(insertData);

  // 3. 后台异步下载（响应发出后执行）
  setImmediate(async () => {
    try {
      const downloaded = await downloadVideoFromUrl(sourceUrl, {
        projectId,
        provider: 'auto',
        maxBytes: ANALYSIS_MAX_VIDEO_BYTES,
      });

      // 检查存储配额
      const storageCheck = await checkStorageQuota(userId, downloaded.buffer.length);
      if (!storageCheck.allowed) {
        await client
          .from('analysis_master_projects')
          .update({ status: 'failed', error: storageCheck.error, updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return;
      }

      // 上传到 S3
      const videoKey = await s3Storage.uploadFile({
        fileContent: downloaded.buffer,
        fileName: `analysis-master/source/${userId}/${projectId}.mp4`,
        contentType: downloaded.contentType,
      });

      // 生成预签名 URL
      const videoUrl = await s3Storage.generatePresignedUrl({
        key: videoKey,
        expireTime: URL_EXPIRE_TIME,
      });

      // 提取音频
      const audioResult = await extractAudioFromBuffer(downloaded.buffer, userId, projectId);

      // 更新项目状态：下载完成
      const { error: updateError } = await client
        .from('analysis_master_projects')
        .update({
          status: 'draft',
          video_key: videoKey,
          video_url: videoUrl,
          video_duration: downloaded.duration || null,
          file_size: downloaded.buffer.length,
          audio_key: audioResult?.audioKey || null,
          audio_url: audioResult?.audioUrl || null,
          audio_duration: audioResult?.audioDuration || null,
          audio_file_size: audioResult?.audioFileSize || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (updateError) {
        await s3Storage.deleteFile(videoKey).catch(() => false);
        if (audioResult?.audioKey) await s3Storage.deleteFile(audioResult.audioKey).catch(() => false);
        logApiError('analysis-master/projects', 'createFromLink update', updateError, { projectId }, userId);
      } else {
        logInfo('api', '分析大师视频下载完成', { projectId, provider: downloaded.provider }, userId);
      }
    } catch (err) {
      logApiError('analysis-master/projects', 'createFromLink download', err, { projectId }, userId);
      // 下载失败，更新状态
      await client
        .from('analysis_master_projects')
        .update({
          status: 'failed',
          error: String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    }
  });

  return NextResponse.json({ success: true, data: immediateResult });
}

async function createFromUpload(userId: string, request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: '请上传视频文件' }, { status: 400 });
  }

  if (!file.type.startsWith('video/')) {
    return NextResponse.json({ error: '只支持视频文件' }, { status: 400 });
  }

  if (file.size > ANALYSIS_MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: '视频文件不能超过 100MB' }, { status: 400 });
  }

  const projectId = createProjectId();
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split('.').pop() || 'mp4';
  const videoKey = `analysis-master/source/${userId}/${projectId}.${extension}`;

  // 先上传视频到 S3
  let uploadedVideoKey = '';
  let uploadedAudioKey = '';
  try {
    uploadedVideoKey = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: videoKey,
      contentType: file.type || 'video/mp4',
    });
  } catch (uploadErr) {
    logApiError('analysis-master/projects', 'createFromUpload video upload', uploadErr, { projectId }, userId);
    return NextResponse.json({ error: '上传视频失败' }, { status: 500 });
  }

  // 提取音频
  let audioKey = '';
  let audioUrl = '';
  let audioDuration = 0;
  let audioFileSize = 0;
  try {
    const audioResult = await extractAudioFromBuffer(buffer, userId, projectId);
    if (audioResult) {
      audioKey = audioResult.audioKey;
      audioUrl = audioResult.audioUrl;
      audioDuration = audioResult.audioDuration || 0;
      audioFileSize = audioResult.audioFileSize || 0;
      uploadedAudioKey = audioKey;
    }
  } catch (audioErr) {
    // 音频提取失败不影响主流程，记录日志即可
    console.warn('[createFromUpload] 音频提取失败:', audioErr);
  }

  // 检查存储配额（视频 + 音频）
  const totalSize = buffer.length + audioFileSize;
  const storageCheck = await checkStorageQuota(userId, totalSize);
  if (!storageCheck.allowed) {
    // 清理已上传的 S3 文件
    await s3Storage.deleteFile(uploadedVideoKey).catch(() => false);
    if (uploadedAudioKey) {
      await s3Storage.deleteFile(uploadedAudioKey).catch(() => false);
    }
    return NextResponse.json({ error: storageCheck.error }, { status: 507 });
  }

  const client = getSupabaseClient();
  const videoUrl = await s3Storage.generatePresignedUrl({
    key: uploadedVideoKey,
    expireTime: URL_EXPIRE_TIME,
  });

  const { data, error } = await client
    .from('analysis_master_projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: String(formData.get('name') || file.name || '分析大师项目'),
      source_type: 'upload',
      video_key: uploadedVideoKey,
      video_url: videoUrl,
      file_size: buffer.length,
      audio_key: audioKey || null,
      audio_url: audioUrl || null,
      audio_duration: audioDuration || null,
      audio_file_size: audioFileSize || 0,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // 清理已上传的 S3 文件
    await s3Storage.deleteFile(uploadedVideoKey).catch(() => false);
    if (uploadedAudioKey) {
      await s3Storage.deleteFile(uploadedAudioKey).catch(() => false);
    }
    logApiError('analysis-master/projects', 'createFromUpload insert', error, { projectId }, userId);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }

  logInfo('api', '创建分析大师上传项目', { projectId, fileSize: buffer.length, audioFileSize }, userId);
  return NextResponse.json({ success: true, data: mapProject(data) });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('analysis_master_projects')
      .select('*')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      logApiError('analysis-master/projects', 'GET select', error, {}, auth.userId);
      return NextResponse.json({ error: '获取分析项目失败' }, { status: 500 });
    }

    const projects = await Promise.all((data || []).map(mapProjectWithFreshUrl));
    return NextResponse.json({ success: true, data: projects });
  } catch (error) {
    logApiError('analysis-master/projects', 'GET', error);
    return NextResponse.json({ error: '获取分析项目失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return await createFromUpload(auth.userId, request);
    }

    const body = await request.json();
    return await createFromLink(auth.userId, body);
  } catch (error) {
    logApiError('analysis-master/projects', 'POST', error);
    return NextResponse.json({ error: '创建分析项目失败，请确认视频可访问后重试' }, { status: 500 });
  }
}
