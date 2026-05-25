import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { downloadVideoFromUrl } from '@/lib/video-downloader';
import { extractAudioFromBuffer } from '@/app/api/analysis-master/upload/extract-audio';
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

export interface AnalysisMasterPlaceholderProjectParams {
  projectId?: string;
  userId: string;
  sourceUrl: string;
  name?: string;
  importMetadata?: Record<string, string>;
  now?: string;
}

export function buildAnalysisMasterPlaceholderProjectUpsert(
  params: AnalysisMasterPlaceholderProjectParams
): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  const sourceUrl = params.sourceUrl.trim();
  if (!sourceUrl) {
    throw new AnalysisMasterProjectError('请提供视频链接', 400);
  }

  return {
    id: params.projectId || createAnalysisProjectId(),
    user_id: params.userId,
    name: params.name?.trim() || '分析大师项目',
    source_type: 'link',
    source_url: sourceUrl,
    status: 'downloading',
    import_metadata: params.importMetadata || {},
    created_at: now,
    updated_at: now,
  };
}

export interface AnalysisMasterProjectStatusPatchParams {
  status: string;
  error?: string | null;
  now?: string;
}

export function buildAnalysisMasterProjectStatusPatch(
  params: AnalysisMasterProjectStatusPatchParams
): Record<string, unknown> {
  return {
    status: params.status,
    error: params.error ?? null,
    updated_at: params.now || new Date().toISOString(),
  };
}

interface AnalysisMasterProjectDeps {
  downloadVideoFromUrl?: typeof downloadVideoFromUrl;
  checkStorageQuota?: typeof checkStorageQuota;
  uploadFile?: typeof s3Storage.uploadFile;
  generatePresignedUrl?: typeof s3Storage.generatePresignedUrl;
  deleteFile?: typeof s3Storage.deleteFile;
  extractAudioFromBuffer?: typeof extractAudioFromBuffer;
  getSupabaseClient?: typeof getSupabaseClient;
  logApiError?: typeof logApiError;
  logInfo?: typeof logInfo;
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

export async function createAnalysisProjectFromLink(
  params: {
    userId: string;
    sourceUrl: string;
    name?: string;
    importMetadata?: Record<string, string>;
    clientRequestId?: string;
    downloadTimeoutMs?: number;
  },
  deps: AnalysisMasterProjectDeps = {}
) {
  const sourceUrl = params.sourceUrl.trim();
  console.log(`[AnalysisProject] >>> createAnalysisProjectFromLink，userId=${params.userId}, url=${sourceUrl}, timeout=${params.downloadTimeoutMs || 60000}ms`);

  if (!sourceUrl) {
    console.error(`[AnalysisProject] createAnalysisProjectFromLink 失败：链接为空`);
    throw new AnalysisMasterProjectError('请提供视频链接', 400);
  }

  const download = deps.downloadVideoFromUrl || downloadVideoFromUrl;
  const storageQuota = deps.checkStorageQuota || checkStorageQuota;
  const uploadFile = deps.uploadFile || ((input) => s3Storage.uploadFile(input));
  const generatePresignedUrl = deps.generatePresignedUrl || ((input) => s3Storage.generatePresignedUrl(input));
  const deleteFile = deps.deleteFile || ((key) => s3Storage.deleteFile(key));
  const extractAudio = deps.extractAudioFromBuffer || extractAudioFromBuffer;
  const getClient = deps.getSupabaseClient || getSupabaseClient;
  const apiLogError = deps.logApiError || logApiError;
  const infoLog = deps.logInfo || logInfo;

  const projectId = createAnalysisProjectId();
  console.log(`[AnalysisProject] 开始下载视频，projectId=${projectId}`);
  let downloaded;
  try {
    downloaded = await download(sourceUrl, {
      projectId,
      provider: 'auto',
      maxBytes: ANALYSIS_MAX_VIDEO_BYTES,
      timeoutMs: params.downloadTimeoutMs,
    });
  } catch (downloadError) {
    const errMsg = downloadError instanceof Error ? downloadError.message : String(downloadError);
    console.error(`[AnalysisProject] 视频下载失败，projectId=${projectId}, url=${sourceUrl}, error=${errMsg}`);
    throw new AnalysisMasterProjectError(`视频下载失败：${errMsg}`, 400);
  }
  console.log(`[AnalysisProject] 视频下载成功，size=${downloaded.buffer.length}, provider=${downloaded.provider}`);

  const storageCheck = await storageQuota(params.userId, downloaded.buffer.length);
  if (!storageCheck.allowed) {
    console.error(`[AnalysisProject] 存储空间不足，userId=${params.userId}, required=${downloaded.buffer.length}`);
    throw new AnalysisMasterProjectError(storageCheck.error || '存储空间不足', 507);
  }
  console.log(`[AnalysisProject] 存储检查通过`);

  const importMetadata = {
    ...(params.importMetadata || {}),
  };
  if (params.clientRequestId) {
    importMetadata.clientRequestId = params.clientRequestId;
  }

  let videoKey: string | null = null;
  let audioKey: string | null = null;

  try {
    console.log(`[AnalysisProject] 上传视频到 S3，projectId=${projectId}`);
    videoKey = await uploadFile({
      fileContent: downloaded.buffer,
      fileName: `analysis-master/source/${params.userId}/${projectId}.mp4`,
      contentType: downloaded.contentType,
    });
    console.log(`[AnalysisProject] 视频上传成功，key=${videoKey}`);

    console.log(`[AnalysisProject] 提取音频，projectId=${projectId}`);
    const audioResult = await extractAudio(downloaded.buffer, params.userId, projectId);
    audioKey = audioResult?.audioKey || null;

    const videoUrl = await generatePresignedUrl({
      key: videoKey,
      expireTime: URL_EXPIRE_TIME,
    });

    const client = getClient();
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
        audio_key: audioKey || null,
        audio_url: audioResult?.audioUrl || null,
        audio_duration: audioResult?.audioDuration || null,
        audio_file_size: audioResult?.audioFileSize || 0,
        import_metadata: importMetadata,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      apiLogError('analysis-master/projects', 'createFromLink insert', error, { projectId }, params.userId);
      throw new AnalysisMasterProjectError('创建分析项目失败', 500);
    }

    console.log(`[AnalysisProject] 项目创建成功，projectId=${projectId}, status=draft`);
    infoLog('api', '创建分析大师链接项目', { projectId, provider: downloaded.provider }, params.userId);
    return mapAnalysisMasterProject(data);
  } catch (error) {
    console.error(`[AnalysisProject] createAnalysisProjectFromLink 失败，projectId=${projectId}: ${(error as Error).message}`);
    if (videoKey) {
      console.log(`[AnalysisProject] 清理已上传视频，key=${videoKey}`);
      await deleteFile(videoKey).catch(() => false);
    }
    if (audioKey) {
      console.log(`[AnalysisProject] 清理已上传音频，key=${audioKey}`);
      await deleteFile(audioKey).catch(() => false);
    }
    if (error instanceof AnalysisMasterProjectError) {
      throw error;
    }
    apiLogError('analysis-master/projects', 'createFromLink', error, { projectId }, params.userId);
    throw new AnalysisMasterProjectError('创建分析项目失败', 500);
  }
}
