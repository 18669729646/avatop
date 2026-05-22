import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyAuth } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { 
  extractVariables,
  checkVariablesByType,
  PROMPT_TYPE_CONFIGS,
  type PromptType,
} from '@/lib/prompt-variables';

// 硬编码的初始默认模板（仅用于初始化短片脚本）
function getInitialDefaultPrompt(): string {
  return `你是一位专业的短视频脚本策划师，专注于创作抖音、小红书等平台的带货短视频脚本。

## 任务目标
根据提供的产品信息和营销策略，创作一个时长约 {{duration}} 秒的短视频脚本。

## 产品信息
- **产品描述**：{{productInfo}}
- **产品类别**：{{productCategory}}
- **目标受众**：{{targetAudience}}
- **核心卖点**：{{sellingPoints}}

## 营销策略
- **钩子类型**：{{hookTypeName}}（{{hookType}}）
- **钩子描述**：{{hookDescription}}
- **钩子话术模板**：{{hookTemplate}}

## 创作要求
- **达人出境**：{{useCreator}}（性别：{{creatorGender}}）
- **启用口播**：{{enableNarration}}
- **图片段落数**：{{imageSegmentCount}}
- **视频段落数**：{{videoSegmentCount}}

## 口播方向指南
{{narrationGuide}}

## 输出格式
请按照以下 JSON 格式输出脚本：

\`\`\`json
{
  "title": "视频标题",
  "totalDuration": {{duration}},
  "segments": [
    {
      "id": 1,
      "type": "image",
      "duration": 8,
      "scene": "场景描述",
      "action": "动作描述",
      "narration": "口播文案",
      "visualDirection": "画面指导"
    }
  ]
}
\`\`\`

请确保脚本节奏紧凑、内容吸引人，并在有限时间内充分展示产品卖点。`;
}

/**
 * 从请求中获取 type 参数，默认为 shortfilm
 */
function getPromptType(request: NextRequest): PromptType {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  if (type === 'analysis_master') return 'analysis_master';
  if (type === 'video_remake') return 'video_remake';
  return 'shortfilm';
}

/**
 * 获取数据库 ID
 */
function getDbId(type: PromptType): string {
  return PROMPT_TYPE_CONFIGS[type].dbId;
}

/**
 * 获取默认提示词
 */
function getDefaultPrompt(type: PromptType): string {
  if (type === 'shortfilm') return getInitialDefaultPrompt();
  return PROMPT_TYPE_CONFIGS[type].getDefaultPrompt();
}

function normalizePromptType(type: unknown): PromptType {
  if (type === 'video_remake') return 'video_remake';
  if (type === 'analysis_master') return 'analysis_master';
  if (type === 'analysis_master_script_remake') return 'analysis_master_script_remake';
  return 'shortfilm';
}

