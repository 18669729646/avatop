import { NextRequest, NextResponse } from 'next/server';
import { longRunningAgent } from '@/lib/fetch-agent';
import { errorResponse } from '@/lib/logger';

/**
 * OpenAI 格式视频创建 API
 * 
 * 支持两种模式：
 * 1. 传统 OpenAI 格式（Veo 等）：POST /v1/videos，使用 FormData
 * 2. Seedance 2.0 格式：POST /v1/videos/generations，使用 JSON body
 */

// 判断是否为 Seedance 2.0 模型
function isSeedanceModel(model: string): boolean {
  return model.startsWith('doubao-seedance') || model.startsWith('seedance');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      apiKey, baseUrl, model, prompt,
      // Seedance 参数（前端用 seedance* 前缀）
      seedanceDuration,
      seedanceImages,     // Seedance 多张参考图（最多9张）
      endFrameUrl,        // Veo 尾帧 URL（FormData 模式）
      seedanceAspectRatio,// 宽高比（Seedance）
      seedanceResolution, // 分辨率：480p/720p/1080p（Seedance）
      seedanceWatermark,
      seedanceRealPersonMode, // 真人模式
      imageTailUrl,       // Seedance 尾帧 URL（JSON 模式）
      videoRefUrl,        // Seedance 参考视频 URL
      audioRefUrls,       // Seedance 参考音频 URL 列表
      extraBody,          // 其他额外参数
      // 非 Seedance 模型参数
      aspectRatio,
      watermark,
    } = body;

    // 验证必填字段
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: '模型不能为空' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    // apiBaseUrl 用于 openai 格式模型（如 yunwu.ai/v1/...）
    // Seedance 走极客智坊单独处理，不走此路径
    const apiBaseUrl = baseUrl || 'https://geekai.co';
    const duration = seedanceDuration || (isSeedanceModel(model) ? 5 : 8);
    // Seedance 运动幅度和镜头控制已通过 extraBody 传入
    // 合并 extraBody（可能包含 movement_amplitude、camera_control、real_person_mode 等）
    const mergedExtraBody: Record<string, unknown> = { ...(extraBody || {}) };

    console.log(`[OpenAI Video Create] model=${model}, isSeedance=${isSeedanceModel(model)}, duration=${duration}s`);

    // 根据模型类型选择调用方式
    if (isSeedanceModel(model)) {
      // Seedance 2.0：使用 JSON body，异步模式
      const result = await createSeedanceVideo({
        apiKey, apiBaseUrl, model, prompt,
        duration,
        seedanceImages,
        imageTailUrl,
        videoRefUrl,
        audioRefUrls,
        aspectRatio: seedanceAspectRatio,
        resolution: seedanceResolution,
        watermark: seedanceWatermark,
        realPersonMode: seedanceRealPersonMode,
        extraBody: Object.keys(mergedExtraBody).length > 0 ? mergedExtraBody : undefined,
      });
      return NextResponse.json(result);
    } else {
      // 传统 OpenAI 格式（Veo 等）：使用 FormData
      const result = await createOpenAIFormatVideo({
        apiKey, apiBaseUrl, model, prompt,
        seconds: duration,
        images: body.images || [],
        endFrameUrl,
        aspectRatio,
        watermark,
      });
      return NextResponse.json(result);
    }

  } catch (error) {
    return errorResponse('video/openai-create', 'POST', error);
  }
}

/**
 * Seedance 2.0 格式：JSON body，异步模式
 * 端点：POST /v1/videos/generations
 */
