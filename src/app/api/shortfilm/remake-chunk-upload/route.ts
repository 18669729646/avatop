import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
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

function loadSession(uploadId: string): Record<string, unknown> | null {
  const filePath = getSessionFile(uploadId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File | null;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);

    if (!chunk || !uploadId || isNaN(chunkIndex)) {
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

    if (receivedChunks.includes(chunkIndex)) {
      return NextResponse.json({
        success: true,
        chunkIndex,
        message: '分片已上传',
      });
    }

    const tempDir = session.tempDir as string;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const chunkPath = path.join(tempDir, `chunk-${chunkIndex.toString().padStart(6, '0')}`);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    fs.writeFileSync(chunkPath, buffer);

    receivedChunks.push(chunkIndex);
    session.receivedChunks = receivedChunks;
    saveSession(uploadId, session);

    console.log(`[Shortfilm Chunk Upload] Received chunk ${chunkIndex + 1}/${session.totalChunks}, total received: ${receivedChunks.length}`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      received: receivedChunks.length,
      total: session.totalChunks,
    });
  } catch (error) {
    console.error('[Shortfilm Chunk Upload] Error:', error);
    return NextResponse.json({ error: '上传分片失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');

    if (!uploadId) {
      return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 });
    }

    const session = loadSession(uploadId);
    if (!session) {
      return NextResponse.json({ error: '上传会话不存在' }, { status: 404 });
    }

    if (session.userId !== auth.userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const receivedChunks = (session.receivedChunks as number[]) || [];

    return NextResponse.json({
      success: true,
      received: receivedChunks.length,
      total: session.totalChunks,
      isComplete: receivedChunks.length === session.totalChunks,
    });
  } catch (error) {
    console.error('[Shortfilm Chunk Status] Error:', error);
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 });
  }
}
