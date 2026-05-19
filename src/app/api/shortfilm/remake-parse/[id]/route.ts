import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getServerDefaultTextApi } from '@/lib/server-config';
import { logInfo, logTaskError } from '@/lib/logger';
import { PROMPT_TYPE_CONFIGS } from '@/lib/prompt-variables';
import { checkUserCredits, consumeCredits } from '@/lib/credits';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { id: projectId } = await params;
    const client = getSupabaseClient();

    const { data: project, error: projectError } = await client
      .from('shortfilm_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', auth.userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    if (!project.source_video_key && !project.source_video_url) {
      return NextResponse.json({ error: '请先上传或解析视频' }, { status: 400 });
    }

    const creditCheck = await checkUserCredits(auth.userId, 5);
    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        { error: `积分不足，当前积分 ${creditCheck.balance}，需要 ${creditCheck.required} 积分` },
        { status: 402 }
      );
    }

    await client
      .from('shortfilm_projects')
      .update({
        status: 'scripting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    logInfo('api', '开始V3解析视频内容', { projectId }, auth.userId);

    const parseResult = await analyzeVideoV3(project, client);

    if (!parseResult.success) {
      await client
        .from('shortfilm_projects')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      return NextResponse.json({ error: parseResult.error }, { status: 500 });
    }

    const scriptSegments = mapToScriptSegments(parseResult.data);

    const totalDuration = scriptSegments.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.duration as number) || 0), 0);

    await client
      .from('shortfilm_projects')
      .update({
        script_segments: scriptSegments,
        total_duration: totalDuration,
        video_duration: project.video_duration || totalDuration,
        status: 'draft',
        current_step: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    await consumeCredits(auth.userId, 'video_remake_parse', projectId, 'video_remake');

    logInfo('api', 'V3视频解析完成', { projectId, sceneCount: scriptSegments.length }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        scriptSegments,
        totalDuration,
        summary: parseResult.data?.summary as string | undefined,
        globalStyle: parseResult.data?.globalStyle,
        continuity: parseResult.data?.continuity,
      },
    });
  } catch (error) {
    console.error('[Shortfilm Remake Parse] error:', error);
    logTaskError('', '解析视频V3', error as Error, {}, '');
    return NextResponse.json({ error: '解析失败' }, { status: 500 });
  }
}

