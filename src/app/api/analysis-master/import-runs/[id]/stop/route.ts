import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { refreshAnalysisMasterImportRunProgress } from '@/lib/analysis-master-import-run-db';
import { logApiError } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const body = await request.json().catch(() => ({}));
    const { runnerToken } = body;

    if (!runnerToken) {
      return NextResponse.json(
        { success: false, error: 'Missing runnerToken' },
        { status: 400 },
      );
    }

    const client = getSupabaseClient();

    // Verify run exists and token matches
    const { data: run, error: runError } = await client
      .from('analysis_master_import_runs')
      .select('id, status, runner_token')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { success: false, error: 'Import run not found' },
        { status: 404 },
      );
    }

    if (run.runner_token !== runnerToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid runner token' },
        { status: 403 },
      );
    }

    // Idempotent: if already completed/stopped, return success
    if (run.status === 'completed' || run.status === 'stopped') {
      return NextResponse.json({ success: true, data: { status: run.status } });
    }

    // Refresh progress to get latest counts
    await refreshAnalysisMasterImportRunProgress(runId, client);

    // Read updated counts to determine final status
    const { data: updatedRun } = await client
      .from('analysis_master_import_runs')
      .select('total_items, completed_items, failed_items')
      .eq('id', runId)
      .single();

    const finalStatus =
      updatedRun && updatedRun.failed_items > 0
        ? 'completed_with_errors'
        : 'completed';

    // Mark the run as completed
    const { error: updateError } = await client
      .from('analysis_master_import_runs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);

    if (updateError) {
      logApiError('import-run-stop', 'update_run_status', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update run status' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { status: finalStatus },
    });
  } catch (error) {
    logApiError('import-run-stop', 'stop', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
