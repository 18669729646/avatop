import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取脚本生成任务状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('script_tasks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('[Script Task API] 查询失败:', error);
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        projectId: data.project_id,
        status: data.status,
        requestParams: data.request_params,
        result: data.result,
        rawResponse: data.raw_response, // 新增：返回完整的LLM响应内容
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: data.completed_at,
      }
    });
  } catch (error) {
    console.error('[Script Task API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询任务失败' },
      { status: 500 }
    );
  }
}

// 删除任务（清理）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('script_tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Script Task API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除任务失败' },
      { status: 500 }
    );
  }
}
