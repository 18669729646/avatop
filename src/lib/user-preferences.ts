/**
 * 用户偏好管理工具
 * 管理用户级别的偏好设置：收藏、最近使用、使用统计等
 */
import { 
  withCache, 
  invalidateCache, 
  CacheKeys,
  CACHE_TTL 
} from './cache';

// 最近使用的模板
export interface RecentTemplate {
  id: string;
  usedAt: number;
  variableValues?: Record<string, string>;
}

// 用户偏好数据
export interface UserPreferences {
  favoriteTemplates: string[];
  recentTemplates: RecentTemplate[];
  templateUsageStats: Record<string, number>;
}

const MAX_RECENT_TEMPLATES = 10;

// API 请求辅助函数
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const fullUrl = typeof window === 'undefined' 
    ? `http://localhost:5000${url}` 
    : url;
  
  // 获取认证 token
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('auth_token') 
    : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
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
 * 获取用户偏好
 */
export async function getUserPreferences(forceRefresh = false): Promise<UserPreferences> {
  try {
    return await withCache(
      CacheKeys.userPreferences(),
      async () => {
        const result = await apiRequest<{ data: UserPreferences }>('/api/user-preferences');
        return result.data || {
          favoriteTemplates: [],
          recentTemplates: [],
          templateUsageStats: {},
        };
      },
      { ttl: CACHE_TTL.SYSTEM_CONFIG, forceRefresh }
    );
  } catch (error) {
    console.error('Failed to get user preferences:', error);
    return {
      favoriteTemplates: [],
      recentTemplates: [],
      templateUsageStats: {},
    };
  }
}

// ==================== 收藏功能 ====================

/**
 * 获取收藏的模板ID列表
 */
export async function getFavoriteTemplates(): Promise<string[]> {
  const prefs = await getUserPreferences();
  return prefs.favoriteTemplates || [];
}

/**
 * 切换收藏状态
 * @returns 返回是否新增收藏
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    const prefs = await getUserPreferences();
    const favorites = prefs.favoriteTemplates || [];
    const index = favorites.indexOf(id);
    
    if (index > -1) {
      // 取消收藏
      favorites.splice(index, 1);
    } else {
      // 添加收藏
      favorites.unshift(id);
    }
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ favoriteTemplates: favorites }),
    });
    
    // 使缓存失效
    invalidateCache(CacheKeys.userPreferences());
    
    return index === -1; // 返回是否新增收藏
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return false;
  }
}

/**
 * 检查是否已收藏
 */
export async function isFavorite(id: string): Promise<boolean> {
  const favorites = await getFavoriteTemplates();
  return favorites.includes(id);
}

// ==================== 最近使用 ====================

/**
 * 获取最近使用的模板
 */
export async function getRecentTemplates(): Promise<RecentTemplate[]> {
  const prefs = await getUserPreferences();
  return prefs.recentTemplates || [];
}

/**
 * 添加到最近使用
 */
export async function addToRecentTemplates(id: string, variableValues?: Record<string, string>): Promise<void> {
  try {
    const prefs = await getUserPreferences();
    let recent = prefs.recentTemplates || [];
    
    // 移除旧的记录
    recent = recent.filter(r => r.id !== id);
    
    // 添加到开头
    recent.unshift({ id, usedAt: Date.now(), variableValues });
    
    // 限制数量
    recent = recent.slice(0, MAX_RECENT_TEMPLATES);
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ recentTemplates: recent }),
    });
    
    // 使缓存失效
    invalidateCache(CacheKeys.userPreferences());
  } catch (error) {
    console.error('Failed to add to recent templates:', error);
  }
}

/**
 * 清除最近使用记录
 */
export async function clearRecentTemplates(): Promise<void> {
  try {
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ recentTemplates: [] }),
    });
    
    // 使缓存失效
    invalidateCache(CacheKeys.userPreferences());
  } catch (error) {
    console.error('Failed to clear recent templates:', error);
  }
}

// ==================== 使用统计 ====================

/**
 * 获取使用统计
 */
export async function getUsageStats(): Promise<Record<string, number>> {
  const prefs = await getUserPreferences();
  return prefs.templateUsageStats || {};
}

/**
 * 增加使用次数
 */
export async function incrementUsage(id: string): Promise<void> {
  try {
    const prefs = await getUserPreferences();
    const stats = prefs.templateUsageStats || {};
    
    stats[id] = (stats[id] || 0) + 1;
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ templateUsageStats: stats }),
    });
    
    // 使缓存失效
    invalidateCache(CacheKeys.userPreferences());
  } catch (error) {
    console.error('Failed to increment usage:', error);
  }
}

// ==================== UI 状态 ====================


