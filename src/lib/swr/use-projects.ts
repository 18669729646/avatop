/**
 * 短片项目相关 SWR Hooks
 */

import useSWR from 'swr';
import { ShortFilmProject } from '../shortfilm';

// 项目列表缓存键
const PROJECTS_KEY = '/api/shortfilm/projects';
const projectKey = (id: string) => `/api/shortfilm/projects/${id}`;

/**
 * 获取所有项目
 */
export function useProjects() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: ShortFilmProject[] }>(
    PROJECTS_KEY,
    { revalidateOnFocus: false }
  );
  
  const projects = data?.data || [];
  
  return {
    projects,
    isLoading,
    isValidating,
    error: error?.message,
    mutate,
    /**
     * 强制刷新项目列表
     */
    refresh: () => mutate(),
  };
}

/**
 * 获取单个项目
 */
export function useProject(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ShortFilmProject }>(
    id ? projectKey(id) : null,
    { revalidateOnFocus: false }
  );
  
  return {
    project: data?.data || null,
    isLoading,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
  };
}
