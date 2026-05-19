'use client';

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';
import { fetcher } from './fetcher';

/**
 * SWR 全局配置
 */
interface SWRProviderProps {
  children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // 窗口聚焦时自动重新验证
        revalidateOnFocus: true,
        // 网络重连时自动重新验证
        revalidateOnReconnect: true,
        // 5秒内相同请求去重
        dedupingInterval: 5000,
        // 错误时自动重试
        shouldRetryOnError: false,
        // 加载时显示上次数据
        keepPreviousData: true,
        // 错误重试配置
        errorRetryCount: 2,
        errorRetryInterval: 3000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
