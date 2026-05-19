# 视频复刻 2.0 — 完整优化方案

> 基于 Best Minds 专家评估 + 用户反馈 + 系统模型能力调研（2026年4月）

---

## 一、现状诊断

### 1.1 当前架构（五步流水线）

```
视频输入 → Gemini文本解析 → 用户编辑 → GPTImage生图 → Veo生视频 → FFmpeg合并
```

### 1.2 核心问题（Best Minds 专家诊断）

| # | 问题 | 严重程度 | 根因 | 诊断专家 |
|---|------|---------|------|---------|
| P1 | **Gemini未真正观看视频** | 🔴 致命 | 只传URL文本，未传视频帧，AI在"猜"内容 | Fei-Fei Li |
| P2 | **文字描述信息损失80%+** | 🔴 致命 | visual_prompt无法描述构图/光影/姿态/材质 | Andrew Ng |
| P3 | **分镜粒度太粗** | 🟠 严重 | 4个分镜覆盖30秒，实际每1-2秒镜头就变化 | Andrew Ng |
| P4 | **用户定制未传递** | 🟠 严重 | customizations编辑后，生成时仍用原始visual_prompt | 代码审查 |
| P5 | **视频无音频** | 🟠 严重 | Veo支持generate_audio但从未传该参数 | 代码审查 |
| P6 | **不支持换装/换头** | 🔴 致命 | GPTImage支持参考图(urls)但从未传入 | 代码审查 |
| P7 | **FFmpeg合并同步执行** | 🟡 中等 | 大视频可能超时，且依赖本地ffmpeg | Werner Vogels |
| P8 | **分辨率选择无效** | 🟡 中等 | -c copy不重新编码，分辨率参数未生效 | Jan Ozer |
| P9 | **管线信息逐级衰减** | 🔴 致命 | 每一步都丢失上一步的信息，最终输出与原始视频无关 | Andrew Ng |
| P10 | **社交平台解析全部假数据** | 🔴 致命 | 5个平台解析函数都返回硬编码模拟数据 | 代码审查 |
| P11 | **大文件处理OOM风险** | 🟠 严重 | chunk-complete和merge都使用Buffer.concat/readFileSync | Werner Vogels |
| P12 | **状态机不一致** | 🟡 中等 | 图片用status，视频用video_status，两套命名 | 代码审查 |

### 1.3 Andrew Ng 的核心洞察

> "你的管线中每一步的信息损失率是多少？"

当前方案的根本问题不是模型不够好，而是**信息在管线中逐级衰减**：

```
视频(100%信息) → 文字描述(20%信息) → AI凭文字想象生图(与原视频无关)
```

**解决方案**: 在第一步就保留结构化视觉信息，让后续每一步都能"看到"原始画面：

```
视频(100%信息) → 关键帧(90%) + 参考图 → GPTImage条件生成(1:1复刻)
```

### 1.4 关键发现：系统模型能力远未用尽

| 模型 | 已有能力 | 当前是否使用 |
|------|---------|------------|
| GPTImage | 支持 `urls` 参考图输入 | ❌ 从未传入 |
| Veo 3.1 | 支持 `generate_audio` 音频生成 | ❌ 从未传参 |
| Veo 3.1 | 支持 `images` 参考图(首尾帧) | ⚠️ 传入但可能未正确传递 |
| Gemini | 支持多模态图片输入 | ❌ 只传了文本 |

**结论**: 不需要引入任何外部API，只需**充分使用系统已有模型的能力**就能大幅提升效果。

---

## 二、目标架构（视频复刻 2.0）

### 2.1 核心理念

**充分使用系统默认模型已有能力 + 关键帧保留视觉信息 + 提示词工程**

```
当前：视频 → 文字描述 → GPTImage(无参考图) → Veo(无音频) → 静音视频
目标：视频 → 关键帧+参考图 → GPTImage(传参考图) → Veo(开音频+音色提示词) → 有声视频
```

### 2.2 设计原则

1. **全部使用系统配置的默认模型** — 不引入fal.ai/Replicate等外部API
2. **换脸/换装/换背景用默认生图模型 + 参考图 + prompt实现** — GPTImage已支持urls参考图
3. **音频用Veo内置音频生成 + 预设音色提示词** — 不做语音克隆，用提示词强规则保持音色一致
4. **关键帧提取保留视觉信息** — 让AI真正"看到"原始视频

### 2.3 新架构（七步DAG管线）

```
Step 1: 视频输入（上传/URL/社交链接）
    │
    ▼
Step 2: 视频深度分析（关键帧提取 + Gemini多模态解析）
    │  输出: 关键帧图片[] + 结构化分镜[]
    │  🔑 关键改进: Gemini真正"看"视频，不再只传URL文本
    │
    ▼
Step 3: 用户定制（换装/换头/换背景/修改口播/选择音色）
    │  输入: 关键帧预览 + 结构化分镜
    │  输出: 定制后的分镜[] + 替换素材(参考图)[]
    │  🔑 关键改进: 定制信息真正传递到后续步骤
    │
    ▼
Step 4: 条件图片生成（GPTImage + 关键帧参考图 + 增强prompt）
    │  输入: 关键帧参考图 + 增强prompt(含构图/定制信息)
    │  输出: 1:1构图的新图片[]
    │  🔑 关键改进: 传参考图给GPTImage，不再"凭空想象"
    │
    ▼
Step 5: 图片后处理（换脸/换装/换背景 — 用GPTImage + 参考图重绘）
    │  输入: 生成图片 + 替换素材参考图 + 重绘prompt
    │  输出: 最终图片[]
    │  🔑 关键改进: 用参考图+prompt精确替换，不是靠文字描述
    │
    ▼
Step 6: 视频生成（Veo图生视频 + 音频生成 + 音色提示词）
    │  输入: 最终图片 + 摄像机运动 + 音色描述prompt
    │  输出: 带音频的分镜视频[]
    │  🔑 关键改进: 开启generate_audio + 音色提示词保持一致
    │
    ▼
Step 7: 合成导出（视频拼接 + 分辨率重编码）
    │  输入: 分镜视频[]
    │  输出: 最终成品视频
    │  🔑 关键改进: 异步任务 + 真正重编码
```

