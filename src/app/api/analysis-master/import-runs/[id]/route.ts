import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { id } = await params;
    const client = getSupabaseClient();
    const { data: run, error: runError } = await client
      .from('analysis_master_import_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: '导入任务不存在' }, { status: 404 });
    }

    const { data: items, error: itemError } = await client
      .from('analysis_master_import_items')
      .select('*')
      .eq('run_id', id)
      .eq('user_id', auth.userId)
      .order('row_index', { ascending: true });

    if (itemError) {
      logApiError('analysis-master/import-runs/[id]', 'select items', itemError, { runId: id }, auth.userId);
      return NextResponse.json({ error: '获取导入明细失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...run,
        runner_token: undefined,
        items: items || [],
      },
    });
  } catch (error) {
    logApiError('analysis-master/import-runs/[id]', 'GET', error);
    return NextResponse.json({ error: '获取导入任务失败' }, { status: 500 });
  }
}
