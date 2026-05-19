import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_MODELS, FRAMES_MODELS } from '@/lib/system-config';
import { longRunningAgent } from '@/lib/fetch-agent';
import { errorResponse } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    const { apiKey, baseUrl, model, prompt, images, aspectRatio, enhancePrompt, enableUpsample, generateAudio } = body;
    
    if (!apiKey) {
      console.error('[Video Create] Missing API Key');
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }
    
    if (!model) {
      console.error('[Video Create] Missing model');
      return NextResponse.json(
        { error: '模型不能为空' },
        { status: 400 }
      );
    }

    if (!VIDEO_MODELS.includes(model)) {
      console.error(`[Video Create] Unsupported model: ${model}`);
      return NextResponse.json(
        { error: `不支持的模型: ${model}` },
        { status: 400 }
      );
    }
    
    if (!prompt) {
      console.error('[Video Create] Missing prompt');
      return NextResponse.json(
        { error: '提示词不能为空' },
        { status: 400 }
      );
    }

    // 确定API基础URL（视频API使用v1端点）
    // 去掉末尾的 /api/v1 避免重复拼接
    const normalizedBase = (baseUrl || 'https://yunwu.ai').replace(/\/api\/v1$/, '');
    const videoApiUrl = `${normalizedBase}/v1/video/create`;
    
    console.log(`[Video Create] Creating video with model: ${model}, API: ${videoApiUrl}`);

    // 构建请求体 - 按照云雾API文档格式
    const requestBody: Record<string, unknown> = {
      model,
      prompt,
      // 开启提示词增强，支持中文自动转英文
      enhance_prompt: enhancePrompt ?? true,
    };

    // 音频生成 - 默认开启
    if (generateAudio !== undefined) {
      requestBody.generate_audio = generateAudio;
    }

    // 首尾帧图片 - 按照API文档，使用 images 数组
    // veo2-fast-frames: 最多支持两个图片，分别是首尾帧
    // veo3-pro-frames: 最多支持一个首帧
    // veo2-fast-components: 最多支持3个元素图片
    if (images && images.length > 0) {
      // 过滤掉无效的图片（空值或base64）
      const validImages = images.filter((img: string) => img && !img.startsWith('data:'));
      
      if (validImages.length > 0) {
        requestBody.images = validImages;
        console.log(`[Video Create] Images (${validImages.length}):`, validImages.map((img: string) => 
          img.substring(0, 60) + '...'
        ));
      }
    }

    if (aspectRatio) {
      requestBody.aspect_ratio = aspectRatio;
    }

    if (enableUpsample !== undefined) {
      requestBody.enable_upsample = enableUpsample;
    }

    console.log('[Video Create] Request body:', JSON.stringify({
      model: requestBody.model,
      prompt: String(requestBody.prompt).substring(0, 50) + '...',
      images: requestBody.images ? `${(requestBody.images as string[]).length} images` : 'none',
      enhance_prompt: requestBody.enhance_prompt,
      generate_audio: requestBody.generate_audio,
      aspect_ratio: requestBody.aspect_ratio,
    }));

    // 调用视频 API
    const response = await fetch(videoApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      // @ts-expect-error - Node.js undici Agent
      dispatcher: longRunningAgent,
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('[Video Create] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: `API 返回非预期格式 (${response.status}): ${text.substring(0, 200)}` },
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.error('[Video Create] API error:', JSON.stringify(data));
      return NextResponse.json(
        { error: data.error?.message || data.error || data.message || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    console.log('[Video Create] Success:', JSON.stringify(data));
    return NextResponse.json(data);
    
  } catch (error) {
    return errorResponse('video/create', 'POST', error);
  }
}
