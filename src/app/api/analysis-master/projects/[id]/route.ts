import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { s3Storage } from '@/lib/s3-client';
import { logApiError, logInfo } from '@/lib/logger';
import { buildAnalysisMasterProjectStatusPatch } from '@/lib/analysis-master-projects';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let projectId: string | undefined;

  try {
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    projectId = (await params).id;
    const body = await request.json();
    const client = getSupabaseClient();

    const { data: project, error: fetchError } = await client
      .from('analysis_master_projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const patch = buildAnalysisMasterProjectStatusPatch({
      status: typeof body.status === 'string' ? body.status : 'draft',
      error: typeof body.error === 'string' ? body.error : null,
      now: new Date().toISOString(),
    });

    const { data, error } = await client
      .from('analysis_master_projects')
      .update(patch)
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .select('*')
      .single();

    if (error || !data) {
      logApiError('analysis-master/projects/[id]', 'PUT update', error, { projectId }, auth.userId);
      return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
    }

    logInfo('api', '分析大师项目状态已更新', { projectId, status: data.status }, auth.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logApiError('analysis-master/projects/[id]', 'PUT', error, { projectId }, auth?.success ? auth.userId : undefined);
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/analysis-master/projects/[id]
 * 删除分析大师项目：清理 S3 文件 + 数据库记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let projectId: string | undefined;

  try {
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    projectId = (await params).id;
    const client = getSupabaseClient();

    // 获取项目信息，验证所有权
    const { data: project, error: fetchError } = await client
      .from('analysis_master_projects')
      .select('id, video_key, audio_key, user_id')
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 1. 删除 S3 视频文件
    if (project.video_key) {
      try {
        await s3Storage.deleteFile(project.video_key);
        logInfo('api', '分析大师项目 S3 文件已删除', { projectId, videoKey: project.video_key }, auth.userId);
      } catch (deleteErr) {
        logApiError('analysis-master/projects/[id]', 'deleteFile video', deleteErr, { projectId }, auth.userId);
      }
    }

    // 1.5 删除 S3 音频文件
    if (project.audio_key) {
      try {
        await s3Storage.deleteFile(project.audio_key);
        logInfo('api', '分析大师音频文件已删除', { projectId, audioKey: project.audio_key }, auth.userId);
      } catch (deleteErr) {
        logApiError('analysis-master/projects/[id]', 'deleteFile audio', deleteErr, { projectId }, auth.userId);
      }
    }

    // 2. 删除关联的任务队列记录（type='analysis'）
    await client
      .from('task_queue')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', auth.userId);

    // 3. 删除数据库项目记录
    const { error: deleteError } = await client
      .from('analysis_master_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', auth.userId);

    if (deleteError) {
      logApiError('analysis-master/projects/[id]', 'delete project', deleteError, { projectId }, auth.userId);
      return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
    }

    logInfo('api', '分析大师项目已删除', { projectId }, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('analysis-master/projects/[id]', 'DELETE', error, { projectId }, auth?.success ? auth.userId : undefined);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