---

## 三、各步骤详细设计

### Step 2: 视频深度分析（核心升级）

#### 2.1 关键帧提取

```
原始视频 → ffmpeg每秒提取1帧 → SSIM智能去重(>0.95合并) → 关键帧[]
```

**实现方式**: 服务端FFmpeg命令

```bash
ffmpeg -i video.mp4 -vf fps=1 -q:v 2 frames/%04d.png
```

**SSIM去重**: 使用 `ffmpeg -i frame1.png -i frame2.png -lavfi ssim` 计算相邻帧相似度，>0.95则合并。

**预期输出**: 30秒视频 → 约15-25个关键帧

**关键帧上传S3**: 提取后上传到S3，生成签名URL供后续步骤使用。

#### 2.2 Gemini多模态解析（Fei-Fei Li 建议：必须传关键帧图片）

**当前**: 只传URL文本 → Gemini无法真正"看"视频
**升级**: 传关键帧图片(base64) + 结构化prompt

**使用系统默认文本API**（云雾API: Gemini 2.5 Pro），调用方式与当前一致，只是增加图片输入：

```json
{
  "contents": [{
    "parts": [
      { "text": "分析以下视频关键帧，按场景分段..." },
      { "inline_data": { "mime_type": "image/jpeg", "data": "base64关键帧1" } },
      { "inline_data": { "mime_type": "image/jpeg", "data": "base64关键帧2" } }
    ]
  }]
}
```

**分组策略**: 每次传5-10帧为一组（避免超出token限制），分组分析后合并结果。

#### 2.3 默认提示词模板（重写版）

> 管理员可在系统后台配置自定义提示词，此为默认模板。提示词必须使用 `{{videoUrl}}` 和 `{{videoDuration}}` 变量。

当前默认提示词过于简陋，无法生成高质量的结构化分镜。以下是基于 Veo 3 官方提示词指南 + Gemini 视频分析最佳实践重写的版本：

```
You are an expert video director and cinematographer. Analyze the following video keyframes and produce a detailed scene-by-scene breakdown optimized for AI-powered video recreation.

Video URL: {{videoUrl}}
Video Duration: {{videoDuration}}

## Your Task

Watch the keyframes carefully and break the video into scenes. Each scene should correspond to a distinct shot or significant visual change (NOT just narrative changes — every camera cut, angle shift, or major composition change is a new scene).

## Output Format

Return a JSON object with this exact structure:

```json
{
  "summary": "One-sentence video overview in the original language",
  "overallStyle": "Visual style description (cinematic, documentary, commercial, etc.)",
  "colorPalette": "Dominant colors (e.g., warm brown, cool blue, high contrast)",
  "scenes": [
    {
      "index": 0,
      "startTime": 0,
      "endTime": 2,
      "duration": 2,
      "shotType": "close_up | medium_shot | wide_shot | extreme_close_up | over_shoulder | bird_eye | low_angle",
      "cameraMovement": "static | push_in | pull_out | pan_left | pan_right | tilt_up | tilt_down | orbit | tracking | dolly",
      "cameraSpeed": "slow | medium | fast",
      "description": "Scene description in the original language",
      "visualPrompt": "DETAILED English prompt for image generation. Must include: shot type, subject description, subject position (left/center/right), background, lighting direction and quality, color tone, depth of field, mood/atmosphere. Example: 'Close-up shot of dark roasted coffee beans scattered on a weathered wooden table, centered composition, warm side lighting from the left creating soft shadows, shallow depth of field with blurred background, rich brown color palette, cozy and inviting atmosphere, cinematic quality'",
      "composition": {
        "subject": "Main subject in English",
        "subjectPosition": "left | center | right | foreground | background",
        "background": "Background description in English",
        "lighting": "Lighting description (direction, quality, color temperature)",
        "colorTone": "Dominant color description"
      },
      "character": {
        "present": true/false,
        "gender": "male | female | unknown",
        "ageRange": "estimated age range",
        "clothing": "clothing description in English",
        "pose": "body position and gesture description",
        "expression": "facial expression"
      },
      "speechText": "Exact spoken dialogue in the original language (empty string if none)",
      "audioPrompt": "Audio description following Veo 3 format. For dialogue: character description + emotion + quoted speech. For ambient: 'Audio: [description]'. Example: 'A woman in her 30s says softly, \"This coffee is amazing.\" Audio: gentle café ambiance, soft jazz in background, espresso machine hiss'",
      "backgroundMusic": "Music style description (e.g., Lo-fi Hip Hop, Orchestral, Acoustic Guitar)",
      "keyframeIndices": [0, 1, 2]
    }
  ]
}
```

## Critical Rules

1. **Scene Granularity**: Split scenes at EVERY camera cut, angle change, or significant visual change. A 30-second video should typically have 10-25 scenes, NOT 4-5.

2. **visualPrompt MUST be in English**: All visual prompts must be detailed English descriptions optimized for AI image generation. Include shot type, subject, composition, lighting, color, and mood.

3. **visualPrompt Must Be Specific**: Never use vague terms like "a scene" or "something happening". Always describe exactly what is visible: subject appearance, position, clothing, expression, background details, lighting direction, color temperature.

4. **audioPrompt Format for Veo 3**:
   - Dialogue: Use the format `A [age] [gender] says [emotion], "[exact dialogue]"` — the double quotes are MANDATORY for lip-sync
   - Ambient sounds: Use `Audio: [sound descriptions]`
   - Music: Use `Music: [style description]`
   - Combine all: `A woman in her 30s says warmly, "Good morning." Audio: birds chirping, gentle breeze. Music: soft acoustic guitar`

5. **speechText**: Extract the EXACT spoken words in the original language. If no speech, use empty string.

6. **Composition Details**: Every scene must have filled composition fields — subject, position, background, lighting, colorTone.

7. **Character Details**: If a person appears, describe their gender, estimated age, clothing, pose, and expression in detail.

8. **Camera Movement**: Identify the actual camera movement in the original video. If the camera is static, use "static".

9. **Time Accuracy**: Estimate start/end times based on the keyframe timestamps. Scenes should not overlap and should cover the full video duration.
```

