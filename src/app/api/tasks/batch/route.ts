import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { broadcastTaskUpdate } from '@/lib/task-events';
import { s3Storage } from '@/lib/s3-client';
import { isAdmin } from '@/lib/task-security';
import { pool } from '@/lib/db-pool';
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
      console.log(`[Tasks Batch API] 成功删除 S3 文件: ${key}`);
    } else {
      console.error(`[Tasks Batch API] 删除 S3 文件失败: ${key}`);
      logStorageError('删除文件', new Error('deleteFile returned false'), {
        key,
        taskId,
        userId,
      }, userId);
    }
    return success;
  } catch (error) {
    console.error(`[Tasks Batch API] 删除 S3 文件失败: ${key}`, error);
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

// 批量删除任务的 S3 文件
async function deleteTasksFiles(
  tasks: Array<{ 
    id: string;
    user_id: string;
    params: Record<string, unknown> | null;
    result: Record<string, unknown> | null; 
    results: Record<string, unknown>[] | null 
  }>
): Promise<void> {
  for (const task of tasks) {
    await deleteTaskFiles(task.result, task.results, task.params, task.id, task.user_id);
  }
}

// 异步触发服务端任务执行
async function triggerBackgroundProcessing(authHeader: string | null): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  
  fetch(`${baseUrl}/api/tasks/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ maxTasks: 3 }),
  }).catch(err => {
    console.error('[Tasks Batch API] 触发后台处理失败:', err);
  });
}

// 批量操作：清理任务、重试失败任务等
export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let action: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    action = body.action;
    const { taskIds } = body;
    
    const client = getSupabaseClient();
    
    switch (action) {
      case 'clearCompleted': {
        // 先获取要删除的任务，删除 S3 文件
        const { data: tasks } = await client
          .from('task_queue')
          .select('id, user_id, params, result, results')
          .eq('status', 'success')
          .eq('user_id', auth.userId);

        const taskIds = tasks?.map(t => t.id) || [];

        if (tasks && tasks.length > 0) {
          await deleteTasksFiles(tasks as Array<{
            id: string;
            user_id: string;
            params: Record<string, unknown> | null;
            result: Record<string, unknown> | null;
            results: Record<string, unknown>[] | null
          }>);
        }

        // 删除历史记录表中的对应记录
        if (taskIds.length > 0) {
          await client.from('image_history').delete().in('id', taskIds).eq('user_id', auth.userId);
          await client.from('video_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        }

        const { error } = await client
          .from('task_queue')
          .delete()
          .eq('status', 'success')
          .eq('user_id', auth.userId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: '已清理完成的任务' });
      }
      
      case 'clearFailed': {
        // 先获取要删除的任务，删除 S3 文件
        const { data: tasks } = await client
          .from('task_queue')
          .select('id, user_id, params, result, results')
          .eq('status', 'failed')
          .eq('user_id', auth.userId);

        const taskIds = tasks?.map(t => t.id) || [];

        if (tasks && tasks.length > 0) {
          await deleteTasksFiles(tasks as Array<{
            id: string;
            user_id: string;
            params: Record<string, unknown> | null;
            result: Record<string, unknown> | null;
            results: Record<string, unknown>[] | null
          }>);
        }

        // 删除历史记录表中的对应记录
        if (taskIds.length > 0) {
          await client.from('image_history').delete().in('id', taskIds).eq('user_id', auth.userId);
          await client.from('video_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        }

        const { error } = await client
          .from('task_queue')
          .delete()
          .eq('status', 'failed')
          .eq('user_id', auth.userId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: '已清理失败的任务' });
      }
      
      case 'clearAll': {
        // 先获取要删除的任务，删除 S3 文件
        const { data: tasks } = await client
          .from('task_queue')
          .select('id, user_id, params, result, results')
          .eq('user_id', auth.userId);

        const taskIds = tasks?.map(t => t.id) || [];

        if (tasks && tasks.length > 0) {
          await deleteTasksFiles(tasks as Array<{
            id: string;
            user_id: string;
            params: Record<string, unknown> | null;
            result: Record<string, unknown> | null;
            results: Record<string, unknown>[] | null
          }>);
        }

        // 删除历史记录表中的对应记录
        if (taskIds.length > 0) {
          await client.from('image_history').delete().in('id', taskIds).eq('user_id', auth.userId);
          await client.from('video_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        }

        const { error } = await client
          .from('task_queue')
          .delete()
          .eq('user_id', auth.userId); // 只删除当前用户的任务

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: '已清空所有任务' });
      }
      
      case 'retryFailed': {
        // 获取当前用户所有失败的任务
        const { data: failedTasks, error: fetchError } = await client
          .from('task_queue')
          .select('*')
          .eq('status', 'failed')
          .eq('user_id', auth.userId);
        
        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }
        
        if (!failedTasks || failedTasks.length === 0) {
          return NextResponse.json({ success: true, message: '没有失败的任务需要重试' });
        }
        
        // 批量更新为 pending 状态（只更新当前用户的）
        const { error: updateError } = await client
          .from('task_queue')
          .update({
            status: 'pending',
            error: null,
            started_at: null,
            completed_at: null,
          })
          .eq('status', 'failed')
          .eq('user_id', auth.userId);
        
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        // 广播每个任务的状态更新
        for (const task of failedTasks) {
          broadcastTaskUpdate({
            taskId: task.id,
            type: task.type as 'image' | 'video' | 'script',
            status: 'pending',
            projectId: task.project_id || undefined,
          });
        }
        console.log(`[Tasks Batch API] 广播 ${failedTasks.length} 个任务状态更新: failed -> pending`);
        
        // 触发服务端任务执行
        triggerBackgroundProcessing(request.headers.get('authorization'));
        
        return NextResponse.json({ 
          success: true, 
          message: `已重试 ${failedTasks.length} 个失败任务` 
        });
      }
      
      case 'deleteMany': {
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
          return NextResponse.json({ error: '请提供要删除的任务ID' }, { status: 400 });
        }

        // 先获取要删除的任务，删除 S3 文件
        const { data: tasks } = await client
          .from('task_queue')
          .select('id, user_id, params, result, results')
          .in('id', taskIds)
          .eq('user_id', auth.userId);

        if (tasks && tasks.length > 0) {
          await deleteTasksFiles(tasks as Array<{
            id: string;
            user_id: string;
            params: Record<string, unknown> | null;
            result: Record<string, unknown> | null;
            results: Record<string, unknown>[] | null
          }>);
        }

        // 删除历史记录表中的对应记录
        await client.from('image_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        await client.from('video_history').delete().in('id', taskIds).eq('user_id', auth.userId);

        const { error } = await client
          .from('task_queue')
          .delete()
          .in('id', taskIds)
          .eq('user_id', auth.userId); // 只能删除自己的任务

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: `已删除 ${taskIds.length} 个任务` });
      }
      
      case 'retryTask': {
        const { taskId } = body;
        if (!taskId) {
          return NextResponse.json({ error: '请提供任务ID' }, { status: 400 });
        }
        
        // 获取任务当前状态（只查询当前用户的）
        const { data: task, error: fetchError } = await client
          .from('task_queue')
          .select('*')
          .eq('id', taskId)
          .eq('user_id', auth.userId)
          .single();
        
        if (fetchError || !task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 });
        }
        
        // 更新为 pending 状态
        const { error: updateError } = await client
          .from('task_queue')
          .update({
            status: 'pending',
            error: null,
            started_at: null,
            completed_at: null,
            retry_count: (task.retry_count || 0) + 1,
          })
          .eq('id', taskId)
          .eq('user_id', auth.userId);
        
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        // 触发服务端任务执行
        triggerBackgroundProcessing(request.headers.get('authorization'));
        
        return NextResponse.json({ success: true, message: '任务已重新加入队列' });
      }
      
      case 'recoverZombie': {
        // 处理僵尸任务（running 状态但已超时的任务）
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
          return NextResponse.json({ error: '请提供要处理的任务ID' }, { status: 400 });
        }
        
        // 批量将僵尸任务标记为 failed（只处理当前用户的）
        const { error: updateError } = await client
          .from('task_queue')
          .update({
            status: 'failed',
            error: '任务执行超时',
            completed_at: new Date().toISOString(),
          })
          .in('id', taskIds)
          .eq('user_id', auth.userId);
        
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `已将 ${taskIds.length} 个超时任务标记为失败` 
        });
      }
      
      default:
        return NextResponse.json({ error: '未知的操作类型' }, { status: 400 });
    }
  } catch (error) {
    return errorResponse('tasks/batch', 'POST', error, auth?.success ? auth.userId : undefined, { action });
  }
}

// 获取任务统计信息（用户数据隔离，管理员可查看所有）
export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const isUserAdmin = isAdmin(auth.payload.role);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // 管理员筛选特定用户
    
    // 使用 PostgreSQL 直接查询，管理员可查看所有
    let sqlQuery = `
      SELECT status, COUNT(*) as count
      FROM task_queue
    `;
    
    const conditions: string[] = [];
    const params: string[] = [];
    
    // 非管理员只能查看自己的统计
    if (!isUserAdmin) {
      conditions.push(`user_id = $1`);
      params.push(auth.userId);
    } else if (userId) {
      // 管理员可以筛选特定用户
      conditions.push(`user_id = $1`);
      params.push(userId);
    }
    
    if (conditions.length > 0) {
      sqlQuery += ` WHERE ` + conditions.join(' AND ');
    }
    
    sqlQuery += ` GROUP BY status`;
    
    const result = await pool.query(sqlQuery, params);
    
    // 汇总统计
    const stats = {
      total: 0,
      pending: 0,
      running: 0,
      retrying: 0,
      success: 0,
      failed: 0,
    };
    
    for (const row of result.rows) {
      const count = parseInt(row.count);
      stats.total += count;
      
      if (row.status === 'pending') stats.pending = count;
      else if (row.status === 'running') stats.running = count;
      else if (row.status === 'retrying') stats.retrying = count;
      else if (row.status === 'success') stats.success = count;
      else if (row.status === 'failed') stats.failed = count;
    }
    
    return NextResponse.json({ 
      data: stats,
      isAdmin: isUserAdmin,
    });
  } catch (error) {
    return errorResponse('tasks/batch/stats', 'GET', error, auth?.success ? auth.userId : undefined);
  }
}
