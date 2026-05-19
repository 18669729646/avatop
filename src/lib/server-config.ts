/**
 * 服务端专用配置模块
 * 
 * 此文件包含直接从数据库获取真实 API Key 的函数。
 * 只能在服务端 API 路由中使用，禁止在前端组件中导入。
 * 
 * API Key 来源优先级：
 * 1. 数据库 system_config 表（优先）
 * 2. 环境变量 DEFAULT_API_CONFIGS（兜底）
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { TextApiConfig, ImageApiConfig, VideoApiConfig } from './system-config';

// 从环境变量解析默认配置
function parseDefaultConfigsFromEnv(): {
  textApis: TextApiConfig[];
  imageApis: ImageApiConfig[];
  videoApis: VideoApiConfig[];
  defaultTextApiId: string;
  defaultImageApiId: string;
  defaultVideoApiId: string;
} | null {
  // 检查环境变量是否存在
  const envConfig = process.env.DEFAULT_API_CONFIGS;
  if (!envConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(envConfig);
    
    // 验证必要字段
    if (!parsed.textApis?.length || !parsed.imageApis?.length || !parsed.videoApis?.length) {
      console.warn('[ServerConfig] 环境变量 DEFAULT_API_CONFIGS 缺少必要的 API 配置');
      return null;
    }

    return {
      textApis: parsed.textApis as TextApiConfig[],
      imageApis: parsed.imageApis as ImageApiConfig[],
      videoApis: parsed.videoApis as VideoApiConfig[],
      defaultTextApiId: parsed.defaultTextApiId || parsed.textApis[0].id,
      defaultImageApiId: parsed.defaultImageApiId || parsed.imageApis[0].id,
      defaultVideoApiId: parsed.defaultVideoApiId || parsed.videoApis[0].id,
    };
  } catch (error) {
    console.error('[ServerConfig] 解析环境变量 DEFAULT_API_CONFIGS 失败:', error);
    return null;
  }
}

// 获取空配置（不包含真实 API Key）
function getEmptyConfigs(): {
  textApis: TextApiConfig[];
  imageApis: ImageApiConfig[];
  videoApis: VideoApiConfig[];
  defaultTextApiId: string;
  defaultImageApiId: string;
  defaultVideoApiId: string;
} {
  const now = Date.now();
  return {
    textApis: [{
      id: 'default-text-api',
      name: '默认文本 API',
      type: 'text' as const,
      apiKey: '',
      baseUrl: '',
      model: '',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }],
    imageApis: [{
      id: 'default-image-api',
      name: '默认图片 API',
      type: 'image' as const,
      apiKey: '',
      baseUrl: '',
      model: '',
      defaultAspectRatio: '1:1',
      defaultResolution: '1K',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }],
    videoApis: [{
      id: 'default-video-api',
      name: '默认视频 API',
      type: 'video' as const,
      apiKey: '',
      baseUrl: '',
      model: '',
      defaultAspectRatio: '9:16',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }],
    defaultTextApiId: 'default-text-api',
    defaultImageApiId: 'default-image-api',
    defaultVideoApiId: 'default-video-api',
  };
}

/**
 * 服务端专用：从数据库获取真实的 API 配置
 * 优先级：数据库 > 环境变量 > 空配置
 */
