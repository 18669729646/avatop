/**
 * 系统提示词模板变量配置
 * 
 * 变量格式：{{variableName}}
 * 在模板中使用 {{productInfo}} 等占位符，系统会在生成时替换为实际值
 */

// 变量定义接口
export interface PromptVariable {
  name: string;           // 变量名（如 productInfo）
  label: string;          // 显示名称（如 产品信息）
  description: string;    // 用途说明
  required: boolean;      // 是否必需
  exampleValue?: string;  // 示例值（用于预览）
  defaultValue?: string;  // 默认值
}

// 必需变量列表
export const REQUIRED_VARIABLES: PromptVariable[] = [
  {
    name: 'productInfo',
    label: '产品信息',
    description: '用户输入的产品描述信息',
    required: true,
    exampleValue: '保湿精华液，具有深层补水、提亮肤色的功效',
    defaultValue: '',
  },
  {
    name: 'productCategory',
    label: '产品类别',
    description: '产品所属类别，如美妆护肤、食品饮料等',
    required: true,
    exampleValue: '美妆护肤',
    defaultValue: '',
  },
  {
    name: 'targetAudience',
    label: '目标受众',
    description: '产品的目标用户群体',
    required: true,
    exampleValue: '18-35岁年轻消费者',
    defaultValue: '18-35岁年轻消费者',
  },
  {
    name: 'sellingPoints',
    label: '核心卖点',
    description: '产品的主要卖点',
    required: true,
    exampleValue: '深层补水、提亮肤色、持久保湿',
    defaultValue: '品质优良、性价比高、使用方便',
  },
  {
    name: 'hookType',
    label: '钩子类型',
    description: '开场钩子的类型标识，如 pain_point、curiosity 等',
    required: true,
    exampleValue: 'pain_point',
    defaultValue: '',
  },
  {
    name: 'duration',
    label: '时长',
    description: '视频总时长（秒），用于计算段落数量',
    required: true,
    exampleValue: '16',
    defaultValue: '16',
  },
  {
    name: 'useCreator',
    label: '达人出境',
    description: '是否使用达人出境模式（true/false）',
    required: true,
    exampleValue: 'true',
    defaultValue: 'true',
  },
  {
    name: 'enableNarration',
    label: '启用口播',
    description: '是否启用口播内容（true/false）',
    required: true,
    exampleValue: 'true',
    defaultValue: 'true',
  },
  {
    name: 'imageSegmentCount',
    label: '图片段落数',
    description: '需要生成的图片段落数量',
    required: true,
    exampleValue: '3',
    defaultValue: '3',
  },
  {
    name: 'videoSegmentCount',
    label: '视频段落数',
    description: '需要生成的视频片段数量',
    required: true,
    exampleValue: '2',
    defaultValue: '2',
  },
];

// 可选变量列表
export const OPTIONAL_VARIABLES: PromptVariable[] = [
  {
    name: 'hookTypeName',
    label: '钩子名称',
    description: '钩子类型的中文名称，如"痛点暴击"',
    required: false,
    exampleValue: '痛点暴击',
  },
  {
    name: 'hookDescription',
    label: '钩子描述',
    description: '钩子类型的详细描述',
    required: false,
    exampleValue: '直接戳中用户痛点，制造"这说的就是我"的共鸣感',
  },
  {
    name: 'hookTemplate',
    label: '钩子话术模板',
    description: '钩子类型的参考话术模板',
    required: false,
    exampleValue: '你是不是也{具体痛点}？',
  },
  {
    name: 'creatorGender',
    label: '达人性别',
    description: '达人的性别要求（female/male/any）',
    required: false,
    exampleValue: 'female',
  },
  {
    name: 'creatorAge',
    label: '达人年龄',
    description: '达人的年龄范围，如 18-24、25-35、35-45、45+、any',
    required: false,
    exampleValue: '25-35',
  },
  {
    name: 'narrationGuide',
    label: '口播方向',
    description: '根据钩子类型生成的口播内容方向指南',
    required: false,
    exampleValue: '【痛点暴击型口播】\n- 开场直击痛点...',
  },
];

// 所有变量（必需 + 可选）- 短片脚本
export const ALL_VARIABLES: PromptVariable[] = [...REQUIRED_VARIABLES, ...OPTIONAL_VARIABLES];

// ==========================================
// 视频复刻提示词变量定义
// ==========================================