function mapToScriptSegments(data: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  if (!data) return [];

  const rawScenes = (data.scenes as Array<Record<string, unknown>> | undefined) || [];

  return rawScenes.map((scene, index) => {
    const shot = scene.shot as Record<string, string> | undefined;
    const character = scene.character as Record<string, unknown> | undefined;

    const rawStartTime = scene.startTime ?? scene.start_time;
    const rawEndTime = scene.endTime ?? scene.end_time;
    const rawDuration = scene.duration;
    const startTime = typeof rawStartTime === 'number' ? rawStartTime : (typeof rawStartTime === 'string' ? parseFloat(rawStartTime) : undefined);
    const endTime = typeof rawEndTime === 'number' ? rawEndTime : (typeof rawEndTime === 'string' ? parseFloat(rawEndTime) : undefined);
    const duration = typeof rawDuration === 'number' ? rawDuration : (typeof rawDuration === 'string' ? parseFloat(rawDuration) : undefined);

    const visualPrompt = (scene.visualPrompt ?? scene.visual_prompt) as string | undefined;
    const audioPrompt = (scene.audioPrompt ?? scene.audio_prompt) as string | undefined;
    const speechText = (scene.speechText ?? scene.speech_text) as string | undefined;
    const backgroundMusic = (scene.backgroundMusic ?? scene.background_music) as string | undefined;
    const description = (scene.description ?? scene.action) as string | undefined;

    let shotType = scene.shotType as string | undefined;
    let cameraMovement = scene.cameraMovement as string | undefined;
    if (shot) {
      shotType = shotType || shot.type;
      cameraMovement = cameraMovement || shot.camera;
    }

    const composition = scene.composition as Record<string, unknown> | undefined;
    const environment = scene.environment as string | undefined;
    const lighting = scene.lighting as string | undefined;

    let imagePrompt = visualPrompt || description || '';
    if (environment) imagePrompt += `, ${environment}`;
    if (lighting) imagePrompt += `, ${lighting}`;
    if (composition) {
      const subject = composition.subject as string | undefined;
      const colorTone = composition.colorTone as string | undefined;
      const background = composition.background as string | undefined;
      if (subject) imagePrompt += `, subject: ${subject}`;
      if (colorTone) imagePrompt += `, color tone: ${colorTone}`;
      if (background) imagePrompt += `, background: ${background}`;
    }
    if (character) {
      const clothing = character.clothing as string | undefined;
      const pose = character.pose as string | undefined;
      const expression = character.expression as string | undefined;
      if (clothing) imagePrompt += `, wearing ${clothing}`;
      if (pose) imagePrompt += `, ${pose}`;
      if (expression) imagePrompt += `, ${expression}`;
    }

    let videoPrompt = visualPrompt || description || '';
    if (cameraMovement && cameraMovement !== 'static') {
      videoPrompt += `, camera: ${cameraMovement}`;
    }
    if (shotType) {
      videoPrompt += `, shot: ${shotType}`;
    }
    if (audioPrompt) {
      videoPrompt += `, audio: ${audioPrompt}`;
    }
    if (speechText) {
      videoPrompt += `, speech: "${speechText}"`;
    }

    return {
      id: `seg-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
      order: index + 1,
      duration: duration || 8,
      imagePrompt: imagePrompt.trim(),
      videoPrompt: videoPrompt.trim(),
      description: description || '',
      startTime,
      endTime,
      shotType,
      cameraMovement,
      speechText,
      audioPrompt,
      backgroundMusic,
    };
  });
}

async function analyzeVideoV3(
  project: Record<string, unknown>,
  client: ReturnType<typeof getSupabaseClient>,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const apiConfig = await getServerDefaultTextApi();
  if (!apiConfig) {
    return { success: false, error: '未配置文本模型' };
  }

  const videoKey = project.source_video_key as string | null;
  let videoUrl = project.source_video_url as string | null;

  if (videoKey) {
    try {
      const { s3Storage } = await import('@/lib/s3-client');
      videoUrl = await s3Storage.generatePresignedUrl({
        key: videoKey,
        expireTime: 3600,
      });
    } catch (e) {
      console.warn('[V3 Parse] 生成视频URL失败:', (e as Error).message);
    }
  }

  if (!videoUrl) {
    return { success: false, error: '无法获取视频地址' };
  }

  let promptTemplate = '';
  try {
    const { data: promptConfig } = await client
      .from('system_prompt_config')
      .select('system_prompt')
      .eq('id', 'video_remake')
      .single();
    promptTemplate = promptConfig?.system_prompt || '';
  } catch (e) {
    console.warn('[V3 Parse] 加载自定义提示词失败，使用默认:', (e as Error).message);
  }

  if (!promptTemplate) {
    promptTemplate = PROMPT_TYPE_CONFIGS.video_remake.getDefaultPrompt();
  }

  const videoDuration = String(project.video_duration || '未知');

  const prompt = promptTemplate
    .replace(/\{\{videoUrl\}\}/g, videoUrl)
    .replace(/\{\{videoDuration\}\}/g, videoDuration)
    .replace(/\{\{projectName\}\}/g, String(project.name || ''))
    .replace(/\{\{keyframeTimestamps\}\}/g, '');

  let videoBuffer: Buffer | null = null;
  let videoMimeType = 'video/mp4';

  try {
    console.log('[V3 Parse] 下载视频文件用于Gemini File API...');
    const videoResponse = await fetch(videoUrl, {
      signal: AbortSignal.timeout(120 * 1000),
    });

    if (!videoResponse.ok) {
      return { success: false, error: `下载视频失败: ${videoResponse.status}` };
    }

    const contentType = videoResponse.headers.get('content-type') || '';
    if (contentType.includes('video/')) {
      videoMimeType = contentType.split(';')[0];
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    videoBuffer = Buffer.from(arrayBuffer);

    const fileSizeMB = videoBuffer.length / (1024 * 1024);
    console.log(`[V3 Parse] 视频下载完成: ${fileSizeMB.toFixed(1)}MB, mime: ${videoMimeType}`);

    if (fileSizeMB > 500) {
      return { success: false, error: `视频文件过大(${fileSizeMB.toFixed(0)}MB)，超过500MB限制` };
    }
  } catch (e) {
    return { success: false, error: `下载视频失败: ${(e as Error).message}` };
  }

  const basePath = apiConfig.baseUrl.endsWith('/v1beta') ? apiConfig.baseUrl : `${apiConfig.baseUrl}/v1beta`;

  if (videoBuffer.length < 15 * 1024 * 1024) {
    console.log('[V3 Parse] 视频较小，使用inline方式...');
    const base64Video = videoBuffer.toString('base64');

    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      {
        inline_data: {
          mime_type: videoMimeType,
          data: base64Video,
        },
      },
    ];

    const inlineResult = await callGeminiApi(apiConfig, parts);
    if (inlineResult.success) {
      return inlineResult;
    }

    console.warn('[V3 Parse] inline方式失败，尝试File API:', inlineResult.error);
  }

  console.log('[V3 Parse] 使用Gemini File API上传视频...');
  const uploadResult = await uploadVideoToGemini(basePath, apiConfig.apiKey, videoBuffer, videoMimeType);

  if (!uploadResult.success) {
    return { success: false, error: `File API上传失败: ${uploadResult.error}` };
  }

  const fileUri = uploadResult.fileUri!;
  const fileName = uploadResult.fileName!;

  try {
    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      {
        file_data: {
          mime_type: videoMimeType,
          file_uri: fileUri,
        },
      },
    ];

    const fileApiResult = await callGeminiApi(apiConfig, parts);
    return fileApiResult;
  } finally {
    try {
      await fetch(`${basePath}/${fileName}`, {
        method: 'DELETE',
        headers: { 'x-goog-api-key': apiConfig.apiKey },
      });
    } catch {}
  }
}

async function uploadVideoToGemini(
  basePath: string,
  apiKey: string,
  videoBuffer: Buffer,
  mimeType: string,
): Promise<{ success: boolean; fileUri?: string; fileName?: string; error?: string }> {
  try {
    const startResponse = await fetch(`${basePath.replace('/v1beta', '')}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(videoBuffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: `video_remake_${Date.now()}` },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      return { success: false, error: `启动上传失败: ${startResponse.status} ${errorText}` };
    }

    const uploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      return { success: false, error: '未获取到上传URL' };
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(videoBuffer.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'Content-Type': mimeType,
      },
      body: new Uint8Array(videoBuffer),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return { success: false, error: `上传数据失败: ${uploadResponse.status} ${errorText}` };
    }

    const uploadResult = await uploadResponse.json();
    const fileName = uploadResult.file?.name;
    const fileUri = uploadResult.file?.uri;

    if (!fileName || !fileUri) {
      return { success: false, error: '上传响应缺少文件信息' };
    }

    console.log(`[V3 Parse] 视频已上传，等待处理: ${fileName}`);

    const maxPollAttempts = 60;
    const pollInterval = 5000;

    for (let i = 0; i < maxPollAttempts; i++) {
      await new Promise(r => setTimeout(r, pollInterval));

      try {
        const pollResponse = await fetch(`${basePath}/${fileName}`, {
          headers: { 'x-goog-api-key': apiKey },
        });

        if (!pollResponse.ok) continue;

        const pollData = await pollResponse.json();
        const state = pollData.state;

        if (state === 'ACTIVE') {
          console.log(`[V3 Parse] 视频处理完成: ${fileName}`);
          return { success: true, fileUri, fileName };
        }

        if (state === 'FAILED') {
          return { success: false, error: `视频处理失败: ${pollData.error?.message || '未知错误'}` };
        }

        console.log(`[V3 Parse] 视频处理中... 状态: ${state}, 等待: ${(i + 1) * pollInterval / 1000}s`);
      } catch (pollError) {
        console.warn('[V3 Parse] 轮询异常:', (pollError as Error).message);
      }
    }

    return { success: false, error: '视频处理超时(5分钟)' };
  } catch (e) {
    return { success: false, error: `上传失败: ${(e as Error).message}` };
  }
}

