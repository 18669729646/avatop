import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getProductSelection } from '@/lib/products';
import type { ProductSelection } from '@/lib/products';
import { getScriptRemakePrompt, fetchImageData } from '@/lib/analysis-master-script-remake';
import type { AnalysisMasterResult } from '@/lib/analysis-master';

// POST /api/analysis-master/script-remake/preview - 预览请求体（仅管理员）
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  const isAdmin = authResult.payload.role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: '仅管理员可用' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { projectId, productId, language, includeChinese, extraRequirements } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: '请提供项目ID' }, { status: 400 });
    }
    if (!productId) {
      return NextResponse.json({ success: false, error: '请选择产品' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取分析结果
    const { data: project, error: projectError } = await client
      .from('analysis_master_projects')
      .select('result')
      .eq('id', projectId)
      .single();

    if (projectError || !project?.result) {
      return NextResponse.json({ success: false, error: '项目分析结果不存在' }, { status: 404 });
    }

    const analysisResult: AnalysisMasterResult = project.result as AnalysisMasterResult;

    // 获取产品信息
    const product: ProductSelection | null = await getProductSelection(productId);
    if (!product) {
      return NextResponse.json({ success: false, error: '产品不存在' }, { status: 404 });
    }

    // 构建提示词
    const prompt = await getScriptRemakePrompt({
      analysisResult,
      product,
      language: language || 'en-US',
      includeChinese: includeChinese !== false,
      extraRequirements,
    });

    // 获取图片数据
    const imageBuffers: Array<{ mimeType: string; data: string }> = [];
    const maxImages = 5;
    const productImages = product.allImages.slice(0, maxImages);

    for (const img of productImages) {
      const buffer = await fetchImageData(img.url);
      if (buffer) {
        imageBuffers.push({
          mimeType: img.url.includes('.png') ? 'image/png' : 'image/jpeg',
          data: buffer.toString('base64'),
        });
      }
    }

    const previewPayload = {
      contents: [
        { parts: [{ text: prompt }, ...imageBuffers.map(img => ({ inlineData: img }))] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    console.log('[Script Remake Preview] 预览请求体:', JSON.stringify(previewPayload, null, 2));

    return NextResponse.json({
      success: true,
      data: {
        prompt,
        imageCount: imageBuffers.length,
        payload: previewPayload,
      },
    });
  } catch (error) {
    console.error(`[Script Remake Preview] 预览失败: ${(error as Error).message}`);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
