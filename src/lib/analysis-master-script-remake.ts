import { getServerDefaultTextApi } from '@/lib/server-config';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { PROMPT_TYPE_CONFIGS, replaceVariables } from '@/lib/prompt-variables';
import type { ProductSelection } from '@/lib/products';
import type { AnalysisMasterResult } from '@/lib/analysis-master';
import { s3Storage } from '@/lib/s3-client';

export const ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE = 'analysis_master_script_remake';

export interface ScriptRemakeSegment {
  order: number;
  durationSec: number;
  scene: string;
  voiceover: string;
  voiceoverCn?: string;
  action: string;
  productPlacement: string;
  camera: string;
  onScreenText: string;
  onScreenTextCn?: string;
}

export interface ScriptRemakeResult {
  title: string;
  hook: string;
  painPoint: string;
  sellingPointScript: string;
  cta: string;
  fullScript: string;
  fullScriptCn?: string;
  segments: ScriptRemakeSegment[];
  shootingNotes: string;
  visualNotes: string;
  complianceNotes: string;
  /** 原始返回数据，用于调试和问题排查 */
  rawResult?: Record<string, unknown>;
}

export interface ScriptRemakeInput {
  analysisResult: AnalysisMasterResult;
  product: ProductSelection;
  language?: string;
  includeChinese?: boolean;
  extraRequirements?: string;
}

export interface ScriptRemakeOptions {
  maxImages?: number;
}

export interface ScriptRemakeSaveData {
  id: string;
  userId: string;
  projectId: string;
  productId: string;
  language?: string;
  title: string;
  hook: string;
  painPoint: string;
  sellingPointScript: string;
  cta: string;
  fullScript: string;
  fullScriptCn?: string;
  segments: ScriptRemakeSegment[];
  shootingNotes: string;
  visualNotes: string;
  complianceNotes: string;
  productSnapshot: Record<string, unknown>;
  analysisSnapshot: Record<string, unknown>;
  rawResult: Record<string, unknown>;
}

// Gemini JSON Schema for script remake response
const SCRIPT_REMAKE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "视频标题" },
    hook: { type: "string", description: "吸引观众的钩子" },
    painPoint: { type: "string", description: "痛点描述" },
    sellingPointScript: { type: "string", description: "卖点脚本" },
    cta: { type: "string", description: "行动号召" },
    fullScript: { type: "string", description: "完整英文脚本" },
    fullScriptCn: { type: "string", description: "完整中文脚本" },
    segments: {
      type: "array",
      description: "视频分镜列表",
      items: {
        type: "object",
        properties: {
          order: { type: "integer", description: "分镜顺序" },
          durationSec: { type: "integer", description: "分镜时长（秒）" },
          scene: { type: "string", description: "场景描述" },
          voiceover: { type: "string", description: "英文旁白" },
          voiceoverCn: { type: "string", description: "中文旁白" },
          action: { type: "string", description: "人物动作" },
          productPlacement: { type: "string", description: "产品展示位置" },
          camera: { type: "string", description: "镜头运动" },
          onScreenText: { type: "string", description: "屏幕文字（英文）" },
          onScreenTextCn: { type: "string", description: "屏幕文字（中文）" }
        },
        required: ["order", "durationSec", "scene", "action", "productPlacement", "camera"]
      }
    },
    shootingNotes: { type: "string", description: "拍摄建议" },
    visualNotes: { type: "string", description: "视觉风格说明" },
    complianceNotes: { type: "string", description: "合规注意事项" }
  },
  required: ["title", "hook", "segments"]
};

