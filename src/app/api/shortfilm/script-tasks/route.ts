import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateId } from '@/lib/shortfilm';

// 获取项目的脚本任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status'); // 支持按状态筛选
    
    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    let query = client
      .from('script_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 支持多状态筛选
    if (status) {
      const statuses = status.split(',');
      query = query.in('status', statuses);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Script Tasks API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const result = (data || []).map(task => ({
      id: task.id,
      projectId: task.project_id,
      status: task.status,
      requestParams: task.request_params,
      result: task.result,
      errorMessage: task.error_message,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Script Tasks API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询任务失败' },
      { status: 500 }
    );
  }
}

// 创建新的脚本任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, requestParams } = body;
    
    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    const taskId = generateId();
    
    const { data, error } = await client
      .from('script_tasks')
      .insert({
        id: taskId,
        project_id: projectId,
        status: 'pending',
        request_params: requestParams || {},
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Script Tasks API] 创建任务失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        projectId: data.project_id,
        status: data.status,
        createdAt: data.created_at,
      }
    });
  } catch (error) {
    console.error('[Script Tasks API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建任务失败' },
      { status: 500 }
    );
  }
}
