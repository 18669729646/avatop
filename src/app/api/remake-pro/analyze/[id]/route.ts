/**
 * 视频复刻大师 - 视频理解 API
 * 调用视频理解模型分析视频，识别9个关键场景
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import { s3Storage } from '@/lib/s3-client';

// 获取复刻大师模型配置
async function getRemakeProConfig(configType: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('system_config')
    .select('extra_config')
    .eq('config_type', configType)
    .single();

  if (error || !data?.extra_config) {
    return null;
  }
  return data.extra_config as Record<string, unknown>;
}

// 调用 Gemini 多模态模型分析视频
async function analyzeVideoWithGemini(
  videoUrl: string,
  apiKey: string,
  model: string,
  baseUrl: string,
  prompt: string
): Promise<SceneAnalysis[]> {
  const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [
        { file_data: { mime_type: 'video/mp4', file_uri: videoUrl } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`视频理解模型调用失败: ${response.status} ${text}`);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('视频理解模型未返回有效内容');
  }

  // 解析 JSON 结果
  let scenes: SceneAnalysis[];
  try {
    const parsed = JSON.parse(textContent);
    scenes = Array.isArray(parsed) ? parsed : parsed.scenes || parsed.data || [parsed];
  } catch {
    // 如果不是纯 JSON，尝试提取 JSON 块
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      scenes = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('无法解析视频理解结果');
    }
  }

  return scenes;
}

interface SceneAnalysis {
  timestamp?: number | string;
  timeSeconds?: number | string;
  time?: number | string;
  description?: string;
  cameraMovement?: string;
  camera_movement?: string;
  sceneDetail?: string;
  scene_detail?: string;
}

// 将各种时间格式转换为秒数（numeric）
function parseTimestampToSeconds(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // "00:05" 或 "01:23" 格式
    const mmss = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (mmss) return parseFloat(mmss[1]) * 60 + parseFloat(mmss[2]);
    // "00:01:23" 格式
    const hhmmss = value.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (hhmmss) return parseFloat(hhmmss[1]) * 3600 + parseFloat(hhmmss[2]) * 60 + parseFloat(hhmmss[3]);
    // 纯数字字符串
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  return fallback;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = auth.userId;
  const supabase = getSupabaseClient();

  try {
    // 获取项目
    const { data: project, error: projectError } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    if (!project.source_video_key) {
      return NextResponse.json({ success: false, error: '请先上传或解析视频' }, { status: 400 });
    }

    // 更新状态为分析中
    await supabase
      .from('remake_pro_projects')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', id);

    // 获取模型配置
    const apiConfig = await getRemakeProConfig('remakeProApis');
    const promptConfig = await getRemakeProConfig('remakeProPrompts');

    if (!apiConfig?.videoUnderstanding) {
      return NextResponse.json({ success: false, error: '视频理解模型未配置，请在后台设置' }, { status: 500 });
    }

    const vuConfig = apiConfig.videoUnderstanding as Record<string, string>;
    const prompt = (promptConfig?.videoUnderstanding as string) || '请分析这个视频，识别9个关键场景。';

    // 生成视频预签名 URL
    const videoUrl = await s3Storage.generatePresignedUrl({
      key: project.source_video_key,
      expireTime: 3600,
    });

    // 调用视频理解模型
    const scenes = await analyzeVideoWithGemini(
      videoUrl,
      vuConfig.apiKey,
      vuConfig.model,
      vuConfig.baseUrl,
      prompt
    );

    // 按段落（15秒）分组场景
    const videoDuration = project.video_duration || 60;
    const segmentCount = Math.ceil(videoDuration / 15);

    // 保存场景到数据库
    const sceneRecords = scenes.map((scene, index) => {
      const fallbackTime = index * (videoDuration / 9);
      const timestamp = parseTimestampToSeconds(
        scene.timestamp ?? scene.timeSeconds ?? scene.time,
        fallbackTime
      );
      const segmentIndex = Math.min(Math.floor(timestamp / 15), segmentCount - 1);

      return {
        id: `rps_${id}_${index}`,
        user_id: userId,
        project_id: id,
        segment_index: segmentIndex,
        scene_index: index,
        start_time: timestamp,
        duration: 8,
        description: scene.description || '',
        camera_movement: scene.cameraMovement || scene.camera_movement || '',
        scene_detail: scene.sceneDetail || scene.scene_detail || '',
        status: 'analyzed',
      };
    });

    // 先删除旧场景
    await supabase
      .from('remake_pro_scenes')
      .delete()
      .eq('project_id', id);

    // 插入新场景
    const { error: scenesError } = await supabase
      .from('remake_pro_scenes')
      .insert(sceneRecords);

    if (scenesError) {
      console.error('[RemakePro] 保存场景失败:', scenesError);
    }

    // 创建段落记录
    const segmentRecords = Array.from({ length: segmentCount }, (_, i) => ({
      id: `rpseg_${id}_${i}`,
      user_id: userId,
      project_id: id,
      segment_index: i,
      start_time: i * 15,
      end_time: Math.min((i + 1) * 15, videoDuration),
      duration: Math.min(15, videoDuration - i * 15),
      status: 'pending',
    }));

    // 先删除旧段落
    await supabase
      .from('remake_pro_segments')
      .delete()
      .eq('project_id', id);

    // 插入新段落
    await supabase
      .from('remake_pro_segments')
      .insert(segmentRecords);

    // 更新项目状态
    await supabase
      .from('remake_pro_projects')
      .update({
        status: 'analyzed',
        analysis_result: scenes,
        segment_count: segmentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      data: {
        scenes: sceneRecords,
        segmentCount,
      }
    });
  } catch (error) {
    // 更新项目状态为失败
    await supabase
      .from('remake_pro_projects')
      .update({ status: 'analyze_failed', updated_at: new Date().toISOString() })
      .eq('id', id);

    logApiError('remake-pro/analyze', 'POST', error, undefined, userId);
    const message = error instanceof Error ? error.message : '视频理解失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


