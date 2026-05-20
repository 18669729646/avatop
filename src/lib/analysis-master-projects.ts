import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { downloadVideoFromUrl } from '@/lib/video-downloader';
import { logApiError, logInfo } from '@/lib/logger';

export const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export class AnalysisMasterProjectError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'AnalysisMasterProjectError';
    this.status = status;
  }
}

export function createAnalysisProjectId(): string {
  return `am-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function mapAnalysisMasterProject(row: Record<string, unknown>) {
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
    importMetadata: row.import_metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function mapAnalysisMasterProjectWithFreshUrl(row: Record<string, unknown>) {
  const mapped = mapAnalysisMasterProject(row);
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

export async function createAnalysisProjectFromLink(params: {
  userId: string;
  sourceUrl: string;
  name?: string;
  importMetadata?: Record<string, string>;
}) {
  const sourceUrl = params.sourceUrl.trim();
  if (!sourceUrl) {
    throw new AnalysisMasterProjectError('请提供视频链接', 400);
  }

  const projectId = createAnalysisProjectId();
  const downloaded = await downloadVideoFromUrl(sourceUrl, {
    projectId,
    provider: 'auto',
    maxBytes: ANALYSIS_MAX_VIDEO_BYTES,
  });
  const storageCheck = await checkStorageQuota(params.userId, downloaded.buffer.length);
  if (!storageCheck.allowed) {
    throw new AnalysisMasterProjectError(storageCheck.error || '存储空间不足', 507);
  }

  let videoKey: string | null = null;
  try {
    videoKey = await s3Storage.uploadFile({
      fileContent: downloaded.buffer,
      fileName: `analysis-master/source/${params.userId}/${projectId}.mp4`,
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
        user_id: params.userId,
        name: params.name || downloaded.title || '分析大师项目',
        source_type: 'link',
        source_url: sourceUrl,
        video_key: videoKey,
        video_url: videoUrl,
        video_duration: downloaded.duration || null,
        file_size: downloaded.buffer.length,
        import_metadata: params.importMetadata || {},
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logApiError('analysis-master/projects', 'createFromLink insert', error, { projectId }, params.userId);
      throw new AnalysisMasterProjectError('创建分析项目失败', 500);
    }

    logInfo('api', '创建分析大师链接项目', { projectId, provider: downloaded.provider }, params.userId);
    return mapAnalysisMasterProject(data);
  } catch (error) {
    if (videoKey) {
      await s3Storage.deleteFile(videoKey).catch(() => false);
    }
    if (error instanceof AnalysisMasterProjectError) {
      throw error;
    }
    logApiError('analysis-master/projects', 'createFromLink', error, { projectId }, params.userId);
    throw new AnalysisMasterProjectError('创建分析项目失败', 500);
  }
}
