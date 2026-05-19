/**
 * 产品管理相关 SWR Hooks
 */

import useSWR from 'swr';
import { fetcherData } from './fetcher';
import { Product } from '../products';

// 缓存键
const PRODUCTS_KEY = '/api/products/manage';
const productKey = (id: string) => `/api/products/manage/${id}`;

/**
 * 获取所有产品
 */
export function useProducts() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Product[]>(
    PRODUCTS_KEY,
    fetcherData,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10秒内去重
    }
  );
  
  return {
    products: data || [],
    isLoading,
    isValidating,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * 获取单个产品
 */
export function useProduct(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Product>(
    id ? productKey(id) : null,
    fetcherData,
    { revalidateOnFocus: false }
  );
  
  return {
    product: data || null,
    isLoading,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
  };
}