**与当前默认提示词的关键差异**:

| 维度 | 当前默认 | 重写版 |
|------|---------|--------|
| 场景粒度 | "尽可能细分"（模糊） | "每个镜头切换就是一个场景，30秒视频10-25个" |
| visualPrompt语言 | 中文 | 英文（AI生图模型英文效果远好于中文） |
| visualPrompt详细度 | "画面视觉提示词" | 必须包含：shot type + subject + position + background + lighting + color + mood |
| 音频提示词 | "音频提示词"（无格式） | Veo 3官方格式：`A [age] [gender] says [emotion], "[dialogue]"` |
| 构图信息 | 无 | composition对象：subject/position/background/lighting/colorTone |
| 人物信息 | 无 | character对象：gender/age/clothing/pose/expression |
| 摄像机运动 | 无 | cameraMovement + cameraSpeed |
| 规则约束 | 无 | 9条Critical Rules，确保输出质量 |

#### 2.3 结构化分镜输出（升级）

```json
{
  "scenes": [
    {
      "index": 0,
      "startTime": 0,
      "endTime": 2,
      "duration": 2,
      "shotType": "close_up",
      "cameraMovement": "push_in",
      "cameraSpeed": "slow",
      "description": "咖啡豆特写",
      "visualPrompt": "Close-up shot of dark brown coffee beans on a wooden table, warm side lighting, shallow depth of field, cinematic composition",
      "composition": {
        "subject": "咖啡豆",
        "subjectPosition": "center",
        "background": "木纹桌面",
        "lighting": "暖色调侧光",
        "colorTone": "warm_brown"
      },
      "character": {
        "present": false
      },
      "speechText": "清晨的第一杯拿铁",
      "voiceStyle": "温柔女声",
      "backgroundMusic": "Lo-fi Hip Hop",
      "keyframeIndices": [0, 1, 2]
    }
  ]
}
```

### Step 3: 用户定制（核心新增功能）

#### 3.1 换角色（换头/换人）

- **来源1：从角色图库选择** — 复用已有的 `character_library` 表和 `CharacterLibraryDialog` 组件
  - 用户点击"换角色"→ 弹出角色图库选择器 → 选择1-5个角色
  - 角色图库已有完整的CRUD API（`/api/characters`）和前端组件（`CharacterLibraryDialog`）
  - 选中角色的 `url` 字段直接作为GPTImage的参考图
- **来源2：本地上传** — 上传目标人脸照片（1-5张）→ 上传到S3 → 存入 `video_remake_assets` 表
- 在Step 5中：将角色参考图 + 生成图片一起传给GPTImage，prompt描述"保持构图不变，将人物替换为参考图中的人，保持相同表情和角度"
- GPTImage的 `urls` 参数同时传入：[生成图片URL, 角色参考图URL]

#### 3.2 换装

- 用户上传替换服装图片 → 上传到S3 → 存入 `video_remake_assets` 表
- 在Step 5中：将服装参考图 + 生成图片一起传给GPTImage，prompt描述"保持构图不变，将人物服装替换为参考图中的服装"
- GPTImage的 `urls` 参数同时传入：[生成图片URL, 服装参考图URL]

#### 3.3 换背景

- 用户输入新背景描述或上传背景图
- 在Step 4中：在prompt中加入"将背景替换为[新背景描述]"
- 如果上传了背景参考图，在 `urls` 中传入背景图

#### 3.4 音色选择

- 预设音色模板供用户选择（见3.5）
- 选择的音色描述拼入视频生成prompt中

#### 3.5 预设音色模板（分男女）

> 基于 Veo 3 官方音频提示词指南重写。音色描述必须包含：性别、年龄段、音色特征、语速、情感基调。
> Veo 3 对话格式：`A [age] [gender] says [emotion], "[dialogue]"` — 引号是强制的。

