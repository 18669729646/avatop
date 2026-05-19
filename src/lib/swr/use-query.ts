/**
 * 通用数据查询 Hook
 * 包装现有的数据获取函数，提供 SWR 的优势
 */

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';

/**
 * 通用的数据查询 Hook
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param options SWR 选项
 */
export function useQuery<T, E = Error>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: {
    dedupingInterval?: number;
    revalidateOnFocus?: boolean;
    onSuccess?: (data: T) => void;
  }
) {
  const swrOptions: SWRConfiguration<T, E> = {
    revalidateOnFocus: options?.revalidateOnFocus ?? false,
    dedupingInterval: options?.dedupingInterval ?? 5000,
  };
  
  // SWR 2.x 使用 onSuccess 需要通过 useEffect 实现
  // 但这里我们暂时移除 onError，因为它在 SWR 2.x 中已被移除
  
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, E>(
    key,
    fetcher,
    swrOptions
  );
  
  const refresh = useCallback(() => {
    return mutate(undefined, { revalidate: true });
  }, [mutate]);
  
  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh,
  };
}

/**
 * 带参数的数据查询 Hook
 * @param keyFactory 缓存键工厂函数（参数变化时返回新的 key）
 * @param fetcher 数据获取函数
 * @param options SWR 选项
 */
export function useQueryWithParams<T, P, E = Error>(
  keyFactory: (params: P) => string | null,
  fetcher: (params: P) => Promise<T>,
  params: P,
  options?: {
    dedupingInterval?: number;
    revalidateOnFocus?: boolean;
  }
) {
  const key = keyFactory(params);
  
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, E>(
    key,
    () => fetcher(params),
    {
      revalidateOnFocus: options?.revalidateOnFocus ?? false,
      dedupingInterval: options?.dedupingInterval ?? 5000,
    }
  );
  
  const refresh = useCallback(() => {
    return mutate(undefined, { revalidate: true });
  }, [mutate]);
  
  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh,
  };
}

/**
 * 带强制刷新的数据查询 Hook
 * @param key 缓存键
 * @param fetcher 数据获取函数（支持 forceRefresh 参数）
 * @param options SWR 选项
 */
export function useQueryWithRefresh<T, E = Error>(
  key: string | null,
  fetcher: (forceRefresh?: boolean) => Promise<T>,
  options?: {
    dedupingInterval?: number;
    revalidateOnFocus?: boolean;
  }
) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, E>(
    key,
    () => fetcher(false), // 默认使用缓存
    {
      revalidateOnFocus: options?.revalidateOnFocus ?? false,
      dedupingInterval: options?.dedupingInterval ?? 5000,
    }
  );
  
  const refresh = useCallback(async () => {
    // 强制刷新时，调用 fetcher(true)
    const newData = await fetcher(true);
    return mutate(newData, { revalidate: false });
  }, [fetcher, mutate]);
  
  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh,
  };
}
