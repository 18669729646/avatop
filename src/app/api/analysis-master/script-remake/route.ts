import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getProductSelection } from '@/lib/products';
import {
  enqueueScriptRemakeTask,
  getScriptRemakesByProject,
  getScriptRemakeById,
} from '@/lib/analysis-master-script-remake';
import type { AnalysisMasterResult } from '@/lib/analysis-master';

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  const userId = authResult.userId;
  let projectId = '';
  let productId = '';
  let language = 'en-US';
  let includeChinese = true;
  let extraRequirements: string | undefined;

  try {
    const body = await request.json();
    projectId = body.projectId || '';
    productId = body.productId || '';
    language = body.language || 'en-US';
    includeChinese = body.includeChinese !== false;
    extraRequirements = body.extraRequirements;

    if (!projectId) {
      return NextResponse.json({ success: false, error: '请提供项目ID' }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ success: false, error: '请选择产品' }, { status: 400 });
    }

    console.log(`[Script Remake API] 用户 ${userId} 提交脚本复刻任务，projectId=${projectId}, productId=${productId}, language=${language}, includeChinese=${includeChinese}`);

    const result = await enqueueScriptRemakeTask({
      projectId,
      productId,
      userId,
      authHeader: request.headers.get('authorization'),
      triggerProcessing: true,
      language,
      includeChinese,
      extraRequirements,
    });

    console.log(`[Script Remake API] 任务已入队，taskId=${result.taskId}, scriptRemakeId=${result.scriptRemakeId}`);

    return NextResponse.json({
      success: true,
      data: {
        taskId: result.taskId,
        scriptRemakeId: result.scriptRemakeId,
        projectId,
        productId,
        language,
        includeChinese,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error(`[Script Remake API] 入队失败: ${(error as Error).message}`, { userId, projectId, productId });
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  const userId = authResult.userId;
  const isAdmin = authResult.payload.role === 'admin';
  let scriptRemakeId = request.nextUrl.searchParams.get('id');
  const projectId = request.nextUrl.searchParams.get('projectId');

  try {
    const client = getSupabaseClient();

    // 如果传入的是 taskId，需要先查询对应的 scriptRemakeId
    if (scriptRemakeId && scriptRemakeId.startsWith('sr-task-')) {
      const { data: taskData, error: taskError } = await client
        .from('task_queue')
        .select('params')
        .eq('id', scriptRemakeId)
        .single();

      if (!taskError && taskData?.params?.scriptRemakeId) {
        scriptRemakeId = taskData.params.scriptRemakeId;
      }
    }

    if (scriptRemakeId) {
      const { data: item, error } = await client
        .from('analysis_master_script_remakes')
        .select('*')
        .eq('id', scriptRemakeId)
        .single();

      if (error || !item) {
        return NextResponse.json({ success: false, error: '脚本不存在' }, { status: 404 });
      }

      if (!isAdmin && item.user_id !== userId) {
        return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: item.id,
          project_id: item.project_id,
          product_id: item.product_id,
          status: item.status,
          title: item.title,
          hook: item.hook,
          pain_point: item.pain_point,
          selling_point_script: item.selling_point_script,
          cta: item.cta,
          full_script: item.full_script,
          full_script_cn: item.full_script_cn,
          segments: item.segments,
          shooting_notes: item.shooting_notes,
          visual_notes: item.visual_notes,
          compliance_notes: item.compliance_notes,
          error: item.error,
          raw_result: item.raw_result, // 原始返回数据
          created_at: item.created_at,
          updated_at: item.updated_at,
        },
      });
    }

    if (!projectId) {
      return NextResponse.json({ success: false, error: '请提供项目ID或脚本ID' }, { status: 400 });
    }

    const { data: projectData, error: projectError } = await client
      .from('analysis_master_projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !projectData) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    if (!isAdmin && projectData.user_id !== userId) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 });
    }

    const { data: remakeData, error: remakeError } = await client
      .from('analysis_master_script_remakes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (remakeError) {
      return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
    }

    const results = (remakeData || []).map(item => ({
      id: item.id,
      project_id: item.project_id,
      product_id: item.product_id,
      status: item.status,
      title: item.title,
      hook: item.hook,
      pain_point: item.pain_point,
      selling_point_script: item.selling_point_script,
      cta: item.cta,
      full_script: item.full_script,
      full_script_cn: item.full_script_cn,
      segments: item.segments,
      shooting_notes: item.shooting_notes,
      visual_notes: item.visual_notes,
      compliance_notes: item.compliance_notes,
      product_snapshot: item.product_snapshot,
      analysis_snapshot: item.analysis_snapshot,
      error: item.error,
      raw_result: item.raw_result, // 原始返回数据
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error(`[Script Remake API] 查询失败: ${(error as Error).message}`, { userId });
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}