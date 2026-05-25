import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import { buildAnalysisMasterItemClaimPatch, parseAnalysisMasterImportRunToken } from '@/lib/analysis-master-import-runs';

const MAX_CLAIM_LIMIT = 3;

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const validated = await validateRunner(request, id);
    if (!validated) {
      return NextResponse.json({ error: '无权访问导入任务' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const workerId = typeof body.workerId === 'string' && body.workerId ? body.workerId : 'analysis-helper';
    const limit = Math.min(Math.max(Number(body.limit || MAX_CLAIM_LIMIT), 1), MAX_CLAIM_LIMIT);
    const { client, run } = validated;

    const { data: items, error: itemError } = await client
      .from('analysis_master_import_items')
      .select('*')
      .eq('run_id', id)
      .eq('status', 'pending')
      .order('row_index', { ascending: true })
      .limit(limit);

    if (itemError) {
      logApiError('analysis-master/import-runs/claim', 'select items', itemError, { runId: id });
      return NextResponse.json({ error: '领取导入任务失败' }, { status: 500 });
    }

    const claimed = [];
    for (const item of items || []) {
      const attempts = Number(item.attempts || 0) + 1;
      const { data: updated, error: updateError } = await client
        .from('analysis_master_import_items')
        .update(buildAnalysisMasterItemClaimPatch({ workerId, attempt: attempts }))
        .eq('id', item.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (!updateError && updated) {
        claimed.push(updated);
      }
    }

    if (claimed.length > 0 && run.status !== 'running') {
      await client
        .from('analysis_master_import_runs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      data: {
        items: claimed.map(item => ({
          id: item.id,
          runId: item.run_id,
          projectId: item.project_id,
          sourceUrl: item.source_url,
          rowIndex: item.row_index,
          attempts: item.attempts,
          metadata: item.metadata || {},
        })),
      },
    });
  } catch (error) {
    logApiError('analysis-master/import-runs/claim', 'POST', error, { runId: id });
    return NextResponse.json({ error: '领取导入任务失败' }, { status: 500 });
  }
}
