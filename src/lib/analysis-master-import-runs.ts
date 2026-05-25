import { createAnalysisMasterBatchImportId } from '@/lib/analysis-master-batch';
import { resolveBatchProjectName } from '@/lib/analysis-master-batch-naming';
import { buildAnalysisMasterPlaceholderProjectUpsert, createAnalysisProjectId } from '@/lib/analysis-master-projects';
import type { AnalysisMasterImportItem } from '@/lib/analysis-master-excel';

export type AnalysisMasterImportMode = 'single' | 'batch';
export type AnalysisMasterImportRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AnalysisMasterImportItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';

export interface AnalysisMasterImportRunCreateParams {
  userId: string;
  mode: AnalysisMasterImportMode;
  sourceFileName?: string;
  imports: AnalysisMasterImportItem[];
  now?: string;
  randomToken?: string;
  idFactory?: (prefix: string, index: number) => string;
}

export interface AnalysisMasterImportRunCreateResult {
  run: Record<string, unknown>;
  projects: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}

function createId(prefix: string, index: number, idFactory?: (prefix: string, index: number) => string): string {
  if (idFactory) {
    return idFactory(prefix, index);
  }
  if (prefix === 'am-run') {
    return createAnalysisMasterBatchImportId().replace('am-batch', 'am-run');
  }
  if (prefix === 'am-project') {
    return createAnalysisProjectId();
  }
  return `am-item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createRunnerToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
}

export function buildAnalysisMasterImportRunToken(runId: string, runnerToken: string): string {
  return `${runId}:${runnerToken}`;
}

export function parseAnalysisMasterImportRunToken(value: string | null | undefined): {
  runId: string;
  runnerToken: string;
} | null {
  if (!value) return null;
  const [runId, ...rest] = value.split(':');
  const runnerToken = rest.join(':');
  if (!runId || !runnerToken) return null;
  return { runId, runnerToken };
}

export function buildAnalysisMasterImportRunCreate(
  params: AnalysisMasterImportRunCreateParams
): AnalysisMasterImportRunCreateResult {
  const now = params.now || new Date().toISOString();
  const runId = createId('am-run', 0, params.idFactory);
  const runnerToken = params.randomToken || createRunnerToken();
  const imports = params.imports;

  const run = {
    id: runId,
    user_id: params.userId,
    mode: params.mode,
    source_file_name: params.sourceFileName || null,
    status: 'pending',
    total_items: imports.length,
    completed_items: 0,
    failed_items: 0,
    runner_token: runnerToken,
    created_at: now,
    updated_at: now,
  };

  const projects: Array<Record<string, unknown>> = [];
  const items: Array<Record<string, unknown>> = [];

  imports.forEach((item, index) => {
    const projectId = createId('am-project', index, params.idFactory);
    const itemId = createId('am-item', index, params.idFactory);
    projects.push(buildAnalysisMasterPlaceholderProjectUpsert({
      projectId,
      userId: params.userId,
      sourceUrl: item.sourceUrl,
      name: params.mode === 'single'
        ? resolveBatchProjectName(item.metadata, index).replace(/^\[批量\]\s*/, '')
        : resolveBatchProjectName(item.metadata, index),
      importMetadata: {
        ...item.metadata,
        importRunId: runId,
        importItemId: itemId,
        rowIndex: String(index),
      },
      now,
    }));
    items.push({
      id: itemId,
      run_id: runId,
      user_id: params.userId,
      project_id: projectId,
      source_url: item.sourceUrl,
      row_index: index,
      status: 'pending',
      attempts: 0,
      metadata: item.metadata,
      error: null,
      worker_id: null,
      started_at: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
  });

  return { run, projects, items };
}

export function buildAnalysisMasterItemClaimPatch(params: {
  workerId: string;
  attempt: number;
  now?: string;
}): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  return {
    status: 'running',
    worker_id: params.workerId,
    attempts: params.attempt,
    error: null,
    started_at: now,
    updated_at: now,
  };
}

export function buildAnalysisMasterItemFailPatch(params: {
  error: string;
  attempts: number;
  maxRetries: number;
  now?: string;
}): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  const shouldRetry = params.attempts <= params.maxRetries;
  return shouldRetry
    ? {
      status: 'pending',
      error: params.error,
      attempts: params.attempts,
      updated_at: now,
    }
    : {
      status: 'failed',
      error: params.error,
      attempts: params.attempts,
      completed_at: now,
      updated_at: now,
    };
}

export function buildAnalysisMasterItemSuccessPatch(params: {
  now?: string;
}): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  return {
    status: 'completed',
    error: null,
    completed_at: now,
    updated_at: now,
  };
}

export function buildAnalysisMasterImportRunProgress(params: {
  total: number;
  completed: number;
  failed: number;
  running: number;
  now?: string;
}): Record<string, unknown> {
  const now = params.now || new Date().toISOString();
  const finished = params.completed + params.failed >= params.total;
  return {
    status: finished ? 'completed' : params.running > 0 ? 'running' : 'pending',
    completed_items: params.completed,
    failed_items: params.failed,
    updated_at: now,
    ...(finished ? { completed_at: now } : {}),
  };
}