function extractJsonObject(text: string): Record<string, unknown> {
  // 先尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 继续尝试提取
  }

  // 尝试提取 <final_output> 标签内的 JSON（新版提示词模板要求）
  const finalOutputMatch = text.match(/<final_output>\s*([\s\S]*?)\s*<\/final_output>/i);
  if (finalOutputMatch) {
    try {
      return JSON.parse(finalOutputMatch[1].trim());
    } catch {
      // 继续尝试
    }
  }

  // 尝试提取 markdown 代码块中的 JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // 继续尝试
    }
  }

  // 尝试提取最外层 JSON 对象（跳过思考内容）
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // 继续尝试更精确的匹配
    }
  }

  // 尝试找到最后一个完整的 JSON 对象（模型可能先输出思考再输出 JSON）
  const allBraces: number[] = [];
  let depth = 0;
  let lastValidStart = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}') {
      depth++;
      if (depth === 1) allBraces.unshift(i);
    } else if (text[i] === '{') {
      if (depth === 1) {
        lastValidStart = i;
      }
      depth--;
      if (depth === 0 && lastValidStart !== -1) {
        try {
          return JSON.parse(text.slice(lastValidStart, allBraces[0] + 1));
        } catch {
          allBraces.shift();
          lastValidStart = -1;
        }
      }
    }
  }

  throw new Error('AI 返回内容不是有效 JSON');
}

export async function getScriptRemakePrompt(context: {
  analysisResult: AnalysisMasterResult;
  product: ProductSelection;
  language?: string;
  includeChinese?: boolean;
  extraRequirements?: string;
}): Promise<string> {
  let template = '';
  try {
    const client = getSupabaseClient();
    const { data } = await client
      .from('system_prompt_config')
      .select('system_prompt')
      .eq('id', PROMPT_TYPE_CONFIGS.analysis_master_script_remake.dbId)
      .single();
    template = data?.system_prompt || '';
  } catch (error) {
    console.warn('[Script Remake] 加载后台提示词失败，使用默认模板:', (error as Error).message);
  }

  if (!template) {
    template = PROMPT_TYPE_CONFIGS.analysis_master_script_remake.getDefaultPrompt();
  }

  const languageTag = context.language || 'en-US';
  const includeChineseStr = context.includeChinese !== false ? 'true' : 'false';

  const prompt = replaceVariables(template, {
    analysisResult: JSON.stringify(context.analysisResult),
    analysisRaw: JSON.stringify(context.analysisResult.raw || {}),
    productName: context.product.name || '',
    productDescription: context.product.description || '',
    productSellingPoints: context.product.sellingPoints.join('、') || '',
    productTargetAudience: context.product.targetAudience || '',
    productUsageScenarios: context.product.usageScenarios || '',
    productBrandInfo: context.product.brandInfo || '',
    productPriceRange: context.product.priceRange || '',
    productKeywords: context.product.keywords.join('、') || '',
    productImages: '[图片数据已附加]',
    targetLanguage: languageTag,
    includeChinese: includeChineseStr,
    extraRequirements: context.extraRequirements || '',
  });

  return prompt;
}

export async function fetchImageData(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Script Remake] 图片获取失败: ${url}, status: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(`[Script Remake] 图片获取异常: ${url}, error: ${(error as Error).message}`);
    return null;
  }
}

/**
 * 重新生成 S3 预签名 URL（因为预签名 URL 可能已过期）
 */
export async function refreshImageUrls(keys: string[], maxImages: number): Promise<{ url: string; key: string }[]> {
  const freshImages: { url: string; key: string }[] = [];
  const keysToFetch = keys.slice(0, maxImages);

  for (const key of keysToFetch) {
    try {
      // 7天过期
      const url = await s3Storage.generatePresignedUrl({ key, expireTime: 7 * 24 * 60 * 60 });
      freshImages.push({ url, key });
    } catch (error) {
      console.warn(`[Script Remake] 刷新预签名 URL 失败: ${key}, error: ${(error as Error).message}`);
    }
  }

  return freshImages;
}