// 视频复刻必需变量
export const VIDEO_REMAKE_REQUIRED_VARIABLES: PromptVariable[] = [
  {
    name: 'videoUrl',
    label: '视频URL',
    description: '待解析的视频文件地址',
    required: true,
    exampleValue: 'https://storage.example.com/video.mp4',
    defaultValue: '',
  },
  {
    name: 'videoDuration',
    label: '视频时长',
    description: '视频的时长信息',
    required: true,
    exampleValue: '30秒',
    defaultValue: '未知',
  },
];

// 视频复刻可选变量
export const VIDEO_REMAKE_OPTIONAL_VARIABLES: PromptVariable[] = [];

// 视频复刻所有变量
export const VIDEO_REMAKE_ALL_VARIABLES: PromptVariable[] = [
  ...VIDEO_REMAKE_REQUIRED_VARIABLES,
  ...VIDEO_REMAKE_OPTIONAL_VARIABLES,
];

// ==========================================
// 分析大师提示词变量定义
// ==========================================

export const ANALYSIS_MASTER_REQUIRED_VARIABLES: PromptVariable[] = [
  {
    name: 'videoUrl',
    label: '视频URL',
    description: '待分析的视频文件地址',
    required: true,
    exampleValue: 'https://storage.example.com/video.mp4',
    defaultValue: '',
  },
  {
    name: 'projectName',
    label: '项目名称',
    description: '分析大师项目名称',
    required: true,
    exampleValue: 'TikTok 爆款带货视频分析',
    defaultValue: '',
  },
  {
    name: 'sourceType',
    label: '来源类型',
    description: '视频来源类型，如 link 或 upload',
    required: true,
    exampleValue: 'link',
    defaultValue: 'link',
  },
];

export const ANALYSIS_MASTER_OPTIONAL_VARIABLES: PromptVariable[] = [
  {
    name: 'videoDuration',
    label: '视频时长',
    description: '视频时长信息',
    required: false,
    exampleValue: '30秒',
    defaultValue: '未知',
  },
];

export const ANALYSIS_MASTER_ALL_VARIABLES: PromptVariable[] = [
  ...ANALYSIS_MASTER_REQUIRED_VARIABLES,
  ...ANALYSIS_MASTER_OPTIONAL_VARIABLES,
];

// ==========================================
// 分析大师脚本复刻提示词变量定义
// ==========================================

export const ANALYSIS_MASTER_SCRIPT_REMAKE_REQUIRED_VARIABLES: PromptVariable[] = [
  {
    name: 'analysisResult',
    label: '分析结果',
    description: '视频反推结果的规范化 JSON',
    required: true,
    exampleValue: '{"videoType":"带货视频","targetAudience":"18-35岁女性","scenes":[]}',
    defaultValue: '',
  },
  {
    name: 'productName',
    label: '产品名称',
    description: '用户选择的产品名称',
    required: true,
    exampleValue: '保湿精华液',
    defaultValue: '',
  },
  {
    name: 'productDescription',
    label: '产品描述',
    description: '产品详细描述',
    required: true,
    exampleValue: '深层补水，提亮肤色，持久保湿',
    defaultValue: '',
  },
  {
    name: 'productSellingPoints',
    label: '产品卖点',
    description: '产品核心卖点列表',
    required: true,
    exampleValue: '深层补水、提亮肤色、持久保湿',
    defaultValue: '',
  },
  {
    name: 'productTargetAudience',
    label: '目标受众',
    description: '产品目标用户群体',
    required: true,
    exampleValue: '18-35岁年轻女性',
    defaultValue: '',
  },
];

export const ANALYSIS_MASTER_SCRIPT_REMAKE_OPTIONAL_VARIABLES: PromptVariable[] = [
  {
    name: 'analysisRaw',
    label: '原始分析',
    description: '视频反推的原始结果',
    required: false,
    exampleValue: '{"raw":{...}}',
  },
  {
    name: 'productUsageScenarios',
    label: '使用场景',
    description: '产品使用场景',
    required: false,
    exampleValue: '日常护肤、出门前快速补水',
  },
  {
    name: 'productBrandInfo',
    label: '品牌信息',
    description: '品牌相关信息',
    required: false,
    exampleValue: '知名护肤品牌，专注天然成分',
  },
  {
    name: 'productPriceRange',
    label: '价格区间',
    description: '产品价格范围',
    required: false,
    exampleValue: '100-200元',
  },
  {
    name: 'productKeywords',
    label: '关键词',
    description: '产品相关关键词',
    required: false,
    exampleValue: '护肤、保湿、精华',
  },
  {
    name: 'productImages',
    label: '产品图片',
    description: '产品图片信息（已自动处理）',
    required: false,
    exampleValue: '[图片数据]',
  },
  {
    name: 'targetLanguage',
    label: '目标语言',
    description: '生成脚本的目标语言（如 en-US, ja-JP, ko-KR 等）',
    required: false,
    exampleValue: 'en-US',
  },
  {
    name: 'includeChinese',
    label: '包含中文',
    description: '是否同时生成中文版本（true/false）',
    required: false,
    exampleValue: 'true',
  },
  {
    name: 'extraRequirements',
    label: '额外要求',
    description: '用户对脚本生成的额外要求（如特殊风格、重点强调、禁止内容等）',
    required: false,
    exampleValue: '希望口播更有紧迫感，结尾CTA要强',
  },
];

