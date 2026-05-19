import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_INTERNAL_ENDPOINT_URL || process.env.COZE_BUCKET_ENDPOINT_URL,
  region: process.env.S3_REGION || 'cn-beijing',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.COZE_BUCKET_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || process.env.COZE_BUCKET_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.COZE_BUCKET_NAME || 'avatop';

function normalizeKey(key: string): string {
  return key.replace(/\\/g, '/');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'key 参数不能为空' }, { status: 400 });
    }

    if (key.startsWith('http') || key.startsWith('data:')) {
      return NextResponse.json({ error: '无效的 key 格式' }, { status: 400 });
    }

    const normalizedKey = normalizeKey(key);

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: normalizedKey,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    const contentType = response.ContentType || 'application/octet-stream';
    const body = await response.Body.transformToByteArray();
    const buffer = Buffer.from(body);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('NoSuchKey') || message.includes('404')) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }
    console.error('[Storage Serve] error:', error);
    return NextResponse.json({ error: '读取文件失败' }, { status: 500 });
  }
}