export async function generateScriptRemake(
  input: ScriptRemakeInput,
  options: ScriptRemakeOptions = {},
  scriptRemakeId?: string
): Promise<ScriptRemakeResult> {
  if (!input.analysisResult || !input.product) {
    throw new Error('参数不完整');
  }

  const apiConfig = await getServerDefaultTextApi();
  if (!apiConfig) {
    throw new Error('未配置文本模型');
  }

  const maxImages = options.maxImages ?? 5;
  let productImages = input.product.allImages.slice(0, maxImages);

  // 如果预签名 URL 已过期，尝试重新生成
  if (productImages.length > 0 && input.product.imageKeys && input.product.imageKeys.length > 0) {
    const freshUrls = await refreshImageUrls(input.product.imageKeys, maxImages);
    if (freshUrls.length > 0) {
      productImages = freshUrls;
      console.log(`[Script Remake] 刷新了 ${freshUrls.length} 个预签名 URL`);
    }
  }

  const imageBuffers: Buffer[] = [];
  for (const img of productImages) {
    const buffer = await fetchImageData(img.url);
    if (buffer) {
      imageBuffers.push(buffer);
    }
  }

  console.log(`[Script Remake] 产品图片数量: ${imageBuffers.length}/${productImages.length}`);
  console.log(`[Script Remake] 语言设置: language=${input.language}, includeChinese=${input.includeChinese}`);

  const prompt = await getScriptRemakePrompt({
    analysisResult: input.analysisResult,
    product: input.product,
    language: input.language,
    includeChinese: input.includeChinese,
    extraRequirements: input.extraRequirements,
  });

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (let i = 0; i < imageBuffers.length; i++) {
    const buffer = imageBuffers[i];
    console.log(`[Script Remake] 添加图片 ${i + 1}: ${buffer.length} bytes`);
    parts.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: buffer.toString('base64'),
      },
    });
  }

  if (imageBuffers.length === 0) {
    console.warn('[Script Remake] 没有可用的产品图片，将基于纯文本生成');
  }

  const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
  const basePath = baseUrl.includes('/v1beta') || baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
  const model = apiConfig.model || 'gemini-2.5-flash';

  console.log(`[Script Remake] 调用模型: ${model}, 提示词长度: ${prompt.length}, 图片数量: ${imageBuffers.length}`);

  const response = await fetch(`${basePath}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiConfig.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 32768,
      },
      // 使用 responseSchema 确保 JSON 输出（比 response_mime_type 更可靠）
      responseSchema: SCRIPT_REMAKE_JSON_SCHEMA,
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Script Remake] API 调用失败: ${response.status}, 错误详情: ${errorText.slice(0, 300)}`);
    throw new Error('脚本复刻失败，请稍后重试');
  }

  const result = await response.json();
  
  // 提取返回数据 - 兼容 responseSchema 的多种返回格式
  let scriptRemakeData: Record<string, unknown> = {};
  
  const candidates = result?.candidates;
  if (candidates && candidates[0]) {
    const content = candidates[0].content;
    if (content && content.parts && content.parts[0]) {
      const part0 = content.parts[0];
      
      // 格式1: parts[0] 直接是 JSON 对象（responseSchema 常用格式）
      if (part0.title || part0.hook || part0.segments) {
        scriptRemakeData = part0;
      }
      // 格式2: parts[0] 包含嵌套的 parts 数组
      else if (part0.parts && part0.parts[0]) {
        const nestedPart = part0.parts[0];
        if (nestedPart.title || nestedPart.hook || nestedPart.segments) {
          scriptRemakeData = nestedPart;
        } else if (typeof nestedPart.text === 'string') {
          // 格式3: text 字段包含 JSON 字符串
          try {
            scriptRemakeData = JSON.parse(nestedPart.text);
          } catch {
            scriptRemakeData = extractJsonObject(nestedPart.text);
          }
        }
      }
    }
  }
  
  console.log(`[Script Remake] AI 返回类型: ${typeof scriptRemakeData}, keys: ${Object.keys(scriptRemakeData).join(', ')}`);
  console.log(`[Script Remake] AI 返回体预览: ${JSON.stringify(scriptRemakeData).slice(0, 500)}...`);

  const normalized = normalizeScriptRemakeResult(scriptRemakeData);
  // 添加原始返回数据用于调试
  normalized.rawResult = scriptRemakeData;

  return normalized;
}

