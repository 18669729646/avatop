import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { downloadVideoFromUrl } from '@/lib/video-downloader';
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
  return mapped;
}

async function createFromLink(userId: string, body: Record<string, unknown>) {
  const sourceUrl = String(body.sourceUrl || body.url || '').trim();
  if (!sourceUrl) {
    return NextResponse.json({ error: '请提供视频链接' }, { status: 400 });
  }

  const projectId = createProjectId();
  const downloaded = await downloadVideoFromUrl(sourceUrl, {
    projectId,
    provider: 'auto',
    maxBytes: ANALYSIS_MAX_VIDEO_BYTES,
  });
  const storageCheck = await checkStorageQuota(userId, downloaded.buffer.length);
  if (!storageCheck.allowed) {
    return NextResponse.json({ error: storageCheck.error }, { status: 507 });
  }

  const videoKey = await s3Storage.uploadFile({
    fileContent: downloaded.buffer,
    fileName: `analysis-master/source/${userId}/${projectId}.mp4`,
    contentType: downloaded.contentType,
  });
  const videoUrl = await s3Storage.generatePresignedUrl({
    key: videoKey,
    expireTime: URL_EXPIRE_TIME,
  });

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('analysis_master_projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: String(body.name || downloaded.title || '分析大师项目'),
      source_type: 'link',
      source_url: sourceUrl,
      video_key: videoKey,
      video_url: videoUrl,
      video_duration: downloaded.duration || null,
      file_size: downloaded.buffer.length,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    await s3Storage.deleteFile(videoKey).catch(() => false);
    logApiError('analysis-master/projects', 'createFromLink insert', error, { projectId }, userId);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }

  logInfo('api', '创建分析大师链接项目', { projectId, provider: downloaded.provider }, userId);
  return NextResponse.json({ success: true, data: mapProject(data) });
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

  const storageCheck = await checkStorageQuota(userId, file.size);
  if (!storageCheck.allowed) {
    return NextResponse.json({ error: storageCheck.error }, { status: 507 });
  }

  const projectId = createProjectId();
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split('.').pop() || 'mp4';
  const videoKey = await s3Storage.uploadFile({
    fileContent: buffer,
    fileName: `analysis-master/source/${userId}/${projectId}.${extension}`,
    contentType: file.type || 'video/mp4',
  });
  const videoUrl = await s3Storage.generatePresignedUrl({
    key: videoKey,
    expireTime: URL_EXPIRE_TIME,
  });

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('analysis_master_projects')
    .insert({
      id: projectId,
      user_id: userId,
      name: String(formData.get('name') || file.name || '分析大师项目'),
      source_type: 'upload',
      video_key: videoKey,
      video_url: videoUrl,
      file_size: buffer.length,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    await s3Storage.deleteFile(videoKey).catch(() => false);
    logApiError('analysis-master/projects', 'createFromUpload insert', error, { projectId }, userId);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }

  logInfo('api', '创建分析大师上传项目', { projectId, fileSize: buffer.length }, userId);
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
