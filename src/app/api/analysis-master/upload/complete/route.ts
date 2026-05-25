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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractAudioFromBuffer } from '../extract-audio';

import { promisify } from 'util';
import { execFile as execFileSync } from 'child_process';
const execFileAsync = promisify(execFileSync);

const SESSION_DIR = path.join(os.tmpdir(), 'am-upload-sessions');

function getSessionFile(uploadId: string): string {
  return path.join(SESSION_DIR, `${uploadId}.json`);
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

function loadSession(uploadId: string): Record<string, unknown> | null {
  const filePath = getSessionFile(uploadId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const session = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // 过期清理
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

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { uploadId, key } = body;

    if (!uploadId || !key) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const session = loadSession(uploadId);
    if (!session) {
      return NextResponse.json({ error: '上传会话不存在或已过期' }, { status: 400 });
    }

    if (session.userId !== auth.userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const receivedChunks = (session.receivedChunks as number[]) || [];
    const totalChunks = session.totalChunks as number;
    const projectId = session.projectId as string;

    if (receivedChunks.length !== totalChunks) {
      return NextResponse.json({
        error: '还有分片未上传',
        received: receivedChunks.length,
        total: totalChunks,
      }, { status: 400 });
    }

    logInfo('api', 'AnalysisMaster 开始合并分片', { uploadId, key, totalChunks }, auth.userId);

    const chunks: Buffer[] = [];
    const tempDir = session.tempDir as string;

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk-${i.toString().padStart(6, '0')}`);
      if (!fs.existsSync(chunkPath)) {
        return NextResponse.json({ error: `分片 ${i} 缺失` }, { status: 500 });
      }
      chunks.push(fs.readFileSync(chunkPath));
    }

    const mergedBuffer = Buffer.concat(chunks);

    let videoDuration = 0;
    let s3Key = '';
    let url = '';
    let tempVideoPath = '';

    try {
      // 写入临时视频文件用于 ffprobe
      tempVideoPath = path.join(tempDir, 'merged_video.mp4');
      fs.writeFileSync(tempVideoPath, mergedBuffer);

      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          tempVideoPath,
        ]);
        const probeData = JSON.parse(stdout);
        videoDuration = Math.round(parseFloat(probeData.format?.duration || '0'));
        console.log(`[AnalysisMaster Chunk Complete] 视频时长: ${videoDuration}秒`);
      } catch (e) {
        console.warn('[AnalysisMaster Chunk Complete] 获取视频时长失败:', (e as Error).message);
      }

      // 写入 S3
      s3Key = await s3Storage.uploadFile({
        fileContent: mergedBuffer,
        fileName: key as string,
        contentType: 'video/mp4',
      });

      // 生成预签名 URL（7天有效期）
      try {
        url = await s3Storage.generatePresignedUrl({
          key: s3Key,
          expireTime: URL_EXPIRE_TIME,
        });
      } catch (e) {
        console.log(`[AnalysisMaster Chunk Complete] 生成预签名 URL 失败（不影响结果）:`, e);
      }

      // 提取音频
      let audioKey = '';
      let audioUrl = '';
      let audioDuration = 0;
      let audioFileSize = 0;
      try {
        const audioResult = await extractAudioFromBuffer(mergedBuffer, auth.userId, projectId || uploadId);
        if (audioResult) {
          audioKey = audioResult.audioKey;
          audioDuration = audioResult.audioDuration || 0;
          audioFileSize = audioResult.audioFileSize || 0;

          // 音频提取后检查配额（含音频大小）
          const totalSize = mergedBuffer.length + audioFileSize;
          const storageCheck = await checkStorageQuota(auth.userId, totalSize);
          if (!storageCheck.allowed) {
            await s3Storage.deleteFile(s3Key).catch(() => false);
            await s3Storage.deleteFile(audioKey).catch(() => false);
            fs.unlinkSync(tempVideoPath);
            fs.rmSync(tempDir, { recursive: true, force: true });
            deleteSession(uploadId);
            return NextResponse.json({ error: storageCheck.error }, { status: 507 });
          }

          try {
            audioUrl = await s3Storage.generatePresignedUrl({ key: audioKey, expireTime: URL_EXPIRE_TIME });
          } catch (e) {
            console.log('[AnalysisMaster] 生成音频预签名 URL 失败:', e);
          }
          logInfo('api', 'AnalysisMaster 音频提取成功', { audioKey, duration: audioDuration, size: audioFileSize }, auth.userId);
        }
      } catch (e) {
        console.log('[AnalysisMaster] 音频提取失败（不影响主流程）:', e);
      }

      // 插入或更新项目记录
      if (projectId) {
        const client = getSupabaseClient();
        const upsertData: Record<string, unknown> = {
          id: projectId,
          user_id: auth.userId,
          name: (session.name as string) || (session.fileName as string) || '未命名项目',
          video_key: s3Key,
          video_url: url,
          status: 'draft',
          source_type: typeof session.sourceUrl === 'string' ? 'link' : 'upload',
          file_size: mergedBuffer.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (typeof session.sourceUrl === 'string') {
          upsertData.source_url = session.sourceUrl;
        }
        if (videoDuration > 0) {
          upsertData.video_duration = videoDuration;
        }
        if (audioKey) {
          upsertData.audio_key = audioKey;
          upsertData.audio_url = audioUrl;
          upsertData.audio_duration = audioDuration;
          upsertData.audio_file_size = audioFileSize;
        }
        const { error: upsertError } = await client
          .from('analysis_master_projects')
          .upsert(upsertData, { onConflict: 'id' });
        if (upsertError) {
          console.error('[AnalysisMaster Chunk Complete] 写入项目失败:', upsertError);
          // 清理已上传的 S3 文件
          if (s3Key) await s3Storage.deleteFile(s3Key).catch(() => false);
          if (audioKey) await s3Storage.deleteFile(audioKey).catch(() => false);
        }
      }

      // 清理临时文件
      const importRunId = typeof session.importRunId === 'string' ? session.importRunId : '';
      const importItemId = typeof session.importItemId === 'string' ? session.importItemId : '';
      if (importRunId && importItemId) {
        const client = getSupabaseClient();
        await client
          .from('analysis_master_import_items')
          .update(buildAnalysisMasterItemSuccessPatch({}))
          .eq('id', importItemId)
          .eq('run_id', importRunId)
          .eq('project_id', projectId)
          .eq('user_id', auth.userId);
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

      if (tempVideoPath) {
        fs.unlinkSync(tempVideoPath);
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
      deleteSession(uploadId);

      logInfo('api', 'AnalysisMaster 分片上传完成', { uploadId, s3Key, videoDuration }, auth.userId);

      return NextResponse.json({
        success: true,
        projectId,
        videoKey: s3Key,
        videoUrl: url,
        videoDuration,
      });
    } catch (error) {
      console.error('[AnalysisMaster Chunk Complete] Error:', error);
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      deleteSession(uploadId);
      return NextResponse.json({ error: '合并分片失败' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
