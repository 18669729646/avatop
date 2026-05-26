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
  buildAnalysisMasterPlaceholderProjectUpsert,
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
    importMetadata: row.import_metadata || {},
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
      clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined,
    });
    return NextResponse.json({
      success: true,
      data: {
        ...project,
        clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined,
      },
    });
  } catch (error) {
    if (error instanceof AnalysisMasterProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

async function createPlaceholderProject(userId: string, body: Record<string, unknown>) {
  try {
    const client = getSupabaseClient();
    const row = buildAnalysisMasterPlaceholderProjectUpsert({
      projectId: typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : undefined,
      userId,
      sourceUrl: String(body.sourceUrl || body.url || ''),
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
      importMetadata: (body.importMetadata && typeof body.importMetadata === 'object' ? body.importMetadata : undefined) as Record<string, string> | undefined,
    });

    const { data, error } = await client
      .from('analysis_master_projects')
      .insert(row)
      .select()
      .single();

    if (error) {
      logApiError('analysis-master/projects', 'createPlaceholder insert', error, { projectId: row.id }, userId);
      return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
    }

    logInfo('api', '分析大师占位项目已创建', { projectId: data.id, status: data.status }, userId);
    return NextResponse.json({
      success: true,
      data: {
        ...mapProject(data),
        projectId: data.id,
      },
    });
  } catch (error) {
    logApiError('analysis-master/projects', 'createPlaceholder', error, undefined, userId);
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10) || 20, 1), 50);
    const offset = (page - 1) * pageSize;

    const client = getSupabaseClient();
    const { data, error, count } = await client
      .from('analysis_master_projects')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      logApiError('analysis-master/projects', 'GET select', error, {}, auth.userId);
      return NextResponse.json({ error: '获取分析项目失败' }, { status: 500 });
    }

    const projects = await Promise.all((data || []).map(mapProjectWithFreshUrl));
    return NextResponse.json({
      success: true,
      data: projects,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
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
    if (body.importMode === 'local-helper') {
      return createPlaceholderProject(auth.userId, body);
    }
    return createFromLink(auth.userId, body);
  } catch (error) {
    logApiError('analysis-master/projects', 'POST', error);
    return NextResponse.json({ error: '创建分析项目失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/analysis-master/projects
 * 一键删除所有分析大师项目：清理 S3 文件 + 任务队列 + 数据库记录
 */
export async function DELETE(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;

  try {
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const client = getSupabaseClient();

    // 1. 获取用户所有项目
    const { data: projects, error: fetchError } = await client
      .from('analysis_master_projects')
      .select('id, video_key, audio_key')
      .eq('user_id', auth.userId);

    if (fetchError) {
      logApiError('analysis-master/projects', 'DELETE fetch', fetchError, {}, auth.userId);
      return NextResponse.json({ error: '查询项目失败' }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ success: true, data: { deleted: 0, deletedFiles: 0, failedFiles: 0 } });
    }

    const projectIds = projects.map((p: { id: string }) => p.id);
    let deletedFiles = 0;
    let failedFiles = 0;

    // 2. 逐个删除 S3 文件（视频 + 音频）
    for (const project of projects) {
      if (project.video_key) {
        try {
          await s3Storage.deleteFile(project.video_key);
          deletedFiles++;
        } catch (deleteErr) {
          failedFiles++;
          logApiError('analysis-master/projects', 'deleteFile video', deleteErr, { projectId: project.id }, auth.userId);
        }
      }
      if (project.audio_key) {
        try {
          await s3Storage.deleteFile(project.audio_key);
          deletedFiles++;
        } catch (deleteErr) {
          failedFiles++;
          logApiError('analysis-master/projects', 'deleteFile audio', deleteErr, { projectId: project.id }, auth.userId);
        }
      }
    }

    // 3. 批量删除关联的任务队列记录
    const { error: taskDeleteError } = await client
      .from('task_queue')
      .delete()
      .in('project_id', projectIds)
      .eq('user_id', auth.userId);

    if (taskDeleteError) {
      logApiError('analysis-master/projects', 'DELETE tasks', taskDeleteError, { projectIds }, auth.userId);
    }

    // 4. 批量删除数据库项目记录
    const { error: deleteError, count } = await client
      .from('analysis_master_projects')
      .delete({ count: 'exact' })
      .in('id', projectIds)
      .eq('user_id', auth.userId);

    if (deleteError) {
      logApiError('analysis-master/projects', 'DELETE projects', deleteError, { projectIds }, auth.userId);
      return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
    }

    logInfo('api', '分析大师项目已批量删除', {
      projectCount: count,
      deletedFiles,
      failedFiles,
    }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        deleted: count ?? projects.length,
        deletedFiles,
        failedFiles,
      },
    });
  } catch (error) {
    logApiError('analysis-master/projects', 'DELETE all', error, {}, auth?.success ? auth.userId : undefined);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
