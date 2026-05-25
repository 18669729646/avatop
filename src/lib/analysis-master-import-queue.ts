import { resolveBatchProjectName } from '@/lib/analysis-master-batch-naming';
import {
  runAnalysisMasterLocalImport,
  type AnalysisMasterLocalImportBatchContext,
  type AnalysisMasterLocalImportError,
  type AnalysisMasterLocalImportParams,
  type AnalysisMasterLocalImportResult,
} from '@/lib/analysis-master-local-import';
import type { AnalysisMasterImportItem } from '@/lib/analysis-master-excel';

export interface AnalysisMasterBatchImportRowResult {
  index: number;
  sourceUrl: string;
  attempts: number;
  status: 'pending' | 'running' | 'retrying' | 'success' | 'failed';
  projectId?: string;
  error?: string | null;
}

export interface AnalysisMasterBatchImportSummary {
  batchId: string;
  sourceFileName?: string;
  total: number;
  processed: number;
  createdRows: number;
  failedRows: number;
  failedItems: Array<{
    sourceUrl: string;
    error: string;
  }>;
  rowResults: AnalysisMasterBatchImportRowResult[];
  status: 'running' | 'success' | 'failed';
  error?: string;
}

export interface AnalysisMasterBatchImportQueueParams {
  batchId: string;
  sourceFileName?: string;
  imports: AnalysisMasterImportItem[];
  saasBaseUrl: string;
  authToken: string | null;
  concurrency?: number;
  maxRetries?: number;
  projectNameResolver?: (metadata: Record<string, string>, index: number) => string;
}

interface RunLocalImportDeps {
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  helperFetch?: typeof fetch;
  executeRow?: (params: AnalysisMasterLocalImportParams) => Promise<AnalysisMasterLocalImportResult>;
  onProgress?: (summary: AnalysisMasterBatchImportSummary) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getProjectIdFromError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'projectId' in error) {
    const projectId = (error as AnalysisMasterLocalImportError).projectId;
    return typeof projectId === 'string' && projectId ? projectId : undefined;
  }
  return undefined;
}

export async function runAnalysisMasterBatchLocalImport(
  params: AnalysisMasterBatchImportQueueParams,
  deps: RunLocalImportDeps,
): Promise<AnalysisMasterBatchImportSummary> {
  const executeRow = deps.executeRow || ((rowParams: AnalysisMasterLocalImportParams) => runAnalysisMasterLocalImport(rowParams, {
    authFetch: deps.authFetch,
    helperFetch: deps.helperFetch,
  }));
  const concurrency = Math.max(1, params.concurrency ?? 3);
  const maxRetries = Math.max(0, params.maxRetries ?? 1);
  const projectNameResolver = params.projectNameResolver || resolveBatchProjectName;
  const rowResults: AnalysisMasterBatchImportRowResult[] = params.imports.map((item, index) => ({
    index,
    sourceUrl: item.sourceUrl,
    attempts: 0,
    status: 'pending',
  }));
  const failedItems: Array<{ sourceUrl: string; error: string }> = [];
  let processed = 0;
  let createdRows = 0;
  let failedRows = 0;

  const emitProgress = (status: AnalysisMasterBatchImportSummary['status'] = 'running', error?: string): AnalysisMasterBatchImportSummary => ({
    batchId: params.batchId,
    sourceFileName: params.sourceFileName,
    total: params.imports.length,
    processed,
    createdRows,
    failedRows,
    failedItems: failedItems.slice(0, 20),
    rowResults: rowResults.map(item => ({ ...item })),
    status,
    error,
  });

  if (params.imports.length === 0) {
    return emitProgress('success');
  }

  let nextIndex = 0;

  const processRow = async (index: number): Promise<void> => {
    const item = params.imports[index];
    const batchContext: AnalysisMasterLocalImportBatchContext = {
      batchId: params.batchId,
      rowIndex: index,
    };
    const projectName = projectNameResolver(item.metadata, index);
    let projectId: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      rowResults[index] = {
        index,
        sourceUrl: item.sourceUrl,
        attempts: attempt + 1,
        status: attempt === 0 ? 'running' : 'retrying',
        projectId,
        error: undefined,
      };
      deps.onProgress?.(emitProgress('running'));

      try {
        const result = await executeRow({
          sourceUrl: item.sourceUrl,
          projectName,
          saasBaseUrl: params.saasBaseUrl,
          authToken: params.authToken,
          projectId,
          batchContext,
        });

        projectId = result.projectId;
        rowResults[index] = {
          index,
          sourceUrl: item.sourceUrl,
          attempts: attempt + 1,
          status: 'success',
          projectId,
          error: null,
        };
        createdRows += 1;
        processed += 1;
        deps.onProgress?.(emitProgress('running'));
        return;
      } catch (error) {
        const message = getErrorMessage(error, '批量导入失败');
        projectId = getProjectIdFromError(error) || projectId;

        if (attempt < maxRetries) {
          rowResults[index] = {
            index,
            sourceUrl: item.sourceUrl,
            attempts: attempt + 1,
            status: 'retrying',
            projectId,
            error: message,
          };
          deps.onProgress?.(emitProgress('running'));
          continue;
        }

        failedRows += 1;
        processed += 1;
        failedItems.push({
          sourceUrl: item.sourceUrl,
          error: message,
        });
        rowResults[index] = {
          index,
          sourceUrl: item.sourceUrl,
          attempts: attempt + 1,
          status: 'failed',
          projectId,
          error: message,
        };
        deps.onProgress?.(emitProgress('running'));
        return;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, params.imports.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= params.imports.length) {
        return;
      }
      await processRow(currentIndex);
    }
  });

  await Promise.all(workers);
  return emitProgress('success');
}
