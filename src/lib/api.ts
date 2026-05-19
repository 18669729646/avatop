/**
 * 共享的 API 请求工具
 * 自动添加认证 Token
 */

// Token 存储 Key
const TOKEN_KEY = 'auth_token';

/**
 * 获取存储的认证 Token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 设置认证 Token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 清除认证 Token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * 获取当前用户 ID（从 localStorage 中解析）
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // 尝试从 localStorage 获取用户信息
  try {
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      return user.id || null;
    }
  } catch {
    // ignore
  }
  
  return null;
}

/**
 * 通用的 API 请求函数
 * 自动添加 Authorization header
 */
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // 在服务器端，需要使用完整的 URL
  const fullUrl = typeof window === 'undefined' 
    ? `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}${url}` 
    : url;
  
  // 获取认证 token
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  // 添加 Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

/**
 * 带认证的 fetch 函数
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // 只有当 body 存在且不是 FormData 时才设置 Content-Type
  // FormData 需要浏览器自动设置 multipart/form-data 边界
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}
