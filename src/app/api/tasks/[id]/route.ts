import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { broadcastTaskUpdate } from '@/lib/task-events';
import { filterTaskForUser } from '@/lib/task-security';
import { s3Storage } from '@/lib/s3-client';
import { logStorageError, logApiError, errorResponse } from '@/lib/logger';

function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

async function deleteS3File(key: string, taskId?: string, userId?: string): Promise<boolean> {
  if (!key) return false;

  try {
    const success = await s3Storage.deleteFile(key);
    if (success) {
      console.log(`[Task API] 成功删除 S3 文件: ${key}`);
    } else {
      console.error(`[Task API] 删除 S3 文件失败: ${key}`);
      logStorageError('删除文件', new Error('deleteFile returned false'), {
        key,
        taskId,
        userId,
      }, userId);
    }
    return success;
  } catch (error) {
    console.error(`[Task API] 删除 S3 文件失败: ${key}`, error);
    logStorageError('删除文件', error, {
      key,
      taskId,
      userId,
    }, userId);
    return false;
  }
}

// 从任务结果中提取并删除 S3 文件
async function deleteTaskFiles(
  result: Record<string, unknown> | null,
  results: Record<string, unknown>[] | null,
  params: Record<string, unknown> | null,
  taskId?: string,
  userId?: string
): Promise<void> {
  const urls: string[] = [];
  
  // 从参数中提取参考图
  if (params) {
    if (params.images && typeof params.images === 'string') {
      urls.push(params.images as string);
    }
    if (params.images && Array.isArray(params.images)) {
      (params.images as string[]).forEach(img => {
        if (typeof img === 'string') urls.push(img);
      });
    }
    if (params.startFrameUrl && typeof params.startFrameUrl === 'string') {
      urls.push(params.startFrameUrl as string);
    }
    if (params.endFrameUrl && typeof params.endFrameUrl === 'string') {
      urls.push(params.endFrameUrl as string);
    }
  }
  
  // 从单个结果中提取 URL
  if (result) {
    if (result.url && typeof result.url === 'string') {
      urls.push(result.url);
    }
    if (result.videoUrl && typeof result.videoUrl === 'string') {
      urls.push(result.videoUrl);
    }
    if (result.thumbnailUrl && typeof result.thumbnailUrl === 'string') {
      urls.push(result.thumbnailUrl);
    }
  }
  
  // 从多个结果中提取 URL
  if (results && Array.isArray(results)) {
    for (const r of results) {
      if (r.url && typeof r.url === 'string') {
        urls.push(r.url);
      }
      if (r.videoUrl && typeof r.videoUrl === 'string') {
        urls.push(r.videoUrl);
      }
      if (r.thumbnailUrl && typeof r.thumbnailUrl === 'string') {
        urls.push(r.thumbnailUrl);
      }
    }
  }
  
  // 删除所有文件
  for (const url of urls) {
    const key = extractKeyFromUrl(url);
    if (key) {
      await deleteS3File(key, taskId, userId);
    }
  }
}

// 获取单个任务（用户数据隔离）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    const client = getSupabaseClient();
    
    // 只能查看自己的任务
    const { data, error } = await client
      .from('task_queue')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    // 根据用户角色过滤敏感信息
    const filteredData = filterTaskForUser(data, auth.success ? auth.payload.role : undefined);
    
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    return errorResponse('tasks/[id]', 'GET', error, auth?.success ? auth.userId : undefined, { taskId: id });
  }
}

// 更新任务状态（只能更新自己的任务）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    const body = await request.json();
    const { status, result, results, error: taskError, startedAt, completedAt, retryCount } = body;
    
    const client = getSupabaseClient();
    
    // 先获取当前任务信息（用于 retryCount 增量更新和广播事件）
    const { data: currentTask } = await client
      .from('task_queue')
      .select('id, type, project_id, retry_count')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (!currentTask) {
      return NextResponse.json({ error: '任务不存在或无权限' }, { status: 404 });
    }
    
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (result !== undefined) updateData.result = result;
    if (results !== undefined) updateData.results = results;
    if (taskError !== undefined) updateData.error = taskError;
    // 转换时间戳格式：数字转为 ISO 字符串
    if (startedAt !== undefined) {
      updateData.started_at = typeof startedAt === 'number' 
        ? new Date(startedAt).toISOString() 
        : startedAt;
    }
    if (completedAt !== undefined) {
      updateData.completed_at = typeof completedAt === 'number' 
        ? new Date(completedAt).toISOString() 
        : completedAt;
    }
    
    // 处理 retryCount 增量更新
    if (retryCount?.increment) {
      updateData.retry_count = (currentTask.retry_count || 0) + 1;
    }
    
    // 只能更新自己的任务
    const { data, error } = await client
      .from('task_queue')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();
    
    if (error) {
      console.error('[Task API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '任务不存在或无权限' }, { status: 404 });
    }
    
    // 广播任务状态更新（用于 SSE 推送）
    if (status && ['pending', 'running', 'success', 'failed'].includes(status)) {
      broadcastTaskUpdate({
        taskId: id,
        type: data.type as 'image' | 'video' | 'script',
        status: status as 'pending' | 'running' | 'success' | 'failed',
        projectId: data.project_id || undefined,
        error: taskError || undefined,
      });
      console.log(`[Task API] 广播任务状态更新: ${id} -> ${status}`);
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse('tasks/[id]', 'PATCH', error, auth?.success ? auth.userId : undefined, { taskId: id });
  }
}

// 删除任务（只能删除自己的任务，同时删除 S3 文件）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    const client = getSupabaseClient();
    
    // 先获取任务信息，删除 S3 文件，再删除数据库记录
    const { data: task } = await client
      .from('task_queue')
      .select('params, result, results')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (task) {
      // 删除任务关联的 S3 文件（包括参考图和生成结果）
      await deleteTaskFiles(
        task.result as Record<string, unknown> | null,
        task.results as Record<string, unknown>[] | null,
        task.params as Record<string, unknown> | null,
        id,
        auth.userId
      );

      // 删除历史记录表中的对应记录
      // image_history 和 video_history 使用 task.id 作为主键
      await client.from('image_history').delete().eq('id', id).eq('user_id', auth.userId);
      await client.from('video_history').delete().eq('id', id).eq('user_id', auth.userId);
      console.log(`[Task API] 已删除任务 ${id} 的历史记录`);
    }

    // 删除数据库记录
    const { error } = await client
      .from('task_queue')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);
    
    if (error) {
      console.error('[Task API] 删除失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('tasks/[id]', 'DELETE', error, auth?.success ? auth.userId : undefined, { taskId: id });
  }
}
