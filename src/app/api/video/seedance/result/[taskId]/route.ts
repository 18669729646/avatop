import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-middleware';
import { logApiError } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: task, error } = await supabase
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', auth.userId)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 过滤敏感参数
    const rawParams = task.params || {};
    const safeParams: Record<string, unknown> = { ...rawParams };
    delete safeParams.apiKey;

    return NextResponse.json({
      taskId,
      status: task.status,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      result: task.result,
      error: task.error,
      model: safeParams.model || safeParams.videoModel,
      duration: safeParams.duration,
      resolution: safeParams.resolution,
      creditsRequired: safeParams.credits_required,
    });

  } catch (error) {
    logApiError('seedance/result', '查询任务', error as Error, {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