export async function getServerApiConfig(): Promise<{
  textApis: TextApiConfig[];
  imageApis: ImageApiConfig[];
  videoApis: VideoApiConfig[];
  defaultTextApiId: string;
  defaultImageApiId: string;
  defaultVideoApiId: string;
}> {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('system_config')
      .select('*');
    
    if (error) {
      console.error('[ServerConfig] 获取配置失败:', error);
      // 尝试从环境变量获取
      return parseDefaultConfigsFromEnv() || getEmptyConfigs();
    }
    
    if (!data || data.length === 0) {
      // 数据库无配置，尝试从环境变量获取
      return parseDefaultConfigsFromEnv() || getEmptyConfigs();
    }
    
    // 将数据库记录转换为配置对象
    const config: Record<string, unknown> = {};
    for (const item of data) {
      if (item.config_type && item.extra_config) {
        config[item.config_type] = item.extra_config;
      }
    }
    
    // 解析配置（支持数组格式或 { items: [...] } 格式）
    const parseApis = (apis: unknown, type: 'text' | 'image' | 'video'): ImageApiConfig[] | TextApiConfig[] | VideoApiConfig[] => {
      let items: unknown[] = [];
      
      if (Array.isArray(apis)) {
        items = apis;
      } else if (apis && typeof apis === 'object' && 'items' in (apis as Record<string, unknown>)) {
        const apisObj = apis as Record<string, unknown>;
        if (Array.isArray(apisObj.items)) {
          items = apisObj.items as unknown[];
        }
      }
      
      // 根据类型过滤
      return items.filter(api => {
        const apiConfig = api as Record<string, unknown>;
        return apiConfig.apiKey && apiConfig.type === type;
      }) as TextApiConfig[] | ImageApiConfig[] | VideoApiConfig[];
    };
    
    // 验证配置完整性
    const textApis = parseApis(config.textApis, 'text') as TextApiConfig[];
    const imageApis = parseApis(config.imageApis, 'image') as ImageApiConfig[];
    const videoApis = parseApis(config.videoApis, 'video') as VideoApiConfig[];
    
    // 从 defaults 配置中获取默认 ID
    const defaults = config.defaults as { defaultTextApiId?: string; defaultImageApiId?: string; defaultVideoApiId?: string } | undefined;
    const defaultTextApiId = defaults?.defaultTextApiId;
    const defaultImageApiId = defaults?.defaultImageApiId;
    const defaultVideoApiId = defaults?.defaultVideoApiId;
    
    // 如果数据库配置不完整，尝试合并环境变量配置
    if (textApis.length === 0 || imageApis.length === 0 || videoApis.length === 0) {
      const envConfigs = parseDefaultConfigsFromEnv();
      if (envConfigs) {
        return {
          textApis: textApis.length > 0 ? textApis : envConfigs.textApis,
          imageApis: imageApis.length > 0 ? imageApis : envConfigs.imageApis,
          videoApis: videoApis.length > 0 ? videoApis : envConfigs.videoApis,
          defaultTextApiId: defaultTextApiId || envConfigs.defaultTextApiId,
          defaultImageApiId: defaultImageApiId || envConfigs.defaultImageApiId,
          defaultVideoApiId: defaultVideoApiId || envConfigs.defaultVideoApiId,
        };
      }
    }
    
    return {
      textApis: textApis.length > 0 ? textApis : getEmptyConfigs().textApis,
      imageApis: imageApis.length > 0 ? imageApis : getEmptyConfigs().imageApis,
      videoApis: videoApis.length > 0 ? videoApis : getEmptyConfigs().videoApis,
      defaultTextApiId: defaultTextApiId || getEmptyConfigs().defaultTextApiId,
      defaultImageApiId: defaultImageApiId || getEmptyConfigs().defaultImageApiId,
      defaultVideoApiId: defaultVideoApiId || getEmptyConfigs().defaultVideoApiId,
    };
  } catch (error) {
    console.error('[ServerConfig] getServerApiConfig 失败:', error);
    return parseDefaultConfigsFromEnv() || getEmptyConfigs();
  }
}

/**
 * 服务端专用：获取默认的图片生成 API 配置
 */
export async function getServerDefaultImageApi(): Promise<ImageApiConfig | null> {
  const config = await getServerApiConfig();
  const defaultApi = config.imageApis.find(api => api.id === config.defaultImageApiId);
  return defaultApi || config.imageApis[0] || null;
}

/**
 * 服务端专用：获取默认的视频生成 API 配置
 */
export async function getServerDefaultVideoApi(): Promise<VideoApiConfig | null> {
  const config = await getServerApiConfig();
  const defaultApi = config.videoApis.find(api => api.id === config.defaultVideoApiId);
  return defaultApi || config.videoApis[0] || null;
}

/**
 * 服务端专用：获取默认的文本生成 API 配置
 */
