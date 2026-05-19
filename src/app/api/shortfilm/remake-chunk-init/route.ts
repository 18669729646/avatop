import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { logInfo } from '@/lib/logger';
import { checkStorageQuota } from '@/lib/storage-quota';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SESSION_DIR = path.join(os.tmpdir(), 'upload-sessions');

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function getSessionFile(uploadId: string): string {
  return path.join(SESSION_DIR, `${uploadId}.json`);
}

function saveSession(uploadId: string, session: Record<string, unknown>): void {
  fs.writeFileSync(getSessionFile(uploadId), JSON.stringify(session), 'utf-8');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { projectId, fileName, fileSize, chunkSize, totalChunks } = body;

    if (!projectId || !fileName || !fileSize) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const storageCheck = await checkStorageQuota(auth.userId);
    if (!storageCheck.allowed) {
      return NextResponse.json({ error: storageCheck.error }, { status: 507 });
    }

    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'mp4';
    const key = `video-remake/${auth.userId}/${projectId}/${timestamp}.${extension}`;

    const tempDir = path.join(os.tmpdir(), `upload-${uploadId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const session = {
      userId: auth.userId,
      projectId,
      fileName,
      fileSize,
      chunkSize,
      totalChunks,
      receivedChunks: [] as number[],
      tempDir,
      key,
      createdAt: Date.now(),
    };
    saveSession(uploadId, session);

    logInfo('api', '初始化分片上传', { uploadId, key, fileSize, totalChunks }, auth.userId);

    return NextResponse.json({
      success: true,
      uploadId,
      key,
      totalChunks,
    });
  } catch (error) {
    console.error('[Shortfilm Chunk Init] Error:', error);
    return NextResponse.json({ error: '初始化失败' }, { status: 500 });
  }
}
