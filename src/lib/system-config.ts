// 系统配置管理模块
import { 
  withCache, 
  invalidateCache, 
  CacheKeys,
  CACHE_TTL 
} from './cache';

// API配置项
export interface ApiConfig {
  id: string;
  name: string; // 配置名称，如"云雾"、"OpenAI"等
  apiKey: string;
  apiKeyMasked?: string; // 脱敏后的 API Key（前端显示用）
  baseUrl: string;
  model?: string; // 默认模型
  isDefault?: boolean; // 是否为默认配置
  createdAt: number;
  updatedAt: number;
}

// 文本生成配置
export interface TextApiConfig extends ApiConfig {
  type: 'text';
}

// 图片生成配置
export interface ImageApiConfig extends ApiConfig {
  type: 'image';
  defaultAspectRatio?: string;
  defaultResolution?: string;
}

// 视频生成配置
export interface VideoApiConfig extends ApiConfig {
  type: 'video';
  defaultAspectRatio?: string;
  defaultResolution?: string;   // 图片/Seedance 默认分辨率
  description?: string;
  // Seedance 2.0 专属默认配置
  seedanceDefaultDuration?: number;        // 默认时长：4-15 秒，默认 5
  seedanceDefaultWatermark?: boolean;     // 默认水印
  seedanceDefaultRealPersonMode?: boolean;// 默认真人模式
}

// 系统配置
export interface DownloadApiConfig extends ApiConfig {
  type: 'download';
  provider: 'tikhub' | string;
}

export interface SystemConfig {
  textApis: TextApiConfig[];
  imageApis: ImageApiConfig[];
  videoApis: VideoApiConfig[];
  downloadApis?: DownloadApiConfig[];
  defaultTextApiId: string;
  defaultImageApiId: string;
  defaultVideoApiId: string;
  defaultDownloadApiId?: string;
}

// 支持的图片生成模型列表（统一管理）
export const IMAGE_MODELS = [
  // GrsAI NanoBanana 系列
  'nano-banana-pro',
  'nano-banana-2',
  // GrsAI GPTImage 系列
  'sora-image',
  'gpt-image-2',
  'gpt-image',
  // Gemini 系列
  'gemini-3.0-flash-preview',
  'gemini-3.1-flash-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.0-flash-exp',
  // 其他
  'flux-dev',
  'flux-schnell',
  'flux-pro',
  'flux-pro-1.1',
  'imagegen',
  'imagegen-3.0',
] as const;

// 支持的视频生成模型列表（统一管理）
export const VIDEO_MODELS = [
  'veo2',
  'veo2-fast',
  'veo2-fast-frames',
  'veo2-fast-components',
  'veo2-pro',
  'veo2-pro-components',
  'veo3',
  'veo3-fast',
  'veo3-fast-frames',
  'veo3-frames',
  'veo3-pro',
  'veo3-pro-frames',
  'veo3.1',
  'veo3.1-fast',
  'veo_3_1',          // OpenAI 格式
  'veo_3_1-fast',     // OpenAI 格式
  'veo_3_1-lite',     // OpenAI 格式 (轻量版)
  'veo_3_1-lite-4K', // OpenAI 格式 (轻量版 4K)
  'veo_3_1-pro',
  'veo3.1-fast-components',
  'veo3.1-pro',
  'veo3.1-4k',
  'veo3.1-pro-4k',
  // Doubao Seedance 2.0
  'doubao-seedance-2.0',       // Seedance 2.0 标准版（JSON 格式）
  'doubao-seedance-2.0-fast',   // Seedance 2.0 快速版（JSON 格式）
] as const;

// 支持首尾帧的模型（最多2张图片）
export const FRAMES_MODELS = [
  'veo2-fast-frames', 'veo3-fast-frames', 'veo3-frames', 'veo3-pro-frames',
  'veo_3_1-fast',
  'doubao-seedance-2.0', 'doubao-seedance-2.0-fast', // Seedance 2.0 支持首尾帧
] as const;

// 支持参考图的模型（最多3张图片）
export const COMPONENTS_MODELS = ['veo2-fast-components', 'veo3.1-fast-components'] as const;

// 配置版本号
const CONFIG_VERSION = 8;

// 内存缓存
let configCache: SystemConfig | null = null;

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
  
  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// 默认配置（空配置，真实配置从后端 API 获取）
// 注意：此处不包含真实 API Key，仅作为初始状态
const DEFAULT_CONFIGS: SystemConfig = {
  textApis: [],
  imageApis: [],
  videoApis: [],
  downloadApis: [],
  defaultTextApiId: '',
  defaultImageApiId: '',
  defaultVideoApiId: '',
  defaultDownloadApiId: '',
};

