import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';

// 脱敏 API Key（显示前4位和后4位）
function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '****';
  return `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`;
}

// 检查是否是脱敏后的 Key（用于判断是否需要更新）
function isMaskedKey(key: string): boolean {
  return key.includes('****');
}

// 从环境变量解析默认配置
function parseDefaultConfigsFromEnv(): {
  textApis: Array<{ id: string; name: string; type: string; apiKey: string; baseUrl: string; model?: string; isDefault?: boolean; defaultAspectRatio?: string; defaultResolution?: string }>;
  imageApis: Array<{ id: string; name: string; type: string; apiKey: string; baseUrl: string; model?: string; isDefault?: boolean; defaultAspectRatio?: string; defaultResolution?: string }>;
  videoApis: Array<{ id: string; name: string; type: string; apiKey: string; baseUrl: string; model?: string; isDefault?: boolean; defaultAspectRatio?: string; defaultResolution?: string }>;
  downloadApis?: Array<{ id: string; name: string; type: string; provider: string; apiKey: string; baseUrl: string; model?: string; isDefault?: boolean }>;
  defaultTextApiId: string;
  defaultImageApiId: string;
  defaultVideoApiId: string;
  defaultDownloadApiId?: string;
} | null {
  const envConfig = process.env.DEFAULT_API_CONFIGS;
  if (!envConfig) {
    return null;
  }

  try {
    const parsed = JSON.parse(envConfig);
    
    if (!parsed.textApis?.length || !parsed.imageApis?.length || !parsed.videoApis?.length) {
      return null;
    }

    return {
      textApis: parsed.textApis,
      imageApis: parsed.imageApis,
      videoApis: parsed.videoApis,
      downloadApis: parsed.downloadApis || [],
      defaultTextApiId: parsed.defaultTextApiId || parsed.textApis[0].id,
      defaultImageApiId: parsed.defaultImageApiId || parsed.imageApis[0].id,
      defaultVideoApiId: parsed.defaultVideoApiId || parsed.videoApis[0].id,
      defaultDownloadApiId: parsed.defaultDownloadApiId || parsed.downloadApis?.[0]?.id || '',
    };
  } catch (error) {
    console.error('[System Config API] 解析环境变量失败:', error);
    return null;
  }
}

// 获取空配置（用于未配置时显示）
function getEmptyConfigs() {
  const now = Date.now();
  return {
    textApis: [{
      id: 'default-text-api',
      name: '请配置文本 API',
      type: 'text',
      apiKey: '',
      baseUrl: '',
      model: '',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }],
    imageApis: [{
      id: 'default-image-api',
      name: '请配置图片 API',
      type: 'image',
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
      name: '请配置视频 API',
      type: 'video',
      apiKey: '',
      baseUrl: '',
      model: '',
      defaultAspectRatio: '9:16',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }],
    downloadApis: [],
    defaultTextApiId: 'default-text-api',
    defaultImageApiId: 'default-image-api',
    defaultVideoApiId: 'default-video-api',
    defaultDownloadApiId: '',
  };
}

// 脱敏 API 配置列表（用于前端显示）
function maskApiConfigs<T extends { apiKey?: string }>(apis: T[]): (T & { apiKeyMasked: string })[] {
  return apis.map(api => ({
    ...api,
    apiKey: '', // 不返回真实 API Key
    apiKeyMasked: maskApiKey(api.apiKey),
  }));
}

