import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ANALYSIS_MASTER_ACTION_TYPE } from '@/lib/analysis-master';
import { checkUserCredits, getCreditPrice } from '@/lib/credits';
import { INTERNAL_AUTH_HEADER, INTERNAL_AUTH_USER_ID } from '@/lib/auth-middleware';
import { logApiError } from '@/lib/logger';

export function createAnalysisTaskId(projectId: string): string {
  return `analysis-${projectId}-${Date.now()}`;
}

export function createAnalysisBatchTaskId(batchId: string): string {
  return `analysis-batch-${batchId}`;
}

export function createAnalysisBatchImportId(): string {
  return `am-batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildInternalTaskHeaders(userId: string): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer internal' });
  headers.set(INTERNAL_AUTH_HEADER, 'true');
  headers.set(INTERNAL_AUTH_USER_ID, userId);
  return headers;
}

export async function triggerBackgroundProcessing(taskId: string | null | undefined, userId: string, authHeader?: string | null, maxTasks = 10): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
  const headers = authHeader
    ? new Headers({ Authorization: authHeader, 'Content-Type': 'application/json' })
    : buildInternalTaskHeaders(userId);

  fetch(`${baseUrl}/api/tasks/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify(taskId ? { taskId } : { maxTasks }),
  }).catch(error => {
    console.error('[Analysis Master] 触发后台处理失败:', error);
  });
}

/**
 * 检查用户是否有正在执行的批量导入任务
 * @param client Supabase 客户端（由调用方传入以复用连接）
 * @returns running 状态的任务信息，不存在则返回 null
 */
export async function getRunningBatchImportTask(
  client: ReturnType<typeof getSupabaseClient>,
  userId: string
): Promise<{
  id: string;
  created_at: string;
} | null> {
  const { data, error } = await client
    .from('task_queue')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('type', 'analysis_batch_import')
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return { id: data.id, created_at: data.created_at };
}

export async function enqueueAnalysisTaskForProject(params: {
  projectId: string;
  userId: string;
  authHeader?: string | null;
  triggerProcessing?: boolean;
}): Promise<{ taskId: string }> {
  const client = getSupabaseClient();
  const { data: project, error: projectError } = await client
    .from('analysis_master_projects')
    .select('*')
    .eq('id', params.projectId)
    .eq('user_id', params.userId)
    .single();

  if (projectError || !project) {
    throw new Error('分析项目不存在');
  }

  if (!project.video_key && !project.video_url) {
    throw new Error('项目缺少视频文件');
  }

  const price = await getCreditPrice(ANALYSIS_MASTER_ACTION_TYPE);
  if (!price) {
    throw new Error('分析大师积分价格未配置');
  }

  const creditCheck = await checkUserCredits(params.userId, price.creditsRequired);
  if (!creditCheck.hasEnough) {
    throw new Error(`积分不足，当前积分 ${creditCheck.balance}，需要 ${creditCheck.required} 积分`);
  }

  const now = new Date().toISOString();
  const { data: lockedProject, error: lockError } = await client
    .from('analysis_master_projects')
    .update({
      status: 'analyzing',
      error: null,
      updated_at: now,
    })
    .eq('id', params.projectId)
    .eq('user_id', params.userId)
    .neq('status', 'analyzing')
    .select('id, video_key, video_url')
    .single();

  if (lockError || !lockedProject) {
    throw new Error('项目正在分析中，请稍后刷新结果');
  }

  const taskId = createAnalysisTaskId(params.projectId);
  const { error: taskError } = await client
    .from('task_queue')
    .insert({
      id: taskId,
      user_id: params.userId,
      type: 'analysis',
      status: 'pending',
      params: {
        projectId: params.projectId,
        videoKey: lockedProject.video_key,
        videoUrl: lockedProject.video_url,
        actionType: ANALYSIS_MASTER_ACTION_TYPE,
        creditsRequired: price.creditsRequired,
      },
      project_id: params.projectId,
      retry_count: 0,
      max_retry: 1,
    });

  if (taskError) {
    await client
      .from('analysis_master_projects')
      .update({
        status: 'draft',
        error: '创建分析任务失败',
        updated_at: now,
      })
      .eq('id', params.projectId)
      .eq('user_id', params.userId);

    logApiError('analysis-master/analyze', 'insert task', taskError, { projectId: params.projectId }, params.userId);
    throw new Error('创建分析任务失败，请稍后重试');
  }

  if (params.triggerProcessing !== false) {
    await triggerBackgroundProcessing(taskId, params.userId, params.authHeader);
  }

  return { taskId };
}
