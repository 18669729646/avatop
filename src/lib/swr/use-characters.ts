/**
 * 角色图库相关 SWR Hooks
 */

import useSWR from 'swr';
import { fetcherData } from './fetcher';
import { CharacterItem } from '../history';

// 缓存键
const CHARACTERS_KEY = '/api/characters';

/**
 * 获取角色图库
 */
export function useCharacters() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<CharacterItem[]>(
    CHARACTERS_KEY,
    fetcherData,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10秒内去重
    }
  );
  
  return {
    characters: data || [],
    isLoading,
    isValidating,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
  };
}
