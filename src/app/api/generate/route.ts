import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { longRunningAgent } from '@/lib/fetch-agent';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { authenticateRequest, unauthorizedResponse, INTERNAL_AUTH_HEADER } from '@/lib/auth-middleware';
import { consumeCredits, checkUserCredits } from '@/lib/credits';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';

// Gemini 图片生成模型列表
const GEMINI_IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image-preview',
];

// GrsAI NanoBanana 模型列表
const NANOBANANA_MODELS = [
  'nano-banana-2',
  'nano-banana-pro',
  'nano-banana-fast',
];

// GrsAI GPTImage 模型列表
const GPTIMAGE_MODELS = [
  'sora-image',
  'gpt-image-2',
  'gpt-image',
];

// 图片压缩配置（尺寸压缩到 1K 以内）
const IMAGE_COMPRESS_CONFIG = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 100,
};

// 判断是否为 Gemini 图片生成模型
function isGeminiImageModel(model: string): boolean {
  return GEMINI_IMAGE_MODELS.includes(model) || (model.includes('gemini') && model.includes('image'));
}

// 判断是否为 NanoBanana 模型
function isNanoBananaModel(model: string): boolean {
  return NANOBANANA_MODELS.includes(model) || model.includes('nano-banana');
}

// 判断是否为 GPTImage 模型
function isGptImageModel(model: string): boolean {
  return GPTIMAGE_MODELS.some(m => model.includes(m));
}

