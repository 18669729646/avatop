import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { logInfo } from '@/lib/logger';
import { checkStorageQuota } from '@/lib/storage-quota';
import { buildAnalysisMasterUploadInitSession } from '@/lib/analysis-master-upload-session';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SESSION_DIR = path.join(os.tmpdir(), 'am-upload-sessions');

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

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
    const { fileName, fileSize, chunkSize, totalChunks, name, sourceUrl } = body;

    if (!fileName || !fileSize) {
      console.error('[init] 缺少参数:', { fileName, fileSize, bodyKeys: Object.keys(body) });
      return NextResponse.json({ error: `缺少必要参数: fileName=${fileName}, fileSize=${fileSize}` }, { status: 400 });
    }

    // 100MB limit
    const MAX_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: `文件大小不能超过 100MB` }, { status: 400 });
    }

    const initSession = buildAnalysisMasterUploadInitSession({
      userId: auth.userId,
      fileName,
      fileSize,
      chunkSize,
      totalChunks,
      name,
      sourceUrl,
      projectId: typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : undefined,
      now: typeof body.now === 'string' ? body.now : undefined,
    });
    const { uploadId, projectId, key, tempDir, session } = initSession;

    fs.mkdirSync(tempDir, { recursive: true });

    const storageCheck = await checkStorageQuota(auth.userId, fileSize);
    if (!storageCheck.allowed) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return NextResponse.json({ error: storageCheck.error }, { status: 507 });
    }

    saveSession(uploadId, session);

    logInfo('api', 'AnalysisMaster 分片上传初始化', { uploadId, key, fileSize, totalChunks }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        uploadId,
        projectId,
        key,
        totalChunks,
      },
    });
  } catch (error) {
    console.error('[AnalysisMaster Chunk Init] Error:', error);
    return NextResponse.json({ error: '初始化失败' }, { status: 500 });
  }
}
