/**
 * 视频复刻大师 - 视频动画化 API（异步模式）
 * 分镜图 + 提示词 → 视频动画化模型 → 动态视频片段
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { logApiError } from '@/lib/logger';

// POST: 启动视频动画化（异步）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;

  const supabase = getSupabaseClient();

  try {
    const { data: project, error } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    if (!project.storyboard_grid_key) {
      return NextResponse.json({ success: false, error: '请先生成分镜图' }, { status: 400 });
    }

    // 更新状态为动画化中
    await supabase.from('remake_pro_projects').update({
      status: 'animating',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // 异步执行
    animateAsync(id, userId, project).catch(err => {
      console.error('[Animate] 异步动画化失败:', err);
    });

    return NextResponse.json({ success: true, message: '视频动画化已启动' });
  } catch (error) {
    logApiError('remake-pro/animate', 'POST', error, { projectId: id }, userId);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

async function animateAsync(projectId: string, userId: string, project: Record<string, unknown>) {
  const supabase = getSupabaseClient();

  try {
    // 读取后台配置
    const { data: configData } = await supabase
      .from('system_config')
      .select('extra_config')
      .eq('config_type', 'remakeProApis')
      .single();

    const config = configData?.extra_config as Record<string, Record<string, string>> | null;
    const animConfig = config?.videoAnimation;

    if (!animConfig?.baseUrl || !animConfig?.apiKey) {
      throw new Error('视频动画化模型未配置');
    }

    const s3 = new S3Storage();

    // 获取场景数据
    const { data: scenes } = await supabase
      .from('remake_pro_scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_index', { ascending: true });

    if (!scenes || scenes.length === 0) {
      throw new Error('没有场景数据，请先完成视频理解');
    }

    // 对每个场景生成动画视频
    for (const scene of scenes) {
      if (scene.status === 'completed' && scene.video_key) continue;

      try {
        // 更新场景状态
        await supabase.from('remake_pro_scenes').update({
          status: 'animating',
          updated_at: new Date().toISOString(),
        }).eq('id', scene.id);

        // 获取分镜图URL
        const storyboardKey = scene.storyboard_key as string;
        if (!storyboardKey) {
          // 如果没有单独的分镜图，使用九宫格
          continue;
        }

        const storyboardUrl = await s3.generatePresignedUrl({ key: storyboardKey, expireTime: 3600 });

        // 调用视频生成 API (Veo 3.1)
        const prompt = scene.animate_prompt || scene.description || 'Generate a smooth animated video from this image';

        const response = await fetch(`${animConfig.baseUrl}/v1/videos/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${animConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: animConfig.model || 'veo-3.1-generate-preview',
            prompt,
            image: storyboardUrl,
            aspect_ratio: '9:16',
            duration: 8,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`视频生成 API 错误: ${response.status} ${errText}`);
        }

        const result = await response.json();
        
        // 轮询等待视频生成完成
        let videoUrl = '';
        let videoKey = '';
        const maxPolls = 60;
        const pollInterval = 10000; // 10秒

        for (let i = 0; i < maxPolls; i++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          const pollResp = await fetch(`${animConfig.baseUrl}/v1/videos/${result.id}`, {
            headers: { 'Authorization': `Bearer ${animConfig.apiKey}` },
          });

          if (!pollResp.ok) continue;
          const pollData = await pollResp.json();

          if (pollData.status === 'completed' && pollData.output?.url) {
            videoUrl = pollData.output.url;
            break;
          } else if (pollData.status === 'failed') {
            throw new Error(`视频生成失败: ${pollData.error || '未知错误'}`);
          }
        }

        if (!videoUrl) throw new Error('视频生成超时');

        // 下载视频并上传到 S3
        const videoResp = await fetch(videoUrl);
        const videoBuffer = Buffer.from(await videoResp.arrayBuffer());

        videoKey = await s3.uploadFile({
          fileContent: videoBuffer,
          fileName: `remake-pro/${userId}/${projectId}/videos/scene_${scene.scene_index}.mp4`,
          contentType: 'video/mp4',
        });

        const signedVideoUrl = await s3.generatePresignedUrl({ key: videoKey, expireTime: 7 * 24 * 3600 });

        // 更新场景
        await supabase.from('remake_pro_scenes').update({
          status: 'completed',
          video_key: videoKey,
          video_url: signedVideoUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', scene.id);

      } catch (sceneError) {
        console.error(`[Animate] 场景 ${scene.scene_index} 动画化失败:`, sceneError);
        await supabase.from('remake_pro_scenes').update({
          status: 'failed',
          error: sceneError instanceof Error ? sceneError.message : '动画化失败',
          updated_at: new Date().toISOString(),
        }).eq('id', scene.id);
      }
    }

    // 更新项目状态
    await supabase.from('remake_pro_projects').update({
      status: 'animated',
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    console.log(`[Animate] 项目 ${projectId} 动画化完成`);
  } catch (error) {
    console.error(`[Animate] 项目 ${projectId} 动画化失败:`, error);
    await supabase.from('remake_pro_projects').update({
      status: 'storyboard_generated',
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
  }
}