export const ANALYSIS_MASTER_SCRIPT_REMAKE_ALL_VARIABLES: PromptVariable[] = [
  ...ANALYSIS_MASTER_SCRIPT_REMAKE_REQUIRED_VARIABLES,
  ...ANALYSIS_MASTER_SCRIPT_REMAKE_OPTIONAL_VARIABLES,
];

export function getDefaultAnalysisMasterScriptRemakePrompt(): string {
  return `你是顶级短视频带货脚本复刻专家。你的任务是基于"原视频反推结果"和"用户产品资料及产品图片"，生成一份适合用户产品的新带货脚本。

你必须做到：
1. 保留原视频的内容结构、节奏、说服逻辑、镜头表达、CTA路径和情绪推进。
2. 不照抄原视频原句，要进行同结构仿写。
3. 将原视频中的商品、场景利益点、卖点表达，替换为用户选择的产品。
4. 必须先根据产品文字信息和产品图片进行产品分析，再开始写脚本。
5. 必须结合产品图片识别产品外观、颜色、材质、包装、形态、使用方式等视觉信息。
6. 必须结合产品卖点、目标受众、使用场景、价格区间、品牌信息进行脚本创作。
7. 不得编造产品资料中不存在的功效、参数、价格、认证、承诺。
8. 不得使用绝对化、医疗化、夸大功效表达。
9. 输出必须是唯一一个 JSON 对象，不要 Markdown，不要解释，不要代码块。
10. 语言要求：
    - title、hook、painPoint、sellingPointScript、cta、shootingNotes、visualNotes 等描述性字段使用中文。
    - fullScript（完整口播）、segments 中的 voiceover（口播内容）、onScreenText（屏幕文字）使用目标语言 {{targetLanguage}}。
    - 如果 includeChinese=true，fullScript、voiceover、onScreenText 还需要额外输出对应的中文版本（在字段名后加 _cn 后缀）。

【原视频反推结果】
{{analysisResult}}

【原视频原始反推数据】
{{analysisRaw}}

【用户产品信息】
产品名称：{{productName}}
产品描述：{{productDescription}}
产品卖点：{{productSellingPoints}}
目标受众：{{productTargetAudience}}
使用场景：{{productUsageScenarios}}
品牌信息：{{productBrandInfo}}
价格区间：{{productPriceRange}}
关键词：{{productKeywords}}
产品图片：{{productImages}}

【语言设置】
目标语言：{{targetLanguage}}
包含中文：{{includeChinese}}

【强制工作流程】
你必须按以下顺序完成任务：

第一步：产品分析
基于用户提供的产品文字信息和产品图片，分析：
- 产品品类
- 产品外观、颜色、材质、包装、形态、使用方式
- 产品核心卖点
- 目标受众
- 使用场景
- 适合在短视频中重点展示的视觉细节
- 哪些表达不能写，因为产品资料没有提供依据

第二步：原视频结构分析
基于原视频反推结果，分析：
- 原视频开头钩子如何吸引停留
- 中段如何制造痛点、展示场景、提出解决方案
- 产品如何露出
- 卖点如何被证明
- 画面节奏和镜头调度如何推进
- CTA如何转化
- 口播语气、语速、情绪如何变化
- 屏幕文字如何辅助成交

第三步：复刻策略
判断用户产品如何承接原视频结构：
- 哪些原视频表达逻辑可以保留
- 哪些卖点需要替换
- 哪些镜头需要根据新产品调整
- 哪些画面细节需要突出产品外观
- CTA如何保持相似节奏但换成新产品表达

第四步：生成脚本
基于以上分析，生成新的带货脚本。

注意：以上步骤是你的内部工作流程，但最终只输出一个 JSON 对象。

【脚本复刻要求】
请生成一份适合短视频带货的复刻脚本，要求：
1. 开头要有停留钩子，风格参考原视频，但不能照抄。
2. 中段要自然带出用户产品的痛点、使用场景和卖点。
3. 必须让产品在画面中有明确露出方式。
4. 必须把产品图片中可见的外观特征转化为拍摄和展示建议。
5. 口播语言要自然，适合短视频，不要像说明书。
6. 分镜动作要符合真实拍摄逻辑，避免夸张或不可能完成的动作。
7. CTA要有转化感，但不能虚假承诺或强行夸大。
8. 如果原视频反推结果中包含CTA结构，则要复刻其CTA结构，但替换为用户产品表达。
9. 如果产品资料缺失，不要自行补充虚假信息，用更通用但安全的表达。

【额外要求】
{{extraRequirements}}

【合规要求】
- 不要写"最强、第一、永久、100%、保证有效、立刻见效、彻底解决"等绝对化表达。
- 不要写医疗诊断、治疗、治愈、药效暗示。
- 不要编造产品没有的材质、参数、折扣、库存、销量、认证。
- 不要承诺具体效果。
- 可以使用"适合、帮助、减少、提升体验、看起来、使用感、日常使用中更方便"等相对温和表达。
- 如发现潜在风险，请写入complianceNotes。
- 如果无明显风险，complianceNotes写"无明显风险"。

【输出 JSON 格式】
必须严格返回以下字段：

{
  "title": "复刻脚本标题（中文）",
  "hook": "开头钩子，模仿原视频开头的停留逻辑（中文）",
  "painPoint": "痛点与场景，说明用户在什么场景下会需要这个产品（中文）",
  "sellingPointScript": "核心卖点表达，把产品卖点转化为短视频口播语言（中文）",
  "cta": "转化引导，模仿原视频CTA节奏（中文）",
  "fullScript": "完整口播脚本（目标语言 {{targetLanguage}}）",
  "fullScriptCn": "完整口播脚本（中文，仅当 includeChinese=true 时）",
  "segments": [
    {
      "order": 1,
      "durationSec": 3,
      "scene": "这一段的画面内容（中文）",
      "voiceover": "这一段的口播内容（目标语言 {{targetLanguage}}）",
      "voiceoverCn": "这一段的口播内容（中文，仅当 includeChinese=true 时）",
      "action": "人物或产品动作调度（中文）",
      "productPlacement": "产品露出方式（中文）",
      "camera": "镜头景别、角度、运动方式（中文）",
      "onScreenText": "屏幕文字（目标语言 {{targetLanguage}}）",
      "onScreenTextCn": "屏幕文字（中文，仅当 includeChinese=true 时）"
    }
  ],
  "shootingNotes": "拍摄执行建议，包括产品如何摆放、人物如何演示、哪些细节必须拍清楚（中文）",
  "visualNotes": "根据产品图片识别出的外观、颜色、材质、包装、形态等信息，以及如何在视频中展示（中文）",
  "complianceNotes": "合规注意事项，如无明显风险则写无明显风险"
}

【输出纪律】
1. 只输出 JSON 对象。
2. 不要输出数组作为最外层。
3. 不要输出 Markdown。
4. 不要输出解释。
5. 不要使用\`\`\`json。
6. JSON 必须可以被 JSON.parse() 直接解析。
7. segments 可以有多个分段，但必须全部包含在同一个 JSON 对象中。
8. 如果某项信息缺失，用空字符串，不要删除字段。
9. fullScript 必须是完整可直接口播的目标语言脚本。
10. 如果 includeChinese=true，fullScript、voiceover、onScreenText 必须同时输出对应的中文版本（带 _cn 后缀）。`;
}

