import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { longRunningAgent } from '@/lib/fetch-agent';
import { broadcastTaskUpdate } from '@/lib/task-events';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { consumeCredits } from '@/lib/credits';
import { getServerTextApiByModel } from '@/lib/server-config';

// 脚本段落结构
interface ScriptSegment {
  order: number;
  duration: number;
  imagePrompt: string;
  videoPrompt: string;
  description: string;
  hookType?: string;
  sellingPoint?: string;
}

// 任务状态类型
type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 创建任务
async function createTask(projectId: string, requestParams: Record<string, unknown>): Promise<string> {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const client = getSupabaseClient();
  
  await client
    .from('script_tasks')
    .insert({
      id: taskId,
      project_id: projectId,
      status: 'pending',
      request_params: requestParams,
    });
  
  return taskId;
}

// 更新任务状态
async function updateTaskStatus(
  taskId: string, 
  status: TaskStatus, 
  result?: ScriptSegment[], 
  errorMessage?: string,
  rawResponse?: string // 新增：保存完整的LLM返回内容
): Promise<void> {
  const client = getSupabaseClient();
  
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  
  if (result) {
    updateData.result = result;
    updateData.completed_at = new Date().toISOString();
  }
  
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }
  
  if (rawResponse) {
    updateData.raw_response = rawResponse;
  }
  
  await client
    .from('script_tasks')
    .update(updateData)
    .eq('id', taskId);
}

