// 历史记录管理工具 - 服务器端存储版本
import { 
  withCache, 
  invalidateCache, 
  invalidateCacheByPrefix,
  CacheKeys,
  CACHE_TTL 
} from './cache';
import { getCurrentUserId } from './api';

export interface ImageHistoryItem {
  id: string;
  url: string;
  prompt: string;
  createdAt: string | number;
  aspectRatio?: string;
  resolution?: string;
  fileSize?: number; // 文件大小（字节）
}

export interface VideoHistoryItem {
  id: string;
  taskId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  createdAt: string | number;
  model?: string;
  aspectRatio?: string;
  duration?: number;
  status: string;
  error?: string;
  fileSize?: number; // 文件大小（字节）
}

// 角色图库项
export interface CharacterItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  tags?: string[];
  createdAt: string | number;
  // 用户信息（管理员视图时显示）
  userId?: string;
  userPhone?: string;
  userNickname?: string;
}

// 产品图库项
export interface ProductItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  tags?: string[];
  createdAt: string | number;
}

// API 请求辅助函数
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // 在服务器端，需要使用完整的 URL
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
  
  // 添加 Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    // 如果是 401 错误，说明未登录或 token 过期，静默处理
    if (response.status === 401) {
      console.log(`[apiRequest] 未授权: ${url}`);
      throw new Error('未登录');
    }
    
    // 其他错误也静默处理，避免控制台显示错误
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    console.log(`[apiRequest] 请求失败: ${url}, 状态: ${response.status}, 错误: ${error.error}`);
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// ========== 图片历史记录 ==========

export async function getImageHistory(): Promise<ImageHistoryItem[]> {
  try {
    const result = await apiRequest<{ data: ImageHistoryItem[] }>('/api/images/history');
    return result.data || [];
  } catch (error) {
    console.error('Failed to get image history:', error);
    return [];
  }
}