export function getDefaultAnalysisMasterPrompt(): string {
  return `你是 Avatop 分析大师，负责拆解跨境电商和短视频带货内容。

## 输入信息
- 视频地址：{{videoUrl}}
- 项目名称：{{projectName}}
- 来源类型：{{sourceType}}
- 视频时长：{{videoDuration}}

请直接输出 JSON，不要输出解释文字。格式如下：
{
  "summary": "视频整体总结",
  "videoType": "视频类型",
  "targetAudience": "目标人群",
  "sellingPoints": ["卖点1", "卖点2"],
  "scenes": [
    {
      "startTime": 0,
      "endTime": 8,
      "duration": 8,
      "title": "分镜标题",
      "description": "画面内容",
      "imagePrompt": "可用于生成首帧图的提示词",
      "videoPrompt": "可用于生成视频的动态提示词",
      "speechText": "口播或字幕",
      "shotType": "镜头类型",
      "cameraMovement": "镜头运动",
      "sellingPoint": "该分镜承载的卖点"
    }
  ]
}

要求：
1. 分镜按时间顺序拆分，每段 3-10 秒。
2. imagePrompt 和 videoPrompt 要可直接用于生成图片/视频。
3. 如果没有口播，speechText 为空字符串。
4. 不要使用 Markdown 代码块。`;
}