export async function getServerDefaultTextApi(): Promise<TextApiConfig | null> {
  const config = await getServerApiConfig();
  const defaultApi = config.textApis.find(api => api.id === config.defaultTextApiId);
  return defaultApi || config.textApis[0] || null;
}

/**
 * 服务端专用：根据 model 匹配文本生成 API 配置
 * 优先精确匹配 model，其次返回默认配置
 */
export async function getServerTextApiByModel(model?: string): Promise<TextApiConfig | null> {
  const config = await getServerApiConfig();
  
  // 优先精确匹配 model
  if (model) {
    const matchedByModel = config.textApis.find(
      api => api.model && api.model.toLowerCase() === model.toLowerCase()
    );
    if (matchedByModel) {
      return matchedByModel;
    }
  }
  
  // 最后返回默认配置
  const defaultApi = config.textApis.find(api => api.id === config.defaultTextApiId);
  return defaultApi || config.textApis[0] || null;
}

/**
 * 服务端专用：根据 baseUrl 或 model 匹配图片生成 API 配置
 * 优先精确匹配 baseUrl，其次匹配 model，最后返回默认配置
 */
export async function getServerImageApiByBaseUrlOrModel(
  baseUrl?: string,
  model?: string
): Promise<ImageApiConfig | null> {
  const config = await getServerApiConfig();
  
  // 【修复】优先精确匹配 model（用户最明确的选择），其次匹配 baseUrl，最后返回默认配置
  // 注意：多个配置可能共用同一个 baseUrl（如 nano-banana-2 和 gpt-image-2 都用 grsaiapi.com），
  // 此时必须以 model 优先，否则会匹配到错误的配置
  if (model) {
    const matchedByModel = config.imageApis.find(
      api => api.model && api.model.toLowerCase() === model.toLowerCase()
    );
    if (matchedByModel) {
      return matchedByModel;
    }
  }

  if (baseUrl) {
    const matchedByBaseUrl = config.imageApis.find(
      api => api.baseUrl && api.baseUrl.toLowerCase() === baseUrl.toLowerCase()
    );
    if (matchedByBaseUrl) {
      return matchedByBaseUrl;
    }
  }
  
  // 最后返回默认配置
  const defaultApi = config.imageApis.find(api => api.id === config.defaultImageApiId);
  return defaultApi || config.imageApis[0] || null;
}

/**
 * 服务端专用：根据 baseUrl 或 model 匹配视频生成 API 配置
 * 优先精确匹配 model（因为 baseUrl 可能相同），其次匹配 baseUrl，最后返回默认配置
 */
export async function getServerVideoApiByBaseUrlOrModel(
  baseUrl?: string,
  model?: string
): Promise<VideoApiConfig | null> {
  const config = await getServerApiConfig();
  
  // 优先精确匹配 model（因为多个配置可能使用相同的 baseUrl）
  if (model) {
    const matchedByModel = config.videoApis.find(
      api => api.model && api.model.toLowerCase() === model.toLowerCase()
    );
    if (matchedByModel) {
      return matchedByModel;
    }
  }
  
  // 其次匹配 baseUrl
  if (baseUrl) {
    const matchedByBaseUrl = config.videoApis.find(
      api => api.baseUrl && api.baseUrl.toLowerCase() === baseUrl.toLowerCase()
    );
    if (matchedByBaseUrl) {
      return matchedByBaseUrl;
    }
  }
  
  // 最后返回默认配置
  const defaultApi = config.videoApis.find(api => api.id === config.defaultVideoApiId);
  return defaultApi || config.videoApis[0] || null;
}

/**
 * 检查系统是否已配置 API Key（用于健康检查）
 */
export async function checkApiConfigured(): Promise<{
  text: boolean;
  image: boolean;
  video: boolean;
}> {
  const config = await getServerApiConfig();
  return {
    text: config.textApis.some(api => api.apiKey && api.apiKey.length > 0),
    image: config.imageApis.some(api => api.apiKey && api.apiKey.length > 0),
    video: config.videoApis.some(api => api.apiKey && api.apiKey.length > 0),
  };
}
