import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkUserCredits, getCreditPrice } from '@/lib/credits';
import { logApiError, logInfo } from '@/lib/logger';
import { ANALYSIS_MASTER_ACTION_TYPE } from '@/lib/analysis-master';

function createTaskId(projectId: string): string {
  return `analysis-${projectId}-${Date.now()}`;
}

async function triggerBackgroundProcessing(taskId: string, authHeader: string | null): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  fetch(`${baseUrl}/api/tasks/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ taskId }),
  }).catch(error => {
    console.error('[Analysis Master] 触发后台处理失败:', error);
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let projectId = '';
  let userId = '';

  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    userId = auth.userId;
    projectId = (await params).id;
    const client = getSupabaseClient();

    const { data: project, error: projectError } = await client
      .from('analysis_master_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: '分析项目不存在' }, { status: 404 });
    }

    if (!project.video_key && !project.video_url) {
      return NextResponse.json({ error: '项目缺少视频文件' }, { status: 400 });
    }

    const price = await getCreditPrice(ANALYSIS_MASTER_ACTION_TYPE);
    if (!price) {
      return NextResponse.json({ error: '分析大师积分价格未配置' }, { status: 500 });
    }

    const creditCheck = await checkUserCredits(auth.userId, price.creditsRequired);
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        { error: `积分不足，当前积分 ${creditCheck.balance}，需要 ${creditCheck.required} 积分` },
        { status: 402 }
      );
    }

    const { data: lockedProject, error: lockError } = await client
      .from('analysis_master_projects')
      .update({
        status: 'analyzing',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .neq('status', 'analyzing')
      .select('id, video_key, video_url')
      .single();

    if (lockError || !lockedProject) {
      return NextResponse.json({ error: '项目正在分析中，请稍后刷新结果' }, { status: 409 });
    }

    const taskId = createTaskId(projectId);
    const { data: task, error: taskError } = await client
      .from('task_queue')
      .insert({
        id: taskId,
        user_id: auth.userId,
        type: 'analysis',
        status: 'pending',
        params: {
          projectId,
          videoKey: lockedProject.video_key,
          videoUrl: lockedProject.video_url,
          actionType: ANALYSIS_MASTER_ACTION_TYPE,
          creditsRequired: price.creditsRequired,
        },
        project_id: projectId,
        retry_count: 0,
        max_retry: 1,
      })
      .select()
      .single();

    if (taskError) {
      await client
        .from('analysis_master_projects')
        .update({
          status: 'draft',
          error: '创建分析任务失败',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', auth.userId);

      logApiError('analysis-master/analyze', 'insert task', taskError, { projectId }, auth.userId);
      return NextResponse.json({ error: '创建分析任务失败，请稍后重试' }, { status: 500 });
    }

    triggerBackgroundProcessing(taskId, request.headers.get('authorization'));

    logInfo('api', '分析大师任务已入队', { projectId, taskId }, auth.userId);
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        taskId,
        status: 'analyzing',
        task,
      },
    });
  } catch (error) {
    logApiError('analysis-master/analyze', 'POST', error, { projectId }, userId);

    if (projectId && userId) {
      try {
        const client = getSupabaseClient();
        await client
          .from('analysis_master_projects')
          .update({
            status: 'failed',
            error: '分析失败',
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', userId);
      } catch {}
    }

    return NextResponse.json(
      { error: '分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
