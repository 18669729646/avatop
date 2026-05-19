import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { isAdmin } from '@/lib/task-security';

// 判断是否为 NanoBanana 模型
function isNanoBananaModel(model: string): boolean {
  return model.includes('nano-banana');
}

// 判断是否为 base64 格式图片
function isBase64Image(img: string): boolean {
  return img.startsWith('data:image/');
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const isAdminUser = isAdmin(auth.success ? auth.payload.role : undefined);
    
    const body = await request.json();
    const { model, prompt, aspectRatio, resolution, images } = body;
    
    // 根据模型类型构建不同的预览
    if (isNanoBananaModel(model || '')) {
      // NanoBanana API 预览（使用 URL 格式）
      const imageInfos: Array<{
        type: string;
        url?: string;
        note?: string;
      }> = [];
      
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img) continue;
          
          if (isBase64Image(img)) {
            imageInfos.push({
              type: 'base64',
              note: '⚠️ 不建议使用 base64，请上传图片获取 URL',
            });
          } else {
            imageInfos.push({
              type: 'URL',
              url: img,
            });
          }
        }
      }
      
      // 只有管理员能看到完整的 rawRequestBody（包含模型信息）
      const previewResult: Record<string, unknown> = {
        requestFormat: 'NanoBanana API (GrsAI 平台)',
        imageCount: imageInfos.length,
        imageInfos,
      };
      
      // 管理员可以看到更多信息
      if (isAdminUser) {
        previewResult.endpoint = 'POST /v1/draw/nano-banana';
        previewResult.model = model || 'nano-banana-2';
        previewResult.rawRequestBody = {
          model: model || 'nano-banana-2',
          prompt,
          aspectRatio: aspectRatio || 'auto',
          imageSize: resolution || '1K',
          webHook: '-1',
          urls: images && images.length > 0 
            ? images.filter((img: string) => img).map((img: string) => {
                if (isBase64Image(img)) {
                  return '[base64数据]';
                }
                return img;
              })
            : undefined,
        };
      }
      
      return NextResponse.json(previewResult);
      
    } else {
      // Gemini API 预览（使用 base64 格式）- 保持原有逻辑
      const parts: Array<{
        type: 'text' | 'image';
        text?: string;
        imageInfo?: {
          type: string;
          url?: string;
        };
      }> = [];
      
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (!img) continue;
          
          if (isBase64Image(img)) {
            parts.push({
              type: 'image',
              imageInfo: {
                type: 'base64',
              }
            });
          } else {
            parts.push({
              type: 'image',
              imageInfo: {
                type: 'URL',
                url: img.substring(0, 80) + '...',
              }
            });
          }
        }
      }
      
      // 添加文本
      parts.push({
        type: 'text',
        text: prompt,
      });
      
      const previewResult: Record<string, unknown> = {
        requestFormat: 'Gemini API (Google 原生格式)',
        imageCount: parts.filter(p => p.type === 'image').length,
        parts,
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio || '1:1',
            imageSize: resolution || '2K',
          }
        }
      };
      
      // 管理员可以看到更多信息
      if (isAdminUser) {
        previewResult.endpoint = `POST /v1beta/models/${model}:generateContent`;
      }
      
      return NextResponse.json(previewResult);
    }
    
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '预览失败' },
      { status: 500 }
    );
  }
}