```typescript
const VOICE_GENDERS = [
  { id: 'female', name: '女声' },
  { id: 'male', name: '男声' },
] as const;

const VOICE_PRESETS = [
  // ===== 女声 =====
  {
    id: 'warm_female',
    name: '温柔女声',
    gender: 'female',
    description: '温柔知性，25-30岁女性',
    frequency: '200-340Hz',
    promptFragment: 'A woman in her late 20s with a warm, gentle voice, speaking softly at a calm measured pace, mid-frequency range with slight breathiness, warm and nurturing tone'
  },
  {
    id: 'professional_female',
    name: '专业女声',
    gender: 'female',
    description: '干练自信，30-35岁女性',
    frequency: '220-380Hz',
    promptFragment: 'A woman in her early 30s with a clear, confident voice, speaking articulately at a steady professional pace, mid-to-high frequency range, crisp enunciation, authoritative yet approachable tone'
  },
  {
    id: 'young_female',
    name: '活力女声',
    gender: 'female',
    description: '青春活力，20-25岁女性',
    frequency: '260-440Hz',
    promptFragment: 'A young woman in her early 20s with a bright, energetic voice, speaking at a brisk enthusiastic pace, higher frequency range, bubbly and animated tone with natural inflection'
  },
  {
    id: 'mature_female',
    name: '知性女声',
    gender: 'female',
    description: '优雅沉稳，35-45岁女性',
    frequency: '180-300Hz',
    promptFragment: 'A woman in her 40s with a rich, resonant voice, speaking at a thoughtful deliberate pace, lower-mid frequency range with warm depth, elegant and composed tone conveying wisdom and experience'
  },
  // ===== 男声 =====
  {
    id: 'deep_male',
    name: '沉稳男声',
    gender: 'male',
    description: '低沉有力，30-40岁男性',
    frequency: '85-180Hz',
    promptFragment: 'A man in his 30s with a deep, resonant voice, speaking at a measured authoritative pace, low frequency range with chest resonance, steady and commanding tone that conveys confidence and reliability'
  },
  {
    id: 'warm_male',
    name: '温暖男声',
    gender: 'male',
    description: '温和亲切，25-35岁男性',
    frequency: '110-220Hz',
    promptFragment: 'A man in his late 20s with a warm, friendly voice, speaking at a relaxed conversational pace, mid-frequency range with natural warmth, approachable and genuine tone like talking to a close friend'
  },
  {
    id: 'young_male',
    name: '活力男声',
    gender: 'male',
    description: '阳光活力，20-25岁男性',
    frequency: '130-260Hz',
    promptFragment: 'A young man in his early 20s with a bright, energetic voice, speaking at a fast enthusiastic pace, mid-to-high frequency range, lively and animated tone with natural excitement and vigor'
  },
  {
    id: 'elderly_male',
    name: '沧桑男声',
    gender: 'male',
    description: '深沉沧桑，50-60岁男性',
    frequency: '75-160Hz',
    promptFragment: 'An older man in his 50s with a weathered, gravelly voice, speaking at a slow deliberate pace, low frequency range with slight raspiness, weighty and reflective tone carrying the gravity of lived experience'
  },
];
```

**前端展示**: 音色选择器分两列（女声 | 男声），每列4个选项，用户点击选择。

**音色一致性策略**: 
1. 同一项目的所有分镜使用同一个音色preset
2. 在视频生成prompt中，将 `promptFragment` 拼入对话描述，确保每个片段的音色描述完全一致
3. 拼接规则：将 `promptFragment` 替换 `A [age] [gender]` 部分，确保Veo 3每次生成时收到相同的音色参数

**Veo 3 音频prompt拼接示例**:
```
// 原始分镜speechText: "这款咖啡豆来自埃塞俄比亚"
// 选中音色: warm_female
// 拼接后的视频prompt:
"A woman in her late 20s with a warm, gentle voice, speaking softly at a calm measured pace, mid-frequency range with slight breathiness, warm and nurturing tone says warmly, '这款咖啡豆来自埃塞俄比亚.' Audio: gentle café ambiance. Music: soft Lo-fi Hip Hop"
```

#### 3.6 数据模型

```sql
ALTER TABLE video_remake_scenes ADD COLUMN customizations JSONB DEFAULT '{}';
-- customizations 结构:
-- {
--   "visualPrompt": "修改后的视觉提示词",
--   "speechText": "修改后的口播",
--   "voicePresetId": "warm_female",
--   "characterSwap": {
--     "enabled": true,
--     "source": "library",           -- "library"(角色图库) | "upload"(本地上传)
--     "libraryCharacterIds": ["char_id_1"],  -- 角色图库ID列表(source=library时)
--     "referenceAssetIds": ["asset_id_1"]    -- 上传素材ID列表(source=upload时)
--   },
--   "clothingSwap": { "enabled": true, "referenceAssetId": "asset_id_2" },
--   "backgroundSwap": { "enabled": true, "prompt": "海边沙滩", "referenceAssetId": null },
--   "cameraMovement": "push_in",
--   "cameraSpeed": "slow"
-- }
```

### Step 4: 条件图片生成（核心升级 — 使用系统默认生图模型）

#### 4.1 GPTImage + 关键帧参考图

