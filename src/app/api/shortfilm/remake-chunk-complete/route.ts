import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { s3Storage } from '@/lib/s3-client';
import { logInfo } from '@/lib/logger';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SESSION_DIR = path.join(os.tmpdir(), 'upload-sessions');

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
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

    logInfo('api', '开始合并分片', { uploadId, key, totalChunks }, auth.userId);

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
    try {
      const tempVideoPath = path.join(tempDir, 'merged_video.mp4');
      fs.writeFileSync(tempVideoPath, mergedBuffer);
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        tempVideoPath,
      ]);
      const probeData = JSON.parse(stdout);
      videoDuration = Math.round(parseFloat(probeData.format?.duration || '0'));
      console.log(`[Shortfilm Chunk Complete] 视频时长: ${videoDuration}秒`);
    } catch (e) {
      console.warn('[Shortfilm Chunk Complete] 获取视频时长失败:', (e as Error).message);
    }

    const s3Key = await s3Storage.uploadFile({
      fileContent: mergedBuffer,
      fileName: key as string,
      contentType: 'video/mp4',
    });

    let url = '';
    try {
      url = await s3Storage.generatePresignedUrl({
        key: s3Key,
        expireTime: URL_EXPIRE_TIME,
      });
    } catch (e) {
      console.log(`[Shortfilm Chunk Complete] Generate URL failed (non-critical):`, e);
    }

    if (projectId) {
      const client = getSupabaseClient();
      const updateData: Record<string, unknown> = {
        source_type: 'remake',
        source_video_key: s3Key,
        source_video_url: url,
        updated_at: new Date().toISOString(),
      };
      if (videoDuration > 0) {
        updateData.video_duration = videoDuration;
      }
      const { error: updateError } = await client
        .from('shortfilm_projects')
        .update(updateData)
        .eq('id', projectId)
        .eq('user_id', auth.userId);

      if (updateError) {
        console.error('[Shortfilm Chunk Complete] 更新项目失败:', updateError);
      }
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    deleteSession(uploadId);

    logInfo('api', '分片上传完成', { uploadId, key: s3Key, projectId }, auth.userId);

    return NextResponse.json({
      success: true,
      key: s3Key,
      url,
      projectId,
      fileSize: mergedBuffer.length,
      videoDuration,
    });
  } catch (error) {
    console.error('[Shortfilm Chunk Complete] Error:', error);
    return NextResponse.json({ error: '完成上传失败' }, { status: 500 });
  }
}