// 获取系统配置（返回脱敏后的 API Key）
export async function GET() {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('system_config')
      .select('*');
    
    if (error) {
      console.error('[System Config API] 查询失败:', error);
      // 尝试从环境变量获取
      const envConfigs = parseDefaultConfigsFromEnv();
      if (envConfigs) {
        return NextResponse.json({ 
          data: {
            textApis: maskApiConfigs(envConfigs.textApis),
            imageApis: maskApiConfigs(envConfigs.imageApis),
            videoApis: maskApiConfigs(envConfigs.videoApis),
            downloadApis: maskApiConfigs(envConfigs.downloadApis || []),
            defaultTextApiId: envConfigs.defaultTextApiId,
            defaultImageApiId: envConfigs.defaultImageApiId,
            defaultVideoApiId: envConfigs.defaultVideoApiId,
            defaultDownloadApiId: envConfigs.defaultDownloadApiId || '',
          }
        });
      }
      return NextResponse.json({ data: maskConfigs(getEmptyConfigs()) });
    }
    
    if (!data || data.length === 0) {
      // 数据库无配置，尝试从环境变量获取
      const envConfigs = parseDefaultConfigsFromEnv();
      if (envConfigs) {
        return NextResponse.json({ 
          data: {
            textApis: maskApiConfigs(envConfigs.textApis),
            imageApis: maskApiConfigs(envConfigs.imageApis),
            videoApis: maskApiConfigs(envConfigs.videoApis),
            downloadApis: maskApiConfigs(envConfigs.downloadApis || []),
            defaultTextApiId: envConfigs.defaultTextApiId,
            defaultImageApiId: envConfigs.defaultImageApiId,
            defaultVideoApiId: envConfigs.defaultVideoApiId,
            defaultDownloadApiId: envConfigs.defaultDownloadApiId || '',
          }
        });
      }
      return NextResponse.json({ data: maskConfigs(getEmptyConfigs()) });
    }
    
    // 将数据库记录转换为配置对象
    const config: Record<string, unknown> = {};
    
    for (const item of data) {
      if (item.config_type && item.extra_config) {
        config[item.config_type] = item.extra_config;
      }
    }
    
    // 获取各类型配置，优先数据库，其次环境变量
    const envConfigs = parseDefaultConfigsFromEnv();
    
    // 辅助函数：从配置中提取 API 列表（支持直接数组或 { items: [...] } 结构）
    function extractApis<T>(cfg: unknown): T[] {
      if (!cfg) return [];
      if (Array.isArray(cfg)) return cfg as T[];
      if (typeof cfg === 'object' && cfg !== null && 'items' in cfg) {
        const obj = cfg as { items?: T[] };
        return Array.isArray(obj.items) ? obj.items : [];
      }
      return [];
    }
    
    const textApis = extractApis<{ apiKey?: string }>(config.textApis).length
      ? extractApis<{ apiKey?: string }>(config.textApis)
      : (envConfigs?.textApis || getEmptyConfigs().textApis);
    const imageApis = extractApis<{ apiKey?: string }>(config.imageApis).length
      ? extractApis<{ apiKey?: string }>(config.imageApis)
      : (envConfigs?.imageApis || getEmptyConfigs().imageApis);
    const videoApis = extractApis<{ apiKey?: string }>(config.videoApis).length
      ? extractApis<{ apiKey?: string }>(config.videoApis)
      : (envConfigs?.videoApis || getEmptyConfigs().videoApis);
    const downloadApis = extractApis<{ apiKey?: string }>(config.downloadApis).length
      ? extractApis<{ apiKey?: string }>(config.downloadApis)
      : (envConfigs?.downloadApis || getEmptyConfigs().downloadApis);
    
    // 从 defaults 配置中获取默认 ID
    const defaults = config.defaults as { 
      defaultTextApiId?: string; 
      defaultImageApiId?: string; 
      defaultVideoApiId?: string;
      defaultDownloadApiId?: string;
    } | undefined;
    
    // 返回脱敏后的配置
    const result = {
      textApis: maskApiConfigs(textApis),
      imageApis: maskApiConfigs(imageApis),
      videoApis: maskApiConfigs(videoApis),
      downloadApis: maskApiConfigs(downloadApis),
      defaultTextApiId: defaults?.defaultTextApiId || envConfigs?.defaultTextApiId || getEmptyConfigs().defaultTextApiId,
      defaultImageApiId: defaults?.defaultImageApiId || envConfigs?.defaultImageApiId || getEmptyConfigs().defaultImageApiId,
      defaultVideoApiId: defaults?.defaultVideoApiId || envConfigs?.defaultVideoApiId || getEmptyConfigs().defaultVideoApiId,
      defaultDownloadApiId: defaults?.defaultDownloadApiId || envConfigs?.defaultDownloadApiId || getEmptyConfigs().defaultDownloadApiId,
    };
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[System Config API] 获取失败:', error);
    // 尝试从环境变量获取
    const envConfigs = parseDefaultConfigsFromEnv();
    if (envConfigs) {
      return NextResponse.json({ 
        data: {
          textApis: maskApiConfigs(envConfigs.textApis),
          imageApis: maskApiConfigs(envConfigs.imageApis),
          videoApis: maskApiConfigs(envConfigs.videoApis),
          downloadApis: maskApiConfigs(envConfigs.downloadApis || []),
          defaultTextApiId: envConfigs.defaultTextApiId,
          defaultImageApiId: envConfigs.defaultImageApiId,
          defaultVideoApiId: envConfigs.defaultVideoApiId,
          defaultDownloadApiId: envConfigs.defaultDownloadApiId || '',
        }
      });
    }
    return NextResponse.json({ data: maskConfigs(getEmptyConfigs()) });
  }
}

