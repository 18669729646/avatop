import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 带乐观锁的状态更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, result, results, error: taskError, startedAt, completedAt, expectedStatus } = body;
    
    const client = getSupabaseClient();
    
    // 先获取当前任务状态
    const { data: currentTask, error: fetchError } = await client
      .from('task_queue')
      .select('status')
      .eq('id', id)
      .single();
    
    if (fetchError || !currentTask) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    // 检查状态是否符合预期（乐观锁）
    if (expectedStatus && currentTask.status !== expectedStatus) {
      return NextResponse.json({ 
        error: `任务状态已变更为 ${currentTask.status}，无法更新`,
        currentStatus: currentTask.status,
      }, { status: 409 });
    }
    
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (result !== undefined) updateData.result = result;
    if (results !== undefined) updateData.results = results;
    if (taskError !== undefined) updateData.error = taskError;
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
    
    const { data, error } = await client
      .from('task_queue')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[Task Status API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Task Status API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新任务失败' },
      { status: 500 }
    );
  }
}
