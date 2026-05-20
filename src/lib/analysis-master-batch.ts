import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface AnalysisMasterBatchImportItem {
  sourceUrl: string;
  metadata: Record<string, string>;
}

export interface AnalysisMasterBatchImportParams {
  batchId: string;
  sourceFileName: string;
  imports: AnalysisMasterBatchImportItem[];
}

export function createAnalysisMasterBatchImportId(): string {
  return `am-batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function updateAnalysisMasterBatchImportProgress(params: {
  batchId: string;
  createdRows?: number;
  failedRows?: number;
  status?: string;
  error?: string | null;
}) {
  const client = getSupabaseClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.createdRows !== undefined) updateData.created_rows = params.createdRows;
  if (params.failedRows !== undefined) updateData.failed_rows = params.failedRows;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.error !== undefined) updateData.error = params.error;

  const { error } = await client
    .from('analysis_master_batch_imports')
    .update(updateData)
    .eq('id', params.batchId);

  if (error) {
    throw error;
  }
}
