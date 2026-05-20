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
  dialogueVoOriginal?: string;
  dialogueVoZh?: string;
  ctaA?: string;
  ctaB?: string;
  ctaC?: string;
  ctaD?: string;
  actionScheduling?: string;
  productDesc?: string;
  mustShow?: string;
  onScreenTextGraphics?: string;
  cameraShotSize?: string;
  cameraAngle?: string;
  compositionNotes?: string;
  lightingAtmosphere?: string;
  colorGrading?: string;
  languageStyle?: string;
  emphasisNotes?: string;
  audioBgm?: string;
  audioSfx?: string;
  ambientSound?: string;
  editingTransition?: string;
  pacingNotes?: string;
  filmingConstraints?: string;
  constraintsCompliance?: string;
  reverseConstraints?: string;
  assetsNeeded?: string;
  sentenceMapping?: string;
  mappingNotes?: string;
  preAnalysis?: unknown;
}

export interface AnalysisMasterResult {
  summary: string;
  videoType: string;
  targetAudience: string;
  sellingPoints: string[];
  scenes: AnalysisScene[];
  imagePrompt: string;
  videoPrompt: string;
  dialogue_vo_original: string;
  dialogue_vo_zh: string;
  cta_a: string;
  cta_b: string;
  cta_c: string;
  cta_d: string;
  raw: Record<string, unknown>;
}

export interface AnalysisPromptContext {
  videoUrl?: string;
  projectName?: string;
  sourceType?: string;
  videoDuration?: number | string;
}

const ANALYSIS_MASTER_EXTENDED_FIELDS_PROMPT = `

补充输出要求：每个 scenes[] 分镜对象必须尽量包含以下字段；无法识别时返回空字符串或空对象，不要省略字段：
dialogue_vo_original, dialogue_vo_zh, cta_a, cta_b, cta_c, cta_d,
action_scheduling, product_desc, must_show, on_screen_text_graphics,
camera_shot_size, camera_angle, camera_movement, composition_notes,
lighting_atmosphere, color_grading, language_style, emphasis_notes,
audio_bgm, audio_sfx, ambient_sound, editing_transition, pacing_notes,
filming_constraints, constraints_compliance, reverse_constraints,
assets_needed, sentence_mapping, mapping_notes, pre_analysis.
`;

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

function stringField(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return '';
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
      dialogueVoOriginal: stringField(scene, 'dialogueVoOriginal', 'dialogue_vo_original'),
      dialogueVoZh: stringField(scene, 'dialogueVoZh', 'dialogue_vo_zh'),
      ctaA: stringField(scene, 'ctaA', 'cta_a'),
      ctaB: stringField(scene, 'ctaB', 'cta_b'),
      ctaC: stringField(scene, 'ctaC', 'cta_c'),
      ctaD: stringField(scene, 'ctaD', 'cta_d'),
      actionScheduling: stringField(scene, 'actionScheduling', 'action_scheduling'),
      productDesc: stringField(scene, 'productDesc', 'product_desc'),
      mustShow: stringField(scene, 'mustShow', 'must_show'),
      onScreenTextGraphics: stringField(scene, 'onScreenTextGraphics', 'on_screen_text_graphics'),
      cameraShotSize: stringField(scene, 'cameraShotSize', 'camera_shot_size'),
      cameraAngle: stringField(scene, 'cameraAngle', 'camera_angle'),
      compositionNotes: stringField(scene, 'compositionNotes', 'composition_notes'),
      lightingAtmosphere: stringField(scene, 'lightingAtmosphere', 'lighting_atmosphere'),
      colorGrading: stringField(scene, 'colorGrading', 'color_grading'),
      languageStyle: stringField(scene, 'languageStyle', 'language_style'),
      emphasisNotes: stringField(scene, 'emphasisNotes', 'emphasis_notes'),
      audioBgm: stringField(scene, 'audioBgm', 'audio_bgm'),
      audioSfx: stringField(scene, 'audioSfx', 'audio_sfx'),
      ambientSound: stringField(scene, 'ambientSound', 'ambient_sound'),
      editingTransition: stringField(scene, 'editingTransition', 'editing_transition'),
      pacingNotes: stringField(scene, 'pacingNotes', 'pacing_notes'),
      filmingConstraints: stringField(scene, 'filmingConstraints', 'filming_constraints'),
      constraintsCompliance: stringField(scene, 'constraintsCompliance', 'constraints_compliance'),
      reverseConstraints: stringField(scene, 'reverseConstraints', 'reverse_constraints'),
      assetsNeeded: stringField(scene, 'assetsNeeded', 'assets_needed'),
      sentenceMapping: stringField(scene, 'sentenceMapping', 'sentence_mapping'),
      mappingNotes: stringField(scene, 'mappingNotes', 'mapping_notes'),
      preAnalysis: scene.preAnalysis || scene.pre_analysis,
    };
  });

  return {
    summary: String(raw.summary || raw.name || raw.title || ''),
    videoType: String(raw.videoType || raw.video_type || ''),
    targetAudience: String(raw.targetAudience || raw.target_audience || ''),
    sellingPoints: normalizeStringArray(raw.sellingPoints || raw.selling_points),
    scenes,
    imagePrompt: String(raw.imagePrompt || raw.image_prompt || ''),
    videoPrompt: String(raw.videoPrompt || raw.video_prompt || ''),
    dialogue_vo_original: String(raw.dialogue_vo_original || raw.dialogue_vo || raw.speech_text || ''),
    dialogue_vo_zh: String(raw.dialogue_vo_zh || raw.dialogue_vo_zh_CN || ''),
    cta_a: String(raw.cta_a || ''),
    cta_b: String(raw.cta_b || ''),
    cta_c: String(raw.cta_c || ''),
    cta_d: String(raw.cta_d || ''),
    raw,
  };
}

export async function getAnalysisMasterPrompt(context: AnalysisPromptContext): Promise<string> {
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

  const prompt = replaceVariables(template, {
    videoUrl: context.videoUrl || '',
    projectName: context.projectName || '',
    sourceType: context.sourceType || '',
    videoDuration: context.videoDuration || '未知',
  });
  return `${prompt}${ANALYSIS_MASTER_EXTENDED_FIELDS_PROMPT}`;
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

async function compressVideoForAnalysis(videoBuffer: Buffer): Promise<Buffer> {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const inputPath = path.join(os.tmpdir(), `am-compress-input-${Date.now()}.mp4`);
  const outputPath = path.join(os.tmpdir(), `am-compress-output-${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vf', 'scale=480:-2',
      '-crf', '28',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: 120000 });

    return fs.readFileSync(outputPath);
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
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

  const prompt = await getAnalysisMasterPrompt(context);
  // 所有视频统一用 ffmpeg 压缩降分辨率，减少 token 消耗
  console.log(`[Analysis Master] 原始视频 ${videoBuffer.length} bytes，使用 ffmpeg 压缩...`);
  const bufferToSend = await compressVideoForAnalysis(videoBuffer);
  console.log(`[Analysis Master] 压缩后 ${bufferToSend.length} bytes`);

  return await callGeminiWithParts(apiConfig, [
    { text: prompt },
    {
      inline_data: {
        mime_type: mimeType,
        data: bufferToSend.toString('base64'),
      },
    },
  ]);
}
