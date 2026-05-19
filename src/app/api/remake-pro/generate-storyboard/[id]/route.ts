import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { longRunningAgent } from '@/lib/fetch-agent';

// 获取后台配置
async function getRemakeProConfig() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('system_config').select('extra_config').eq('config_type', 'remakeProApis').single();
  if (!data?.extra_config) throw new Error('未配置复刻大师模型');
  return data.extra_config as Record<string, Record<string, string>>;
}

// GrsAI 图片生成（提交-轮询模式）
async function callGptImageGenerate(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageUrls?: string[]
): Promise<Buffer> {
  // Step 1: 提交任务
  const submitEndpoint = `${baseUrl}/v1/draw/completions`;
  const requestBody: Record<string, unknown> = {
    model: model || 'gpt-image-2',
    prompt,
    aspectRatio: 'auto',
    webHook: '-1',
  };
  if (imageUrls && imageUrls.length > 0) {
    requestBody.urls = imageUrls.filter(Boolean);
  }

  console.log(`[Storyboard-Generate] 提交图片生成任务: ${model}`);

  const submitResponse = await fetch(submitEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    // @ts-expect-error - Node.js undici Agent
    dispatcher: longRunningAgent,
  });

  const submitContentType = submitResponse.headers.get('content-type') || '';
  let submitData: Record<string, unknown>;

  if (submitContentType.includes('application/json')) {
    submitData = await submitResponse.json();
  } else {
    const text = await submitResponse.text();
    throw new Error(`API 返回非JSON格式: ${text.substring(0, 200)}`);
  }

  if (submitData.code !== 0) {
    throw new Error(`提交任务失败: ${(submitData.msg as string) || '未知错误'}`);
  }

  const dataObj = submitData.data as Record<string, unknown> | undefined;
  const taskId = dataObj?.id as string | undefined;
  if (!taskId) {
    throw new Error(`API 未返回任务ID: ${JSON.stringify(submitData)}`);
  }

  console.log(`[Storyboard-Generate] 任务ID: ${taskId}`);

  // Step 2: 轮询结果
  const resultEndpoint = `${baseUrl}/v1/draw/result`;
  const maxRetries = 200;
  const retryInterval = 3000;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, retryInterval));

    if ((i + 1) % 5 === 0) {
      console.log(`[Storyboard-Generate] 轮询第 ${i + 1} 次...`);
    }

    const resultResponse = await fetch(resultEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ id: taskId }),
      // @ts-expect-error - Node.js undici Agent
      dispatcher: longRunningAgent,
    });

    const resultContentType = resultResponse.headers.get('content-type') || '';
    if (!resultContentType.includes('application/json')) {
      continue;
    }

    const resultData = await resultResponse.json() as Record<string, unknown>;

    if (resultData.code !== 0) {
      throw new Error(`查询结果失败: ${(resultData.msg as string) || '未知错误'}`);
    }

    const resultObj = resultData.data as Record<string, unknown> | undefined;
    if (!resultObj) continue;

    const status = resultObj.status as string;

    if (status === 'succeeded') {
      const images = resultObj.images as Array<{ url: string }>;
      if (!images || images.length === 0) {
        throw new Error('生成成功但无图片数据');
      }

      // 下载图片
      const imageUrl = images[0].url;
      const imgResp = await fetch(imageUrl, {
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });
      return Buffer.from(await imgResp.arrayBuffer());
    }

    if (status === 'failed') {
      const error = (resultObj.error as string) || '生成失败';
      throw new Error(`图片生成失败: ${error}`);
    }
  }

  throw new Error('图片生成超时（10分钟）');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }
  const userId = auth.userId;

  const supabase = getSupabaseClient();

  // 验证项目
  const { data: project } = await supabase.from('remake_pro_projects').select('*').eq('id', projectId).eq('user_id', userId).single();
  if (!project) {
    return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
  }

  if (!project.key_frame_grid_key) {
    return NextResponse.json({ success: false, error: '请先进行视频理解和关键帧提取' }, { status: 400 });
  }

  if (project.product_images?.length === 0) {
    return NextResponse.json({ success: false, error: '请先选择产品图' }, { status: 400 });
  }

  // 更新状态为生成中
  await supabase.from('remake_pro_projects').update({
    status: 'generating_storyboard',
    updated_at: new Date().toISOString(),
  }).eq('id', projectId);

  // 异步执行生成
  generateStoryboardBackground(projectId, userId, project);

  return NextResponse.json({ success: true, message: '分镜图生成已开始' });
}

