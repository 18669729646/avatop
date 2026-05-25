import * as os from 'os';
import * as path from 'path';
import { createAnalysisProjectId } from '@/lib/analysis-master-projects';

export interface AnalysisMasterUploadInitSessionParams {
  userId: string;
  fileName: string;
  fileSize: number;
  chunkSize?: number;
  totalChunks: number;
  name?: string;
  sourceUrl?: string;
  projectId?: string;
  importRunId?: string;
  importItemId?: string;
  now?: string;
}

export interface AnalysisMasterUploadInitSessionResult {
  uploadId: string;
  projectId: string;
  key: string;
  tempDir: string;
  session: Record<string, unknown>;
}

function buildTimestamp(now?: string): number {
  if (!now) {
    return Date.now();
  }
  const parsed = Date.parse(now);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function buildAnalysisMasterUploadInitSession(
  params: AnalysisMasterUploadInitSessionParams
): AnalysisMasterUploadInitSessionResult {
  const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const projectId = params.projectId || createAnalysisProjectId();
  const timestamp = buildTimestamp(params.now);
  const extension = params.fileName.split('.').pop() || 'mp4';
  const key = `analysis-master/${params.userId}/${projectId}/${timestamp}.${extension}`;
  const tempDir = path.join(os.tmpdir(), `am-upload-${uploadId}`);

  return {
    uploadId,
    projectId,
    key,
    tempDir,
    session: {
      userId: params.userId,
      projectId,
      fileName: params.fileName,
      fileSize: params.fileSize,
      name: params.name || params.fileName,
      sourceUrl: typeof params.sourceUrl === 'string' && params.sourceUrl.trim() ? params.sourceUrl.trim() : undefined,
      importRunId: typeof params.importRunId === 'string' && params.importRunId.trim() ? params.importRunId.trim() : undefined,
      importItemId: typeof params.importItemId === 'string' && params.importItemId.trim() ? params.importItemId.trim() : undefined,
      chunkSize: params.chunkSize,
      totalChunks: params.totalChunks,
      receivedChunks: [] as number[],
      tempDir,
      key,
      createdAt: timestamp,
    },
  };
}
