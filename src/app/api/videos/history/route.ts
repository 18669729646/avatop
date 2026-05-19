import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Storage } from '@/lib/s3-client';
import { logStorageError, errorResponse } from '@/lib/logger';

// 从 URL 中提取存储 key
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

// 删除 S3 文件
async function deleteS3File(key: string, userId?: string): Promise<boolean> {
  if (!key) return false;

  try {
    await s3Storage.deleteFile(key);
    return true;
  } catch (error) {
    console.error(`删除 S3 文件失败: ${key}`, error);
    return false;
  }
}

// 获取视频历史（用户数据隔离）
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const client = getSupabaseClient();
    
    // 只查询当前用户的记录
    const { data, error } = await client
      .from('video_history')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[Video History API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      url: item.url,
      prompt: item.prompt,
      aspectRatio: item.aspect_ratio,
      duration: item.duration,
      fileSize: item.file_size,
      createdAt: item.created_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse('videos/history', 'GET', error);
  }
}

// 添加视频到历史（关联用户）
export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { id, url, prompt, aspectRatio, duration, fileSize } = body;
    
    if (!url || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const taskId = id || `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 插入时关联用户
    const { data, error } = await client
      .from('video_history')
      .insert({
        id: taskId,
        user_id: auth.userId,
        url,
        prompt,
        aspect_ratio: aspectRatio,
        duration,
        file_size: fileSize,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Video History API] 添加失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        url: data.url,
        prompt: data.prompt,
        aspectRatio: data.aspect_ratio,
        duration: data.duration,
        fileSize: data.file_size,
        createdAt: data.created_at,
      }
    });
  } catch (error) {
    return errorResponse('videos/history', 'POST', error, auth?.success ? auth.userId : undefined);
  }
}

// 删除视频历史（只能删除自己的，同时删除 S3 文件）
export async function DELETE(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    const client = getSupabaseClient();
    
    if (id) {
      // 删除单条：先获取记录，删除 S3 文件，再删除数据库记录
      const { data: record } = await client
        .from('video_history')
        .select('url, key')
        .eq('id', id)
        .eq('user_id', auth.userId)
        .single();
      
      if (record) {
        // 删除 S3 文件
        const key = record.key || extractKeyFromUrl(record.url);
        if (key) {
          await deleteS3File(key, auth.userId);
        }
      }
      
      const { error } = await client
        .from('video_history')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // 清空当前用户的所有记录：先获取所有记录，删除 S3 文件，再删除数据库记录
      const { data: records } = await client
        .from('video_history')
        .select('url, key')
        .eq('user_id', auth.userId);
      
      if (records && records.length > 0) {
        // 批量删除 S3 文件
        for (const record of records) {
          const key = record.key || extractKeyFromUrl(record.url);
          if (key) {
            await deleteS3File(key, auth.userId);
          }
        }
      }
      
      const { error } = await client
        .from('video_history')
        .delete()
        .eq('user_id', auth.userId);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('videos/history', 'DELETE', error, auth?.success ? auth.userId : undefined);
  }
}