// 脱敏配置对象
type DefaultApiIds = {
  defaultTextApiId?: string;
  defaultImageApiId?: string;
  defaultVideoApiId?: string;
  defaultDownloadApiId?: string;
};

function mergeDefaultApiIds(existingDefaults: DefaultApiIds | undefined, updates: DefaultApiIds): Required<DefaultApiIds> {
  const fallback = getEmptyConfigs();
  return {
    defaultTextApiId: updates.defaultTextApiId ?? existingDefaults?.defaultTextApiId ?? fallback.defaultTextApiId,
    defaultImageApiId: updates.defaultImageApiId ?? existingDefaults?.defaultImageApiId ?? fallback.defaultImageApiId,
    defaultVideoApiId: updates.defaultVideoApiId ?? existingDefaults?.defaultVideoApiId ?? fallback.defaultVideoApiId,
    defaultDownloadApiId: updates.defaultDownloadApiId ?? existingDefaults?.defaultDownloadApiId ?? fallback.defaultDownloadApiId,
  };
}

function maskConfigs(configs: ReturnType<typeof getEmptyConfigs>) {
  return {
    textApis: maskApiConfigs(configs.textApis),
    imageApis: maskApiConfigs(configs.imageApis),
    videoApis: maskApiConfigs(configs.videoApis),
    downloadApis: maskApiConfigs(configs.downloadApis),
    defaultTextApiId: configs.defaultTextApiId,
    defaultImageApiId: configs.defaultImageApiId,
    defaultVideoApiId: configs.defaultVideoApiId,
    defaultDownloadApiId: configs.defaultDownloadApiId,
  };
}