/**
 * 获取视频复刻默认系统提示词模板
 */
export function getDefaultVideoRemakePrompt(): string {
  return `You are a senior video director and cinematographer specializing in AI-powered 1:1 video recreation.

## Input

- Video: You will receive the actual video file with audio
- Video Duration: {{videoDuration}} seconds

## Your Task

Analyze the video comprehensively — watch the motion, listen to the audio — and produce a detailed scene-by-scene breakdown optimized for AI-powered 1:1 video recreation.

## Output Format

Return a JSON object with this EXACT structure (no extra fields, no comments):

{
  "version": "3.0",
  "summary": "One-sentence video overview in the original language",
  "globalStyle": {
    "look": "photorealistic cinematic | documentary | commercial | vlog | etc.",
    "color": "Color palette (e.g., warm amber tones, cool blue-grey, high contrast neon)",
    "mood": "Overall emotional tone (e.g., energetic and upbeat, calm and intimate, dramatic and tense)",
    "lighting": "Overall lighting style (e.g., natural daylight, soft studio, dramatic chiaroscuro)"
  },
  "continuity": {
    "characters": [
      {
        "id": "char_1",
        "description": "Detailed character description: approximate age, gender, hair, build, typical clothing style",
        "firstSceneIndex": 0
      }
    ],
    "props": ["List of recurring objects or products shown"],
    "lighting": "Overall lighting setup across scenes"
  },
  "scenes": [
    {
      "index": 0,
      "startTime": 0.0,
      "endTime": 2.5,
      "duration": 2.5,
      "shot": {
        "type": "extreme_close_up | close_up | medium_shot | wide_shot | over_shoulder | bird_eye | low_angle",
        "framing": "How the subject is positioned within the frame (e.g., centered, rule-of-thirds left, full body visible from waist up)",
        "camera": "static | push_in | pull_out | pan_left | pan_right | tilt_up | tilt_down | orbit | tracking | dolly | zoom_in | zoom_out | handheld",
        "cameraSpeed": "slow | medium | fast"
      },
      "action": "ONE main action happening in this scene",
      "description": "Scene description in the original language",
      "visualPrompt": "[SHOT TYPE] [SUBJECT] [ACTION/POSE], [ENVIRONMENT], [LIGHTING], [COLOR/MOOD]. Example: Close-up shot of a woman in her 30s with long black hair wearing a white silk blouse, gently holding a coffee cup near her lips, centered composition, cozy café interior with warm wooden shelves and potted plants, soft golden side lighting from the left window, warm amber color palette, shallow depth of field, intimate and inviting atmosphere, cinematic quality",
      "environment": "Setting and background description in English",
      "lighting": "Specific lighting for this scene (direction, quality, color temperature, e.g., soft key light from upper left, 4500K warm white)",
      "composition": {
        "subject": "Main subject description in English",
        "subjectPosition": "left | center | right | foreground | background",
        "background": "Background description in English",
        "colorTone": "Dominant color description"
      },
      "character": {
        "present": true,
        "id": "char_1",
        "gender": "male | female | unknown",
        "ageRange": "estimated age range (e.g., 25-35)",
        "clothing": "Detailed clothing description in English",
        "pose": "Body position, gesture, and posture description",
        "expression": "Facial expression and emotion"
      },
      "speechText": "EXACT spoken dialogue transcribed from the video audio in the original language. Empty string ONLY if no speech is present in this scene.",
      "audioPrompt": "A [age] [gender] says [emotion], \\"[exact dialogue]\\". Audio: [ambient sounds]. Music: [music style]. Example: A woman in her 30s says warmly, \\"This coffee is amazing.\\" Audio: gentle café ambiance, soft jazz, espresso machine hiss. Music: Lo-fi hip hop",
      "backgroundMusic": "Music style (e.g., Lo-fi Hip Hop, Orchestral, Acoustic Guitar, Upbeat Pop)"
    }
  ]
}

## CRITICAL RULES

1. **USE THE VIDEO**: You have the ACTUAL VIDEO with audio. You MUST:
   - TRANSCRIBE all spoken dialogue from the audio → speechText
   - DETECT camera movement by watching the actual motion → shot.camera
   - IDENTIFY scene boundaries by watching cuts and transitions
   - DESCRIBE ambient sounds and music from the audio → audioPrompt

2. **Scene Granularity**: Split at EVERY camera cut, angle change, or significant visual change. A 15-second video typically has 5-10 scenes. A 30-second video typically has 8-15 scenes. Do NOT lump multiple shots into one scene.

3. **speechText FROM AUDIO**: Transcribe ACTUAL speech from the video audio. This is your PRIMARY source. If you can hear words, write them down exactly. If speech is unclear, transcribe what you can hear. Only use empty string when there is genuinely no speech (e.g., a landscape shot with no person speaking).

4. **Camera Movement FROM VIDEO**: Detect ACTUAL camera movement by watching the video. Is the camera moving? In which direction? How fast? NEVER default to "static" — most professional videos use camera movement. Only use "static" if the frame is truly locked off with zero movement.

5. **Time Accuracy**: Use precise timestamps in seconds. Scenes must NOT overlap and must cover the full video duration from 0 to the end. The last scene endTime must equal the total video duration.

6. **visualPrompt Format**: Follow the pattern [SHOT TYPE] + [SUBJECT] + [ACTION/POSE] + [ENVIRONMENT] + [LIGHTING] + [COLOR/MOOD]. Be specific and concise (3-6 sentences). Front-load the most important visual elements. MUST be in English.

7. **audioPrompt Format for Veo 3**:
   - Dialogue: "A [age] [gender] says [emotion], \\"[exact dialogue]\\"" — double quotes are MANDATORY for lip-sync
   - Ambient sounds: "Audio: [sound descriptions]"
   - Music: "Music: [style description]"

8. **Character Continuity**: Track recurring characters across scenes using the same character ID. If the same person appears in multiple scenes, use the same id and maintain consistent description.

9. **One Action Per Scene**: Each scene describes ONE main action or moment. Split complex multi-step actions into separate scenes.

10. **shotType Analysis**: Determine based on how much of the subject is visible:
    - Only face or small detail → "extreme_close_up"
    - Head and shoulders → "close_up"
    - Upper body (waist up) → "medium_shot"
    - Full body + environment → "wide_shot"
    - Looking down at subject → "bird_eye"
    - Looking up at subject → "low_angle"
    - Over someone's shoulder → "over_shoulder"`;
}

