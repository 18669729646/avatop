import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { consumeCredits } from '@/lib/credits';
import { checkStorageQuota } from '@/lib/storage-quota';
import { getServerDefaultImageApi } from '@/lib/server-config';
import { s3Storage } from '@/lib/s3-client';

// Gemini 图片生成 API
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 检查存储空间是否足够
    const s3StorageCheck = await checkStorageQuota(auth.userId);
    if (!s3StorageCheck.allowed) {
      return NextResponse.json(
        { error: s3StorageCheck.error },
        { status: 507 } // 507 Insufficient Storage
      );
    }
    
    const body = await request.json();
    const { prompt, referenceImage, referenceImages, characterImages, aspectRatio = '9:16', apiKey: _apiKey, baseUrl: _baseUrl, model: _model } = body;

    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    // 从数据库获取 API 配置（优先使用数据库配置，忽略前端传递的 apiKey）
    const defaultImageApi = await getServerDefaultImageApi();
    const apiKey = defaultImageApi?.apiKey || process.env.YUNWU_API_KEY || '';
    const finalBaseUrl = defaultImageApi?.baseUrl || _baseUrl || process.env.COZE_API_BASE_URL || 'https://yunwu.ai/v1beta';
    const finalModel = defaultImageApi?.model || _model || process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

    if (!apiKey) {
      return NextResponse.json({ error: '请先在系统设置中配置图片生成API Key' }, { status: 400 });
    }

    // 构建 Gemini 请求
    const parts: Record<string, unknown>[] = [];

    // 合并参考图（支持单张和多张）
    const allReferenceImages = referenceImages || (referenceImage ? [referenceImage] : []);

    // 如果有参考图片，先添加图片
    for (const refImage of allReferenceImages) {
      try {
        // 判断是URL还是base64
        if (refImage.startsWith('http')) {
          // 从URL下载图片并转换为base64
          const imageResponse = await fetch(refImage);
          const arrayBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          });
        } else if (refImage.startsWith('data:')) {
          // 已经是base64格式，直接提取
          const base64Data = refImage.replace(/^data:image\/\w+;base64,/, '');
          const mimeType = refImage.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      } catch (err) {
        console.error('Failed to process reference image:', err);
        // 继续执行，即使参考图处理失败
      }
    }

    // 添加角色图片
    const hasCharacterImages = characterImages && characterImages.length > 0;
    if (hasCharacterImages) {
      for (const charImage of characterImages) {
        try {
          const charUrl = typeof charImage === 'string' ? charImage : charImage.url;
          if (charUrl.startsWith('http')) {
            const imageResponse = await fetch(charUrl);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType: contentType,
                data: base64,
              },
            });
          } else if (charUrl.startsWith('data:')) {
            const base64Data = charUrl.replace(/^data:image\/\w+;base64,/, '');
            const mimeType = charUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        } catch (err) {
          console.error('Failed to process character image:', err);
        }
      }
    }

    // 构建最终提示词
    let finalPrompt = prompt;
    if (hasCharacterImages) {
      finalPrompt = `【人物一致性要求 - 必须严格遵守】
图中人物/达人的五官（脸型、眼睛、眉毛、鼻子、嘴唇）、发型（长度、颜色、造型）必须与参考图中的人物完全一致，不得有任何改变。
服装、配饰、姿态、表情可以根据场景灵活变化。
如果无法保持人物特征完全一致，请不要在图中添加人物。

${prompt}`;
    }

    // 添加文本提示
    parts.push({ text: finalPrompt });

    // Gemini 端点格式: /v1beta/models/{model}:generateContent
    const endpoint = `${finalBaseUrl}/models/${finalModel}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: '2K',
        },
      },
    };

    console.log(`[ShortFilm] Calling Gemini API for image generation`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('[ShortFilm] Non-JSON response:', text.substring(0, 500));
      return NextResponse.json(
        { error: `API 返回非预期格式: ${text.substring(0, 100)}` },
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.error('[ShortFilm] Gemini API error:', data);
      return NextResponse.json(
        { error: data.error?.message || data.error || `API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 解析响应，提取图片
    const candidates = data.candidates as Record<string, unknown>[] | undefined;
    if (candidates && candidates.length > 0) {
      const parts = (candidates[0].content as Record<string, unknown>)?.parts as Record<string, unknown>[] || [];

      for (const part of parts) {
        if (part.inlineData) {
          const b64 = (part.inlineData as Record<string, unknown>).data as string;
          const mimeType = (part.inlineData as Record<string, unknown>).mimeType as string || 'image/png';
          
          // 将生成的图片上传到对象存储
          try {
            // 将 base64 转换为 Buffer
            const buffer = Buffer.from(b64, 'base64');
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const extension = mimeType.split('/')[1] || 'png';
            const s3StorageKey = `generated/${timestamp}-${randomStr}.${extension}`;
            
            const key = await s3Storage.uploadFile({
              fileContent: buffer,
              fileName: s3StorageKey,
              contentType: mimeType,
            });
            
            // 生成签名URL
            const url = await s3Storage.generatePresignedUrl({
              key,
              expireTime: URL_EXPIRE_TIME, // 1年
            });
            
            // 扣除积分（图片生成成功）
            const creditResult = await consumeCredits(auth.userId, 'shortfilm_image', key, 'image');
            if (!creditResult.success) {
              console.error('[ShortFilm] 扣除积分失败:', creditResult.error);
            } else if (creditResult.skipped) {
              console.log('[ShortFilm] 积分已扣除过，跳过重复扣除');
            } else {
              console.log(`[ShortFilm] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
            }
            
            return NextResponse.json({
              success: true,
              url,
            });
          } catch (uploadError) {
            console.error('[ShortFilm] Failed to upload generated image:', uploadError);
            // 上传失败，返回错误而不是 base64
            return NextResponse.json(
              { error: '图片上传到对象存储失败，请检查存储配置' },
              { status: 500 }
            );
          }
        }
      }

      // 如果没有图片，检查是否有文本
      const textPart = parts.find((p: Record<string, unknown>) => p.text);
      if (textPart) {
        return NextResponse.json(
          { error: `模型返回文本而非图片: ${textPart.text}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: '未返回生成的图片' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[ShortFilm] Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片生成失败' },
      { status: 500 }
    );
  }
}
