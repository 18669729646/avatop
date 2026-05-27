export interface AnalysisProjectRefreshFields {
  id?: string;
  status?: string;
  error?: string | null;
  videoKey?: string;
  videoUrl?: string;
  audioKey?: string;
  audioUrl?: string;
  optimisticStatus?: string;
  result?: unknown;
  videoDuration?: number;
  audioDuration?: number;
  fileSize?: number;
}

export function shouldRefreshAnalysisProjectDetails(
  previous?: AnalysisProjectRefreshFields | null,
  current?: AnalysisProjectRefreshFields | null
): boolean {
  if (!previous && !current) return false;
  if (!previous || !current) return true;

  return (
    previous.id !== current.id ||
    previous.status !== current.status ||
    previous.error !== current.error ||
    previous.videoKey !== current.videoKey ||
    previous.audioKey !== current.audioKey ||
    previous.optimisticStatus !== current.optimisticStatus ||
    Boolean(previous.result) !== Boolean(current.result) ||
    (Boolean(previous.result) && JSON.stringify(previous.result) !== JSON.stringify(current.result)) ||
    previous.videoDuration !== current.videoDuration ||
    previous.audioDuration !== current.audioDuration ||
    previous.fileSize !== current.fileSize
  );
}