export function normalizeScriptRemakeResult(raw: Record<string, unknown>): ScriptRemakeResult {
  const segments = Array.isArray(raw.segments)
    ? raw.segments.map((seg: Record<string, unknown>, index) => ({
        order: typeof seg.order === 'number' ? seg.order : index + 1,
        durationSec: typeof seg.durationSec === 'number' ? seg.durationSec : 8,
        scene: String(seg.scene || ''),
        voiceover: String(seg.voiceover || ''),
        voiceoverCn: String(seg.voiceoverCn || seg.voiceover_cn || ''),
        action: String(seg.action || ''),
        productPlacement: String(seg.productPlacement || ''),
        camera: String(seg.camera || ''),
        onScreenText: String(seg.onScreenText || ''),
        onScreenTextCn: String(seg.onScreenTextCn || seg.onScreenText_cn || ''),
      }))
    : [];

  return {
    title: String(raw.title || '复刻脚本'),
    hook: String(raw.hook || ''),
    painPoint: String(raw.painPoint || ''),
    sellingPointScript: String(raw.sellingPointScript || ''),
    cta: String(raw.cta || ''),
    fullScript: String(raw.fullScript || ''),
    fullScriptCn: String(raw.fullScriptCn || raw.fullScript_cn || ''),
    segments,
    shootingNotes: String(raw.shootingNotes || ''),
    visualNotes: String(raw.visualNotes || ''),
    complianceNotes: String(raw.complianceNotes || ''),
  };
}

export async function saveScriptRemake(data: ScriptRemakeSaveData): Promise<void> {
  const client = getSupabaseClient();

  await client.from('analysis_master_script_remakes').insert({
    id: data.id,
    user_id: data.userId,
    project_id: data.projectId,
    product_id: data.productId,
    language: data.language,
    title: data.title,
    hook: data.hook,
    pain_point: data.painPoint,
    selling_point_script: data.sellingPointScript,
    cta: data.cta,
    full_script: data.fullScript,
    full_script_cn: data.fullScriptCn,
    segments: data.segments,
    shooting_notes: data.shootingNotes,
    visual_notes: data.visualNotes,
    compliance_notes: data.complianceNotes,
    product_snapshot: data.productSnapshot,
    analysis_snapshot: data.analysisSnapshot,
    raw_result: data.rawResult,
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getScriptRemakeById(id: string): Promise<ScriptRemakeSaveData | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('analysis_master_script_remakes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    productId: data.product_id,
    language: data.language || undefined,
    title: data.title || '',
    hook: data.hook || '',
    painPoint: data.pain_point || '',
    sellingPointScript: data.selling_point_script || '',
    cta: data.cta || '',
    fullScript: data.full_script || '',
    fullScriptCn: data.full_script_cn || '',
    segments: data.segments || [],
    shootingNotes: data.shooting_notes || '',
    visualNotes: data.visual_notes || '',
    complianceNotes: data.compliance_notes || '',
    productSnapshot: data.product_snapshot || {},
    analysisSnapshot: data.analysis_snapshot || {},
    rawResult: data.raw_result || {},
  };
}

export async function getScriptRemakesByProject(projectId: string, userId?: string): Promise<ScriptRemakeSaveData[]> {
  const client = getSupabaseClient();
  let query = client.from('analysis_master_script_remakes').select('*').eq('project_id', projectId);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(item => ({
    id: item.id,
    userId: item.user_id,
    projectId: item.project_id,
    productId: item.product_id,
    language: item.language || undefined,
    title: item.title || '',
    hook: item.hook || '',
    painPoint: item.pain_point || '',
    sellingPointScript: item.selling_point_script || '',
    cta: item.cta || '',
    fullScript: item.full_script || '',
    fullScriptCn: item.full_script_cn || '',
    segments: item.segments || [],
    shootingNotes: item.shooting_notes || '',
    visualNotes: item.visual_notes || '',
    complianceNotes: item.compliance_notes || '',
    productSnapshot: item.product_snapshot || {},
    analysisSnapshot: item.analysis_snapshot || {},
    rawResult: item.raw_result || {},
  }));
}

export function createScriptRemakeId(): string {
  return `sr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ScriptRemakeTaskParams {
  scriptRemakeId: string;
  projectId: string;
  productId: string;
  analysisResult: Record<string, unknown>;
  productSnapshot: Record<string, unknown>;
  actionType: string;
  creditsRequired: number;
  language?: string;
  includeChinese?: boolean;
  extraRequirements?: string;
}

export function buildInternalTaskHeaders(userId: string): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer internal' });
  headers.set('x-internal-auth', 'true');
  headers.set('x-internal-user-id', userId);
  return headers;
}

export async function triggerScriptRemakeBackgroundProcessing(taskId: string, userId: string, authHeader?: string | null): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
  const headers = authHeader
    ? new Headers({ Authorization: authHeader, 'Content-Type': 'application/json' })
    : buildInternalTaskHeaders(userId);

  fetch(`${baseUrl}/api/tasks/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ taskId }),
  }).catch(error => {
    console.error('[Script Remake] 触发后台处理失败:', error);
  });
}