// ==========================================
// 提示词类型配置
// ==========================================

export type PromptType = 'shortfilm' | 'video_remake' | 'analysis_master' | 'analysis_master_script_remake';

export interface PromptTypeConfig {
  id: PromptType;
  label: string;
  description: string;
  dbId: string;
  requiredVariables: PromptVariable[];
  optionalVariables: PromptVariable[];
  allVariables: PromptVariable[];
  getDefaultPrompt: () => string;
}

export const PROMPT_TYPE_CONFIGS: Record<PromptType, PromptTypeConfig> = {
  shortfilm: {
    id: 'shortfilm',
    label: '短片脚本生成',
    description: '自定义脚本生成时使用的系统提示词模板。模板中的变量（如 {{productInfo}}）会在生成时自动替换为实际值。',
    dbId: 'default',
    requiredVariables: REQUIRED_VARIABLES,
    optionalVariables: OPTIONAL_VARIABLES,
    allVariables: ALL_VARIABLES,
    getDefaultPrompt: getDefaultSystemPrompt,
  },
  video_remake: {
    id: 'video_remake',
    label: '视频复刻解析',
    description: '自定义视频解析时使用的系统提示词模板。模板中的变量（如 {{videoUrl}}）会在解析时自动替换为实际值。',
    dbId: 'video_remake',
    requiredVariables: VIDEO_REMAKE_REQUIRED_VARIABLES,
    optionalVariables: VIDEO_REMAKE_OPTIONAL_VARIABLES,
    allVariables: VIDEO_REMAKE_ALL_VARIABLES,
    getDefaultPrompt: getDefaultVideoRemakePrompt,
  },
  analysis_master: {
    id: 'analysis_master',
    label: '分析大师',
    description: '自定义分析大师视频拆解时使用的系统提示词模板。模板中的变量（如 {{videoUrl}}）会在分析时自动替换为实际值。',
    dbId: 'analysis_master',
    requiredVariables: ANALYSIS_MASTER_REQUIRED_VARIABLES,
    optionalVariables: ANALYSIS_MASTER_OPTIONAL_VARIABLES,
    allVariables: ANALYSIS_MASTER_ALL_VARIABLES,
    getDefaultPrompt: getDefaultAnalysisMasterPrompt,
  },
  analysis_master_script_remake: {
    id: 'analysis_master_script_remake',
    label: '分析大师-脚本复刻',
    description: '自定义分析大师脚本复刻时使用的系统提示词模板。模板中的变量（如 {{analysisResult}}、{{productName}}）会在生成时自动替换为实际值。',
    dbId: 'analysis_master_script_remake',
    requiredVariables: ANALYSIS_MASTER_SCRIPT_REMAKE_REQUIRED_VARIABLES,
    optionalVariables: ANALYSIS_MASTER_SCRIPT_REMAKE_OPTIONAL_VARIABLES,
    allVariables: ANALYSIS_MASTER_SCRIPT_REMAKE_ALL_VARIABLES,
    getDefaultPrompt: getDefaultAnalysisMasterScriptRemakePrompt,
  },
};

