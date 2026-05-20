import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkUserCredits, getCreditPrice } from '@/lib/credits';
import { logApiError, logInfo } from '@/lib/logger';
import { ANALYSIS_MASTER_ACTION_TYPE } from '@/lib/analysis-master';
import { enqueueAnalysisTaskForProject } from '@/lib/analysis-master-queue';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const projectId = (await params).id;
    const client = getSupabaseClient();

    const { data: project, error: projectError } = await client
      .from('analysis_master_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    if (!project.video_key && !project.video_url) {
      return NextResponse.json({ error: '项目缺少视频文件' }, { status: 400 });
    }

    const price = await getCreditPrice(ANALYSIS_MASTER_ACTION_TYPE);
    const creditCheck = await checkUserCredits(auth.userId, price?.creditsRequired ?? 0);

    const { data: promptRows } = await client
      .from('system_prompt_config')
      .select('system_prompt, variables_used')
      .eq('id', ANALYSIS_MASTER_ACTION_TYPE)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        videoKey: project.video_key,
        videoUrl: project.video_url,
        status: project.status,
        creditPrice: price?.creditsRequired ?? 0,
        userCredits: creditCheck.balance,
        hasEnoughCredits: creditCheck.hasEnough,
        promptTemplate: promptRows?.system_prompt ?? null,
        promptVariables: promptRows?.variables_used ?? null,
      },
    });
  } catch (error) {
    logApiError('analysis-master/analyze', 'GET preview', error, {}, '');
    return NextResponse.json({ error: '预览失败' }, { status: 500 });
  }
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

    const result = await enqueueAnalysisTaskForProject({
      projectId,
      userId: auth.userId,
      authHeader: request.headers.get('authorization'),
      triggerProcessing: true,
    });

    logInfo('api', '分析大师任务已入队', { projectId, taskId: result.taskId }, auth.userId);
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        taskId: result.taskId,
        status: 'analyzing',
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
