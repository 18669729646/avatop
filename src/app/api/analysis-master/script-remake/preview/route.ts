import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
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
    const userId = authResult.userId;

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

    // 获取产品信息（直接从数据库，与 enqueueScriptRemakeTask 保持一致）
    const { data: product, error: productError } = await client
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '产品不存在或无权限访问' }, { status: 404 });
    }

    // 构建产品快照（与 enqueueScriptRemakeTask 保持一致）
    const productSnapshot = {
      ...product,
      sellingPoints: product.selling_points || [],
    };

    // 构建提示词
    const prompt = await getScriptRemakePrompt({
      analysisResult,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        sellingPoints: productSnapshot.sellingPoints,
        targetAudience: product.target_audience || '',
        usageScenarios: product.usage_scenarios || '',
        brandInfo: product.brand_info || '',
        priceRange: product.price_range || '',
        keywords: product.keywords || [],
        primaryImage: productSnapshot.images?.[0]?.url || '',
        allImages: (productSnapshot.images || []).map((img: { key: string; url: string }) => ({
          key: img.key,
          url: img.url,
        })),
      },
      language: language || 'en-US',
      includeChinese: includeChinese !== false,
      extraRequirements,
    });

    // 获取图片数据
    const imageBuffers: Array<{ mimeType: string; data: string }> = [];
    // 获取 API 配置（与实际调用一致）
    const { getServerDefaultTextApi } = await import('@/lib/server-config');
    const apiConfig = await getServerDefaultTextApi();
    const model = apiConfig?.model || 'gemini-2.5-flash';
    const baseUrl = apiConfig?.baseUrl?.replace(/\/+$/, '') || '';
    const basePath = baseUrl.includes('/v1beta') || baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1beta`;
    const endpoint = `${basePath}/models/${model}:generateContent`;

    const maxImages = 5;
    const productImages = productSnapshot.images?.slice(0, maxImages) || [];

    // 构建完整的请求体（与实际调用完全一致）
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    for (const img of productImages) {
      const buffer = await fetchImageData(img.url);
      if (buffer) {
        parts.push({
          inline_data: {
            mime_type: img.url.includes('.png') ? 'image/png' : 'image/jpeg',
            data: buffer.toString('base64'),
          },
        });
      }
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 32768,
        response_mime_type: 'application/json',
      },
    };

    // 返回预览数据
    return NextResponse.json({
      success: true,
      data: {
        endpoint,
        model,
        prompt,
        requestBody,
        imagesCount: productImages.length,
        extraRequirements: extraRequirements || '',
        productSnapshot: {
          id: product.id,
          name: product.name,
          description: product.description,
          sellingPoints: productSnapshot.sellingPoints,
        },
        analysisSnapshot: {
          summary: analysisResult.summary || '',
          videoPrompt: analysisResult.videoPrompt || '',
          imagePrompt: analysisResult.imagePrompt || '',
        },
      },
    });
  } catch (error) {
    console.error('[Script Remake Preview API] 预览失败:', (error as Error).message);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