// 获取系统配置
export function getSystemConfig(): SystemConfig {
  if (configCache) return configCache;
  
  // 触发异步加载
  getSystemConfigAsync().then(config => {
    configCache = config;
  });
  
  return DEFAULT_CONFIGS;
}

// 保存系统配置
export function saveSystemConfig(config: SystemConfig): void {
  // 立即更新缓存
  configCache = config;
  
  // 后台保存到服务器
  saveSystemConfigAsync(config);
}

// 异步版本 - 从服务器获取配置
export async function getSystemConfigAsync(forceRefresh = false): Promise<SystemConfig> {
  try {
    // 如果需要强制刷新，先清除缓存
    if (forceRefresh) {
      invalidateCache(CacheKeys.allSystemConfigs());
      configCache = null;
    }
    
    return await withCache(
      CacheKeys.allSystemConfigs(),
      async () => {
        const result = await apiRequest<{ data: SystemConfig }>('/api/system-config');
        return result.data || DEFAULT_CONFIGS;
      },
      { ttl: CACHE_TTL.SYSTEM_CONFIG }
    );
  } catch (error) {
    console.error('Failed to get system config:', error);
    return DEFAULT_CONFIGS;
  }
}

// 异步版本 - 保存配置到服务器
export async function saveSystemConfigAsync(config: SystemConfig): Promise<boolean> {
  try {
    await apiRequest('/api/system-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    
    // 更新缓存
    configCache = config;
    invalidateCache(CacheKeys.allSystemConfigs());
    
    return true;
  } catch (error) {
    console.error('Failed to save system config:', error);
    return false;
  }
}

// 获取默认文本API配置
export function getDefaultTextApi(): TextApiConfig | null {
  const config = getSystemConfig();
  const defaultApi = config.textApis.find(api => api.id === config.defaultTextApiId);
  return defaultApi || config.textApis[0] || null;
}

// 获取默认图片API配置
export function getDefaultImageApi(): ImageApiConfig | null {
  const config = getSystemConfig();
  const defaultApi = config.imageApis.find(api => api.id === config.defaultImageApiId);
  return defaultApi || config.imageApis[0] || null;
}

// 获取默认视频API配置
export function getDefaultVideoApi(): VideoApiConfig | null {
  const config = getSystemConfig();
  const defaultApi = config.videoApis.find(api => api.id === config.defaultVideoApiId);
  return defaultApi || config.videoApis[0] || null;
}

// 添加文本API配置
export function addTextApiConfig(config: Omit<TextApiConfig, 'id' | 'createdAt' | 'updatedAt'>): TextApiConfig {
  const systemConfig = getSystemConfig();
  const newConfig: TextApiConfig = {
    ...config,
    id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.textApis.push(newConfig);
  if (config.isDefault || systemConfig.textApis.length === 1) {
    systemConfig.defaultTextApiId = newConfig.id;
  }
  saveSystemConfig(systemConfig);
  return newConfig;
}

// 添加图片API配置
export function addImageApiConfig(config: Omit<ImageApiConfig, 'id' | 'createdAt' | 'updatedAt'>): ImageApiConfig {
  const systemConfig = getSystemConfig();
  const newConfig: ImageApiConfig = {
    ...config,
    id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.imageApis.push(newConfig);
  if (config.isDefault || systemConfig.imageApis.length === 1) {
    systemConfig.defaultImageApiId = newConfig.id;
  }
  saveSystemConfig(systemConfig);
  return newConfig;
}

// 添加视频API配置
export function addVideoApiConfig(config: Omit<VideoApiConfig, 'id' | 'createdAt' | 'updatedAt'>): VideoApiConfig {
  const systemConfig = getSystemConfig();
  const newConfig: VideoApiConfig = {
    ...config,
    id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.videoApis.push(newConfig);
  if (config.isDefault || systemConfig.videoApis.length === 1) {
    systemConfig.defaultVideoApiId = newConfig.id;
  }
  saveSystemConfig(systemConfig);
  return newConfig;
}

// 更新文本API配置
export function updateTextApiConfig(id: string, updates: Partial<TextApiConfig>): void {
  const systemConfig = getSystemConfig();
  const index = systemConfig.textApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.textApis[index] = {
      ...systemConfig.textApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultTextApiId = id;
    }
    saveSystemConfig(systemConfig);
  }
}

// 更新图片API配置
export function updateImageApiConfig(id: string, updates: Partial<ImageApiConfig>): void {
  const systemConfig = getSystemConfig();
  const index = systemConfig.imageApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.imageApis[index] = {
      ...systemConfig.imageApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultImageApiId = id;
    }
    saveSystemConfig(systemConfig);
  }
}

// 更新视频API配置
export function updateVideoApiConfig(id: string, updates: Partial<VideoApiConfig>): void {
  const systemConfig = getSystemConfig();
  const index = systemConfig.videoApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.videoApis[index] = {
      ...systemConfig.videoApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultVideoApiId = id;
    }
    saveSystemConfig(systemConfig);
  }
}

// 删除文本API配置
export function deleteTextApiConfig(id: string): void {
  const systemConfig = getSystemConfig();
  systemConfig.textApis = systemConfig.textApis.filter(api => api.id !== id);
  if (systemConfig.defaultTextApiId === id && systemConfig.textApis.length > 0) {
    systemConfig.defaultTextApiId = systemConfig.textApis[0].id;
  }
  saveSystemConfig(systemConfig);
}

// 删除图片API配置
export function deleteImageApiConfig(id: string): void {
  const systemConfig = getSystemConfig();
  systemConfig.imageApis = systemConfig.imageApis.filter(api => api.id !== id);
  if (systemConfig.defaultImageApiId === id && systemConfig.imageApis.length > 0) {
    systemConfig.defaultImageApiId = systemConfig.imageApis[0].id;
  }
  saveSystemConfig(systemConfig);
}

// 删除视频API配置
export function deleteVideoApiConfig(id: string): void {
  const systemConfig = getSystemConfig();
  systemConfig.videoApis = systemConfig.videoApis.filter(api => api.id !== id);
  if (systemConfig.defaultVideoApiId === id && systemConfig.videoApis.length > 0) {
    systemConfig.defaultVideoApiId = systemConfig.videoApis[0].id;
  }
  saveSystemConfig(systemConfig);
}

// 设置默认API
export function setDefaultApi(type: 'text' | 'image' | 'video', id: string): void {
  const systemConfig = getSystemConfig();
  if (type === 'text') {
    systemConfig.defaultTextApiId = id;
  } else if (type === 'image') {
    systemConfig.defaultImageApiId = id;
  } else if (type === 'video') {
    systemConfig.defaultVideoApiId = id;
  }
  saveSystemConfig(systemConfig);
}

// 重置为默认配置
export function resetSystemConfig(): void {
  // 立即更新缓存
  configCache = DEFAULT_CONFIGS;
  
  // 后台保存到服务器
  saveSystemConfigAsync(DEFAULT_CONFIGS);
}

// 异步版本 - 重置为默认配置
export async function resetSystemConfigAsync(): Promise<boolean> {
  return saveSystemConfigAsync(DEFAULT_CONFIGS);
}

// ========== 异步版本的增删改函数 ==========

// 异步版本 - 添加文本API配置
export async function addTextApiConfigAsync(config: Omit<TextApiConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<TextApiConfig> {
  const systemConfig = await getSystemConfigAsync();
  const newConfig: TextApiConfig = {
    ...config,
    id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.textApis.push(newConfig);
  if (config.isDefault || systemConfig.textApis.length === 1) {
    systemConfig.defaultTextApiId = newConfig.id;
  }
  await saveSystemConfigAsync(systemConfig);
  return newConfig;
}

// 异步版本 - 添加图片API配置
export async function addImageApiConfigAsync(config: Omit<ImageApiConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImageApiConfig> {
  const systemConfig = await getSystemConfigAsync();
  const newConfig: ImageApiConfig = {
    ...config,
    id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.imageApis.push(newConfig);
  if (config.isDefault || systemConfig.imageApis.length === 1) {
    systemConfig.defaultImageApiId = newConfig.id;
  }
  await saveSystemConfigAsync(systemConfig);
  return newConfig;
}

// 异步版本 - 添加视频API配置
export async function addVideoApiConfigAsync(config: Omit<VideoApiConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<VideoApiConfig> {
  const systemConfig = await getSystemConfigAsync();
  const newConfig: VideoApiConfig = {
    ...config,
    id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.videoApis.push(newConfig);
  if (config.isDefault || systemConfig.videoApis.length === 1) {
    systemConfig.defaultVideoApiId = newConfig.id;
  }
  await saveSystemConfigAsync(systemConfig);
  return newConfig;
}

export async function addDownloadApiConfigAsync(config: Omit<DownloadApiConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<DownloadApiConfig> {
  const systemConfig = await getSystemConfigAsync();
  const newConfig: DownloadApiConfig = {
    ...config,
    id: `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  systemConfig.downloadApis = [...(systemConfig.downloadApis || []), newConfig];
  if (config.isDefault || !systemConfig.defaultDownloadApiId) {
    systemConfig.defaultDownloadApiId = newConfig.id;
  }
  await saveSystemConfigAsync(systemConfig);
  return newConfig;
}

// 异步版本 - 更新文本API配置
export async function updateTextApiConfigAsync(id: string, updates: Partial<TextApiConfig>): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  const index = systemConfig.textApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.textApis[index] = {
      ...systemConfig.textApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultTextApiId = id;
    }
    return saveSystemConfigAsync(systemConfig);
  }
  return false;
}

// 异步版本 - 更新图片API配置
export async function updateImageApiConfigAsync(id: string, updates: Partial<ImageApiConfig>): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  const index = systemConfig.imageApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.imageApis[index] = {
      ...systemConfig.imageApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultImageApiId = id;
    }
    return saveSystemConfigAsync(systemConfig);
  }
  return false;
}

// 异步版本 - 更新视频API配置
export async function updateVideoApiConfigAsync(id: string, updates: Partial<VideoApiConfig>): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  const index = systemConfig.videoApis.findIndex(api => api.id === id);
  if (index !== -1) {
    systemConfig.videoApis[index] = {
      ...systemConfig.videoApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    if (updates.isDefault) {
      systemConfig.defaultVideoApiId = id;
    }
    return saveSystemConfigAsync(systemConfig);
  }
  return false;
}

export async function updateDownloadApiConfigAsync(id: string, updates: Partial<DownloadApiConfig>): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  const downloadApis = systemConfig.downloadApis || [];
  const index = downloadApis.findIndex(api => api.id === id);
  if (index !== -1) {
    downloadApis[index] = {
      ...downloadApis[index],
      ...updates,
      updatedAt: Date.now(),
    };
    systemConfig.downloadApis = downloadApis;
    if (updates.isDefault) {
      systemConfig.defaultDownloadApiId = id;
    }
    return saveSystemConfigAsync(systemConfig);
  }
  return false;
}

// 异步版本 - 删除文本API配置
export async function deleteTextApiConfigAsync(id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  systemConfig.textApis = systemConfig.textApis.filter(api => api.id !== id);
  if (systemConfig.defaultTextApiId === id && systemConfig.textApis.length > 0) {
    systemConfig.defaultTextApiId = systemConfig.textApis[0].id;
  }
  return saveSystemConfigAsync(systemConfig);
}

// 异步版本 - 删除图片API配置
export async function deleteImageApiConfigAsync(id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  systemConfig.imageApis = systemConfig.imageApis.filter(api => api.id !== id);
  if (systemConfig.defaultImageApiId === id && systemConfig.imageApis.length > 0) {
    systemConfig.defaultImageApiId = systemConfig.imageApis[0].id;
  }
  return saveSystemConfigAsync(systemConfig);
}

// 异步版本 - 删除视频API配置
export async function deleteVideoApiConfigAsync(id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  systemConfig.videoApis = systemConfig.videoApis.filter(api => api.id !== id);
  if (systemConfig.defaultVideoApiId === id && systemConfig.videoApis.length > 0) {
    systemConfig.defaultVideoApiId = systemConfig.videoApis[0].id;
  }
  return saveSystemConfigAsync(systemConfig);
}

export async function deleteDownloadApiConfigAsync(id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  systemConfig.downloadApis = (systemConfig.downloadApis || []).filter(api => api.id !== id);
  if (systemConfig.defaultDownloadApiId === id && systemConfig.downloadApis.length > 0) {
    systemConfig.defaultDownloadApiId = systemConfig.downloadApis[0].id;
  }
  return saveSystemConfigAsync(systemConfig);
}

// 异步版本 - 设置默认API
export async function setDefaultApiAsync(type: 'text' | 'image' | 'video', id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  if (type === 'text') {
    systemConfig.defaultTextApiId = id;
  } else if (type === 'image') {
    systemConfig.defaultImageApiId = id;
  } else if (type === 'video') {
    systemConfig.defaultVideoApiId = id;
  }
  return saveSystemConfigAsync(systemConfig);
}

export async function setDefaultDownloadApiAsync(id: string): Promise<boolean> {
  const systemConfig = await getSystemConfigAsync();
  systemConfig.defaultDownloadApiId = id;
  return saveSystemConfigAsync(systemConfig);
}

// ========== 服务端专用函数（见 server-config.ts）==========
// 服务端专用函数已移至 src/lib/server-config.ts，避免前端打包时解析 child_process
