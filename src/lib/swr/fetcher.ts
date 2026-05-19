/**
 * SWR 统一 fetcher 函数
 * 处理认证、错误和响应解析
 */

import { getAuthToken } from '../api';

/**
 * 通用 JSON fetcher
 */
export async function fetcher<T>(url: string): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * 带数据提取的 fetcher（从 { data: T } 中提取 data）
 */
export async function fetcherData<T>(url: string): Promise<T> {
  const result = await fetcher<{ data: T }>(url);
  return result.data;
}

/**
 * 带认证的 POST fetcher
 */
export async function postFetcher<T, D = unknown>(url: string, data?: D): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * 带认证的 PUT fetcher
 */
export async function putFetcher<T, D = unknown>(url: string, data: D): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * 带认证的 DELETE fetcher
 */
export async function deleteFetcher<T>(url: string): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}
