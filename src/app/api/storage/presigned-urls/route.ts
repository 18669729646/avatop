import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { s3Storage } from '@/lib/s3-client';

/**
 * 批量获取签名 URL
 * 支持两种模式：
 * 1. keys: 批量获取已存在文件的下载签名 URL
 * 2. files: 批量获取上传签名 URL（用于上传新文件）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keys, files, expireTime = URL_EXPIRE_TIME } = body; // 默认1年

    // 模式1: 获取上传签名 URL
    if (files && Array.isArray(files) && files.length > 0) {
      const results: Array<{ key: string; url: string }> = [];
      
      for (const file of files) {
        const { key, contentType } = file;
        
        if (!key) continue;
        
        try {
          // 生成预签名 URL（SDK 只支持下载签名）
          const url = await s3Storage.generatePresignedUrl({
            key,
            expireTime,
          });
          
          results.push({ key, url });
        } catch (error) {
          console.error(`[Presigned-URLs] Failed to generate upload URL for key: ${key}`, error);
          results.push({ key, url: '' });
        }
      }
      
      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    // 模式2: 获取下载签名 URL
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'keys 或 files 参数不能为空' },
        { status: 400 }
      );
    }

    // 过滤掉无效的 key（如 base64 数据或 URL）
    const validKeys = keys.filter(key => {
      if (!key) return false;
      if (key.startsWith('data:')) return false; // base64
      if (key.startsWith('http')) return false; // 已经是 URL
      return true;
    });

    // 批量生成签名 URL
    const urlMap: Record<string, string> = {};
    
    await Promise.all(
      validKeys.map(async (key: string) => {
        try {
          const url = await s3Storage.generatePresignedUrl({
            key,
            expireTime,
          });
          urlMap[key] = url;
        } catch (error) {
          console.error(`[Presigned-URLs] Failed to generate URL for key: ${key}`, error);
          urlMap[key] = ''; // 失败时返回空字符串
        }
      })
    );

    return NextResponse.json({
      success: true,
      urlMap,
    });
  } catch (error) {
    console.error('[Presigned-URLs] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取签名 URL 失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
