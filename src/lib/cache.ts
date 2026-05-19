/**
 * 统一数据缓存工具
 * 用于提升数据加载性能，减少不必要的 API 请求
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  /** 缓存过期时间（毫秒），默认 5 分钟 */
  ttl?: number;
  /** 是否强制刷新缓存 */
  forceRefresh?: boolean;
}

// 默认缓存过期时间
const DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟

// 不同类型数据的缓存过期时间
export const CACHE_TTL = {
  /** 项目列表：2 分钟 */
  PROJECTS: 2 * 60 * 1000,
  /** 模板：10 分钟（变化较少） */
  TEMPLATES: 10 * 60 * 1000,
  /** 产品列表：10 分钟（变化较少） */
  PRODUCTS: 10 * 60 * 1000,
  /** 提示词模板：10 分钟 */
  PROMPT_TEMPLATES: 10 * 60 * 1000,
  /** 系统配置：30 分钟（变化很少） */
  SYSTEM_CONFIG: 30 * 60 * 1000,
  /** 通用：5 分钟 */
  DEFAULT: DEFAULT_TTL,
};

/**
 * 内存缓存管理器
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 删除匹配前缀的所有缓存
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 获取缓存统计信息
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// 全局缓存实例
export const cache = new MemoryCache();

/**
 * 缓存键生成器
 */
export const CacheKeys = {
  // 短片项目
  projects: () => 'shortfilm:projects',
  project: (id: string) => `shortfilm:project:${id}`,
  
  // 短片模板
  templates: () => 'shortfilm:templates',
  template: (id: string) => `shortfilm:template:${id}`,
  
  // 产品
  products: () => 'products:all',
  product: (id: string) => `products:${id}`,
  
  // 提示词模板
  promptTemplates: (isSystem?: boolean) => 
    isSystem === undefined ? 'prompt-templates:all' : `prompt-templates:system:${isSystem}`,
  promptTemplate: (id: string) => `prompt-templates:${id}`,
  
  // 角色库
  characters: () => 'characters:all',
  
  // 用户偏好
  userPreferences: () => 'user:preferences',
  
  // 队列配置
  queueConfig: () => 'queue:config',
  
  // 系统配置
  systemConfig: (key: string) => `system-config:${key}`,
  allSystemConfigs: () => 'system-config:all',
} as const;

/**
 * 创建带缓存的数据获取函数
 * @param key 缓存键
 * @param fetcher 数据获取函数
 * @param options 缓存选项
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, forceRefresh = false } = options;

  // 如果不是强制刷新，先尝试从缓存获取
  if (!forceRefresh) {
    const cached = cache.get<T>(key);
    if (cached !== null) {
      console.log(`[Cache] Hit: ${key}`);
      return cached;
    }
  }

  console.log(`[Cache] Miss: ${key}, fetching...`);
  
  // 获取新数据
  const data = await fetcher();
  
  // 存入缓存
  cache.set(key, data, ttl);
  
  return data;
}

/**
 * 使缓存失效
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
  console.log(`[Cache] Invalidated: ${key}`);
}

/**
 * 使匹配前缀的所有缓存失效
 */
export function invalidateCacheByPrefix(prefix: string): void {
  const count = cache.deleteByPrefix(prefix);
  console.log(`[Cache] Invalidated ${count} entries with prefix: ${prefix}`);
}

/**
 * 使所有缓存失效
 */
export function invalidateAllCache(): void {
  cache.clear();
  console.log('[Cache] All cache cleared');
}
