import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const DEFAULT_CONFIG = {
  maxConcurrent: 3,
  retryDelay: 5000,
  maxRetry: 5,
  taskTimeout: 600000, // 10分钟
  autoStart: true,
};

// 获取队列配置
export async function GET() {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('queue_config')
      .select('*')
      .eq('id', 'default')
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Queue Config API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      // 返回默认值
      return NextResponse.json({ data: { id: 'default', ...DEFAULT_CONFIG } });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        maxConcurrent: data.max_concurrent,
        retryDelay: data.retry_delay,
        maxRetry: data.max_retry,
        taskTimeout: data.task_timeout,
        autoStart: data.auto_start,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    console.error('[Queue Config API] 获取失败:', error);
    return NextResponse.json({ error: '获取队列配置失败' }, { status: 500 });
  }
}

// 更新队列配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxConcurrent, retryDelay, maxRetry, taskTimeout, autoStart } = body;
    
    const client = getSupabaseClient();
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (maxConcurrent !== undefined) updateData.max_concurrent = maxConcurrent;
    if (retryDelay !== undefined) updateData.retry_delay = retryDelay;
    if (maxRetry !== undefined) updateData.max_retry = maxRetry;
    if (taskTimeout !== undefined) updateData.task_timeout = taskTimeout;
    if (autoStart !== undefined) updateData.auto_start = autoStart;
    
    // 使用 upsert
    const { data, error } = await client
      .from('queue_config')
      .upsert({
        id: 'default',
        ...updateData,
      }, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      console.error('[Queue Config API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        maxConcurrent: data.max_concurrent,
        retryDelay: data.retry_delay,
        maxRetry: data.max_retry,
        taskTimeout: data.task_timeout,
        autoStart: data.auto_start,
      }
    });
  } catch (error) {
    console.error('[Queue Config API] 更新失败:', error);
    return NextResponse.json({ error: '更新队列配置失败' }, { status: 500 });
  }
}
