'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { invalidateAllCache } from './cache';

// 用户信息类型
export interface User {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  credits: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
  createdAt: string;
  lastLoginAt: string | null;
  forceChangePassword?: boolean;
}

// 认证状态类型
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Context 类型
interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<{ 
    success: boolean; 
    error?: string;
    remainingAttempts?: number;
    remainingTime?: number;
  }>;
  register: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: (showFrozenMessage?: boolean) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token 存储 Key
const TOKEN_KEY = 'auth_token';
const USER_INFO_KEY = 'user_info';

// Provider 组件
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // 从 localStorage 加载 token
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          // 验证 token 有效性
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.data));
              setState({
                user: data.data,
                token,
                isLoading: false,
                isAuthenticated: true,
              });
              return;
            }
          }
        }
      } catch (error) {
        console.error('Failed to load auth:', error);
      }
      
      localStorage.removeItem(USER_INFO_KEY);
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    };
    
    loadAuth();
  }, []);

  // 注册
  const register = useCallback(async (phone: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        localStorage.setItem(TOKEN_KEY, data.data.token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.data.user));
        // 清除所有缓存，确保新用户不会看到旧数据
        invalidateAllCache();
        setState({
          user: data.data.user,
          token: data.data.token,
          isLoading: false,
          isAuthenticated: true,
        });
        return { success: true };
      }
      
      return { success: false, error: data.error || '注册失败' };
    } catch (error) {
      return { success: false, error: '网络错误，请重试' };
    }
  }, []);

  // 更改密码
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { success: false, error: '请先登录' };
    }
    
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 刷新用户信息，移除 forceChangePassword 标记
        const meResponse = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (meResponse.ok) {
          const meData = await meResponse.json();
          if (meData.success && meData.data) {
            setState(prev => ({
              ...prev,
              user: meData.data,
            }));
          }
        }
        
        return { success: true };
      }
      
      return { success: false, error: data.error || '密码修改失败' };
    } catch (error) {
      return { success: false, error: '网络错误，请重试' };
    }
  }, []);

  // 登录
  const login = useCallback(async (phone: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        localStorage.setItem(TOKEN_KEY, data.data.token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.data.user));
        // 清除所有缓存，确保用户切换时不会看到旧数据
        invalidateAllCache();
        setState({
          user: data.data.user,
          token: data.data.token,
          isLoading: false,
          isAuthenticated: true,
        });
        
        // 如果需要强制修改密码，跳转到修改密码页面
        if (data.data.user.forceChangePassword) {
          router.push('/change-password?force=1');
        }
        
        return { success: true };
      }
      
      return { 
        success: false, 
        error: data.error || '登录失败',
        remainingAttempts: data.remainingAttempts,
        remainingTime: data.remainingTime,
      };
    } catch (error) {
      return { success: false, error: '网络错误，请重试' };
    }
  }, [router]);

  // 登出
  const logout = useCallback((showFrozenMessage: boolean = false) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    // 清除所有缓存，避免用户切换时看到旧数据
    invalidateAllCache();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
    
    if (showFrozenMessage) {
      // 存储冻结提示信息，登录页会显示
      sessionStorage.setItem('frozen_message', '您的账户已被冻结，请联系客服');
    }
    
    router.push('/login');
  }, [router]);

  // 刷新用户信息
  const refreshUser = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal, // 支持 AbortController
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // 检查用户是否被冻结
          if (data.data.status === 'frozen' && state.user?.status !== 'frozen') {
            // 用户刚被冻结，自动登出
            logout(true);
            return;
          }
          
          localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.data));
          // 使用 setTimeout 避免同步 setState
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              user: data.data,
            }));
          }, 0);
        }
      } else if (response.status === 403) {
        // 账户被冻结
        logout(true);
      }
    } catch (error) {
      // 忽略请求被取消的错误
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Failed to fetch')) {
        return;
      }
      // 网络瞬时抖动，静默忽略，下次路由切换会重试
      if (error instanceof TypeError) {
        return;
      }
      console.error('Failed to refresh user:', error);
    }
  }, [state.user?.status, logout]);

  // 页面切换时检查用户状态
  useEffect(() => {
    if (state.isAuthenticated && pathname && !pathname.includes('/login')) {
      const controller = new AbortController();
      // 使用 setTimeout 避免同步调用
      setTimeout(() => refreshUser(controller.signal), 0);
      return () => controller.abort(); // 组件卸载时取消请求
    }
  }, [pathname, state.isAuthenticated, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        changePassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 获取 Token 的工具函数（用于 API 调用）
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// 带认证的 fetch 工具函数
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // 只有当 body 存在且不是 FormData 时才设置 Content-Type
  // FormData 需要浏览器自动设置 multipart/form-data 边界
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // 对于 FormData，不使用 spread operator，避免 body stream 被提前读取
  const fetchOptions: RequestInit = { headers };
  if (options.body instanceof FormData) {
    fetchOptions.body = options.body;
    fetchOptions.method = options.method || 'GET';
    fetchOptions.credentials = options.credentials;
    fetchOptions.cache = options.cache;
    fetchOptions.redirect = options.redirect;
    fetchOptions.referrer = options.referrer;
    fetchOptions.referrerPolicy = options.referrerPolicy;
    fetchOptions.integrity = options.integrity;
    fetchOptions.keepalive = options.keepalive;
    fetchOptions.signal = options.signal;
    fetchOptions.mode = options.mode;
  } else {
    fetchOptions.method = options.method;
    fetchOptions.body = options.body;
    fetchOptions.credentials = options.credentials;
    fetchOptions.cache = options.cache;
    fetchOptions.redirect = options.redirect;
    fetchOptions.referrer = options.referrer;
    fetchOptions.referrerPolicy = options.referrerPolicy;
    fetchOptions.integrity = options.integrity;
    fetchOptions.keepalive = options.keepalive;
    fetchOptions.signal = options.signal;
    fetchOptions.mode = options.mode;
  }
  
  return fetch(url, fetchOptions);
}