async function callGeminiApi(
  apiConfig: { baseUrl: string; apiKey: string; model?: string },
  parts: Array<Record<string, unknown>>,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const basePath = apiConfig.baseUrl.endsWith('/v1beta') ? apiConfig.baseUrl : `${apiConfig.baseUrl}/v1beta`;

  const preferredModels = [
    apiConfig.model,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i) as string[];

  let lastError = '';

  for (const model of preferredModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 5000));
      }

      try {
        const response = await fetch(`${basePath}/models/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiConfig.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.4,
              topK: 32,
              topP: 0.95,
              maxOutputTokens: 32768,
            },
          }),
          signal: AbortSignal.timeout(10 * 60 * 1000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Gemini API V3] model=${model} attempt=${attempt + 1} error:`, response.status, errorText);
          lastError = `API 调用失败: ${response.status}`;
          if (response.status === 429) continue;
          if (response.status === 400 && errorText.includes('inline_data')) {
            console.warn(`[Gemini API V3] model=${model} 不支持inline video，尝试下一个模型`);
            break;
          }
          break;
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = '无法解析 AI 返回的JSON内容';
          console.error(`[Gemini API V3] model=${model} 返回内容无法解析为JSON, text长度: ${text.length}`);
          continue;
        }

        try {
          const parsedData = JSON.parse(jsonMatch[0]);

          if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
            const totalDuration = parsedData.scenes[parsedData.scenes.length - 1]?.endTime;
            if (totalDuration) {
              parsedData.totalDuration = totalDuration;
            }
          }

          return { success: true, data: parsedData };
        } catch (parseError) {
          lastError = `JSON解析失败: ${(parseError as Error).message}`;
          console.error(`[Gemini API V3] JSON解析失败, text前200字:`, text.substring(0, 200));
          continue;
        }
      } catch (fetchError) {
        lastError = `请求失败: ${(fetchError as Error).message}`;
        console.error(`[Gemini API V3] model=${model} attempt=${attempt + 1} fetch error:`, fetchError);
      }
    }
  }

  return { success: false, error: lastError || '所有模型尝试均失败' };
}
