import { ANALYSIS_LOCAL_HELPER_CHUNK_SIZE, ANALYSIS_LOCAL_HELPER_URL, buildAnalysisLocalHelperRequest, type AnalysisLocalHelperRequest } from '@/lib/analysis-master-local-helper';

export interface AnalysisMasterLocalImportBatchContext {
  batchId: string;
  rowIndex: number;
}

export interface AnalysisMasterLocalImportParams {
  sourceUrl: string;
  projectName?: string;
  saasBaseUrl: string;
  authToken: string | null;
  projectId?: string;
  batchContext?: AnalysisMasterLocalImportBatchContext;
}

export interface AnalysisMasterLocalImportResult {
  projectId: string;
  project: {
    id: string;
    status?: string;
    error?: string | null;
  };
  helperRequest: AnalysisLocalHelperRequest;
  helperData: unknown;
}

interface LocalImportAuthFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

interface LocalImportDeps {
  authFetch: LocalImportAuthFetch;
  helperFetch?: typeof fetch;
}

export interface AnalysisMasterLocalImportError extends Error {
  projectId?: string;
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

async function updateProjectStatus(
  authFetch: LocalImportAuthFetch,
  projectId: string,
  status: string,
  error: string | null,
): Promise<void> {
  await authFetch(`/api/analysis-master/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, error }),
  });
}

async function createOrReuseProject(
  authFetch: LocalImportAuthFetch,
  params: AnalysisMasterLocalImportParams,
): Promise<string> {
  if (params.projectId) {
    await updateProjectStatus(authFetch, params.projectId, 'downloading', null);
    return params.projectId;
  }

  const createRes = await authFetch('/api/analysis-master/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceUrl: params.sourceUrl,
      name: params.projectName,
      importMode: 'local-helper',
      importMetadata: params.batchContext
        ? {
          batchId: params.batchContext.batchId,
          rowIndex: String(params.batchContext.rowIndex),
        }
        : undefined,
    }),
  });
  const createData = await parseJson(createRes);
  if (!createRes.ok || !createData.success || !createData.data || typeof createData.data !== 'object') {
    throw new Error((createData.error as string) || '创建项目失败');
  }

  const projectId = String((createData.data as Record<string, unknown>).id || (createData.data as Record<string, unknown>).projectId || '');
  if (!projectId) {
    throw new Error('创建项目失败');
  }

  return projectId;
}

export async function runAnalysisMasterLocalImport(
  params: AnalysisMasterLocalImportParams,
  deps: LocalImportDeps,
): Promise<AnalysisMasterLocalImportResult> {
  const helperFetch = deps.helperFetch || fetch;
  const helperRequest = buildAnalysisLocalHelperRequest({
    sourceUrl: params.sourceUrl,
    projectName: params.projectName,
    saasBaseUrl: params.saasBaseUrl,
    authToken: params.authToken,
    chunkSize: ANALYSIS_LOCAL_HELPER_CHUNK_SIZE,
    projectId: params.projectId,
    batchId: params.batchContext?.batchId,
    rowIndex: params.batchContext?.rowIndex,
  });

  const projectId = await createOrReuseProject(deps.authFetch, params);
  const requestBody: AnalysisLocalHelperRequest = {
    ...helperRequest,
    projectId,
    batchId: params.batchContext?.batchId,
    rowIndex: params.batchContext?.rowIndex,
  };

  const helperRes = await helperFetch(`${ANALYSIS_LOCAL_HELPER_URL}/v1/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const helperData = await parseJson(helperRes);
  if (!helperRes.ok || helperData.success === false) {
    const message = String((helperData.error as string) || '视频解析失败，请检查当前网络环境后重试。');
    await updateProjectStatus(deps.authFetch, projectId, 'download_failed', message).catch(() => undefined);
    const error = new Error(message) as AnalysisMasterLocalImportError;
    error.projectId = projectId;
    throw error;
  }

  return {
    projectId,
    project: {
      id: projectId,
      status: 'draft',
      error: null,
    },
    helperRequest: requestBody,
    helperData: helperData.data ?? helperData,
  };
}
