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
    source_url: params.sourceUrl || null,
    file_size: params.fileSize,
    audio_key: params.audioKey || null,
    audio_url: params.audioKey ? params.audioUrl || '' : null,
    audio_duration: params.audioKey ? params.audioDuration || 0 : null,
    audio_file_size: params.audioKey ? params.audioFileSize || 0 : 0,
    created_at: now,
    updated_at: now,
  };

  if (params.videoDuration > 0) {
    row.video_duration = params.videoDuration;
  }

  return row;
}