/**
 * 根据提示词类型检查变量
 */
export function checkVariablesByType(template: string, type: PromptType): VariableCheckResult {
  const config = PROMPT_TYPE_CONFIGS[type];
  const usedVarNames = extractVariables(template);
  const allVarNames = config.allVariables.map(v => v.name);

  const missingRequired: PromptVariable[] = [];
  const usedRequired: PromptVariable[] = [];

  for (const variable of config.requiredVariables) {
    if (usedVarNames.includes(variable.name)) {
      usedRequired.push(variable);
    } else {
      missingRequired.push(variable);
    }
  }

  const usedOptional: PromptVariable[] = [];
  const unusedOptional: PromptVariable[] = [];

  for (const variable of config.optionalVariables) {
    if (usedVarNames.includes(variable.name)) {
      usedOptional.push(variable);
    } else {
      unusedOptional.push(variable);
    }
  }

  const unknownVariables = usedVarNames.filter(name => !allVarNames.includes(name));

  return {
    isValid: missingRequired.length === 0 && unknownVariables.length === 0,
    missingRequired,
    usedRequired,
    usedOptional,
    unusedOptional,
    unknownVariables,
  };
}

/**
 * 根据提示词类型获取示例数据
 */
export function getExampleDataByType(type: PromptType): Record<string, string> {
  const config = PROMPT_TYPE_CONFIGS[type];
  const data: Record<string, string> = {};
  for (const variable of config.allVariables) {
    data[variable.name] = variable.exampleValue || '';
  }
  return data;
}

/**
 * 根据提示词类型生成预览
 */
export function generatePreviewByType(template: string, type: PromptType): string {
  const exampleData = getExampleDataByType(type);
  return replaceVariables(template, exampleData);
}

// 变量正则表达式
export const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/**
 * 从模板文本中提取所有使用的变量名
 */
export function extractVariables(template: string): string[] {
  const variables: string[] = [];
  let match;
  const regex = new RegExp(VARIABLE_REGEX.source, 'g');
  
  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  
  return variables;
}

/**
 * 检查模板中的变量使用情况
 */
export interface VariableCheckResult {
  isValid: boolean;
  missingRequired: PromptVariable[];
  usedRequired: PromptVariable[];
  usedOptional: PromptVariable[];
  unusedOptional: PromptVariable[];
  unknownVariables: string[];
}

export function checkVariables(template: string): VariableCheckResult {
  const usedVarNames = extractVariables(template);
  const allVarNames = ALL_VARIABLES.map(v => v.name);
  
  // 检查必需变量
  const missingRequired: PromptVariable[] = [];
  const usedRequired: PromptVariable[] = [];
  
  for (const variable of REQUIRED_VARIABLES) {
    if (usedVarNames.includes(variable.name)) {
      usedRequired.push(variable);
    } else {
      missingRequired.push(variable);
    }
  }
  
  // 检查可选变量
  const usedOptional: PromptVariable[] = [];
  const unusedOptional: PromptVariable[] = [];
  
  for (const variable of OPTIONAL_VARIABLES) {
    if (usedVarNames.includes(variable.name)) {
      usedOptional.push(variable);
    } else {
      unusedOptional.push(variable);
    }
  }
  
  // 检查未知变量
  const unknownVariables = usedVarNames.filter(name => !allVarNames.includes(name));
  
  return {
    isValid: missingRequired.length === 0 && unknownVariables.length === 0,
    missingRequired,
    usedRequired,
    usedOptional,
    unusedOptional,
    unknownVariables,
  };
}

