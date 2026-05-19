/**
 * 广告模板相关 SWR Hooks
 */

import useSWR from 'swr';
import { Template } from '../template-library';

// 缓存键
const TEMPLATES_KEY = '/api/template-library';

/**
 * 获取所有模板
 */
export function useTemplates() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ success: boolean; templates: Template[] }>(
    TEMPLATES_KEY,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 15000, // 15秒内去重
    }
  );
  
  const templates = data?.templates || [];
  
  return {
    templates,
    isLoading,
    isValidating,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
  };
}