**当前**: 纯文字prompt → GPTImage（`urls` 为空）→ 与原视频构图无关
**升级**: 增强prompt + 关键帧参考图 → GPTImage（`urls` 传入关键帧）→ 1:1构图

```
输入:
  - 关键帧参考图（保持构图一致性）← Step 2 提取的关键帧
  - 增强prompt（含构图描述 + 定制信息）← Step 3 定制后的prompt

输出:
  - 保持1:1构图的新图片
```

**GPTImage API调用**:

```typescript
const requestBody = {
  model: imageApi.model,           // 系统默认生图模型
  prompt: effectivePrompt,          // 增强后的prompt
  aspectRatio: scene.aspect_ratio || '9:16',
  urls: [keyframeUrl],             // 关键帧参考图（核心新增！）
};
```

#### 4.2 增强prompt构建（修复P4 + 提升复刻度）

**当前问题**: customizations编辑后，生成时仍用原始visual_prompt

**修复方案**:

```typescript
function buildEffectivePrompt(scene: Scene): string {
  const custom = scene.customizations || {};
  let prompt = custom.visualPrompt || scene.visual_prompt;

  if (custom.backgroundSwap?.enabled && !custom.visualPrompt) {
    prompt = `${scene.visual_prompt}, but with the background replaced by: ${custom.backgroundSwap.prompt}`;
  }

  return prompt;
}
```

#### 4.3 参考图选择策略

每个分镜从其关联的关键帧中选择**最接近的一帧**作为参考图：

```typescript
function selectKeyframeForScene(scene: Scene, keyframes: Keyframe[]): string {
  const midTime = (scene.startTime + scene.endTime) / 2;
  const closest = keyframes.reduce((prev, curr) =>
    Math.abs(curr.timestamp_ms / 1000 - midTime) < Math.abs(prev.timestamp_ms / 1000 - midTime)
      ? curr : prev
  );
  return closest.image_url;
}
```

### Step 5: 图片后处理（使用系统默认生图模型）

> 核心理念: 用GPTImage的参考图能力 + 精确prompt实现换角色/换装/换背景

#### 5.1 换角色（换头/换人）

```
生成图片 + 角色参考图 → GPTImage(urls=[生成图, 角色参考图]) + prompt → 换角色后图片
```

**参考图来源**:
- **角色图库**: 从 `character_library` 表读取角色的 `url` 字段
- **本地上传**: 从 `video_remake_assets` 表读取上传的素材URL

**prompt模板**:
```
Replace the person in the first image with the person from the second reference image. 
Keep the exact same composition, pose, lighting, and background. Only change the person's 
appearance to match the reference while maintaining the same expression, angle, and body position.
```

**GPTImage API调用**:

```typescript
async function getCharacterReferenceUrls(custom: Customizations): Promise<string[]> {
  if (custom.characterSwap?.source === 'library' && custom.characterSwap.libraryCharacterIds?.length) {
    const { data } = await supabase
      .from('character_library')
      .select('url')
      .in('id', custom.characterSwap.libraryCharacterIds);
    return data?.map(c => c.url).filter(Boolean) || [];
  }
  if (custom.characterSwap?.referenceAssetIds?.length) {
    return await getAssetUrls(custom.characterSwap.referenceAssetIds);
  }
  return [];
}
```

#### 5.2 换装

```
生成图片 + 服装参考图 → GPTImage(urls=[生成图, 服装参考图]) + prompt → 换装后图片
```

**prompt模板**:
```
Replace the clothing on the person in the first image with the clothing shown in the second 
reference image. Keep the exact same person, pose, background, and composition. Only change 
the clothing style to match the reference while maintaining the same body position and proportions.
```

#### 5.3 换背景

```
生成图片 + 背景参考图/描述 → GPTImage(urls=[生成图]) + prompt → 换背景后图片
```

**prompt模板**:
```
Keep the person and foreground elements exactly as they are in the image, but replace the 
background with [新背景描述]. Maintain the same lighting direction and color temperature 
to ensure the subject blends naturally with the new background.
```

#### 5.4 后处理流程控制

不是所有分镜都需要后处理，根据customizations决定：

```typescript
async function postProcessImage(scene: Scene, generatedImageUrl: string, imageApi: ApiConfig): Promise<string> {
  const custom = scene.customizations || {};
  let currentUrl = generatedImageUrl;

  if (custom.characterSwap?.enabled) {
    const charRefUrls = await getCharacterReferenceUrls(custom);
    if (charRefUrls.length > 0) {
      currentUrl = await callGptImage(imageApi, CHARACTER_SWAP_PROMPT, [currentUrl, ...charRefUrls]);
    }
  }

  if (custom.clothingSwap?.enabled) {
    const clothingRefUrl = await getAssetUrl(custom.clothingSwap.referenceAssetId);
    currentUrl = await callGptImage(imageApi, CLOTHING_SWAP_PROMPT, [currentUrl, clothingRefUrl]);
  }

  if (custom.backgroundSwap?.enabled) {
    const bgPrompt = buildBackgroundSwapPrompt(custom.backgroundSwap);
    const bgUrls = custom.backgroundSwap.referenceAssetId
      ? [currentUrl, await getAssetUrl(custom.backgroundSwap.referenceAssetId)]
      : [currentUrl];
    currentUrl = await callGptImage(imageApi, bgPrompt, bgUrls);
  }

  return currentUrl;
}
```

