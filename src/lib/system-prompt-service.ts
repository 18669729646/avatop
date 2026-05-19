/**
 * 系统提示词模板服务端操作
 * 仅在服务端使用
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getNarrationGuide } from './template-library';

/**
 * 从数据库获取自定义系统提示词模板（服务端调用）
 */
export async function getCustomSystemPrompt(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('system_prompt_config')
      .select('system_prompt')
      .eq('id', 'default')
      .single();
    
    if (error) {
      console.error('[SystemPromptService] Get custom system prompt error:', error);
      return null;
    }
    
    return data?.system_prompt || null;
  } catch (error) {
    console.error('[SystemPromptService] Get custom system prompt error:', error);
    return null;
  }
}

/**
 * 使用自定义模板生成最终提示词
 * @param customTemplate 自定义模板（包含 {{变量}} 占位符）
 * @param params 参数值
 */
export function generateFinalPromptWithTemplate(
  customTemplate: string,
  params: {
    productInfo: string;
    productCategory: string;
    targetAudience: string;
    sellingPoints: string;
    hookType: string;
    hookTypeName?: string;
    hookDescription?: string;
    hookTemplate?: string;
    duration: number;
    useCreator: boolean;
    creatorGender?: 'female' | 'male' | 'any';
    enableNarration?: boolean;
  }
): string {
  const {
    productInfo,
    productCategory,
    targetAudience,
    sellingPoints,
    hookType,
    hookTypeName,
    hookDescription,
    hookTemplate,
    duration,
    useCreator,
    creatorGender,
    enableNarration = true,
  } = params;

  // 计算片段数量
  const imageSegmentCount = duration / 8 + 1;
  const videoSegmentCount = imageSegmentCount - 1;

  // 获取口播方向
  const narrationGuide = getNarrationGuide(hookType, hookTypeName);

  // 准备变量值
  const variableValues: Record<string, string | number | boolean> = {
    productInfo,
    productCategory,
    targetAudience,
    sellingPoints,
    hookType,
    hookTypeName: hookTypeName || '',
    hookDescription: hookDescription || '',
    hookTemplate: hookTemplate || '',
    duration,
    useCreator: useCreator.toString(),
    creatorGender: creatorGender || 'any',
    enableNarration: enableNarration.toString(),
    imageSegmentCount,
    videoSegmentCount,
    narrationGuide,
  };

  // 替换模板中的变量
  let result = customTemplate;
  for (const [key, value] of Object.entries(variableValues)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}
