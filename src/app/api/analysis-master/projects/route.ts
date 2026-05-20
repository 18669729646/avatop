import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { extractAudioFromBuffer } from '../upload/extract-audio';
import { logApiError, logInfo } from '@/lib/logger';
import {
  ANALYSIS_MAX_VIDEO_BYTES,
  AnalysisMasterProjectError,
  createAnalysisProjectFromLink,
  createAnalysisProjectId,
} from '@/lib/analysis-master-projects';

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
  try {
    const project = await createAnalysisProjectFromLink({
      userId,
      sourceUrl: String(body.sourceUrl || body.url || ''),
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
      importMetadata: body.importMetadata as Record<string, string> | undefined,
    });
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    if (error instanceof AnalysisMasterProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
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

  const projectId = createAnalysisProjectId();
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split('.').pop() || 'mp4';
  const videoKey = `analysis-master/source/${userId}/${projectId}.${extension}`;

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
    console.warn('[createFromUpload] 音频提取失败:', audioErr);
  }

  const totalSize = buffer.length + audioFileSize;
  const storageCheck = await checkStorageQuota(userId, totalSize);
  if (!storageCheck.allowed) {
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
      .order('created_at', { ascending: false });

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
      return createFromUpload(auth.userId, request);
    }

    const body = await request.json();
    return createFromLink(auth.userId, body);
  } catch (error) {
    logApiError('analysis-master/projects', 'POST', error);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }
}