// 判断是否为 Gemini 原生端点
function isGeminiNativeEndpoint(baseUrl: string): boolean {
  return baseUrl.includes('/v1beta');
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 检查积分是否足够（图片生成）
    const creditCheck = await checkUserCredits(auth.userId, 5); // 图片生成消耗5积分
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        { error: `积分不足，当前积分 ${creditCheck.balance}，需要 ${creditCheck.required} 积分` },
        { status: 402 }
      );
    }
    
    // 检查存储空间是否足够
    const storageCheck = await checkStorageQuota(auth.userId);
    if (!storageCheck.allowed) {
      return NextResponse.json(
        { error: storageCheck.error },
        { status: 507 } // 507 Insufficient Storage
      );
    }
    
    // 先尝试读取请求体文本
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch (readError) {
      console.error('[Generate API] 读取请求体失败:', readError);
      return NextResponse.json(
        { error: '读取请求体失败，请检查网络连接或减少请求大小' },
        { status: 400 }
      );
    }
    
    // 检查请求体大小
    const sizeMB = bodyText.length / (1024 * 1024);
    console.log(`[Generate API] 请求体大小: ${sizeMB.toFixed(2)}MB`);
    
    // 如果超过 10MB，提前返回错误
    if (sizeMB > 10) {
      console.error(`[Generate API] 请求体过大: ${sizeMB.toFixed(2)}MB`);
      return NextResponse.json(
        { error: `请求体过大 (${sizeMB.toFixed(1)}MB)，请减少参考图数量或压缩图片后重试` },
        { status: 413 }
      );
    }
    
    // 解析 JSON
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('[Generate API] JSON 解析失败:', parseError);
      return NextResponse.json(
        { error: '请求体格式错误，请检查数据格式' },
        { status: 400 }
      );
    }
    
    // 验证必填字段
    const apiKey = body.apiKey as string | undefined;
    const baseUrl = body.baseUrl as string | undefined;
    const model = body.model as string | undefined;
    const prompt = body.prompt as string | undefined;
    const aspectRatio = body.aspectRatio as string | undefined;
    const resolution = body.resolution as string | undefined;
    const images = body.images as string[] | undefined;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key 不能为空' },
        { status: 400 }
      );
    }
    
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'API 基础地址不能为空' },
        { status: 400 }
      );
    }
    
    if (!prompt) {
      return NextResponse.json(
        { error: '提示词不能为空' },
        { status: 400 }
      );
    }

    // 处理基础地址，确保格式正确
    let apiBaseUrl = (baseUrl || '').trim();
    // 移除末尾的斜杠
    if (apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1);
    }

    if (!isHttpUrl(apiBaseUrl)) {
      return NextResponse.json(
        { error: 'API 基础地址格式不正确，仅支持 http/https' },
        { status: 400 }
      );
    }

    if (images?.some(img => img && !isBase64Image(img) && !isHttpUrl(img))) {
      return NextResponse.json(
        { error: '参考图地址格式不正确，仅支持 base64 或 http/https URL' },
        { status: 400 }
      );
    }

    // 根据模型类型选择 API 调用方式
    const useNanoBanana = isNanoBananaModel(model || '');
    const useGeminiNative = isGeminiNativeEndpoint(apiBaseUrl) && isGeminiImageModel(model || '');
    
    // 检测是否是内部服务器调用（任务队列调用）
    // 内部调用由任务队列统一扣除积分，这里不重复扣
    const isInternalCall = request.headers.get(INTERNAL_AUTH_HEADER) === 'true';
    
    if (useNanoBanana) {
      // GrsAI NanoBanana API 格式
      return await callNanoBananaApi(apiBaseUrl, apiKey || '', model || '', prompt, aspectRatio, resolution, images, auth.userId, isInternalCall);
    } else if (useGeminiNative) {
      // Gemini 原生 API 格式 (v1beta 端点)
      return await callGeminiNativeApi(apiBaseUrl, apiKey || '', model || '', prompt, aspectRatio, resolution, images, auth.userId, isInternalCall);
    } else if (isGptImageModel(model || '')) {
      // GrsAI GPTImage API 格式
      return await callGptImageApi(apiBaseUrl, apiKey || '', model || '', prompt, aspectRatio, resolution, images, auth.userId, isInternalCall);
    } else {
      // OpenAI 兼容格式 (v1 端点) - 暂不支持
      return NextResponse.json(
        { error: '请使用 v1beta 端点调用 Gemini 图片生成模型' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Generate image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}

// GrsAI GPTImage API 调用函数
// 端点: /v1/draw/completions
// 请求体格式与 NanoBanana 相同: { model, prompt, aspectRatio, urls, webHook }
async function callGptImageApi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio?: string,
  _resolution?: string,
  images?: string[],
  userId?: string,
  isInternalCall?: boolean
) {
  console.log(`[GPTImage API] 开始调用: ${model}`);
  
  // Step 1: 提交生成任务
  const submitEndpoint = `${baseUrl}/v1/draw/completions`;
  
  // 构建请求体（按 API 文档格式）
  const requestBody: Record<string, unknown> = {
    model: model || 'sora-image',
    prompt: prompt,
    aspectRatio: aspectRatio || 'auto',
    webHook: '-1', // 使用轮询模式，接口立即返回 id
  };

  // 如果有参考图片，添加到 urls 数组
  if (images && images.length > 0) {
    const validImages = images.filter(img => img);
    if (validImages.length > 0) {
      requestBody.urls = validImages;
      console.log(`[GPTImage API] 参考图数量: ${validImages.length}`);
    }
  }

  console.log(`[GPTImage API] 提交任务: ${submitEndpoint}`);
  console.log(`[GPTImage API] 请求体:`, JSON.stringify({
    model: requestBody.model,
    prompt: requestBody.prompt,
    aspectRatio: requestBody.aspectRatio,
    urls: requestBody.urls ? `[${(requestBody.urls as string[]).length}张图片]` : undefined,
  }));

  // 设置超时控制（10分钟）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[GPTImage API] 请求超时，中止请求');
    controller.abort();
  }, 10 * 60 * 1000);

  try {
    // Step 1: 提交任务
    const submitResponse = await fetch(submitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      // @ts-expect-error - Node.js undici Agent
      dispatcher: longRunningAgent,
    });

    const submitContentType = submitResponse.headers.get('content-type') || '';
    let submitData: Record<string, unknown>;
    
    if (submitContentType.includes('application/json')) {
      submitData = await submitResponse.json();
    } else {
      const text = await submitResponse.text();
      console.error('[GPTImage API] 非JSON响应:', text.substring(0, 500));
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: `API 返回非预期格式 (${submitResponse.status}): ${text.substring(0, 100)}` },
        { status: submitResponse.status }
      );
    }

    // 检查提交响应
    if (submitData.code !== 0) {
      console.error('[GPTImage API] 提交失败:', submitData);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: (submitData.msg as string) || '提交任务失败' },
        { status: 400 }
      );
    }

    console.log('[GPTImage API] 提交成功:', JSON.stringify(submitData));

    // 获取任务 ID
    const dataObj = submitData.data as Record<string, unknown> | undefined;
    const taskId = dataObj?.id as string | undefined;
    
    if (!taskId) {
      console.error('[GPTImage API] 未返回任务ID:', submitData);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'API 未返回任务ID', raw: submitData },
        { status: 500 }
      );
    }

    console.log(`[GPTImage API] 任务ID: ${taskId}`);

    // Step 2: 轮询获取结果
    const resultEndpoint = `${baseUrl}/v1/draw/result`;
    const maxRetries = 200; // 最多轮询 200 次（10分钟 / 3秒 = 200次）
    const retryInterval = 3000; // 每次间隔 3 秒

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
      console.log(`[GPTImage API] 轮询第 ${i + 1} 次...`);
      
      const resultResponse = await fetch(resultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id: taskId }),
        signal: controller.signal,
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const resultContentType = resultResponse.headers.get('content-type') || '';
      let resultData: Record<string, unknown>;
      
      if (resultContentType.includes('application/json')) {
        resultData = await resultResponse.json();
      } else {
        const text = await resultResponse.text();
        console.error('[GPTImage API] 结果查询非JSON响应:', text.substring(0, 500));
        continue;
      }

      if (resultData.code !== 0) {
        console.error('[GPTImage API] 结果查询失败:', resultData);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: (resultData.msg as string) || '查询任务状态失败' },
          { status: 400 }
        );
      }

      const resultObj = resultData.data as Record<string, unknown> | undefined;
      if (!resultObj) {
        console.error('[GPTImage API] 结果数据为空:', resultData);
        continue;
      }

      const status = resultObj.status as string;
      const progress = resultObj.progress as number;

      console.log(`[GPTImage API] 轮询结果: status=${status}, progress=${progress}, taskId=${taskId}`);

      // 成功
      if (status === 'succeeded') {
        clearTimeout(timeoutId);
        return await parseGptImageResultResponse(resultObj, userId, isInternalCall);
      }
      
      // 失败
      if (status === 'failed') {
        clearTimeout(timeoutId);
        const failureReason = resultObj.failure_reason as string || resultObj.error as string;
        return NextResponse.json(
          { error: `图片生成失败: ${failureReason || '未知错误'}` },
          { status: 500 }
        );
      }
      
      // 进行中
      if (status === 'running') {
        console.log(`[GPTImage API] 任务进行中: ${progress}%`);
        continue;
      }
      
      console.log(`[GPTImage API] 未知状态: ${status}`);
      continue;
    }

    clearTimeout(timeoutId);
    console.log(`[GPTImage API] 轮询结束，达到最大次数 ${maxRetries}，taskId=${taskId}`);
    return NextResponse.json(
      { error: '图片生成超时，请稍后重试' },
      { status: 504 }
    );

  } catch (fetchError) {
    clearTimeout(timeoutId);
    
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[GPTImage API] 请求超时');
      return NextResponse.json(
        { error: 'API 请求超时，请稍后重试' },
        { status: 504 }
      );
    }
    
    console.error('[GPTImage API] 请求失败:', fetchError);
    return NextResponse.json(
      { error: `API 请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 解析 GPTImage 结果响应
async function parseGptImageResultResponse(data: Record<string, unknown>, userId?: string, isInternalCall?: boolean): Promise<NextResponse> {
  try {
    const results = data.results as Array<{ url?: string; content?: string }> | undefined;
    
    if (results && results.length > 0 && results[0].url) {
      // 扣除积分
      if (userId && !isInternalCall) {
        const result = await consumeCredits(userId, 'image_generate');
        if (!result.success) {
          console.error('[GPTImage API] 扣除积分失败:', result.error);
        } else {
          console.log(`[GPTImage API] 扣除积分成功: ${result.creditsUsed} 积分`);
        }
      } else if (isInternalCall) {
        console.log(`[GPTImage API] 内部调用，跳过积分扣除（由任务队列统一处理）`);
      }
      
      const originalUrl = results[0].url;
      console.log(`[GPTImage API] 生成成功，图片URL: ${originalUrl.substring(0, 80)}...`);
      
      // 下载并保存到对象存储
      console.log(`[GPTImage API] 开始下载图片并保存到对象存储...`);
      
      try {
        const downloadResponse = await fetch(originalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (downloadResponse.ok) {
          const arrayBuffer = await downloadResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const contentType = downloadResponse.headers.get('content-type') || 'image/png';
          const extension = contentType.split('/')[1] || 'png';
          
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileName = `generated/${timestamp}_${randomStr}.${extension}`;
          
          console.log(`[GPTImage API] 图片大小: ${(buffer.length / 1024).toFixed(2)}KB`);
          
          const uploadResult = await s3Storage.uploadFile({
            fileContent: buffer,
            fileName: fileName,
            contentType: contentType,
          });
          
          const uploadUrl = await s3Storage.generatePresignedUrl({
            key: uploadResult,
            expireTime: URL_EXPIRE_TIME,
          });
          
          if (uploadUrl) {
            console.log(`[GPTImage API] 图片已保存到对象存储: ${uploadUrl}`);
            return NextResponse.json({
              data: [{ url: uploadUrl, fileSize: buffer.length, saved: true }],
              created: Date.now()
            });
          } else {
            console.warn(`[GPTImage API] 上传对象存储失败`);
          }
        } else {
          console.warn(`[GPTImage API] 下载图片失败: ${downloadResponse.status}`);
        }
      } catch (downloadError) {
        console.warn(`[GPTImage API] 下载保存图片异常:`, downloadError);
      }
      
      // 降级处理：返回原始 URL
      return NextResponse.json({
        data: [{ url: originalUrl }],
        created: Date.now()
      });
    }
    
    console.error('[GPTImage API] 结果中没有图片URL:', data);
    return NextResponse.json(
      { error: '生成结果中没有图片URL', raw: data },
      { status: 500 }
    );
  } catch (parseError) {
    console.error('[GPTImage API] 解析结果失败:', parseError);
    return NextResponse.json(
      { error: '解析结果失败', raw: data },
      { status: 500 }
    );
  }
}

// 判断是否为 base64 格式图片
function isBase64Image(img: string): boolean {
  return img.startsWith('data:image/');
}



// 下载图片并转为 base64（带压缩）
async function downloadImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  if (!isHttpUrl(url)) {
    throw new Error('图片 URL 格式不正确，仅支持 http/https');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  
  // 压缩图片到 1K 以内
  try {
    const compressedBuffer = await sharp(Buffer.from(buffer))
      .resize(IMAGE_COMPRESS_CONFIG.maxWidth, IMAGE_COMPRESS_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_COMPRESS_CONFIG.quality })
      .toBuffer();
    
    const base64 = compressedBuffer.toString('base64');
    console.log(`[API图片压缩] 压缩完成: ${(buffer.byteLength / 1024).toFixed(1)}KB → ${(compressedBuffer.length / 1024).toFixed(1)}KB`);
    
    return { data: base64, mimeType: 'image/jpeg' };
  } catch (compressError) {
    console.error('[API图片压缩] 压缩失败，使用原图:', compressError);
    const base64 = Buffer.from(buffer).toString('base64');
    return { data: base64, mimeType: contentType };
  }
}

// 压缩 base64 图片
async function compressBase64Image(base64Data: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 压缩图片到 1K 以内
    const compressedBuffer = await sharp(buffer)
      .resize(IMAGE_COMPRESS_CONFIG.maxWidth, IMAGE_COMPRESS_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_COMPRESS_CONFIG.quality })
      .toBuffer();
    
    const compressedBase64 = compressedBuffer.toString('base64');
    console.log(`[API图片压缩] 压缩完成: ${(buffer.length / 1024).toFixed(1)}KB → ${(compressedBuffer.length / 1024).toFixed(1)}KB`);
    
    return { data: compressedBase64, mimeType: 'image/jpeg' };
  } catch (compressError) {
    console.error('[API图片压缩] 压缩失败，使用原图:', compressError);
    return { data: base64Data, mimeType };
  }
}

// Gemini 原生 API 调用 (v1beta 端点)
async function callGeminiNativeApi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio?: string,
  resolution?: string,
  images?: string[],
  userId?: string,
  isInternalCall?: boolean  // 内部调用不扣积分
) {
  // Gemini 端点格式: /v1beta/models/{model}:generateContent
  const endpoint = `${baseUrl}/models/${model}:generateContent`;

  // 构建 Gemini 请求体
  const parts: Record<string, unknown>[] = [];

  // 如果有参考图片，先添加图片
  if (images && images.length > 0) {
    for (const img of images) {
      // 跳过空值
      if (!img) continue;
      
      if (isBase64Image(img)) {
        // base64 格式图片：提取数据并压缩
        const extractedData = img.replace(/^data:image\/\w+;base64,/, '');
        const extractedMimeType = img.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
        
        // 压缩 base64 图片
        const compressed = await compressBase64Image(extractedData, extractedMimeType);
        
        parts.push({
          inline_data: {
            mime_type: compressed.mimeType,
            data: compressed.data
          }
        });
      } else {
        // URL 格式图片：下载并压缩
        console.log(`[Gemini API] 下载图片 URL: ${img.substring(0, 80)}...`);
        const result = await downloadImageAsBase64(img);
        
        parts.push({
          inline_data: {
            mime_type: result.mimeType,
            data: result.data
          }
        });
      }
    }
  }

  // 添加文本提示
  parts.push({ text: prompt });

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio || "1:1",
        imageSize: resolution || "2K"
      }
    }
  };

  // 打印最终请求体（图片数据只显示摘要）
  const logRequestBody = {
    ...requestBody,
    contents: [{
      ...((requestBody.contents as Record<string, unknown>[])[0]),
      parts: parts.map((p) => {
        const inlineData = p.inline_data as { mime_type?: string; data?: string } | undefined;
        if (inlineData && inlineData.data) {
          return {
            inline_data: {
              mime_type: inlineData.mime_type,
              data: `${inlineData.data.substring(0, 50)}...(base64 ${Math.round(inlineData.data.length / 1024)}KB)`,
              _original_length: inlineData.data.length
            }
          };
        }
        return p;
      })
    }]
  };
  console.log(`[Gemini API] 最终请求体:\n${JSON.stringify(logRequestBody, null, 2)}`);
  console.log(`[Gemini API] 请求体总大小约: ${Math.round(JSON.stringify(requestBody).length / 1024)}KB`);

  // 使用 Query 参数传递 API Key (Gemini 原生格式)
  const url = `${endpoint}?key=${apiKey}`;
  
  // 设置超时控制（10分钟）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[Gemini API] 请求超时，中止请求');
    controller.abort();
  }, 10 * 60 * 1000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      // @ts-expect-error - Node.js undici Agent
      dispatcher: longRunningAgent,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response from Gemini API:', text.substring(0, 500));
      return NextResponse.json(
        { error: `API 返回非预期格式 (${response.status}): ${text.substring(0, 100)}` },
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return NextResponse.json(
        { error: data.error?.message || data.error || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 解析 Gemini 响应，提取图片
    return await parseGeminiResponse(data, userId, isInternalCall);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[Gemini API] 请求超时');
      return NextResponse.json(
        { error: 'API 请求超时，请稍后重试' },
        { status: 504 }
      );
    }
    
    console.error('[Gemini API] 请求失败:', fetchError);
    return NextResponse.json(
      { error: `API 请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 解析 Gemini 响应
async function parseGeminiResponse(data: Record<string, unknown>, userId?: string, isInternalCall?: boolean): Promise<NextResponse> {
  try {
    const candidates = data.candidates as Record<string, unknown>[] | undefined;
    if (candidates && candidates.length > 0) {
      const parts = (candidates[0].content as Record<string, unknown>)?.parts as Record<string, unknown>[] || [];
      
      // 查找图片部分
      for (const part of parts) {
        if (part.inlineData) {
          // 扣除积分（图片生成成功）- 仅在非内部调用时扣除
          if (userId && !isInternalCall) {
            const result = await consumeCredits(userId, 'image_generate');
            if (!result.success) {
              console.error('[Gemini API] 扣除积分失败:', result.error);
            } else {
              console.log(`[Gemini API] 扣除积分成功: ${result.creditsUsed} 积分`);
            }
          } else if (isInternalCall) {
            console.log(`[Gemini API] 内部调用，跳过积分扣除（由任务队列统一处理）`);
          }
          
          // 返回 base64 图片
          return NextResponse.json({
            data: [{
              b64_json: (part.inlineData as Record<string, unknown>).data,
              mimeType: (part.inlineData as Record<string, unknown>).mimeType || 'image/png'
            }],
            created: Date.now()
          });
        }
      }
      
      // 如果没有图片，检查是否有文本（可能是错误或解释）
      const textPart = parts.find((p: Record<string, unknown>) => p.text);
      if (textPart) {
        return NextResponse.json(
          { error: `模型返回文本而非图片: ${textPart.text}` },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: '未返回生成的图片', raw: data },
      { status: 500 }
    );
  } catch {
    console.error('Failed to parse Gemini response:', data);
    return NextResponse.json(
      { error: '解析响应失败', raw: data },
      { status: 500 }
    );
  }
}

// OpenAI 兼容 API 调用 (v1 端点)
async function callOpenAiCompatibleApi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  size?: string,
  images?: string[]
) {
  const endpoint = `${baseUrl}/images/generations`;

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size: size || '1024x1024',
  };

  // 如果有参考图片，根据不同模型添加图片参数
  if (images && images.length > 0) {
    if (model.includes('gpt-image')) {
      // GPT Image 模型支持多张参考图
      requestBody.image = images[0];
      if (images.length > 1) {
        requestBody.image2 = images[1];
      }
      if (images.length > 2) {
        requestBody.image3 = images[2];
      }
      if (images.length > 3) {
        requestBody.image4 = images[3];
      }
    } else if (model.includes('flux') || model.includes('kontext')) {
      // Flux 系列模型
      requestBody.image = images[0];
    }
  }

  console.log(`Calling OpenAI compatible API: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
    console.error('Non-JSON response from API:', text.substring(0, 500));
    return NextResponse.json(
      { error: `API 返回非预期格式 (${response.status}): ${text.substring(0, 100)}` },
      { status: response.status }
    );
  }

  if (!response.ok) {
    console.error('API error:', data);
    return NextResponse.json(
      { error: data.error?.message || data.error || `API 请求失败: ${response.status}` },
      { status: response.status }
    );
  }

  return NextResponse.json(data);
}

// NanoBanana API 调用 (GrsAI 平台)
// 文档: https://grsai.ai/zh/dashboard/documents/nano-banana
async function callNanoBananaApi(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio?: string,
  _resolution?: string,  // imageSize 参数
  images?: string[],
  userId?: string,
  isInternalCall?: boolean  // 内部调用不扣积分
) {
  console.log(`[NanoBanana API] 开始调用: ${model}`);
  
  // Step 1: 提交生成任务
  const submitEndpoint = `${baseUrl}/v1/draw/nano-banana`;
  
  // 构建请求体（按 API 文档格式）
  const requestBody: Record<string, unknown> = {
    model: model || 'nano-banana-pro',
    prompt: prompt,
    aspectRatio: aspectRatio || 'auto',
    imageSize: _resolution || '1K',
    webHook: '-1', // 使用轮询模式，接口立即返回 id
  };

  // 如果有参考图片，添加到 urls 数组
  // API 文档: urls 参数支持参考图 URL 或 Base64
  if (images && images.length > 0) {
    const validImages = images.filter(img => img);
    if (validImages.length > 0) {
      requestBody.urls = validImages;
      console.log(`[NanoBanana API] 参考图数量: ${validImages.length}`);
    }
  }

  console.log(`[NanoBanana API] 提交任务: ${submitEndpoint}`);
  console.log(`[NanoBanana API] 请求体:`, JSON.stringify({
    model: requestBody.model,
    prompt: requestBody.prompt,
    aspectRatio: requestBody.aspectRatio,
    imageSize: requestBody.imageSize,
    urls: requestBody.urls ? `[${(requestBody.urls as string[]).length}张图片]` : undefined,
  }));

  // 设置超时控制（10分钟）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[NanoBanana API] 请求超时，中止请求');
    controller.abort();
  }, 10 * 60 * 1000);

  try {
    // Step 1: 提交任务
    const submitResponse = await fetch(submitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      // @ts-expect-error - Node.js undici Agent
      dispatcher: longRunningAgent,
    });

    const submitContentType = submitResponse.headers.get('content-type') || '';
    let submitData: Record<string, unknown>;
    
    if (submitContentType.includes('application/json')) {
      submitData = await submitResponse.json();
    } else {
      const text = await submitResponse.text();
      console.error('[NanoBanana API] 非JSON响应:', text.substring(0, 500));
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: `API 返回非预期格式 (${submitResponse.status}): ${text.substring(0, 100)}` },
        { status: submitResponse.status }
      );
    }

    // 检查提交响应
    // API 文档格式: { code: 0, msg: "success", data: { id: "xxx" } }
    if (submitData.code !== 0) {
      console.error('[NanoBanana API] 提交失败:', submitData);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: (submitData.msg as string) || '提交任务失败' },
        { status: 400 }
      );
    }

    console.log('[NanoBanana API] 提交成功:', JSON.stringify(submitData));

    // 获取任务 ID
    // API 文档格式: data.id
    const dataObj = submitData.data as Record<string, unknown> | undefined;
    const taskId = dataObj?.id as string | undefined;
    
    if (!taskId) {
      console.error('[NanoBanana API] 未返回任务ID:', submitData);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'API 未返回任务ID', raw: submitData },
        { status: 500 }
      );
    }

    console.log(`[NanoBanana API] 任务ID: ${taskId}`);

    // Step 2: 轮询获取结果
    const resultEndpoint = `${baseUrl}/v1/draw/result`;
    const maxRetries = 200; // 最多轮询 200 次（10分钟 / 3秒 = 200次）
    const retryInterval = 3000; // 每次间隔 3 秒

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
      console.log(`[NanoBanana API] 轮询第 ${i + 1} 次...`);
      
      const resultResponse = await fetch(resultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id: taskId }),  // API 文档: 使用 id 参数
        signal: controller.signal,
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const resultContentType = resultResponse.headers.get('content-type') || '';
      let resultData: Record<string, unknown>;
      
      if (resultContentType.includes('application/json')) {
        resultData = await resultResponse.json();
      } else {
        const text = await resultResponse.text();
        console.error('[NanoBanana API] 结果查询非JSON响应:', text.substring(0, 500));
        continue;
      }

      // 检查响应格式
      // API 实际返回格式: { code: 0, data: { status, progress, results }, msg }
      if (resultData.code !== 0) {
        console.error('[NanoBanana API] 结果查询失败:', resultData);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: (resultData.msg as string) || '查询任务状态失败' },
          { status: 400 }
        );
      }

      // 从 data 对象中提取状态和结果
      const dataObj = resultData.data as Record<string, unknown> | undefined;
      if (!dataObj) {
        console.error('[NanoBanana API] 结果数据为空:', resultData);
        continue;
      }

      const status = dataObj.status as string;
      const progress = dataObj.progress as number;

      console.log(`[NanoBanana API] 轮询结果: status=${status}, progress=${progress}, taskId=${taskId}`);

      // 成功: status === "succeeded"
      if (status === 'succeeded') {
        clearTimeout(timeoutId);
        return await parseNanoBananaResultResponse(dataObj, userId, isInternalCall);
      }
      
      // 失败: status === "failed"
      if (status === 'failed') {
        clearTimeout(timeoutId);
        const failureReason = dataObj.failure_reason as string || dataObj.error as string;
        return NextResponse.json(
          { error: `图片生成失败: ${failureReason || '未知错误'}` },
          { status: 500 }
        );
      }
      
      // 进行中: status === "running"
      if (status === 'running') {
        console.log(`[NanoBanana API] 任务进行中: ${progress}%`);
        continue;
      }
      
      // 其他状态继续等待
      console.log(`[NanoBanana API] 未知状态: ${status}`);
      continue;
    }

    clearTimeout(timeoutId);
    console.log(`[NanoBanana API] 轮询结束，达到最大次数 ${maxRetries}，taskId=${taskId}`);
    return NextResponse.json(
      { error: '图片生成超时，请稍后重试' },
      { status: 504 }
    );

  } catch (fetchError) {
    clearTimeout(timeoutId);
    
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[NanoBanana API] 请求超时');
      return NextResponse.json(
        { error: 'API 请求超时，请稍后重试' },
        { status: 504 }
      );
    }
    
    console.error('[NanoBanana API] 请求失败:', fetchError);
    return NextResponse.json(
      { error: `API 请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 解析 NanoBanana 结果响应
// API 文档格式: { id, results: [{url, content}], progress, status }
// 在服务器端下载图片并保存到对象存储
async function parseNanoBananaResultResponse(data: Record<string, unknown>, userId?: string, isInternalCall?: boolean): Promise<NextResponse> {
  try {
    const results = data.results as Array<{ url?: string; content?: string }> | undefined;
    
    if (results && results.length > 0 && results[0].url) {
      // 扣除积分（图片生成成功）- 仅在非内部调用时扣除
      if (userId && !isInternalCall) {
        const result = await consumeCredits(userId, 'image_generate');
        if (!result.success) {
          console.error('[NanoBanana API] 扣除积分失败:', result.error);
        } else {
          console.log(`[NanoBanana API] 扣除积分成功: ${result.creditsUsed} 积分`);
        }
      } else if (isInternalCall) {
        console.log(`[NanoBanana API] 内部调用，跳过积分扣除（由任务队列统一处理）`);
      }
      
      const originalUrl = results[0].url;
      console.log(`[NanoBanana API] 生成成功，图片URL: ${originalUrl.substring(0, 80)}...`);
      
      // 在服务器端下载图片并保存到对象存储
      console.log(`[NanoBanana API] 开始下载图片并保存到对象存储...`);
      
      try {
        const downloadResponse = await fetch(originalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (downloadResponse.ok) {
          const arrayBuffer = await downloadResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // 确定内容类型
          const contentType = downloadResponse.headers.get('content-type') || 'image/png';
          const extension = contentType.split('/')[1] || 'png';
          
          // 生成文件名
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileName = `generated/${timestamp}_${randomStr}.${extension}`;
          
          console.log(`[NanoBanana API] 图片大小: ${(buffer.length / 1024).toFixed(2)}KB`);
          
          // 上传到对象存储（使用统一的 s3Storage 实例）
          const uploadResult = await s3Storage.uploadFile({
            fileContent: buffer,
            fileName: fileName,
            contentType: contentType,
          });
          
          // 生成签名 URL
          const uploadUrl = await s3Storage.generatePresignedUrl({
            key: uploadResult,
            expireTime: URL_EXPIRE_TIME, // 1年
          });
          
          if (uploadUrl) {
            console.log(`[NanoBanana API] 图片已保存到对象存储: ${uploadUrl}`);
            return NextResponse.json({
              data: [{ url: uploadUrl, fileSize: buffer.length, saved: true }],
              created: Date.now()
            });
          } else {
            console.warn(`[NanoBanana API] 上传对象存储失败`);
          }
        } else {
          console.warn(`[NanoBanana API] 下载图片失败: ${downloadResponse.status}`);
        }
      } catch (downloadError) {
        console.warn(`[NanoBanana API] 下载保存图片异常:`, downloadError);
      }
      
      // 如果下载或上传失败，返回原始 URL（降级处理）
      return NextResponse.json({
        data: [{ url: originalUrl }],
        created: Date.now()
      });
    }
    
    console.error('[NanoBanana API] 结果中没有图片URL:', data);
    return NextResponse.json(
      { error: '生成结果中没有图片URL', raw: data },
      { status: 500 }
    );
  } catch (parseError) {
    console.error('[NanoBanana API] 解析结果失败:', parseError);
    return NextResponse.json(
      { error: '解析结果失败', raw: data },
      { status: 500 }
    );
  }
}