async function createSeedanceVideo(opts: {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  prompt: string;
  duration: number;
  images?: string[];
  seedanceImages?: string[];
  imageTailUrl?: string;
  videoRefUrl?: string;
  audioRefUrls?: string[];
  aspectRatio?: string;
  resolution?: string;
  watermark?: boolean;
  realPersonMode?: boolean;
  extraBody?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const {
    apiKey, apiBaseUrl, model, prompt, duration,
    images, seedanceImages, imageTailUrl, videoRefUrl, audioRefUrls,
    aspectRatio, resolution, watermark, realPersonMode, extraBody,
  } = opts;

  // apiBaseUrl 可能含 /api/v1 路径（如 https://geekai.co/api/v1）
  // 根据是否含 /api/v1 判断是极客智坊还是其他平台
  const isGeekai = apiBaseUrl.includes('/api/v1');
  const cleanBase = isGeekai
    ? apiBaseUrl.replace(/\/api\/v1\/?$/, '')
    : apiBaseUrl;

  // 根据不同平台拼接正确路径
  // 极客智坊: https://geekai.co/api/v1/videos/generations
  // 云眸:     https://yunwu.ai/v1/videos/generations
  const videoApiUrl = isGeekai
    ? `${cleanBase}/api/v1/videos/generations`
    : `${cleanBase}/v1/videos/generations`;

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    async: true, // Seedance 仅支持异步
    duration,
    watermark: watermark ?? false,
  };

  // 宽高比（Seedance 支持：16:9 / 9:16 / 3:4 / 4:3 / 1:1 / 21:9 / adaptive）
  if (aspectRatio) {
    requestBody.aspect_ratio = aspectRatio;
  }

  // 分辨率（Seedance 支持：480p / 720p / 1080p）
  if (resolution) {
    requestBody.resolution = resolution;
  }

  // 首帧 + 尾帧模式：用 image + image_tail，不传 images
  // 多图参考模式：用 images 数组，不传 image/image_tail
  // 两者不能混用（API 会报错 "first/last frame content cannot be mixed with reference media content"）
  if (imageTailUrl) {
    // 有尾帧 → 首帧模式
    if (seedanceImages && seedanceImages.length > 0) {
      requestBody.image = seedanceImages[0];
    } else if (images && images.length > 0) {
      requestBody.image = images[0];
    }
    requestBody.image_tail = imageTailUrl;
  } else if (seedanceImages && seedanceImages.length > 0) {
    // 无尾帧 + 有多图 → 参考图模式（只用 images）
    requestBody.images = seedanceImages;
  } else if (images && images.length > 0) {
    // 无尾帧 + 有单图 → 首帧模式
    requestBody.image = images[0];
  }

  // 参考视频
  if (videoRefUrl) {
    requestBody.video = videoRefUrl;
  }

  // 参考音频
  if (audioRefUrls && audioRefUrls.length > 0) {
    requestBody.audio = audioRefUrls;
  }

  // 真人模式
  if (realPersonMode) {
    requestBody.extra_body = {
      ...(extraBody || {}),
      real_person_mode: true,
    };
  } else if (extraBody) {
    requestBody.extra_body = extraBody;
  }

  console.log('[Seedance Create] 请求参数:', {
    model,
    duration,
    aspectRatio: requestBody.aspect_ratio,
    resolution: requestBody.resolution,
    hasImage: !!requestBody.image,
    hasImageTail: !!imageTailUrl,
    hasVideo: !!videoRefUrl,
    hasAudio: audioRefUrls?.length,
    realPersonMode,
  });

  const response = await fetch(videoApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60 * 1000),
  });

  const contentType = response.headers.get('content-type') || '';
  let data: Record<string, unknown>;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.error('[Seedance Create] 非 JSON 响应:', text.substring(0, 500));
    return {
      ok: false,
      error: `API 返回非预期格式 (${response.status}): ${text.substring(0, 200)}`,
    };
  }

  // 日志：记录完整原始响应，用于排查 API 返回异常
  console.log(`[Seedance Create] 原始响应 (status=${response.status}):`, JSON.stringify(data));

  // 检查 API 是否返回了 task_id
  if (response.ok && !data.task_id) {
    console.error('[Seedance Create] API 返回成功但缺少 task_id:', JSON.stringify(data));
    return {
      ok: false,
      error: `API 返回成功但缺少 task_id: ${JSON.stringify(data).substring(0, 200)}`,
    };
  }

  if (!response.ok) {
    console.error('[Seedance Create] API HTTP 错误:', JSON.stringify(data));
    return {
      ok: false,
      error: (data.error as string) || (data.message as string) || `API 请求失败: ${response.status}`,
    };
  }

  console.log('[Seedance Create] 成功，task_id:', data.task_id);
  return { ok: true, ...data };
}

/**
 * 传统 OpenAI 格式（Veo 等）：FormData
 * 端点：POST /v1/videos
 */
async function createOpenAIFormatVideo(opts: {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  prompt: string;
  seconds: number;
  images?: string[];
  endFrameUrl?: string;
  aspectRatio?: string;
  watermark?: boolean;
}): Promise<Record<string, unknown>> {
  const {
    apiKey, apiBaseUrl, model, prompt, seconds,
    images, endFrameUrl, aspectRatio, watermark,
  } = opts;

  const videoApiUrl = `${apiBaseUrl}/v1/videos`;

  // 构建 FormData
  const formData = new FormData();
  formData.append('model', model);
  formData.append('prompt', prompt);
  formData.append('seconds', String(seconds));

  // 处理尺寸
  const size = aspectRatio ? aspectRatio.replace(':', 'x') : '9x16';
  formData.append('size', size);

  if (watermark !== undefined) {
    formData.append('watermark', String(watermark));
  }

  // 处理参考图片
  if (images && images.length > 0) {
    const validImages = images.filter((img: string) => img && !img.startsWith('data:'));
    for (let i = 0; i < validImages.length; i++) {
      const imageUrl = validImages[i];
      try {
        const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30 * 1000) });
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get('content-type') || 'image/png';
          const extension = contentType.split('/')[1] || 'png';
          const blob = new Blob([imageBuffer], { type: contentType });
          formData.append('input_reference', blob, `image_${i}.${extension}`);
        }
      } catch (imgError) {
        console.error(`[OpenAI Create] 下载图片失败 ${i + 1}:`, imgError);
      }
    }
  }

  // 处理尾帧图片
  if (endFrameUrl) {
    try {
      const endFrameResponse = await fetch(endFrameUrl, { signal: AbortSignal.timeout(30 * 1000) });
      if (endFrameResponse.ok) {
        const endFrameBuffer = await endFrameResponse.arrayBuffer();
        const contentType = endFrameResponse.headers.get('content-type') || 'image/png';
        const extension = contentType.split('/')[1] || 'png';
        const blob = new Blob([endFrameBuffer], { type: contentType });
        formData.append('last_frame', blob, `end_frame.${extension}`);
      }
    } catch (efError) {
      console.error('[OpenAI Create] 下载尾帧失败:', efError);
    }
  }

  console.log('[OpenAI Format Create] 请求参数:', {
    model, seconds, size, hasImages: (images?.length ?? 0) > 0, hasEndFrame: !!endFrameUrl,
  });

  const response = await fetch(videoApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(60 * 1000),
  });

  const contentType = response.headers.get('content-type') || '';
  let data: Record<string, unknown>;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.error('[OpenAI Format Create] 非 JSON 响应:', text.substring(0, 500));
    return {
      ok: false,
      error: `API 返回非预期格式 (${response.status}): ${text.substring(0, 200)}`,
    };
  }

  if (!response.ok) {
    console.error('[OpenAI Format Create] API 错误:', JSON.stringify(data));
    return {
      ok: false,
      error: (data.error as string) || (data.message as string) || `API 请求失败: ${response.status}`,
    };
  }

  console.log('[OpenAI Format Create] 成功，id:', data.id);
  return { ok: true, ...data };
}
