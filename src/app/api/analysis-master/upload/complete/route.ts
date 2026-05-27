import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { s3Storage } from '@/lib/s3-client';
import { logInfo } from '@/lib/logger';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkStorageQuota } from '@/lib/storage-quota';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { buildAnalysisMasterItemSuccessPatch } from '@/lib/analysis-master-import-runs';
import { refreshAnalysisMasterImportRunProgress } from '@/lib/analysis-master-import-run-db';
import { enqueueAnalysisTaskForProject } from '@/lib/analysis-master-queue';
import { buildAnalysisUploadProjectUpsert } from '@/lib/analysis-master-upload-project';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractAudioFromBuffer } from '../extract-audio';

import { promisify } from 'util';
import { execFile as execFileSync } from 'child_process';

const execFileAsync = promisify(execFileSync);
const SESSION_DIR = path.join(os.tmpdir(), 'am-upload-sessions');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function getSessionFile(uploadId: string): string {
  return path.join(SESSION_DIR, `${uploadId}.json`);
}

function loadSession(uploadId: string): Record<string, unknown> | null {
  const filePath = getSessionFile(uploadId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const session = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Date.now() - (session.createdAt as number) > SESSION_TTL_MS) {
      fs.unlinkSync(filePath);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function deleteSession(uploadId: string): void {
  const filePath = getSessionFile(uploadId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function cleanupUploadArtifacts(params: {
  uploadId: string;
  tempVideoPath?: string;
  tempDir?: string;
  s3Key?: string;
  audioKey?: string;
  deleteRemote?: boolean;
}): Promise<void> {
  if (params.deleteRemote && params.s3Key) {
    await s3Storage.deleteFile(params.s3Key).catch(() => false);
  }
  if (params.deleteRemote && params.audioKey) {
    await s3Storage.deleteFile(params.audioKey).catch(() => false);
  }
  if (params.tempVideoPath && fs.existsSync(params.tempVideoPath)) {
    fs.unlinkSync(params.tempVideoPath);
  }
  if (params.tempDir && fs.existsSync(params.tempDir)) {
    fs.rmSync(params.tempDir, { recursive: true, force: true });
  }
  deleteSession(params.uploadId);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { uploadId, key } = body;

    if (!uploadId || !key) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const session = loadSession(uploadId);
    if (!session) {
      return NextResponse.json({ error: 'Upload session not found or expired' }, { status: 400 });
    }

    if (session.userId !== auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const receivedChunks = (session.receivedChunks as number[]) || [];
    const totalChunks = session.totalChunks as number;
    const projectId = session.projectId as string;

    if (receivedChunks.length !== totalChunks) {
      return NextResponse.json({
        error: 'Some chunks are still missing',
        received: receivedChunks.length,
        total: totalChunks,
      }, { status: 400 });
    }

    logInfo('api', 'AnalysisMaster merge chunks start', { uploadId, key, totalChunks }, auth.userId);

    const tempDir = session.tempDir as string;
    const tempVideoPath = path.join(tempDir, 'merged_video.mp4');

    try {
      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i.toString().padStart(6, '0')}`);
        if (!fs.existsSync(chunkPath)) {
          return NextResponse.json({ error: `Chunk ${i} is missing` }, { status: 500 });
        }
        chunks.push(fs.readFileSync(chunkPath));
      }

      const mergedBuffer = Buffer.concat(chunks);

      let videoDuration = 0;
      let s3Key = '';
      let url = '';
      let audioKey = '';
      let audioUrl = '';
      let audioDuration = 0;
      let audioFileSize = 0;

      try {
        fs.writeFileSync(tempVideoPath, mergedBuffer);

        try {
          const { stdout } = await execFileAsync('ffprobe', [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            tempVideoPath,
          ]);
          const probeData = JSON.parse(stdout);
          videoDuration = Math.round(parseFloat(probeData.format?.duration || '0'));
          console.log(`[AnalysisMaster Chunk Complete] Video duration: ${videoDuration}s`);
        } catch (e) {
          console.warn('[AnalysisMaster Chunk Complete] Failed to get video duration:', (e as Error).message);
        }

        s3Key = await s3Storage.uploadFile({
          fileContent: mergedBuffer,
          fileName: key as string,
          contentType: 'video/mp4',
        });

        try {
          url = await s3Storage.generatePresignedUrl({
            key: s3Key,
            expireTime: URL_EXPIRE_TIME,
          });
        } catch (e) {
          console.log('[AnalysisMaster Chunk Complete] Failed to generate presigned URL (non-blocking):', e);
        }

        try {
          const audioResult = await extractAudioFromBuffer(mergedBuffer, auth.userId, projectId || uploadId);
          if (audioResult) {
            audioKey = audioResult.audioKey;
            audioDuration = audioResult.audioDuration || 0;
            audioFileSize = audioResult.audioFileSize || 0;

            const totalSize = mergedBuffer.length + audioFileSize;
            const storageCheck = await checkStorageQuota(auth.userId, totalSize);
            if (!storageCheck.allowed) {
              await cleanupUploadArtifacts({
                uploadId,
                tempVideoPath,
                tempDir,
                s3Key,
                audioKey,
                deleteRemote: true,
              });
              return NextResponse.json({ error: storageCheck.error }, { status: 507 });
            }

            try {
              audioUrl = await s3Storage.generatePresignedUrl({
                key: audioKey,
                expireTime: URL_EXPIRE_TIME,
              });
            } catch (e) {
              console.log('[AnalysisMaster] Failed to generate audio presigned URL:', e);
            }
            logInfo('api', 'AnalysisMaster audio extracted successfully', { audioKey, duration: audioDuration, size: audioFileSize }, auth.userId);
          }
        } catch (e) {
          console.log('[AnalysisMaster] Audio extraction failed (non-blocking):', e);
        }

        if (projectId) {
          const client = getSupabaseClient();
          const upsertData = buildAnalysisUploadProjectUpsert({
            projectId,
            userId: auth.userId,
            name: (session.name as string) || (session.fileName as string) || 'Untitled project',
            videoKey: s3Key,
            videoUrl: url,
            videoDuration,
            fileSize: mergedBuffer.length,
            sourceUrl: typeof session.sourceUrl === 'string' ? session.sourceUrl : undefined,
            audioKey: audioKey || undefined,
            audioUrl,
            audioDuration,
            audioFileSize,
          });

          const { error: upsertError } = await client
            .from('analysis_master_projects')
            .upsert(upsertData, { onConflict: 'id' });
          if (upsertError) {
            console.error('[AnalysisMaster Chunk Complete] Failed to write project:', upsertError);
            await cleanupUploadArtifacts({
              uploadId,
              tempVideoPath,
              tempDir,
              s3Key,
              audioKey,
              deleteRemote: true,
            });
            return NextResponse.json({ error: 'Failed to write project' }, { status: 500 });
          }
        }

        const importRunId = typeof session.importRunId === 'string' ? session.importRunId : '';
        const importItemId = typeof session.importItemId === 'string' ? session.importItemId : '';
        if (importRunId && importItemId) {
          const client = getSupabaseClient();
          const { data: updatedItem, error: itemUpdateError } = await client
            .from('analysis_master_import_items')
            .update(buildAnalysisMasterItemSuccessPatch({}))
            .eq('id', importItemId)
            .eq('run_id', importRunId)
            .eq('project_id', projectId)
            .eq('user_id', auth.userId)
            .select('id')
            .single();

          if (itemUpdateError || !updatedItem) {
            console.error('[AnalysisMaster Chunk Complete] Failed to write import item:', itemUpdateError);
            await cleanupUploadArtifacts({
              uploadId,
              tempVideoPath,
              tempDir,
              s3Key,
              audioKey,
              deleteRemote: true,
            });
            return NextResponse.json({ error: 'Failed to write import item' }, { status: 500 });
          }

          await refreshAnalysisMasterImportRunProgress(importRunId, client).catch(error => {
            console.warn('[AnalysisMaster Chunk Complete] import run progress refresh failed:', error);
          });

          await enqueueAnalysisTaskForProject({
            projectId,
            userId: auth.userId,
            authHeader: request.headers.get('authorization'),
          }).catch(error => {
            console.warn('[AnalysisMaster Chunk Complete] enqueue analysis failed:', error);
          });
        }

        await cleanupUploadArtifacts({
          uploadId,
          tempVideoPath,
          tempDir,
        });

        logInfo('api', 'AnalysisMaster chunk upload complete', { uploadId, s3Key, videoDuration }, auth.userId);

        return NextResponse.json({
          success: true,
          projectId,
          videoKey: s3Key,
          videoUrl: url,
          videoDuration,
        });
      } catch (error) {
        console.error('[AnalysisMaster Chunk Complete] Error:', error);
        await cleanupUploadArtifacts({
          uploadId,
          tempVideoPath,
          tempDir,
          deleteRemote: true,
        });
        return NextResponse.json({ error: 'Failed to merge chunks' }, { status: 500 });
      }
    } catch (error) {
      await cleanupUploadArtifacts({
        uploadId,
        tempVideoPath,
        tempDir,
        deleteRemote: true,
      });
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