### Step 6: 视频生成（升级 — 使用系统默认视频模型）

**当前**: 图片 + prompt → Veo（无音频）
**升级**: 图片 + 增强prompt(含音色描述) → Veo（开音频 + 音色提示词）

```
输入:
  - 最终图片（Step 5输出）
  - 增强prompt（含摄像机运动 + 音色描述）
  - generate_audio: true

输出:
  - 带音频的分镜视频
```

#### 6.1 视频生成prompt增强

```typescript
function buildVideoPrompt(scene: Scene, voicePreset?: VoicePreset): string {
  const custom = scene.customizations || {};
  let prompt = custom.visualPrompt || scene.visual_prompt;

  if (custom.cameraMovement && custom.cameraMovement !== 'static') {
    const cameraMap: Record<string, string> = {
      push_in: 'camera slowly pushing in',
      pull_out: 'camera slowly pulling out',
      pan_left: 'camera panning to the left',
      pan_right: 'camera panning to the right',
      tilt_up: 'camera tilting upward',
      tilt_down: 'camera tilting downward',
      orbit: 'camera orbiting around the subject',
      tracking: 'camera tracking the subject',
      dolly: 'camera dollying alongside the subject',
    };
    prompt += `, ${cameraMap[custom.cameraMovement] || ''}`;
  }

  const speechText = custom.speechText || scene.speech_text;
  if (speechText && voicePreset) {
    prompt += `. ${voicePreset.promptFragment} says ${getEmotionFromStyle(voicePreset.id)}, "${speechText}"`;
  }

  if (scene.audio_prompt) {
    prompt += `. ${scene.audio_prompt}`;
  }

  return prompt;
}

function getEmotionFromStyle(presetId: string): string {
  const emotionMap: Record<string, string> = {
    warm_female: 'warmly',
    professional_female: 'confidently',
    young_female: 'enthusiastically',
    mature_female: 'thoughtfully',
    deep_male: 'authoritatively',
    warm_male: 'friendlily',
    young_male: 'excitedly',
    elderly_male: 'reflectively',
  };
  return emotionMap[presetId] || 'calmly';
}
```

#### 6.2 Veo API调用升级

```typescript
const requestBody = {
  model: videoApi.model,
  prompt: enhancedPrompt,
  images: [finalImageUrl],
  generate_audio: true,              // 核心新增！开启音频生成
  aspect_ratio: scene.aspect_ratio || '9:16',
  enhance_prompt: true,
};
```

### Step 7: 合成导出（Jan Ozer 建议：必须重编码）

**当前**: ffmpeg -c copy（不重编码，分辨率参数无效）
**升级**: ffmpeg重编码

```bash
# 拼接视频（重编码）
ffmpeg -f concat -safe 0 -i filelist.txt -c:v libx264 -preset medium -crf 23 -c:a aac concatenated.mp4

# 重编码到目标分辨率
ffmpeg -i concatenated.mp4 -vf scale=1920:1080 -c:v libx264 -preset medium -crf 23 -c:a copy final_output.mp4
```

**改为异步任务**: 合并操作放入task_queue，避免API超时。

---

## 四、数据库Schema变更

### 4.1 新增表

```sql
-- 关键帧表
CREATE TABLE video_remake_keyframes (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  image_key TEXT,
  image_url TEXT,
  ssim_score FLOAT,
  is_key_scene BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_keyframes_project ON video_remake_keyframes(project_id);

-- 替换素材表
CREATE TABLE video_remake_assets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) REFERENCES video_remake_projects(id) ON DELETE CASCADE,
  asset_type VARCHAR(32) NOT NULL, -- face_reference / clothing_reference / background_image
  file_key TEXT NOT NULL,
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_assets_project ON video_remake_assets(project_id);
CREATE INDEX idx_assets_user ON video_remake_assets(user_id);
```

### 4.2 修改表

```sql
-- 分镜表增加定制字段
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT '{}';
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS shot_type VARCHAR(32);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS camera_movement VARCHAR(32);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS camera_speed VARCHAR(16);
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS composition JSONB DEFAULT '{}';
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS character_info JSONB DEFAULT '{}';
ALTER TABLE video_remake_scenes ADD COLUMN IF NOT EXISTS keyframe_ids TEXT[];

-- 项目表增加字段
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS keyframes_extracted BOOLEAN DEFAULT false;
ALTER TABLE video_remake_projects ADD COLUMN IF NOT EXISTS voice_preset_id VARCHAR(32) DEFAULT 'warm_female';
```

---

## 五、API变更

### 5.1 新增API

| 路由 | 方法 | 功能 | 优先级 |
|------|------|------|--------|
| `/api/video-remake/extract-keyframes/[id]` | POST | 提取关键帧+上传S3 | P0 |
| `/api/video-remake/upload-asset` | POST | 上传替换素材（人脸/服装/背景图） | P0 |

### 5.2 修改API

| 路由 | 变更 | 优先级 |
|------|------|--------|
| `/api/video-remake/parse/[id]` | 升级为多模态解析（传关键帧图片base64） | P0 |
| `/api/video-remake/generate-images/[id]` | 传关键帧参考图 + 使用定制prompt | P0 |
| `/api/video-remake/generate-videos/[id]` | 开启generate_audio + 音色提示词 | P0 |
| `/api/video-remake/merge/[id]` | 改为异步任务 + 重编码 | P0 |

