export const ANALYSIS_LOCAL_HELPER_URL = 'http://127.0.0.1:17321';
export const ANALYSIS_LOCAL_HELPER_MAX_BYTES = 100 * 1024 * 1024;
export const ANALYSIS_LOCAL_HELPER_CHUNK_SIZE = 512 * 1024;

export interface AnalysisLocalHelperRequest {
  sourceUrl: string;
  projectName: string;
  saasBaseUrl: string;
  authToken: string;
  chunkSize: number;
  maxBytes: number;
}

export function buildAnalysisLocalHelperRequest(params: {
  sourceUrl: string;
  projectName?: string;
  saasBaseUrl: string;
  authToken: string | null;
  chunkSize: number;
}): AnalysisLocalHelperRequest {
  const sourceUrl = params.sourceUrl.trim();
  if (!sourceUrl) {
    throw new Error('请输入视频链接');
  }
  if (!params.authToken) {
    throw new Error('请先登录');
  }

  return {
    sourceUrl,
    projectName: (params.projectName || '链接分析项目').trim() || '链接分析项目',
    saasBaseUrl: params.saasBaseUrl.replace(/\/+$/, ''),
    authToken: params.authToken,
    chunkSize: params.chunkSize,
    maxBytes: ANALYSIS_LOCAL_HELPER_MAX_BYTES,
  };
}
