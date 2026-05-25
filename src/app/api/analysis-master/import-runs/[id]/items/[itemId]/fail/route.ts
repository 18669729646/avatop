import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import { buildAnalysisMasterItemFailPatch, parseAnalysisMasterImportRunToken } from '@/lib/analysis-master-import-runs';
import { refreshAnalysisMasterImportRunProgress } from '@/lib/analysis-master-import-run-db';

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  try {
    const validated = await validateRunner(request, id);
    if (!validated) {
      return NextResponse.json({ error: '无权访问导入任务' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.error === 'string' && body.error ? body.error : '视频解析失败，请检查当前网络环境后重试。';
    const maxRetries = Number.isFinite(Number(body.maxRetries)) ? Number(body.maxRetries) : 1;
    const { client } = validated;

    const { data: item, error: itemError } = await client
      .from('analysis_master_import_items')
      .select('*')
      .eq('id', itemId)
      .eq('run_id', id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: '导入明细不存在' }, { status: 404 });
    }

    const patch = buildAnalysisMasterItemFailPatch({
      error: message,
      attempts: Number(item.attempts || 1),
      maxRetries,
    });

    await client
      .from('analysis_master_import_items')
      .update(patch)
      .eq('id', itemId)
      .eq('run_id', id);

    await client
      .from('analysis_master_projects')
      .update({
        status: patch.status === 'failed' ? 'download_failed' : 'downloading',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.project_id)
      .eq('user_id', item.user_id);

    await refreshAnalysisMasterImportRunProgress(id, client).catch(error => {
      logApiError('analysis-master/import-runs/fail', 'refresh progress', error, { runId: id, itemId });
    });

    return NextResponse.json({ success: true, data: { status: patch.status } });
  } catch (error) {
    logApiError('analysis-master/import-runs/fail', 'POST', error, { runId: id, itemId });
    return NextResponse.json({ error: '回写失败状态失败' }, { status: 500 });
  }
}
