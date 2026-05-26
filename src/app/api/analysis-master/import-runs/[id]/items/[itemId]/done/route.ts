import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  parseAnalysisMasterImportRunToken,
  buildAnalysisMasterItemSuccessPatch,
} from '@/lib/analysis-master-import-runs';
import { refreshAnalysisMasterImportRunProgress } from '@/lib/analysis-master-import-run-db';
import { logApiError } from '@/lib/logger';

async function validateRunner(request: NextRequest, runId: string) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : authHeader;
  const parsed = parseAnalysisMasterImportRunToken(token);
  if (!parsed || parsed.runId !== runId) {
    return null;
  }

  const client = getSupabaseClient();
  const { data: run, error } = await client
    .from('analysis_master_import_runs')
    .select('*')
    .eq('id', runId)
    .eq('runner_token', parsed.runnerToken)
    .single();

  if (error || !run) {
    return null;
  }
  return { client, run };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: runId, itemId } = await params;

  try {
    const validated = await validateRunner(request, runId);
    if (!validated) {
      return NextResponse.json({ error: '无权访问导入任务' }, { status: 403 });
    }

    const { client } = validated;

    // 1. Get item to find project_id
    const { data: item, error: itemFetchError } = await client
      .from('analysis_master_import_items')
      .select('*')
      .eq('id', itemId)
      .eq('run_id', runId)
      .single();

    if (itemFetchError || !item) {
      return NextResponse.json({ error: '导入明细不存在' }, { status: 404 });
    }

    // 2. Update item status to completed
    const successPatch = buildAnalysisMasterItemSuccessPatch({});
    const { error: itemUpdateError } = await client
      .from('analysis_master_import_items')
      .update(successPatch)
      .eq('id', itemId)
      .eq('run_id', runId);

    if (itemUpdateError) {
      logApiError('import-item-done', 'update item', itemUpdateError, { runId, itemId });
      return NextResponse.json({ error: '更新导入明细失败' }, { status: 500 });
    }

    // 3. Update project status to pending (ready for analysis)
    const body = await request.json().catch(() => ({}));
    const sourceVideoKey = body.sourceVideoKey || item.metadata?.sourceVideoKey;
    const videoDuration = body.videoDuration || item.metadata?.videoDuration;

    const projectUpdate: Record<string, unknown> = {
      status: 'pending',
      error: null,
      updated_at: new Date().toISOString(),
    };
    if (sourceVideoKey) {
      projectUpdate.source_video_key = sourceVideoKey;
    }
    if (videoDuration != null) {
      projectUpdate.video_duration = videoDuration;
    }

    await client
      .from('analysis_master_projects')
      .update(projectUpdate)
      .eq('id', item.project_id)
      .eq('user_id', item.user_id);

    // 4. Refresh run progress
    await refreshAnalysisMasterImportRunProgress(runId, client).catch((err) => {
      logApiError('import-item-done', 'refresh progress', err, { runId, itemId });
    });

    return NextResponse.json({ success: true, data: { status: 'completed' } });
  } catch (error) {
    logApiError('import-item-done', 'POST', error, { runId, itemId });
    return NextResponse.json({ error: '回写完成状态失败' }, { status: 500 });
  }
}