export async function enqueueScriptRemakeTask(params: {
  projectId: string;
  productId: string;
  userId: string;
  authHeader?: string | null;
  triggerProcessing?: boolean;
  language?: string;
  includeChinese?: boolean;
  extraRequirements?: string;
}): Promise<{ taskId: string; scriptRemakeId: string }> {
  const client = getSupabaseClient();
  const { data: project, error: projectError } = await client
    .from('analysis_master_projects')
    .select('*')
    .eq('id', params.projectId)
    .eq('user_id', params.userId)
    .single();

  if (projectError || !project) {
    throw new Error('分析项目不存在');
  }

  if (project.status !== 'completed') {
    throw new Error('请先完成视频反推');
  }

  if (!project.result) {
    throw new Error('分析项目缺少反推结果');
  }

  const { data: product, error: productError } = await client
    .from('products')
    .select('*')
    .eq('id', params.productId)
    .eq('user_id', params.userId)
    .single();

  if (productError || !product) {
    throw new Error('产品不存在或无权限访问');
  }

  const { getCreditPrice } = await import('@/lib/credits');
  const price = await getCreditPrice(ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE);
  if (!price) {
    throw new Error('脚本复刻积分价格未配置');
  }

  const { checkUserCredits } = await import('@/lib/credits');
  const creditCheck = await checkUserCredits(params.userId, price.creditsRequired);
  if (!creditCheck.hasEnough) {
    throw new Error(`积分不足，当前积分 ${creditCheck.balance}，需要 ${price.creditsRequired} 积分`);
  }

  const now = new Date().toISOString();
  const analysisResult = project.result as Record<string, unknown>;
  // 将 images 数组转换为 allImages 格式（key, url）
  // images 格式: {key: string, url: string}[]
  const rawImages = product.images as { key: string; url: string }[] | string[] | undefined;
  const allImages: { key: string; url: string }[] = (rawImages || []).map((img, idx) => {
    if (typeof img === 'string') {
      // 兼容旧格式：字符串直接作为 URL
      return { key: `img-${idx}`, url: img };
    }
    return { key: img.key || `img-${idx}`, url: img.url || '' };
  });
  // 添加 S3 key，用于任务处理时重新生成预签名 URL
  const imageKeys = allImages.map(img => img.key);
  const productSnapshot = {
    ...product,
    allImages,
    primaryImage: allImages[0] || null,
    sellingPoints: product.selling_points || [],
    imageKeys, // 存储 S3 key 数组
  };

  const scriptRemakeId = createScriptRemakeId();
  const taskId = `sr-task-${scriptRemakeId}`;

  const { error: insertError } = await client
    .from('analysis_master_script_remakes')
    .insert({
      id: scriptRemakeId,
      user_id: params.userId,
      project_id: params.projectId,
      product_id: params.productId,
      language: params.language,
      status: 'pending',
      product_snapshot: productSnapshot,
      analysis_snapshot: analysisResult,
      created_at: now,
      updated_at: now,
    });

  if (insertError) {
    throw new Error('创建脚本复刻记录失败');
  }

  const { error: taskError } = await client
    .from('task_queue')
    .insert({
      id: taskId,
      user_id: params.userId,
      type: 'script_remake',
      status: 'pending',
      params: {
        scriptRemakeId,
        projectId: params.projectId,
        productId: params.productId,
        analysisResult,
        productSnapshot,
        actionType: ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE,
        creditsRequired: price.creditsRequired,
        language: params.language,
        includeChinese: params.includeChinese,
        extraRequirements: params.extraRequirements,
      } satisfies ScriptRemakeTaskParams,
      project_id: params.projectId,
      retry_count: 0,
      max_retry: 1,
    });

  if (taskError) {
    await client
      .from('analysis_master_script_remakes')
      .delete()
      .eq('id', scriptRemakeId);

    throw new Error('创建任务失败');
  }

  if (params.triggerProcessing !== false) {
    await triggerScriptRemakeBackgroundProcessing(taskId, params.userId, params.authHeader);
  }

  return { taskId, scriptRemakeId };
}