// 后台执行脚本生成
async function executeScriptGeneration(
  taskId: string,
  projectId: string,
  userId: string | undefined,
  params: {
    productImages?: string[];
    productDescription?: string;
    scriptPrompt: string;
    duration: number;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    isFullPrompt?: boolean;
  }
): Promise<void> {
  try {
    // 更新状态为处理中
    await updateTaskStatus(taskId, 'processing');
    
    // 广播任务开始执行
    broadcastTaskUpdate({
      taskId,
      type: 'script',
      status: 'running',
      projectId,
      startedAt: Date.now(),
    });
    
    const { 
      productImages, 
      productDescription, 
      scriptPrompt, 
      duration,
      apiKey: _apiKey,
      baseUrl: _baseUrl,
      model: _model,
      isFullPrompt,
    } = params;

    // 从数据库获取 API 配置（根据前端传递的 model 匹配配置）
    const textApi = await getServerTextApiByModel(_model);
    const finalApiKey = textApi?.apiKey || process.env.YUNWU_API_KEY || '';
    const finalBaseUrl = textApi?.baseUrl || _baseUrl || 'https://yunwu.ai/v1beta';
    const finalModel = textApi?.model || _model || 'gemini-3.1-pro-preview';

    console.log(`[Script Task ${taskId}] Starting generation, model: ${finalModel}`);

    // 计算片段数量：8秒2段落，16秒3段落，24秒4段落
    const imageSegmentCount = duration / 8 + 1;
    const videoSegmentCount = imageSegmentCount - 1;

    // 产品一致性要求
    const productConsistencyRule = `
## 产品外观一致性要求（必须严格遵守）

**核心原则**：生成的所有图片和视频提示词中，关于产品的描述必须严格基于产品参考图，不得有任何改动或臆造。

### 具体要求：
1. **外观一致性**：产品的形状、尺寸、颜色、材质、按键位置、接口布局等物理特征必须与参考图完全一致
2. **品牌标识**：产品上的品牌Logo、文字、图案位置和样式必须与参考图一致
3. **细节保持**：产品的纹理、光泽、边角处理等细节必须与参考图一致
4. **例外情况**：如果产品带有显示屏，显示屏上显示的内容可以根据产品功能和使用场景进行调整
5. **禁止行为**：禁止更改产品颜色、禁止添加或删除产品上的按键/接口、禁止更改产品形状或尺寸比例、禁止臆造产品没有的功能或部件

### 提示词书写规范：
在 imagePrompt 和 videoPrompt 中描述产品时，必须：
- 准确描述产品在参考图中呈现的外观特征
- 使用"与参考图一致的产品外观"等表述确保一致性
- 如需强调某个角度或细节，必须基于参考图中实际存在的角度和细节

## 达人（人物）一致性要求（必须严格遵守）

**核心原则**：如果提供了达人参考图，生成的所有图片和视频中出现的达人，其五官和发型必须与参考图完全一致。

### 必须与参考图一致的元素：
1. **五官特征**：脸型、眼睛形状和颜色、眉毛形状、鼻子轮廓、嘴唇形状等面部特征必须与参考图完全相同
2. **发型发色**：头发的长度、颜色、发型造型必须与参考图完全一致
3. **肤色肤质**：皮肤的颜色、质感必须与参考图一致
4. **年龄外观**：人物的年龄感必须与参考图一致

### 允许变化的元素：
1. **服装**：根据不同场景可以穿着不同的服装
2. **配饰**：耳环、项链、手表、眼镜等配饰可以根据场景变化
3. **妆容浓淡**：可以调整妆容浓淡，但不能改变五官特征
4. **姿态动作**：可以有各种不同的动作和姿态
5. **表情**：可以有各种表情变化

### 提示词书写规范：
在 imagePrompt 和 videoPrompt 中描述人物时，必须：
- 使用"与参考图中完全相同的人物面部"、"同一达人，五官发型完全一致"等表述
- 明确描述"发型与参考图一致"、"五官与参考图一致"
- 禁止更改发色、发型长度、五官形状等核心特征
- 如需更换服装，明确说明"同一人物，不同服装，五官发型不变"

## 场景一致性要求（必须严格遵守）

**核心原则**：所有段落的场景必须保持一致，确保视频的连贯性和沉浸感。

### 具体要求：
1. **统一场景设定**：根据产品特性和用户需求，选择一个主要场景（如：都市夜景、户外自然、室内家居、专业影棚等），所有段落必须在这个场景中发生
2. **环境元素一致**：场景中的背景、光线、天气、时间、装饰物等环境元素在所有段落中必须保持一致
3. **光影风格统一**：所有段落的打光方式、色温、对比度、氛围感必须保持统一
4. **色彩基调一致**：整体画面的色调、饱和度、风格必须贯穿始终
5. **空间连续性**：镜头之间的空间关系要有逻辑，避免场景跳跃造成割裂感

### 场景选择指南：
- 科技产品：现代都市夜景、科技感展厅、简约工作室
- 美妆护肤：明亮化妆间、自然光室内、精致浴室
- 食品饮料：温馨厨房、户外野餐、精致餐厅
- 运动户外：自然环境、运动场馆、城市街头
- 家居用品：温馨家居、现代公寓、生活场景

### 提示词书写规范：
在生成每个段落的 imagePrompt 和 videoPrompt 时，必须：
- 在第一个段落明确设定场景
- 后续段落使用"同一场景"、"延续之前的场景"等表述
- 确保每个段落都包含场景描述，避免场景漂移
`;

    const isGeminiApi = finalBaseUrl.includes('/v1beta') || finalBaseUrl.includes('generativelanguage.googleapis.com');
    let content = '';
    
    // 如果是完整提示词模式
    if (isFullPrompt) {
      let fullMessage = scriptPrompt;
      
      if (productImages && productImages.length > 0) {
        fullMessage += `

============================================
## 产品参考图（必须严格遵守外观一致性）
============================================

以下是产品的真实图片，共 ${productImages.length} 张：

${productImages.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

**重要提醒**：产品的外观、颜色、形状、材质、Logo等必须与参考图保持一致`;
      }
      
      // 自动追加 JSON 格式要求，确保模型返回正确的格式
      fullMessage += `

============================================
## 输出格式要求（必须严格遵守）
============================================

请直接返回一个JSON数组，不要包含任何其他文字说明、开场白或结束语。
每个元素包含以下字段：
- order: 段落序号（数字）
- duration: 时长（秒）
- imagePrompt: 图片生成提示词（英文）
- videoPrompt: 视频生成提示词（英文）
- description: 段落描述（中文）
- hookType: 钩子类型（仅第一个段落需要填写，如"痛点暴击钩子"、"高能片段钩子"等，其他段落可省略）
- sellingPoint: 该段落突出的产品卖点（可选）

示例格式：
[
  {"order": 1, "duration": 8, "imagePrompt": "...", "videoPrompt": "...", "description": "...", "hookType": "痛点暴击钩子", "sellingPoint": "..."},
  {"order": 2, "duration": 8, "imagePrompt": "...", "videoPrompt": "...", "description": "...", "sellingPoint": "..."}
]

现在请直接返回JSON数组：`;
      
      if (isGeminiApi) {
        const endpoint = `${finalBaseUrl}/models/${finalModel}:generateContent?key=${finalApiKey}`;
        
        const requestBody = {
          contents: [{ role: 'user', parts: [{ text: productConsistencyRule + '\n\n' + fullMessage }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 16384 },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API请求失败');
        
        const candidates = data.candidates;
        if (candidates?.length > 0) {
          const parts = candidates[0].content?.parts;
          const textPart = parts?.find((p: Record<string, unknown>) => p.text);
          content = textPart?.text || '';
        }
      } else {
        let endpoint = finalBaseUrl;
        if (!endpoint.includes('/v1') && !endpoint.includes('/v1beta')) {
          endpoint = `${endpoint}/v1`;
        }
        endpoint = `${endpoint}/chat/completions`;
        
        const messages = [
          { role: 'system', content: productConsistencyRule },
          { role: 'user', content: fullMessage }
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${finalApiKey}` },
          body: JSON.stringify({ model: finalModel, messages, temperature: 0.85, max_tokens: 16384 }),
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API请求失败');
        
        if (data.choices?.length > 0) {
          content = data.choices[0].message?.content || '';
        }
      }
    } else {
      // 简单模式
      const systemPrompt = `你是一位专业的短视频脚本策划师，专门为TikTok电商短视频创作脚本。

${productConsistencyRule}

## 分镜设计多样化要求

1. **创意优先**：根据产品特性设计独特的镜头语言
2. **风格变化**：开场要有冲击力，中间要有节奏感，结尾要有感染力
3. **镜头多样**：快切、慢镜头、延时、俯拍、仰拍、环绕、跟拍等
4. **景别组合**：特写、近景、中景、全景的组合

输出要求：
1. 脚本必须严格分为 ${imageSegmentCount} 个图片段落，用于生成 ${videoSegmentCount} 个视频片段
2. 每个段落包含：order, duration, description, imagePrompt, videoPrompt, hookType, sellingPoint
3. 图片提示词：描述画面主体、场景、构图、光影、氛围、风格
4. 视频提示词：描述运动、转场、动作，每个视频约8秒
5. 达人出境要求：如果视频中需要达人出境，每个段落的图片提示词必须包含达人形象描述，明确要求达人五官、发型必须与参考图完全一致
6. 必须以JSON数组格式输出，不要包含其他文字
7. 第一个段落需要标注钩子类型（hookType），可选值：痛点暴击钩子、高能片段钩子、结果前置钩子、悬念提问钩子、身份宣称钩子、数据冲击钩子、对比反差钩子、优惠稀缺钩子、社交货币钩子、颠覆认知钩子
8. 每个段落可以标注突出的产品卖点`;

      let userContent = `请为以下产品创作一个${duration}秒的短视频脚本。

产品描述：${productDescription || '见参考图'}

创意要求：${scriptPrompt}

请生成 ${imageSegmentCount} 个图片段落，直接输出JSON数组。`;

      if (productImages && productImages.length > 0) {
        userContent = `请参考以下产品图片创作一个${duration}秒的短视频脚本。

**产品图片**（共${productImages.length}张）：
${productImages.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

产品描述：${productDescription || '见参考图'}

创意要求：${scriptPrompt}

请生成 ${imageSegmentCount} 个图片段落，直接输出JSON数组。`;
      }

      if (isGeminiApi) {
        const endpoint = `${finalBaseUrl}/models/${finalModel}:generateContent?key=${finalApiKey}`;
        const requestBody = {
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 8192 },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API请求失败');
        
        const candidates = data.candidates;
        if (candidates?.length > 0) {
          const parts = candidates[0].content?.parts;
          const textPart = parts?.find((p: Record<string, unknown>) => p.text);
          content = textPart?.text || '';
        }
      } else {
        let endpoint = finalBaseUrl;
        if (!endpoint.includes('/v1') && !endpoint.includes('/v1beta')) {
          endpoint = `${endpoint}/v1`;
        }
        endpoint = `${endpoint}/chat/completions`;
        
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${finalApiKey}` },
          body: JSON.stringify({ model: finalModel, messages, temperature: 0.85, max_tokens: 8192 }),
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API请求失败');
        
        if (data.choices?.length > 0) {
          content = data.choices[0].message?.content || '';
        }
      }
    }

    if (!content) {
      throw new Error('API未返回有效内容');
    }

    console.log(`[Script Task ${taskId}] API返回内容长度: ${content.length}`);
    console.log(`[Script Task ${taskId}] API返回内容: ${content.substring(0, 1000)}`);

    // 检查是否是 LLM 返回的错误消息（如 [CRITICAL: ...] 或 [ERROR: ...]）
    if (content.trim().startsWith('[CRITICAL:') || content.trim().startsWith('[ERROR:') || content.trim().startsWith('[WARNING:')) {
      // 提取错误消息
      const errorMatch = content.match(/\[(CRITICAL|ERROR|WARNING):\s*([^\]]+)\]/);
      const errorMsg = errorMatch ? errorMatch[2] : content.substring(0, 200);
      console.error(`[Script Task ${taskId}] LLM返回错误: ${errorMsg}`);
      throw new Error(`模型返回错误: ${errorMsg}`);
    }

    // 解析JSON
    let segments: ScriptSegment[] = [];
    
    // 先尝试移除 markdown 代码块标记
    const cleanedContent = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0].trim();
      console.log(`[Script Task ${taskId}] 提取的JSON长度: ${jsonStr.length}`);
      if (!jsonStr.endsWith(']')) {
        console.error(`[Script Task ${taskId}] JSON不完整，最后100字符: ${jsonStr.substring(Math.max(0, jsonStr.length - 100))}`);
        throw new Error('生成的内容不完整，可能是因为内容太长被截断');
      }
      try {
        segments = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(`[Script Task ${taskId}] JSON解析失败: ${parseError}`);
        console.error(`[Script Task ${taskId}] JSON内容前1000字符: ${jsonStr.substring(0, 1000)}`);
        throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
      }
    } else {
      console.error(`[Script Task ${taskId}] 未找到JSON数组，完整内容: ${content}`);
      throw new Error('未找到有效的JSON数组');
    }

    // 验证并规范化段落数据
    if (segments.length !== imageSegmentCount) {
      console.warn(`[Script Task ${taskId}] Expected ${imageSegmentCount} segments, got ${segments.length}`);
      if (segments.length < imageSegmentCount) {
        while (segments.length < imageSegmentCount) {
          segments.push({
            order: segments.length + 1,
            duration: 8,
            imagePrompt: '产品展示场景',
            videoPrompt: '产品展示动画',
            description: `段落${segments.length + 1}`,
          });
        }
      } else {
        segments = segments.slice(0, imageSegmentCount);
      }
    }

    segments = segments.map((seg, index) => ({
      order: index + 1,
      duration: seg.duration || 8,
      imagePrompt: seg.imagePrompt || '',
      videoPrompt: seg.videoPrompt || '',
      description: seg.description || '',
      hookType: seg.hookType,
      sellingPoint: seg.sellingPoint,
    }));

    console.log(`[Script Task ${taskId}] Generated ${segments.length} segments successfully`);
    
    // 扣除积分（脚本生成成功）
    if (userId) {
      const creditResult = await consumeCredits(userId, 'script_generate', taskId, 'script');
      if (!creditResult.success) {
        console.error(`[Script Task ${taskId}] 扣除积分失败:`, creditResult.error);
      } else {
        console.log(`[Script Task ${taskId}] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
      }
    }
    
    // 更新任务状态为完成，同时保存完整的LLM返回内容
    await updateTaskStatus(taskId, 'completed', segments, undefined, content);
    
    // 广播任务成功
    broadcastTaskUpdate({
      taskId,
      type: 'script',
      status: 'success',
      projectId,
      result: {
        segments,
        rawResponse: content,
      },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '脚本生成失败';
    console.error(`[Script Task ${taskId}] Error:`, errorMessage);
    await updateTaskStatus(taskId, 'failed', undefined, errorMessage);
    
    // 广播任务失败
    broadcastTaskUpdate({
      taskId,
      type: 'script',
      status: 'failed',
      projectId,
      error: errorMessage,
    });
  }
}

// POST: 创建异步任务
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { 
      projectId, // 必须提供项目ID
      productImages, 
      productDescription, 
      scriptPrompt, 
      duration,
      apiKey,
      baseUrl,
      model,
      isFullPrompt,
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    if (!scriptPrompt || !duration) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证脚本要求字数限制
    const SCRIPT_PROMPT_MAX_LENGTH = 20000;
    if (scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH) {
      return NextResponse.json({ 
        error: `脚本要求超过字数限制（${scriptPrompt.length}/${SCRIPT_PROMPT_MAX_LENGTH}字），请精简内容` 
      }, { status: 400 });
    }

    // 检查是否已有进行中的任务
    const client = getSupabaseClient();
    const { data: existingTasks } = await client
      .from('script_tasks')
      .select('id, status')
      .eq('project_id', projectId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingTasks && existingTasks.length > 0) {
      // 已有进行中的任务，返回该任务ID
      console.log(`[Script] Project ${projectId} already has task ${existingTasks[0].id}`);
      return NextResponse.json({
        taskId: existingTasks[0].id,
        status: existingTasks[0].status,
        message: '已有进行中的任务',
      });
    }

    // 创建新任务
    const requestParams = {
      productImages,
      productDescription,
      scriptPrompt,
      duration,
      apiKey,
      baseUrl,
      model,
      isFullPrompt,
    };
    
    const taskId = await createTask(projectId, requestParams);
    
    console.log(`[Script] Created task ${taskId} for project ${projectId}`);

    // 后台执行生成（不等待）
    executeScriptGeneration(taskId, projectId, auth.userId, {
      productImages,
      productDescription,
      scriptPrompt,
      duration,
      apiKey,
      baseUrl,
      model,
      isFullPrompt,
    }).catch(err => {
      console.error(`[Script] Background execution error for task ${taskId}:`, err);
    });

    return NextResponse.json({
      taskId,
      status: 'pending',
      message: '任务已创建，正在后台生成',
    });

  } catch (error) {
    console.error('[Script] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建任务失败' },
      { status: 500 }
    );
  }
}