// 保存系统配置（需要管理员权限）
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 从数据库查询用户角色
    const client = getSupabaseClient();
    const { data: userData, error: userError } = await client
      .from('users')
      .select('role')
      .eq('id', auth.userId)
      .single();
    
    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const body = await request.json();
    
    // 获取现有配置（用于合并 API Key）
    const { data: existingData } = await client
      .from('system_config')
      .select('*');
    
    const existingConfig: Record<string, unknown> = {};
    for (const item of (existingData || [])) {
      if (item.config_type && item.extra_config) {
        existingConfig[item.config_type] = item.extra_config;
      }
    }
    
    // 处理 API 配置，保留未修改的 API Key
    const processApiConfigs = <T extends { id: string; apiKey?: string }>(
      newApis: T[],
      existingApis: T[] | undefined
    ): T[] => {
      if (!existingApis || !Array.isArray(existingApis)) {
        return newApis;
      }
      return newApis.map(newApi => {
        const existing = existingApis.find(a => a.id === newApi.id);
        
        // 如果传入的 apiKey 是空的或者是脱敏格式，保留原有的 apiKey
        if ((!newApi.apiKey || isMaskedKey(newApi.apiKey)) && existing?.apiKey) {
          return { ...newApi, apiKey: existing.apiKey };
        }
        
        return newApi;
      });
    };
    
    // 处理各个配置类型
    // 从 existingConfig 中提取数组（支持直接数组或 { items: [...] } 结构）
    const extractApiArray = (cfg: unknown): Array<{ id: string; apiKey?: string }> | undefined => {
      if (!cfg) return undefined;
      if (Array.isArray(cfg)) return cfg as Array<{ id: string; apiKey?: string }>;
      if (typeof cfg === 'object' && cfg !== null && 'items' in cfg) {
        const obj = cfg as { items?: Array<{ id: string; apiKey?: string }> };
        return obj.items;
      }
      return undefined;
    };
    
    const textApis = body.textApis 
      ? processApiConfigs(body.textApis, extractApiArray(existingConfig.textApis)) 
      : undefined;
    const imageApis = body.imageApis 
      ? processApiConfigs(body.imageApis, extractApiArray(existingConfig.imageApis)) 
      : undefined;
    const videoApis = body.videoApis 
      ? processApiConfigs(body.videoApis, extractApiArray(existingConfig.videoApis)) 
      : undefined;
    const downloadApis = body.downloadApis
      ? processApiConfigs(body.downloadApis, extractApiArray(existingConfig.downloadApis))
      : undefined;
    
    // 保存各个配置类型
    const configTypes = [
      { key: 'textApis', data: textApis },
      { key: 'imageApis', data: imageApis },
      { key: 'videoApis', data: videoApis },
      { key: 'downloadApis', data: downloadApis },
    ];
    
    for (const { key, data } of configTypes) {
      if (data !== undefined) {
        await client
          .from('system_config')
          .upsert({
            id: `config_${key}`,
            config_type: key,
            name: key,
            extra_config: data,
          }, { onConflict: 'id' });
      }
    }
    
    // 保存默认 ID
    if (
      body.defaultTextApiId !== undefined ||
      body.defaultImageApiId !== undefined ||
      body.defaultVideoApiId !== undefined ||
      body.defaultDownloadApiId !== undefined
    ) {
      const existingDefaults = existingConfig.defaults as DefaultApiIds | undefined;
      const mergedDefaults = mergeDefaultApiIds(existingDefaults, {
        defaultTextApiId: body.defaultTextApiId,
        defaultImageApiId: body.defaultImageApiId,
        defaultVideoApiId: body.defaultVideoApiId,
        defaultDownloadApiId: body.defaultDownloadApiId,
      });

      await client
        .from('system_config')
        .upsert({
          id: 'config_defaults',
          config_type: 'defaults',
          name: 'defaults',
          extra_config: mergedDefaults,
        }, { onConflict: 'id' });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[System Config API] 保存失败:', error);
    return NextResponse.json({ error: '保存配置失败' }, { status: 500 });
  }
}

// 重置系统配置到默认值（需要管理员权限）
export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 从数据库查询用户角色
    const client = getSupabaseClient();
    const { data: userData, error: userError } = await client
      .from('users')
      .select('role')
      .eq('id', auth.userId)
      .single();
    
    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }
    
    // 删除所有自定义配置
    const { error } = await client
      .from('system_config')
      .delete()
      .neq('id', ''); // 删除所有记录
    
    if (error) {
      console.error('[System Config API] 重置失败:', error);
      return NextResponse.json({ error: '重置配置失败' }, { status: 500 });
    }
    
    console.log('[System Config API] 配置已重置，将使用环境变量默认配置');
    return NextResponse.json({ 
      success: true, 
      message: '配置已重置，将使用环境变量默认配置（如已配置）' 
    });
  } catch (error) {
    console.error('[System Config API] 重置失败:', error);
    return NextResponse.json({ error: '重置配置失败' }, { status: 500 });
  }
}

export const mergeDefaultApiIdsForTest = mergeDefaultApiIds;