export async function addImageToHistory(item: Omit<ImageHistoryItem, 'id' | 'createdAt'>): Promise<ImageHistoryItem | null> {
  try {
    const result = await apiRequest<{ data: ImageHistoryItem }>('/api/images/history', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return result.data;
  } catch (error) {
    console.error('Failed to add image to history:', error);
    return null;
  }
}

export async function removeImageFromHistory(id: string): Promise<boolean> {
  try {
    await apiRequest('/api/images/history?id=' + id, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Failed to remove image from history:', error);
    return false;
  }
}

export async function clearImageHistory(): Promise<boolean> {
  try {
    await apiRequest('/api/images/history', { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Failed to clear image history:', error);
    return false;
  }
}

// ========== 视频历史记录 ==========

export async function getVideoHistory(): Promise<VideoHistoryItem[]> {
  try {
    const result = await apiRequest<{ data: VideoHistoryItem[] }>('/api/videos/history');
    return result.data || [];
  } catch (error) {
    console.error('Failed to get video history:', error);
    return [];
  }
}

export async function addVideoToHistory(item: Omit<VideoHistoryItem, 'id' | 'createdAt'>): Promise<VideoHistoryItem | null> {
  try {
    const result = await apiRequest<{ data: VideoHistoryItem }>('/api/videos/history', {
      method: 'POST',
      body: JSON.stringify({
        url: item.videoUrl,
        prompt: item.prompt,
        aspectRatio: item.aspectRatio,
        duration: item.duration,
        fileSize: item.fileSize,
      }),
    });
    return result.data;
  } catch (error) {
    console.error('Failed to add video to history:', error);
    return null;
  }
}

export async function removeVideoFromHistory(id: string): Promise<boolean> {
  try {
    await apiRequest('/api/videos/history?id=' + id, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Failed to remove video from history:', error);
    return false;
  }
}

export async function clearVideoHistory(): Promise<boolean> {
  try {
    await apiRequest('/api/videos/history', { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Failed to clear video history:', error);
    return false;
  }
}

// ========== 角色图库管理 ==========

export async function getCharacterLibrary(
  forceRefresh = false,
  page?: number,
  pageSize?: number
): Promise<CharacterItem[] | { data: CharacterItem[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }> {
  try {
    const usePagination = page !== undefined && pageSize !== undefined;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      return usePagination ? { data: [] } : [];
    }

    const userId = getCurrentUserId();
    const params = new URLSearchParams({ 
      page: (page || 1).toString(), 
      pageSize: (pageSize || 20).toString() 
    });
    const cacheKey = userId ? `characters:${userId}:${page || 1}:${pageSize || 20}` : `characters:${page || 1}:${pageSize || 20}`;
    
    const result = await withCache(
      cacheKey,
      async () => {
        const response = await fetch(`/api/characters?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('[CharacterLibrary] 未授权，请先登录');
            return { data: [], pagination: undefined };
          }
          const errorText = await response.text();
          console.log('[CharacterLibrary] API error:', response.status, errorText);
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
          data: data.data || [],
          pagination: data.pagination,
        };
      },
      { ttl: CACHE_TTL.PRODUCTS, forceRefresh }
    );
    
    if (!usePagination) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.log('[CharacterLibrary] Failed to load:', error instanceof Error ? error.message : error);
    return { data: [] };
  }
}

export async function addToCharacterLibrary(item: Omit<CharacterItem, 'id' | 'createdAt'>): Promise<CharacterItem | null> {
  try {
    const result = await apiRequest<{ data: CharacterItem }>('/api/characters', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    
    // 使缓存失效
    invalidateCacheByPrefix('characters:');
    
    return result.data;
  } catch (error) {
    console.error('Failed to add to character library:', error);
    return null;
  }
}

export async function removeFromCharacterLibrary(id: string): Promise<boolean> {
  try {
    await apiRequest('/api/characters?id=' + id, { method: 'DELETE' });
    
    // 使缓存失效
    invalidateCacheByPrefix('characters:');
    
    return true;
  } catch (error) {
    console.error('Failed to remove from character library:', error);
    return false;
  }
}

export async function updateCharacterInLibrary(id: string, updates: Partial<CharacterItem>): Promise<boolean> {
  try {
    // 获取当前角色信息，然后更新
    const library = await getCharacterLibrary();
    const libraryArray = Array.isArray(library) ? library : library.data;
    const item = libraryArray.find(c => c.id === id);
    if (!item) return false;
    
    // 删除旧的，添加新的
    await removeFromCharacterLibrary(id);
    await addToCharacterLibrary({
      name: updates.name || item.name,
      url: updates.url || item.url,
      description: updates.description || item.description,
      tags: updates.tags || item.tags,
    });
    return true;
  } catch (error) {
    console.error('Failed to update character in library:', error);
    return false;
  }
}

export async function clearCharacterLibrary(): Promise<boolean> {
  try {
    // 批量删除
    const library = await getCharacterLibrary();
    const libraryArray = Array.isArray(library) ? library : library.data;
    await Promise.all(libraryArray.map(item => removeFromCharacterLibrary(item.id)));
    
    // 使缓存失效
    invalidateCacheByPrefix('characters:');
    
    return true;
  } catch (error) {
    console.error('Failed to clear character library:', error);
    return false;
  }
}

// ========== 产品图库管理 ==========

export async function getProductLibrary(): Promise<ProductItem[]> {
  try {
    const result = await apiRequest<{ data: ProductItem[] }>('/api/products');
    return result.data || [];
  } catch (error) {
    console.error('Failed to get product library:', error);
    return [];
  }
}

export async function addToProductLibrary(item: Omit<ProductItem, 'id' | 'createdAt'>): Promise<ProductItem | null> {
  try {
    const result = await apiRequest<{ data: ProductItem }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return result.data;
  } catch (error) {
    console.error('Failed to add to product library:', error);
    return null;
  }
}

export async function removeFromProductLibrary(id: string): Promise<boolean> {
  try {
    await apiRequest('/api/products?id=' + id, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Failed to remove from product library:', error);
    return false;
  }
}

export async function clearProductLibrary(): Promise<boolean> {
  try {
    // 批量删除
    const library = await getProductLibrary();
    await Promise.all(library.map(item => removeFromProductLibrary(item.id)));
    return true;
  } catch (error) {
    console.error('Failed to clear product library:', error);
    return false;
  }
}

// ========== 存储统计信息 ==========

export interface StorageStats {
  imageHistory: number;      // 生成图片数量
  videoHistory: number;      // 生成视频数量
  characterLibrary: number;  // 角色图库数量
  productLibrary: number;    // 产品图库数量
  totalSize: number;         // 总存储使用量（字节）
}

export async function getStorageStats(): Promise<StorageStats> {
  // 动态导入避免循环依赖
  const { getProductsStats } = await import('./products');
  
  const [imageHistory, videoHistory, characterLibrary, productsStats] = await Promise.all([
    getImageHistory(),
    getVideoHistory(),
    getCharacterLibrary(),
    getProductsStats(true), // 强制刷新缓存
  ]);

  // 处理 characterLibrary 的返回值类型
  const characterLibraryArray = Array.isArray(characterLibrary) ? characterLibrary : characterLibrary.data;

  // 获取存储使用量（从服务器端统计）
  let totalSize = 0;
  try {
    const storageRes = await fetch('/api/storage/stats');
    if (storageRes.ok) {
      const storageData = await storageRes.json();
      if (storageData.success && storageData.data) {
        totalSize = storageData.data.totalSize || 0;
      }
    }
  } catch {
    totalSize = 0;
  }

  return {
    imageHistory: imageHistory.length,
    videoHistory: videoHistory.length,
    characterLibrary: characterLibraryArray.length,
    productLibrary: productsStats.totalProducts,
    totalSize,
  };
}

export async function clearAllHistoryData(): Promise<void> {
  // 动态导入避免循环依赖
  const { clearAllProducts } = await import('./products');
  const { authFetch } = await import('./auth-context');
  
  await Promise.all([
    clearImageHistory(),
    clearVideoHistory(),
    clearCharacterLibrary(),
    clearProductLibrary(),
    clearAllProducts(), // 清除完整产品数据（products 表）
    // 清除短片项目
    authFetch('/api/shortfilm/projects', { method: 'DELETE' }).catch(err => {
      console.error('Failed to clear shortfilm projects:', err);
    }),
    // 清除广告模板（用户创建的，不包括系统模板）
    authFetch('/api/template-library?all=true', { method: 'DELETE' }).catch(err => {
      console.error('Failed to clear templates:', err);
    }),
  ]);
  console.log('All history data cleared');
}
