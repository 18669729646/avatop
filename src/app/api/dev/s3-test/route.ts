import { NextRequest, NextResponse } from 'next/server';
import { s3Storage } from '@/lib/s3-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'dev-test-secret-123') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('=== S3 连接测试 ===');
    console.log('S3_INTERNAL_ENDPOINT_URL:', process.env.S3_INTERNAL_ENDPOINT_URL);
    console.log('S3_REGION:', process.env.S3_REGION);
    console.log('S3_ACCESS_KEY:', process.env.S3_ACCESS_KEY?.substring(0, 10) + '...');
    console.log('COZE_BUCKET_NAME:', process.env.COZE_BUCKET_NAME);

    const testContent = Buffer.from('Hello World');
    const testFileName = `test/${Date.now()}-hello.txt`;

    console.log('尝试上传文件...');
    const key = await s3Storage.uploadFile({
      fileContent: testContent,
      fileName: testFileName,
      contentType: 'text/plain',
    });

    console.log('上传成功！key:', key);

    const url = await s3Storage.generatePresignedUrl({
      key: key,
      expireTime: 3600,
    });

    console.log('签名 URL 生成成功:', url.substring(0, 100) + '...');

    await s3Storage.deleteFile(key);
    console.log('测试文件已删除');

    return NextResponse.json({
      success: true,
      message: 'S3 连接正常',
      testKey: key,
      testUrl: url,
    });
  } catch (error) {
    console.error('S3 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      details: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
