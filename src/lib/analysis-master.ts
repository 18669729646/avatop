import { getServerDefaultTextApi } from '@/lib/server-config';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { PROMPT_TYPE_CONFIGS, replaceVariables } from '@/lib/prompt-variables';

export const ANALYSIS_MASTER_ACTION_TYPE = 'video_analysis_master';

export interface AnalysisScene {
  id: string;
  order: number;
  startTime?: number;
  endTime?: number;
  duration: number;
  title: string;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
  speechText?: string;
  shotType?: string;
  cameraMovement?: string;
  sellingPoint?: string;
}

export interface AnalysisMasterResult {
  summary: string;
  videoType: string;
  targetAudience: string;
  sellingPoints: string[];
  scenes: AnalysisScene[];
  raw: Record<string, unknown>;
}

export interface AnalysisPromptContext {
  videoUrl?: string;
  projectName?: string;
  sourceType?: string;
  videoDuration?: number | string;
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI 返回内容不是有效 JSON');
  }
  return JSON.parse(match[0]);
}

function toNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean);
}

export function normalizeAnalysisResult(raw: Record<string, unknown>): AnalysisMasterResult {
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes as Array<Record<string, unknown>> : [];
  const scenes = rawScenes.map((scene, index) => {
    const startTime = toNumber(scene.startTime ?? scene.start_time);
    const endTime = toNumber(scene.endTime ?? scene.end_time);
    const duration = toNumber(scene.duration, endTime !== undefined && startTime !== undefined ? endTime - startTime : 8) || 8;

    return {
      id: `analysis-scene-${index + 1}`,
      order: index + 1,
      startTime,
      endTime,
      duration,
      title: String(scene.title || `分镜 ${index + 1}`),
      description: String(scene.description || scene.action || ''),
      imagePrompt: String(scene.imagePrompt || scene.image_prompt || scene.visualPrompt || scene.visual_prompt || ''),
      videoPrompt: String(scene.videoPrompt || scene.video_prompt || scene.visualPrompt || scene.visual_prompt || ''),
      speechText: String(scene.speechText || scene.speech_text || ''),
      shotType: String(scene.shotType || scene.shot_type || ''),
      cameraMovement: String(scene.cameraMovement || scene.camera_movement || ''),
      sellingPoint: String(scene.sellingPoint || scene.selling_point || ''),
    };
  });

  return {
    summary: String(raw.summary || ''),
    videoType: String(raw.videoType || raw.video_type || ''),
    targetAudience: String(raw.targetAudience || raw.target_audience || ''),
    sellingPoints: normalizeStringArray(raw.sellingPoints || raw.selling_points),
    scenes,
    raw,
  };
}

async function getAnalysisMasterPrompt(context: AnalysisPromptContext): Promise<string> {
  let template = '';
  try {
    const client = getSupabaseClient();
    const { data } = await client
      .from('system_prompt_config')
      .select('system_prompt')
      .eq('id', PROMPT_TYPE_CONFIGS.analysis_master.dbId)
      .single();
    template = data?.system_prompt || '';
  } catch (error) {
    console.warn('[Analysis Master] 加载后台提示词失败，使用默认模板:', (error as Error).message);
  }

  if (!template) {
    template = PROMPT_TYPE_CONFIGS.analysis_master.getDefaultPrompt();
  }

  return replaceVariables(template, {
    videoUrl: context.videoUrl || '',
    projectName: context.projectName || '',
    sourceType: context.sourceType || '',
    videoDuration: context.videoDuration || '未知',
  });
}

async function callGeminiWithParts(
  apiConfig: { baseUrl: string; apiKey: string; model?: string },
  parts: Array<Record<string, unknown>>,
): Promise<AnalysisMasterResult> {
  const basePath = apiConfig.baseUrl.endsWith('/v1beta') ? apiConfig.baseUrl : `${apiConfig.baseUrl}/v1beta`;
  const model = apiConfig.model || 'gemini-2.5-flash';
  const response = await fetch(`${basePath}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiConfig.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 32768,
      },
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini 分析失败: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return normalizeAnalysisResult(extractJsonObject(text));
}

async function uploadVideoToGemini(
  basePath: string,
  apiKey: string,
  videoBuffer: Buffer,
  mimeType: string,
): Promise<{ fileUri: string; fileName: string }> {
  const uploadBase = basePath.replace('/v1beta', '');
  const startResponse = await fetch(`${uploadBase}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(videoBuffer.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `analysis_master_${Date.now()}` } }),
  });

  if (!startResponse.ok) {
    throw new Error(`启动 Gemini File API 上传失败: ${startResponse.status}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini File API 未返回上传地址');
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
    throw new Error(`Gemini File API 上传视频失败: ${uploadResponse.status}`);
  }

  const uploadResult = await uploadResponse.json();
  const fileName = uploadResult.file?.name;
  const fileUri = uploadResult.file?.uri;
  if (!fileName || !fileUri) {
    throw new Error('Gemini File API 响应缺少文件信息');
  }

  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const pollResponse = await fetch(`${basePath}/${fileName}`, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!pollResponse.ok) continue;
      const pollData = await pollResponse.json();
      if (pollData.state === 'ACTIVE') return { fileUri, fileName };
      if (pollData.state === 'FAILED') {
        throw new Error(`Gemini 视频处理失败: ${pollData.error?.message || '未知错误'}`);
      }
    }

    throw new Error('Gemini 视频处理超时');
  } catch (error) {
    await fetch(`${basePath}/${fileName}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    }).catch(() => undefined);
    throw error;
  }
}

export async function analyzeVideoBufferWithGemini(
  videoBuffer: Buffer,
  mimeType = 'video/mp4',
  context: AnalysisPromptContext = {},
): Promise<AnalysisMasterResult> {
  const apiConfig = await getServerDefaultTextApi();
  if (!apiConfig) {
    throw new Error('未配置文本模型');
  }

  const basePath = apiConfig.baseUrl.endsWith('/v1beta') ? apiConfig.baseUrl : `${apiConfig.baseUrl}/v1beta`;
  const prompt = await getAnalysisMasterPrompt(context);

  if (videoBuffer.length < 15 * 1024 * 1024) {
    try {
      return await callGeminiWithParts(apiConfig, [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: videoBuffer.toString('base64'),
          },
        },
      ]);
    } catch (error) {
      console.warn('[Analysis Master] inline video failed, fallback to File API:', (error as Error).message);
    }
  }

  const uploaded = await uploadVideoToGemini(basePath, apiConfig.apiKey, videoBuffer, mimeType);
  try {
    return await callGeminiWithParts(apiConfig, [
      { text: prompt },
      {
        file_data: {
          mime_type: mimeType,
          file_uri: uploaded.fileUri,
        },
      },
    ]);
  } finally {
    await fetch(`${basePath}/${uploaded.fileName}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiConfig.apiKey },
    }).catch(() => undefined);
  }
}