// GET: 获取当前系统提示词配置
export async function GET(request: NextRequest) {
  try {
    const type = getPromptType(request);
    const dbId = getDbId(type);
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('system_prompt_config')
      .select('*')
      .eq('id', dbId)
      .single();
    
    if (error) {
      console.error('[SystemPrompt] Fetch error:', error);
      const defaultPrompt = getDefaultPrompt(type);
      return NextResponse.json({
        success: true,
        config: {
          id: dbId,
          system_prompt: defaultPrompt,
          default_prompt: defaultPrompt,
          variables_used: extractVariables(defaultPrompt),
          is_initial: true,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      config: {
        ...data,
        is_initial: false,
      },
    });
  } catch (error) {
    console.error('[SystemPrompt] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// PUT: 更新系统提示词配置
export async function PUT(request: NextRequest) {
  // 验证管理员权限
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }
  
  if (authResult.payload.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '仅管理员可以修改系统设置' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { systemPrompt, confirmOverride, type: promptType } = body;
    const type = normalizePromptType(promptType);
    const dbId = getDbId(type);
    
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return NextResponse.json(
        { success: false, error: '模板内容不能为空' },
        { status: 400 }
      );
    }
    
    // video_remake、analysis_master 和 analysis_master_script_remake 不做变量检查，直接保存
    let checkResult = null;
    if (type === 'shortfilm') {
      checkResult = checkVariablesByType(systemPrompt, type);
    }

    // 如果缺少必需变量，返回错误（仅 shortfilm 检查）
    if (checkResult && checkResult.missingRequired.length > 0) {
      const missingNames = checkResult.missingRequired.map(v => v.label).join('、');
      return NextResponse.json({
        success: false,
        error: `缺少必需的引用要素：${missingNames}`,
        missingVariables: checkResult.missingRequired.map(v => ({
          name: v.name,
          label: v.label,
          description: v.description,
        })),
        checkResult,
      }, { status: 400 });
    }
    
    // 如果有未知变量，返回警告（仅 shortfilm 检查）
    if (checkResult && checkResult.unknownVariables.length > 0) {
      return NextResponse.json({
        success: false,
        error: `存在未知的变量：${checkResult.unknownVariables.join('、')}`,
        unknownVariables: checkResult.unknownVariables,
        checkResult,
      }, { status: 400 });
    }
    
    // 需要用户确认才能保存
    if (!confirmOverride) {
      return NextResponse.json({
        success: false,
        needsConfirm: true,
        message: '请确认保存此模板',
        checkResult: checkResult ? {
          usedRequired: checkResult.usedRequired.map(v => ({
            name: v.name,
            label: v.label,
          })),
          usedOptional: checkResult.usedOptional.map(v => ({
            name: v.name,
            label: v.label,
          })),
          unusedOptional: checkResult.unusedOptional.map(v => ({
            name: v.name,
            label: v.label,
          })),
        } : null,
        stats: {
          totalChars: systemPrompt.length,
          variableCount: checkResult ? checkResult.usedRequired.length + checkResult.usedOptional.length : 0,
        },
      }, { status: 200 });
    }
    
    // 保存到数据库
    const client = getSupabaseClient();
    const variablesUsed = extractVariables(systemPrompt);
    
    const { error } = await client
      .from('system_prompt_config')
      .upsert({
        id: dbId,
        system_prompt: systemPrompt,
        variables_used: variablesUsed,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('[SystemPrompt] Save error:', error);
      return NextResponse.json(
        { success: false, error: '保存失败，请稍后重试' },
        { status: 500 }
      );
    }

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_settings',
      actionName: 'update_settings',
      targetInfo: `${PROMPT_TYPE_CONFIGS[type].label}提示词模板`,
      detail: {
        type: `system_prompt_${type}`,
        totalChars: systemPrompt.length,
        variablesCount: variablesUsed.length,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: '系统提示词模板已保存',
      config: {
        id: dbId,
        system_prompt: systemPrompt,
        variables_used: variablesUsed,
      },
    });
  } catch (error) {
    console.error('[SystemPrompt] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '保存失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// POST: 设为默认模板（将当前模板保存为默认模板）
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }
  
  if (authResult.payload.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '仅管理员可以修改系统设置' },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    let bodyType: unknown;
    try {
      const body = await request.json();
      bodyType = body?.type;
    } catch {
      bodyType = undefined;
    }
    const type = normalizePromptType(url.searchParams.get('type') || bodyType);
    const dbId = getDbId(type);
    const client = getSupabaseClient();
    
    // 获取当前配置
    const { data: currentConfig } = await client
      .from('system_prompt_config')
      .select('system_prompt')
      .eq('id', dbId)
      .single();
    
    if (!currentConfig?.system_prompt) {
      return NextResponse.json(
        { success: false, error: '当前没有保存的模板，请先保存模板' },
        { status: 400 }
      );
    }
    
    const currentPrompt = currentConfig.system_prompt;
    
    // 仅 shortfilm 检查变量完整性
    const checkResult = checkVariablesByType(currentPrompt, type);
    if (['shortfilm'].includes(type) && checkResult.missingRequired.length > 0) {
      const missingNames = checkResult.missingRequired.map(v => v.label).join('、');
      return NextResponse.json(
        { success: false, error: `当前模板缺少必需变量：${missingNames}` },
        { status: 400 }
      );
    }
    
    // 更新 default_prompt 字段
    const { error } = await client
      .from('system_prompt_config')
      .update({
        default_prompt: currentPrompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbId);
    
    if (error) {
      console.error('[SystemPrompt] Set default error:', error);
      return NextResponse.json(
        { success: false, error: '设为默认失败' },
        { status: 500 }
      );
    }

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_settings',
      actionName: 'update_settings',
      targetInfo: `设为${PROMPT_TYPE_CONFIGS[type].label}默认提示词模板`,
      detail: {
        type: `set_default_prompt_${type}`,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: '已将当前模板设为默认模板',
      config: {
        id: dbId,
        system_prompt: currentPrompt,
        default_prompt: currentPrompt,
        variables_used: extractVariables(currentPrompt),
      },
    });
  } catch (error) {
    console.error('[SystemPrompt] POST error:', error);
    return NextResponse.json(
      { success: false, error: '设为默认失败' },
      { status: 500 }
    );
  }
}

// DELETE: 恢复默认模板（恢复到用户设定的默认模板）
export async function DELETE(request: NextRequest) {
  // 验证管理员权限
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }
  
  if (authResult.payload.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '仅管理员可以修改系统设置' },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const type = normalizePromptType(url.searchParams.get('type'));
    const dbId = getDbId(type);
    const client = getSupabaseClient();
    
    // 获取当前配置
    const { data: currentConfig } = await client
      .from('system_prompt_config')
      .select('default_prompt')
      .eq('id', dbId)
      .single();
    
    // 使用用户设定的默认模板，如果没有则使用初始默认模板
    const defaultPrompt = currentConfig?.default_prompt || getDefaultPrompt(type);
    
    const { error } = await client
      .from('system_prompt_config')
      .upsert({
        id: dbId,
        system_prompt: defaultPrompt,
        variables_used: extractVariables(defaultPrompt),
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('[SystemPrompt] Reset error:', error);
      return NextResponse.json(
        { success: false, error: '恢复默认失败' },
        { status: 500 }
      );
    }

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_settings',
      actionName: 'update_settings',
      targetInfo: `恢复${PROMPT_TYPE_CONFIGS[type].label}默认提示词模板`,
      detail: {
        type: `reset_prompt_${type}`,
      },
      request,
    });
    
    return NextResponse.json({
      success: true,
      message: '已恢复默认模板',
      config: {
        id: dbId,
        system_prompt: defaultPrompt,
        default_prompt: currentConfig?.default_prompt || defaultPrompt,
        variables_used: extractVariables(defaultPrompt),
      },
    });
  } catch (error) {
    console.error('[SystemPrompt] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '恢复默认失败' },
      { status: 500 }
    );
  }
}