---

## 六、前端变更

### 6.1 新增组件

| 组件 | 功能 | 优先级 |
|------|------|--------|
| KeyframePreview | 关键帧预览（网格展示提取的关键帧） | P0 |
| CharacterSwapPanel | 换角色面板（从角色图库选择 / 本地上传 → 选择应用分镜） | P1 |
| ClothingSwapPanel | 换装面板（上传服装图 → 选择应用分镜） | P1 |
| VoicePresetSelector | 音色选择器（女声4种 / 男声4种，分两列展示） | P0 |
| CameraMotionSelector | 摄像机运动选择器 | P1 |

### 6.2 定制Tab升级

当前CustomizeTab只支持编辑文字，升级为：

```
定制Tab
├── 场景编辑（修改分镜描述/视觉prompt）          ← 已有，修复传递问题
├── 换角色（从角色图库选择 / 本地上传 → 应用到所有/指定分镜） ← 新增，复用CharacterLibraryDialog
├── 换装（上传服装 → 应用到指定分镜）              ← 新增
├── 换背景（输入新背景描述/上传背景图）            ← 新增
├── 音色选择（女声4种 / 男声4种，分两列展示）      ← 新增
└── 摄像机运动（为每个分镜选择运动类型和速度）      ← 新增
```

### 6.3 进度展示升级

当前5步进度条升级为7步：

```
[1.输入] → [2.分析] → [3.定制] → [4.生图] → [5.后处理] → [6.生视频] → [7.导出]
```

---

## 七、成本估算

### 7.1 单个项目处理成本（30秒视频，约20个分镜）

**全部使用系统默认模型，无新增外部API成本**

| 步骤 | API | 单价 | 数量 | 小计 |
|------|-----|------|------|------|
| 关键帧提取 | FFmpeg(本地) | ¥0 | 1次 | ¥0 |
| Gemini多模态解析 | 系统默认文本API | ¥0.05 | 1次 | ¥0.05 |
| 条件图片生成 | 系统默认图片API(GPTImage) | ¥0.35 | 20张 | ¥7.0 |
| 换脸(可选) | 系统默认图片API(GPTImage) | ¥0.35 | 10张 | ¥3.5 |
| 换装(可选) | 系统默认图片API(GPTImage) | ¥0.35 | 10张 | ¥3.5 |
| 视频生成(含音频) | 系统默认视频API(Veo 3.1) | ¥0.5 | 20段 | ¥10 |
| FFmpeg合并 | 本地 | ¥0 | 1次 | ¥0 |

**总计（不含换脸换装）**: ~¥17.05/项目
**总计（含换脸换装）**: ~¥24.05/项目

### 7.2 与当前方案对比

| 项目 | 当前成本 | 2.0成本 | 变化 |
|------|---------|---------|------|
| 基础复刻(无换脸换装) | ~¥10.5 | ~¥17.1 | +63%（增加了关键帧+音频） |
| 含换脸换装 | 不支持 | ~¥24.1 | 新功能 |
| 复刻相似度 | 40% | 80%+ | +100% |
| 视频含音频 | ❌ 静音 | ✅ | 新功能 |

---

## 八、实施路线图

### Phase 1: 修复致命问题（1周）— 立即可做

**目标**: 修复P1(Gemini不看视频) + P4(定制不传递) + P5(无音频) + P8(分辨率无效)

| 任务 | 文件 | 具体改动 |
|------|------|---------|
| 1.1 关键帧提取 | 新增 `extract-keyframes/[id]/route.ts` | FFmpeg提取帧+上传S3 |
| 1.2 Gemini多模态解析 | `parse/[id]/route.ts` | 传关键帧base64图片给Gemini |
| 1.3 定制prompt传递 | `generate-images/[id]/route.ts` | 使用customizations.visualPrompt |
| 1.4 传参考图给GPTImage | `generate-images/[id]/route.ts` | urls参数传入关键帧参考图 |
| 1.5 开启Veo音频 | `generate-videos/[id]/route.ts` | generate_audio: true |
| 1.6 音色提示词 | `generate-videos/[id]/route.ts` | 拼入voicePreset.promptFragment |
| 1.7 FFmpeg重编码 | `merge/[id]/route.ts` | 改用libx264重编码+异步任务 |

**影响范围**:
- 修改: `parse/[id]/route.ts`, `generate-images/[id]/route.ts`, `generate-videos/[id]/route.ts`, `merge/[id]/route.ts`
- 新增: `extract-keyframes/[id]/route.ts`, `src/lib/voice-presets.ts`
- 数据库: 新增 `video_remake_keyframes` 表, ALTER `video_remake_scenes` 加 `customizations` 列, ALTER `video_remake_projects` 加 `keyframes_extracted`, `voice_preset_id` 列

**风险**:
- Gemini传大量base64图片可能超token限制 → 分组传5-10帧
- FFmpeg重编码耗时增加 → 改为异步任务
- GPTImage参考图效果需验证 → 先用简单场景测试

### Phase 2: 换脸换装换背景（1-2周）

**目标**: 实现换脸、换装、换背景功能（用系统默认生图模型）

