import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 });
    }

    const session = loadSession(uploadId);
    if (!session) {
      return NextResponse.json({ success: true, message: '会话不存在，无需清理' });
    }

    if (session.userId !== auth.userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const tempDir = session.tempDir as string;
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    deleteSession(uploadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AnalysisMaster Chunk Abort] Error:', error);
    return NextResponse.json({ error: '取消上传失败' }, { status: 500 });
  }
}
