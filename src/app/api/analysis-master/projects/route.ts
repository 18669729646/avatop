import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { s3Storage } from '@/lib/s3-client';
import { logApiError, logInfo } from '@/lib/logger';

/**
 * DELETE /api/analysis-master/projects
 * 一键删除所有分析大师项目：清理 S3 文件 + 任务队列 + 数据库记录
 */
export async function DELETE(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;

  try {
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const client = getSupabaseClient();

    // 1. 获取用户所有项目
    const { data: projects, error: fetchError } = await client
      .from('analysis_master_projects')
      .select('id, video_key, audio_key')
      .eq('user_id', auth.userId);

    if (fetchError) {
      logApiError('analysis-master/projects', 'DELETE fetch', fetchError, {}, auth.userId);
      return NextResponse.json({ error: '查询项目失败' }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const projectIds = projects.map((p: { id: string }) => p.id);
    let deletedFiles = 0;
    let failedFiles = 0;

    // 2. 逐个删除 S3 文件（视频 + 音频）
    for (const project of projects) {
      if (project.video_key) {
        try {
          await s3Storage.deleteFile(project.video_key);
          deletedFiles++;
        } catch (deleteErr) {
          failedFiles++;
          logApiError('analysis-master/projects', 'deleteFile video', deleteErr, { projectId: project.id }, auth.userId);
        }
      }
      if (project.audio_key) {
        try {
          await s3Storage.deleteFile(project.audio_key);
          deletedFiles++;
        } catch (deleteErr) {
          failedFiles++;
          logApiError('analysis-master/projects', 'deleteFile audio', deleteErr, { projectId: project.id }, auth.userId);
        }
      }
    }

    // 3. 批量删除关联的任务队列记录
    const { error: taskDeleteError } = await client
      .from('task_queue')
      .delete()
      .in('project_id', projectIds)
      .eq('user_id', auth.userId);

    if (taskDeleteError) {
      logApiError('analysis-master/projects', 'DELETE tasks', taskDeleteError, { projectIds }, auth.userId);
    }

    // 4. 批量删除数据库项目记录
    const { error: deleteError, count } = await client
      .from('analysis_master_projects')
      .delete({ count: 'exact' })
      .in('id', projectIds)
      .eq('user_id', auth.userId);

    if (deleteError) {
      logApiError('analysis-master/projects', 'DELETE projects', deleteError, { projectIds }, auth.userId);
      return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
    }

    logInfo('api', '分析大师项目已批量删除', {
      projectCount: count,
      deletedFiles,
      failedFiles,
    }, auth.userId);

    return NextResponse.json({
      success: true,
      deleted: count ?? projects.length,
      deletedFiles,
      failedFiles,
    });
  } catch (error) {
    logApiError('analysis-master/projects', 'DELETE all', error, {}, auth?.success ? auth.userId : undefined);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
