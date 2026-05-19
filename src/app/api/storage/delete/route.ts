import { NextRequest, NextResponse } from 'next/server';
import { s3Storage } from '@/lib/s3-client';
import { errorResponse, logStorageError } from '@/lib/logger';

/**
 * 删除对象存储文件 API
 * 支持批量删除多个文件
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'keys 参数不能为空' },
        { status: 400 }
      );
    }

    const results: Array<{ key: string; success: boolean; error?: string }> = [];

    for (const key of keys) {
      if (!key) {
        results.push({ key: key || '', success: false, error: 'key 为空' });
        continue;
      }

      try {
        const success = await s3Storage.deleteFile(key);
        if (success) {
          results.push({ key, success: true });
          console.log(`[Storage Delete] 成功删除文件: ${key}`);
        } else {
          results.push({ key, success: false, error: '删除失败' });
          console.error(`[Storage Delete] 删除文件失败: ${key}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        results.push({ key, success: false, error: errorMessage });
        console.error(`[Storage Delete] 删除文件失败: ${key}`, errorMessage);
        logStorageError('删除文件', error, {
          key,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return Response.json({
      success: true,
      data: {
        total: keys.length,
        successCount,
        failCount,
        results,
      },
    });
  } catch (error) {
    return errorResponse('storage/delete', 'POST', error);
  }
}