| 任务 | 文件 | 具体改动 |
|------|------|---------|
| 2.1 素材上传 | 新增 `upload-asset/route.ts` | 上传服装/背景图到S3 |
| 2.2 换角色后处理 | `generate-images/[id]/route.ts` 或任务处理器 | GPTImage + 角色参考图(图库/上传) |
| 2.3 换装后处理 | 同上 | GPTImage + 服装参考图 |
| 2.4 换背景后处理 | 同上 | GPTImage + 背景描述/参考图 |
| 2.5 前端面板 | 新增 `CharacterSwapPanel`(含CharacterLibraryDialog), `ClothingSwapPanel` | 定制Tab新增子面板 |

**影响范围**:
- 新增: 1个API路由, 2个前端组件
- 修改: 定制Tab组件, 图片生成流程
- 数据库: 新增 `video_remake_assets` 表

**风险**:
- GPTImage换角色效果可能不如专用模型 → 提供多次生成选项
- 换脸法律合规 → 添加水印+免责声明+用户协议

### Phase 3: 体验优化（1周）

**目标**: 提升用户体验和系统稳定性

| 任务 | 文件 | 具体改动 |
|------|------|---------|
| 3.1 SSE实时推送 | 前端轮询改为SSE订阅 | 替换setInterval为EventSource |
| 3.2 断点续传 | 任务失败批量重试 | task_queue增加重试逻辑 |
| 3.3 社交平台解析 | `link/route.ts` | 接入真实解析API（替换假数据） |
| 3.4 上传API整合 | 合并3种上传方式 | 统一为分片上传 |
| 3.5 大文件OOM修复 | `chunk-complete`, `merge` | 流式处理替代Buffer.concat |
| 3.6 状态机统一 | `generate-images` + `generate-videos` | 统一status字段命名 |

---

## 九、风险与依赖

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| GPTImage参考图换脸效果不稳定 | 换脸质量不理想 | 中 | 提供多次生成选项，后续版本可接入专用模型 |
| Veo音频质量不稳定 | 音频效果不理想 | 低 | Veo 3.1音频质量较好，可调prompt优化 |
| 换脸法律合规 | 产品风险 | 高 | 添加水印+免责声明+用户协议+实名认证 |
| 关键帧提取性能 | 处理时间增加 | 中 | 并行处理，SSIM去重减少帧数 |
| FFmpeg服务器依赖 | 合并功能受限 | 中 | 考虑云端视频处理API |
| Gemini token限制 | 大视频解析不完整 | 中 | 分组传帧(5-10帧/组) |
| 音色跨片段一致性 | 各片段音色可能不同 | 中 | 强规则提示词(年龄/频率/音色描述) |

---

## 十、成功指标

| 指标 | 当前 | Phase 1后 | Phase 2后 | 最终目标 |
|------|------|----------|----------|---------|
| 复刻相似度 | ⭐⭐ (40%) | ⭐⭐⭐⭐ (75%) | ⭐⭐⭐⭐ (80%) | ⭐⭐⭐⭐⭐ (90%+) |
| 支持换装 | ❌ | ❌ | ✅ | ✅ |
| 支持换头 | ❌ | ❌ | ✅ | ✅ |
| 支持换背景 | ❌ | ❌ | ✅ | ✅ |
| 视频含音频 | ❌ 静音 | ✅ | ✅ | ✅ |
| 分镜粒度 | 4个/30秒 | 15-25个/30秒 | 15-25个/30秒 | 15-25个/30秒 |
| 定制生效 | ❌ 编辑不传递 | ✅ | ✅ | ✅ |
| 合并可靠性 | 依赖本地ffmpeg | 异步任务 | 异步任务 | 异步任务 |
| 分辨率选择 | ❌ 无效 | ✅ 重编码 | ✅ 重编码 | ✅ 重编码 |
| 音色一致性 | N/A | ✅ 提示词强规则 | ✅ | ✅ |

---

## 十一、技术选型总结

**全部使用系统配置的默认模型，零新增外部API依赖**

| 功能 | 使用模型 | 调用方式 | 关键参数 |
|------|---------|---------|---------|
| 关键帧提取 | FFmpeg(本地) | 命令行 | `fps=1` + SSIM去重 |
| 视频解析 | 系统默认文本API(Gemini) | 多模态(base64图片) | `inline_data` |
| 条件图片生成 | 系统默认图片API(GPTImage) | `urls`参考图 | `urls=[关键帧URL]` |
| 换角色 | 系统默认图片API(GPTImage) | `urls`参考图 | `urls=[生成图, 角色参考图]`（图库/上传） |
| 换装 | 系统默认图片API(GPTImage) | `urls`参考图 | `urls=[生成图, 服装参考图]` |
| 换背景 | 系统默认图片API(GPTImage) | `urls`参考图 | `urls=[生成图, 背景参考图]` |
| 视频生成(含音频) | 系统默认视频API(Veo 3.1) | `generate_audio:true` | 音色提示词 |
| 视频合并 | FFmpeg(本地) | 命令行 | `libx264`重编码 |

---

## 十二、下一版本规划（v2.1）

| 功能 | 说明 |
|------|------|
| 语音克隆 | CosyVoice 3零样本克隆，10-20秒语音样本即可 |
| BGM生成 | Suno API生成背景音乐 |
| 专用换脸模型 | InstantID/FaceFusion，提升换脸精度 |
| ControlNet条件生成 | 深度图/姿态图条件生成，进一步提升复刻度 |
| 社交平台真实解析 | 接入第三方解析API |
