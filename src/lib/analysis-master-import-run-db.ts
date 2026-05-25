import { getSupabaseClient } from '@/storage/database/supabase-client';
import { buildAnalysisMasterImportRunProgress } from '@/lib/analysis-master-import-runs';

export async function refreshAnalysisMasterImportRunProgress(
  runId: string,
  client = getSupabaseClient(),
): Promise<void> {
  const { data: items, error } = await client
    .from('analysis_master_import_items')
    .select('status')
    .eq('run_id', runId);

  if (error || !items) {
    throw error || new Error('import items not found');
  }

  const completed = items.filter(item => item.status === 'completed').length;
  const failed = items.filter(item => item.status === 'failed').length;
  const running = items.filter(item => item.status === 'running').length;

  await client
    .from('analysis_master_import_runs')
    .update(buildAnalysisMasterImportRunProgress({
      total: items.length,
      completed,
      failed,
      running,
    }))
    .eq('id', runId);
}
