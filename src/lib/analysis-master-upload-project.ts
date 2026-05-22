export interface AnalysisUploadProjectUpsertParams {
  projectId: string;
  userId: string;
  name: string;
  videoKey: string;
  videoUrl: string;
  videoDuration: number;
  fileSize: number;
  sourceUrl?: string;
  audioKey?: string;
  audioUrl?: string;
  audioDuration?: number;
  audioFileSize?: number;
  now?: string;
}

export function buildAnalysisUploadProjectUpsert(params: AnalysisUploadProjectUpsertParams): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  const row: Record<string, unknown> = {
    id: params.projectId,
    user_id: params.userId,
    name: params.name,
    video_key: params.videoKey,
    video_url: params.videoUrl,
    status: 'draft',
    source_type: params.sourceUrl ? 'link' : 'upload',
    file_size: params.fileSize,
    created_at: now,
    updated_at: now,
  };

  if (params.sourceUrl) {
    row.source_url = params.sourceUrl;
  }
  if (params.videoDuration > 0) {
    row.video_duration = params.videoDuration;
  }
  if (params.audioKey) {
    row.audio_key = params.audioKey;
    row.audio_url = params.audioUrl || '';
    row.audio_duration = params.audioDuration || 0;
    row.audio_file_size = params.audioFileSize || 0;
  }

  return row;
}
