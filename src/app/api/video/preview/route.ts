import { NextRequest, NextResponse } from 'next/server';
import { VIDEO_MODELS } from '@/lib/system-config';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { isAdmin } from '@/lib/task-security';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const isAdminUser = isAdmin(auth.success ? auth.payload.role : undefined);
    
    const body = await request.json();
    const { model, prompt, images, aspectRatio, enhancePrompt, enableUpsample } = body;
    
    // 只有管理员需要验证模型
    if (isAdminUser && model && !VIDEO_MODELS.includes(model)) {
      return NextResponse.json(
        { error: `不支持的模型: ${model}` },
        { status: 400 }
      );
    }
    
    // 构建请求体预览
    const parts: Array<{
      type: 'text' | 'image';
      text?: string;
      imageInfo?: {
        originalFormat: string;
        url: string;
        note?: string;
      };
    }> = [];
    
    let totalSize = 0;
    
    // 处理图片 - 分类显示
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img) continue;
        
        // 视频API只支持URL格式，不支持base64
        if (img.startsWith('data:')) {
          // 计算 base64 数据大小
          const base64Size = Math.round(img.length * 0.75 / 1024);
          parts.push({
            type: 'image',
            imageInfo: {
              originalFormat: 'base64',
              url: `[base64图片 ${base64Size}KB - 将自动上传到对象存储]`,
              note: '任务执行时会自动上传获取URL',
            }
          });
          totalSize += img.length;
        } else {
          parts.push({
            type: 'image',
            imageInfo: {
              originalFormat: 'URL',
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
    
    // 构建预览结果（普通用户只能看到基本信息）
    const previewResult: Record<string, unknown> = {
      requestSize: totalSize > 0 ? Math.round(totalSize * 0.75 / 1024) + 'KB (base64数据)' : 'URL图片，无base64数据',
      parts,
      notes: [
        '视频生成 API 仅支持 URL 格式图片',
        'base64 图片会在任务执行时自动上传到对象存储获取 URL',
        '提示词增强会自动将中文翻译为英文',
      ],
    };
    
    // 只有管理员能看到完整的 rawRequestBody（包含模型信息）
    if (isAdminUser) {
      // 构建最终请求体预览
      const rawRequestBody: Record<string, unknown> = {
        model,
        prompt,
        enhance_prompt: enhancePrompt ?? true,
      };
      
      // 所有图片都会被处理（base64会转为URL）
      if (images && images.length > 0) {
        rawRequestBody.images = images.map((img: string, index: number) => {
          if (!img) return `[${index}] 空`;
          if (img.startsWith('data:')) {
            return `[${index}] base64 -> 将上传获取URL`;
          }
          return `[${index}] ${img.substring(0, 60)}...`;
        });
      }
      
      if (aspectRatio) {
        rawRequestBody.aspect_ratio = aspectRatio;
      }
      
      if (enableUpsample !== undefined) {
        rawRequestBody.enable_upsample = enableUpsample;
      }
      
      previewResult.endpoint = 'POST /v1/video/create';
      previewResult.model = model;
      previewResult.rawRequestBody = rawRequestBody;
    }
    
    return NextResponse.json(previewResult);
    
  } catch (error) {
    console.error('Video preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '预览失败' },
      { status: 500 }
    );
  }
}