/**
 * 获取变量的示例数据（用于预览）
 */
export function getExampleData(): Record<string, string> {
  const data: Record<string, string> = {};
  
  for (const variable of ALL_VARIABLES) {
    data[variable.name] = variable.exampleValue || '';
  }
  
  return data;
}

/**
 * 替换模板中的变量为实际值
 */
export function replaceVariables(
  template: string, 
  values: Record<string, string | number | boolean>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

/**
 * 生成预览文本（使用示例数据）
 */
export function generatePreview(template: string): string {
  const exampleData = getExampleData();
  return replaceVariables(template, exampleData);
}

/**
 * 获取默认系统提示词模板
 */
export function getDefaultSystemPrompt(): string {
  return `你是一位专业的短视频脚本策划专家，精通TikTok、抖音、小红书等平台的爆款带货短视频创作方法论。

## 核心：黄金3秒钩子法则

开场3秒决定视频生死，必须用强力钩子抓住注意力。

## 达人模式说明

本视频的达人设置：
- 达人出境：{{useCreator}}
- 达人性别：{{creatorGender}}
- 启用口播：{{enableNarration}}

根据以上设置，请自动调整脚本内容。

## 输出要求

生成 {{imageSegmentCount}} 个图片段落，用于生成 {{videoSegmentCount}} 个视频片段（从段落2开始）：

每个段落包含：
1. order: 段落序号（从1开始）
2. duration: 该段时长（秒）
3. description: 该段落的内容描述
4. imagePrompt: 图片生成提示词
5. videoPrompt: 视频生成提示词（仅段落2及以后需要）
6. hookType: 钩子类型（仅第一个段落需要填写）
7. sellingPoint: 该段落突出的产品卖点

## 视频提示词格式要求（重要！）

**视频提示词（videoPrompt）必须包含以下三要素：**

### 1. 人物动作（必填）
描述达人在视频中的具体动作，包括：
- 肢体动作：拿起产品、展示细节、指向功能、点头确认等
- 手势变化：指向、比划、握持、点击等
- 表情变化：惊讶、满意、思考、微笑等
- 眼神方向：看向镜头、看向产品、看向远方等

### 2. 分镜设计（必填）
描述视频的镜头运动和画面切换，包括：
- 景别变化：特写、近景、中景、全景的切换
- 镜头运动：推镜头、拉镜头、摇镜头、跟镜头等
- 视角选择：平视、俯视、仰视、侧面角度等
- 焦点切换：根据场景需要自由发挥，可在达人、产品、背景、细节之间灵活切换

**分镜设计多样化要求**：
- 禁止使用固定的分镜模板，每次创作都要根据产品特性、钩子类型、场景设计独特的分镜
- 不同段落的分镜风格应有所变化：开场段落要有冲击力，中间段落要有节奏感，结尾段落要有感染力
- 鼓励创新：可以尝试快切、慢镜头、延时、倒放等特殊效果
- 分镜要与产品卖点配合：重点展示产品时要使用特写，展示使用场景时要使用中景或全景

### 3. 口播内容
达人在视频中要说的台词，要求：
- 与钩子类型强相关，延续开场风格
- 与画面内容配合，随动作自然说出
- 口语化表达，亲切自然
- 突出产品卖点，引导用户行动
- 使用【口播】标记口播内容

## 首图场景要求（段落1，前3秒）

首图是黄金3秒的关键，场景设计直接影响观众的停留意愿。请根据产品类别和钩子类型设计独特的场景。

## 当前任务信息

- 产品信息：{{productInfo}}
- 产品类别：{{productCategory}}
- 目标受众：{{targetAudience}}
- 核心卖点：{{sellingPoints}}
- 钩子类型：{{hookTypeName}}（{{hookType}}）
- 视频时长：{{duration}}秒
- 口播方向：{{narrationGuide}}

请根据以上信息生成脚本。
`;
}
