import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { authenticateRequest } from '@/lib/auth-middleware';

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

function saveSession(uploadId: string, session: Record<string, unknown>): void {
  fs.writeFileSync(getSessionFile(uploadId), JSON.stringify(session), 'utf-8');
}

export async function POST(request: NextRequest) {
  try {
    // 使用统一的认证函数，解码 JWT 获取真实 userId
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const uploadId = searchParams.get('uploadId');
    const chunkIndexStr = searchParams.get('chunkIndex');

    if (!uploadId || !chunkIndexStr) {
      return NextResponse.json({ error: `缺少参数: uploadId=${uploadId}, chunkIndex=${chunkIndexStr}` }, { status: 400 });
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (isNaN(chunkIndex)) {
      return NextResponse.json({ error: 'chunkIndex 无效' }, { status: 400 });
    }

    const session = loadSession(uploadId);
    if (!session) {
      return NextResponse.json({ error: `上传会话不存在或已过期: uploadId=${uploadId}` }, { status: 400 });
    }

    if (session.userId !== authResult.userId) {
      return NextResponse.json({ error: `无权限: sessionUserId=${session.userId}, tokenUserId=${authResult.userId}` }, { status: 403 });
    }

    const tempDir = session.tempDir as string;
    const chunkPath = path.join(tempDir, `chunk-${chunkIndex.toString().padStart(6, '0')}`);

    const buffer = Buffer.from(await request.arrayBuffer());
    fs.writeFileSync(chunkPath, buffer);

    const receivedChunks = (session.receivedChunks as number[]) || [];
    if (!receivedChunks.includes(chunkIndex)) {
      receivedChunks.push(chunkIndex);
      receivedChunks.sort((a, b) => a - b);
    }
    session.receivedChunks = receivedChunks;
    saveSession(uploadId, session);

    return NextResponse.json({
      success: true,
      received: receivedChunks.length,
      total: session.totalChunks,
    });
  } catch (error) {
    console.error('[AnalysisMaster Chunk Upload] Error:', error);
    return NextResponse.json({ error: '分片上传失败' }, { status: 500 });
  }
}
