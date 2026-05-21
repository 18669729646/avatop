/**
 * 分析大师项目列表 SWR Hook
 * 自动轮询，实时更新，支持分页
 */

import useSWR from 'swr';
import { getAuthToken } from '../api';

export interface AnalysisProject {
  id: string;
  name: string;
  sourceType: string;
  sourceUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  fileSize?: number;
  audioUrl?: string;
  audioDuration?: number;
  audioFileSize?: number;
  status: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  importMetadata?: Record<string, string>;
  clientRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PROJECT_PAGE_SIZE = 12;

interface ProjectsResponse {
  data: AnalysisProject[];
  pagination: ProjectPagination;
}

function authFetch(url: string) {
  const token = getAuthToken();
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function useAnalysisMasterProjects(userId?: string | null) {
  const cacheKey = userId ? `analysis-master-projects:${userId}` : null;

  const { data, error, isLoading, mutate } = useSWR<ProjectsResponse>(
    cacheKey,
    async () => {
      const response = await authFetch(`/api/analysis-master/projects?page=1&pageSize=${PROJECT_PAGE_SIZE}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: '获取项目列表失败' }));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      return result as ProjectsResponse;
    },
    {
      refreshInterval: 3000, // 每 3 秒自动轮询
      revalidateOnFocus: true, // 窗口聚焦时刷新
      revalidateOnReconnect: true, // 网络重连时刷新
      dedupingInterval: 2000, // 2 秒内重复请求去重
    }
  );

  return {
    projects: data?.data || [],
    pagination: data?.pagination || {
      page: 1,
      pageSize: PROJECT_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    },
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    mutate,
  };
}