async function generateStoryboardBackground(projectId: string, userId: string, project: Record<string, unknown>) {
  const supabase = getSupabaseClient();

  try {
    console.log(`[Storyboard] 开始生成项目 ${projectId} 的分镜图`);

    const config = await getRemakeProConfig();
    const storyboardConfig = config.storyboardGeneration;
    if (!storyboardConfig?.baseUrl || !storyboardConfig?.apiKey) {
      throw new Error('未配置分镜图生成模型');
    }

    // 准备参考图片 URL
    const referenceImageUrls: string[] = [];

    // 九宫格关键帧图
    if (project.key_frame_grid_url) {
      referenceImageUrls.push(project.key_frame_grid_url as string);
    }

    // 产品图
    const productImages = project.product_images as Array<{ url: string; key: string }> || [];
    for (const img of productImages) {
      if (img.key) {
        try {
          const s3 = new S3Storage();
          const freshUrl = await s3.generatePresignedUrl({ key: img.key, expireTime: 3600 });
          referenceImageUrls.push(freshUrl);
        } catch {
          if (img.url) referenceImageUrls.push(img.url);
        }
      } else if (img.url) {
        referenceImageUrls.push(img.url);
      }
    }

    // 角色图
    const characterImage = project.character_image as { url: string; key: string } | null;
    if (characterImage) {
      if (characterImage.key) {
        try {
          const s3 = new S3Storage();
          const freshUrl = await s3.generatePresignedUrl({ key: characterImage.key, expireTime: 3600 });
          referenceImageUrls.push(freshUrl);
        } catch {
          if (characterImage.url) referenceImageUrls.push(characterImage.url);
        }
      } else if (characterImage.url) {
        referenceImageUrls.push(characterImage.url);
      }
    }

    console.log(`[Storyboard] 参考图数量: ${referenceImageUrls.length}`);

    // 获取场景描述作为提示词
    const { data: scenes } = await supabase.from('remake_pro_scenes')
      .select('description, camera_movement, scene_detail')
      .eq('project_id', projectId)
      .order('scene_index', { ascending: true });

    const sceneDescriptions = (scenes || []).map((s: { description: string; camera_movement: string; scene_detail: string }, i: number) =>
      `场景${i + 1}: ${s.description || ''} | 运镜: ${s.camera_movement || ''} | 细节: ${s.scene_detail || ''}`
    ).join('\n');

    const prompt = `请根据参考图中的九宫格关键帧，将原视频中的产品和角色替换为我提供的产品图和角色图，生成一张3x3九宫格分镜图。保持原视频的分镜骨架和构图风格，只替换产品和角色。

场景描述：
${sceneDescriptions}

要求：
1. 保持3x3九宫格布局
2. 每个格子对应一个场景
3. 产品和角色需要自然融入场景
4. 保持原视频的色调和风格`;

    // 调用 GrsAI 图片生成（提交-轮询模式）
    const imageBuffer = await callGptImageGenerate(
      storyboardConfig.baseUrl,
      storyboardConfig.apiKey,
      storyboardConfig.model || 'gpt-image-2',
      prompt,
      referenceImageUrls
    );

    // 上传到 S3
    const s3 = new S3Storage();
    const s3Key = await s3.uploadFile({
      fileContent: imageBuffer,
      fileName: `remake-pro/${userId}/${projectId}/storyboard_grid.jpg`,
      contentType: 'image/jpeg',
    });

    const storyboardUrl = await s3.generatePresignedUrl({ key: s3Key, expireTime: 7 * 24 * 3600 });

    await supabase.from('remake_pro_projects').update({
      status: 'storyboard_generated',
      storyboard_grid_key: s3Key,
      storyboard_grid_url: storyboardUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    console.log(`[Storyboard] 项目 ${projectId} 分镜图生成完成`);
  } catch (error) {
    console.error(`[Storyboard] 项目 ${projectId} 分镜图生成失败:`, error);
    await supabase.from('remake_pro_projects').update({
      status: 'analyzed',
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
  }
}
