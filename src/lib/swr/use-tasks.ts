import useSWR from 'swr';
import { QueueTask, getTaskQueue, getQueueStats } from '@/lib/queue';

/**
 * 任务队列 Hook
 * 支持窗口聚焦自动刷新 + 更快的轮询（当有运行中任务时）
 * @param viewMode 'all' = 管理员查看所有任务, 'mine' = 查看自己的任务
 * @param userId 当前用户 ID（用于缓存隔离）
 */
export function useTaskQueue(viewMode: 'all' | 'mine' = 'mine', userId?: string | null) {
  const cacheKey = userId ? `task-queue:${userId}:${viewMode}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<{ tasks: QueueTask[]; isAdmin: boolean }>(
    cacheKey,
    () => getTaskQueue(viewMode),
    {
      refreshInterval: 3000, // 每3秒自动刷新（加快频率）
      revalidateOnFocus: true, // 窗口聚焦时刷新
      revalidateOnReconnect: true, // 网络重连时刷新
      dedupingInterval: 1000, // 1秒内重复请求去重
    }
  );

  return {
    tasks: data?.tasks || [],
    isAdmin: data?.isAdmin || false,
    isLoading,
    error,
    mutate,
  };
}

/**
 * 任务队列统计 Hook
 * @param viewMode 'all' = 管理员查看所有任务统计, 'mine' = 查看自己的任务统计
 * @param userId 当前用户 ID（用于缓存隔离）
 */
export function useTaskStats(viewMode: 'all' | 'mine' = 'mine', userId?: string | null) {
  const cacheKey = userId ? `task-stats:${userId}:${viewMode}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<{ stats: { total: number; pending: number; running: number; retrying: number; success: number; failed: number }; isAdmin: boolean }>(
    cacheKey,
    () => getQueueStats(viewMode),
    {
      refreshInterval: 3000, // 每3秒自动刷新（加快频率）
      revalidateOnFocus: true, // 窗口聚焦时刷新
      revalidateOnReconnect: true, // 网络重连时刷新
      dedupingInterval: 1000, // 1秒内重复请求去重
    }
  );

  return {
    stats: data?.stats || { total: 0, pending: 0, running: 0, retrying: 0, success: 0, failed: 0 },
    isAdmin: data?.isAdmin || false,
    isLoading,
    error,
    mutate,
  };
}
