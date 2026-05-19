// 模板库管理工具
// AI生成的模板会自动保存到模板库（对象存储），支持跨设备同步

// 内部认证 fetch 辅助函数
async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('auth_token') 
    : null;
  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // 只有当 body 存在且不是 FormData 时才设置 Content-Type
  // FormData 需要浏览器自动设置 multipart/form-data 边界
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

// 模板段落数据结构
export interface TemplateSegment {
  id: string;
  order: number;
  duration: number;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
  hookType?: string;
  sellingPoint?: string;
}

// 模板提示词数据结构（用于生成视频脚本）
export interface TemplatePrompt {
  productInfo: string;
  productCategory: string;
  targetAudience: string;
  sellingPoints: string;
  hookType: string;
  hookTypeName: string;
  hookDescription?: string;
  hookTemplate?: string;
  duration: number;
  useCreator: boolean;
  creatorGender?: 'female' | 'male' | 'any';
  creatorAge?: string; // 达人年龄范围
  enableNarration?: boolean; // 是否启用口播
  createdAt: number;
}

// 模板数据结构
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;         // 产品类别
  duration: number;         // 视频时长
  hookType: string;         // 钩子类型
  hookTypeName?: string;    // 钩子类型名称
  targetAudience: string;   // 目标受众
  useCreator: boolean;      // 是否达人出境
  creatorGender?: 'female' | 'male' | 'any'; // 达人性别
  creatorAge?: string; // 达人年龄范围
  enableNarration?: boolean; // 是否启用口播
  segments: TemplateSegment[];
  templatePrompt?: TemplatePrompt; // 模板提示词数据
  productId?: string;       // 关联的产品ID
  productName?: string;     // 产品名称
  productInfo?: string;     // 原始产品信息
  sellingPoints?: string;   // 核心卖点
  productImages?: Array<{ key: string; url: string }>; // 产品图片（key + url）
  finalPrompt?: string;     // 最终生成提示词（发送给AI的完整提示词）
  createdAt: number;
  updatedAt: number;
  usageCount: number;       // 使用次数
}

// 从签名 URL 中提取 key
function extractKeyFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return url;
  }
}

// 获取当前用户 ID（从 token 或 localStorage）
function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // 尝试从 localStorage 获取用户信息
  try {
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      return user.id || null;
    }
  } catch {
    // ignore
  }
  
  return null;
}

// 获取用户专属的缓存 key
function getCacheKey(): string {
  const userId = getCurrentUserId();
  const baseKey = 'ai_template_library_cache';
  return userId ? `${baseKey}_${userId}` : baseKey;
}

// 旧版缓存 key（用于清理）
const LEGACY_CACHE_KEY = 'ai_template_library_cache';
const MAX_TEMPLATES = 50;

// 钩子类型定义（用于生成最终提示词）
const HOOK_TYPES = [
  { 
    value: 'pain_point', 
    label: '痛点暴击', 
    description: '直接戳中用户痛点，制造"这说的就是我"的共鸣感',
    template: '你是不是也{具体痛点}？',
  },
  { 
    value: 'curiosity', 
    label: '好奇心钩子', 
    description: '制造信息差和好奇心，引发探索欲望',
    template: '你绝对猜不到...',
  },
  { 
    value: 'contrast', 
    label: '对比反差', 
    description: '用强烈的前后对比制造视觉冲击',
    template: '左边 vs 右边',
  },
  { 
    value: 'social_proof', 
    label: '社会认同', 
    description: '利用权威背书或用户评价增强可信度',
    template: 'XX%的人都选择了...',
  },
  { 
    value: 'story', 
    label: '故事开场', 
    description: '用简短故事引发情感共鸣',
    template: '我以前也...',
  },
  { 
    value: 'challenge', 
    label: '挑战引发', 
    description: '抛出挑战激发参与感',
    template: '你敢挑战吗？',
  },
  { 
    value: 'promise', 
    label: '承诺收益', 
    description: '直接承诺具体收益吸引注意力',
    template: '{时间}内，{达成了什么结果}',
  },
  { 
    value: 'question', 
    label: '提问互动', 
    description: '用问题引发思考和互动',
    template: '你知道为什么吗？',
  },
  { 
    value: 'emotion', 
    label: '情感共鸣', 
    description: '触发情感共鸣建立连接',
    template: '每个{人群}都懂...',
  },
  { 
    value: 'shock', 
    label: '震撼开场', 
    description: '用震撼内容抓住注意力',
    template: '这简直太...',
  },
];

// 产品类别定义
const PRODUCT_CATEGORIES: Record<string, string> = {
  beauty: '美妆护肤',
  food: '食品饮料',
  digital: '数码电子',
  clothing: '服装服饰',
  home: '家居生活',
  other: '其他产品',
};

// 生成最终提示词
export function generateFinalPrompt(params: {
  productInfo: string;
  productCategory: string;
  targetAudience: string;
  sellingPoints: string;
  hookType: string;
  hookTypeName?: string;
  hookDescription?: string;
  hookTemplate?: string;
  duration: number;
  useCreator: boolean;
  creatorGender?: 'female' | 'male' | 'any';
  creatorAge?: string;
  enableNarration?: boolean; // 是否启用口播
}): string {
  const {
    productInfo,
    productCategory,
    targetAudience,
    sellingPoints,
    hookType,
    hookTypeName,
    hookDescription,
    hookTemplate,
    duration,
    useCreator,
    creatorGender,
    creatorAge,
    enableNarration = true,
  } = params;

  // 计算片段数量：8秒2段落，16秒3段落，24秒4段落
  // 段落数 = 时长/8 + 1，视频数 = 段落数 - 1
  const imageSegmentCount = duration / 8 + 1;
  const videoSegmentCount = imageSegmentCount - 1;

  // 口播内容方向（根据钩子类型）
  const narrationGuide = getNarrationGuide(hookType, hookTypeName);

  // 年龄显示文本
  const ageDisplay = creatorAge || '25-35岁';

  // 系统提示词
  const systemPrompt = `你是一位专业的短视频脚本策划专家，精通TikTok、抖音、小红书等平台的爆款带货短视频创作方法论。

## 核心：黄金3秒钩子法则

开场3秒决定视频生死，必须用强力钩子抓住注意力。

## 达人${useCreator ? '出境' : '展示'}模式

${useCreator ? `**本视频需要达人出境**

### 达人形象要求
- 性别：${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : '不限'}
- 年龄：${ageDisplay}
- 风格：符合产品调性

### 图片提示词中必须包含
- 达人形象描述（外貌、穿着、发型）
- 表情和眼神（自信、亲切、惊讶、满意等）
- 达人与产品的互动方式

### 视频提示词三要素要求
每个视频提示词必须包含：
1. **【人物动作】**：达人的动作变化（根据具体产品设计）、手势和表情的自然过渡
2. **【分镜设计】**：镜头运动与达人配合（推拉摇跟）、景别变化、视角切换
3. **【口播内容】**${enableNarration ? '：达人口播台词，与钩子类型和画面配合' : '（可选）：如需要可添加口播内容'}
${enableNarration ? `
### 口播内容方向
${narrationGuide}
` : ''}` : `**本视频以产品为主体，不展示达人形象**

### 产品展示要求
1. 开场段落：产品特写或使用场景
2. 产品展示段落：产品细节、使用效果、场景应用
3. 视觉效果：强调光影、质感、构图的专业性
4. 动态展示：产品旋转、开盖、使用过程等
`}

## 输出要求

生成 ${imageSegmentCount} 个图片段落，用于生成 ${videoSegmentCount} 个视频片段（从段落2开始）：

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
- 分镜要与口播内容配合：口播重点内容时镜头要聚焦达人表情，展示产品功能时镜头要对准产品
- 每个视频的焦点切换方式必须不同，禁止重复使用相同的切换模式

### 3. 口播内容${enableNarration && useCreator ? '（必填）' : '（可选）'}
${enableNarration && useCreator ? `达人在视频中要说的台词，要求：
- 与钩子类型强相关，延续开场风格
- 与画面内容配合，随动作自然说出
- 口语化表达，亲切自然
- 突出产品卖点，引导用户行动
- 使用【口播】标记口播内容` : '如果需要，可添加口播内容，使用【口播】标记'}

### 视频提示词示例格式（仅供参考，请勿照搬）：

**注意：以下示例仅供参考格式，你创作时必须根据产品特性、钩子类型、场景设计独特的分镜，禁止照搬示例内容！**

\`\`\`
【人物动作】（示例）达人拿起产品，右手握住产品瓶身，左手轻轻按压泵头，挤出适量产品在掌心，然后将产品均匀涂抹在脸颊，轻轻拍打促进吸收，表情满意地点头微笑。

【分镜设计】（示例-仅供参考，请自由发挥）镜头从达人面部特写开始（景别：特写），缓慢拉远展示达人整体姿态（景别：中景），然后镜头向产品推进聚焦产品细节（景别：特写），最后切回达人面部展示满意表情（景别：近景）。${enableNarration && useCreator ? `

【口播】（示例）这款精华真的太惊艳了！轻轻一按就能挤出这么细腻的质地，上脸吸收超快，用了一周皮肤明显亮了很多！` : ''}
\`\`\`

**再次强调**：以上示例仅展示格式，你的分镜设计必须：
1. 根据产品特性选择合适的景别组合
2. 根据钩子类型设计有冲击力的镜头语言
3. 根据场景设计独特的视角和运动轨迹
4. 每个视频的分镜都要有创意，不要重复使用固定的分镜模式

## 首图场景要求（段落1，前3秒）

**首图是黄金3秒的关键，必须精心设计场景以配合钩子类型的表达。**

### 场景设计原则
1. 场景要与钩子类型强匹配，形成视觉与内容的一致性
2. 场景要能快速建立产品使用情境，让观众产生代入感
3. 场景要有辨识度，避免千篇一律的白底或纯色背景
4. 场景要真实可信，符合目标受众的生活环境

### 场景自由发挥要求
请根据以下要素，自由发挥设计首图场景：
- 钩子类型的特点（如：痛点暴击需要问题场景，对比反差需要对比环境）
- 产品类别的典型使用场景（如：美妆产品适合化妆间、食品产品适合厨房/餐厅）
- 目标受众的生活场景（如：年轻白领适合办公室/公寓，宝妈适合家庭环境）
- 达人形象与场景的协调性（如：职业装达人适合办公场景，休闲装达人适合居家场景）

**注意**：不要使用通用模板场景，要结合产品特性和钩子类型，设计有独特记忆点的场景。

## 格式要求
- 必须以JSON数组格式输出
- 所有内容使用中文
- 段落1的videoPrompt必须为空字符串""
- 图片提示词要详细、具体，适合AI生图
- 视频提示词必须包含【人物动作】、【分镜设计】${enableNarration && useCreator ? '、【口播】' : ''}三要素`;

  // 用户消息 - 明确输出当前配置
  const userMessage = `请为以下产品创作一个${duration}秒的爆款带货短视频脚本模板：

============================================
## 当前配置
============================================

**钩子类型**：${hookTypeName || hookType}
**达人出境**：${useCreator ? '是' : '否'}
${useCreator ? `**达人性别**：${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : '不限'}` : ''}
${useCreator ? `**启用口播**：${enableNarration ? '是' : '否'}` : ''}

============================================
## 产品信息
============================================

${productInfo}

**产品类别**：${productCategory}
**目标受众**：${targetAudience ? (targetAudience.includes('岁') ? targetAudience : `${targetAudience}岁`) : '25-35岁'}
**核心卖点**：${sellingPoints || '品质优良、性价比高、使用方便'}

============================================
## 钩子类型说明（请基于此类型自由发挥）
============================================

**当前选择：${hookTypeName || hookType}钩子**

${hookDescription ? `**钩子描述**：${hookDescription}` : ''}
${hookTemplate ? `**参考话术模板**：${hookTemplate}` : ''}

**创作要求**：
请基于【${hookTypeName || hookType}钩子】的核心特点，结合产品特性和目标受众，自由发挥创作开场白。不要生搬硬套模板，要自然融入产品卖点，形成有感染力的开场。

============================================
## 首图场景要求（请自由发挥场景设计）
============================================

首图是黄金3秒的关键，场景设计直接影响观众的停留意愿。

**首图场景设计要点**：
1. 根据钩子类型特点设计匹配的场景环境
2. 结合产品类别选择典型使用场景
3. 考虑目标受众的生活环境和审美偏好
4. 场景要有辨识度，避免通用模板场景

**请自由发挥**：根据产品【${productCategory}】和钩子【${hookTypeName || hookType}】，设计一个独特、有代入感的首图场景。场景描述要具体到：光线（自然光/灯光）、背景（具体环境）、道具（相关物品）、氛围（温馨/专业/时尚等）。

============================================
## 视频提示词三要素要求（必填！）
============================================

**每个视频提示词（videoPrompt）必须包含以下三要素：**

### 1. 【人物动作】
描述达人的具体动作，包括肢体动作、手势变化、表情变化、眼神方向等。

### 2. 【分镜设计】
描述镜头运动和画面切换，包括景别变化（特写/近景/中景/全景）、镜头运动（推/拉/摇/跟）、视角选择、焦点切换等。

**重要：分镜设计必须多样化，禁止套用固定模板！**
- 每个视频的分镜都要根据产品特性、钩子类型、场景设计独特的镜头语言
- 不同段落的分镜风格应有所变化：开场要有冲击力，中间要有节奏感，结尾要有感染力
- 鼓励创新：可以尝试快切、慢镜头、延时、俯拍、仰拍、环绕等多样化镜头
- 禁止每次都使用相同的分镜模式
- 焦点切换方式必须多样化：可从达人切换到产品、从产品切换到背景、从细节切换到全景、从手部动作切换到面部表情等，每个视频都要有独特的焦点切换设计

### 3. 【口播内容】${enableNarration && useCreator ? '（必须包含）' : '（可选）'}
${enableNarration && useCreator ? `达人要说的台词，要与钩子类型、画面内容配合，口语化表达，突出产品卖点。` : '如需要，可添加口播内容。'}

**示例格式（仅供参考，请勿照搬，必须自由发挥设计独特的分镜）**：
\`\`\`
【人物动作】达人拿起产品，右手握住瓶身，左手按压泵头，将产品均匀涂抹在脸颊，轻轻拍打，表情满意地点头微笑。

【分镜设计】（示例仅供参考）镜头从面部特写开始，缓慢拉远展示整体姿态，然后推进聚焦产品细节，最后切回面部展示满意表情。${enableNarration && useCreator ? `

【口播】这款精华真的太惊艳了！上脸吸收超快，用了一周皮肤明显亮了很多！` : ''}
\`\`\`

**再次强调**：请根据产品特性和钩子类型，自由发挥设计独特的分镜，不要重复使用示例中的固定模式！

============================================
## 其他要求
============================================

1. 第一个段落（前3秒）必须使用【${hookTypeName || hookType}钩子】开场
2. 第一个段落的hookType字段必须填写"${hookTypeName || hookType}钩子"
3. 中间段落展示产品卖点和使用场景，每5-8秒切换信息点
4. 最后一个段落包含明确的行动号召和紧迫感
5. 生成 ${imageSegmentCount} 个图片段落
6. 段落1的videoPrompt必须为空字符串""
7. 段落2及以后的videoPrompt必须包含【人物动作】、【分镜设计】${enableNarration && useCreator ? '、【口播】' : ''}三要素
8. 图片和视频提示词要高度相关，视频是图片的动态延续
9. **分镜设计多样化**：每个视频的分镜都要独特，禁止重复使用固定的分镜模式，要根据产品特性、钩子类型、场景设计有创意的镜头语言
${useCreator ? `10. 达人出境要求：每个段落的图片提示词必须包含达人形象描述
11. 达人形象要统一，年龄约25-35岁，穿着风格符合产品调性` : `10. 产品展示模式：以产品为主体，不出现人物，重点展示产品质感和细节`}`;

  return systemPrompt + '\n\n' + userMessage;
}

// 根据钩子类型获取口播内容方向
export function getNarrationGuide(hookType: string, hookTypeName?: string): string {
  const guides: Record<string, string> = {
    pain_point: `【痛点暴击型口播】
- 开场直击痛点："你是不是也每天为XXX烦恼？"
- 共情引导："我之前也是这样，直到发现了这个产品..."
- 解决方案："用了一个月，问题彻底解决了！"
- 行动号召："别再犹豫了，早点用上早点解脱！"`,

    subversion: `【颠覆认知型口播】
- 反常开场："别再用XXX了，90%的人都不知道..."
- 制造悬念："医生说这招更管用，为什么你不早知道？"
- 揭秘引导："今天就告诉你这个行业的秘密..."
- 惊喜转化："看完这个视频，你会感谢我告诉了你！"`,

    result_first: `【结果前置型口播】
- 直接展示结果："30天，我从XXX变成了XXX"
- 对比呈现："看看使用前后的差别，简直判若两人"
- 强化效果："只用了一个产品，效果竟然这么好"
- 行动号召："你也想要这样的改变吗？赶紧试试！"`,

    suspense: `【悬念提问型口播】
- 反常提问："为什么有些人不XXX，却比XXX还要好？"
- 制造好奇："你绝对猜不到，秘诀竟然是..."
- 揭秘过程："经过我的研究发现，关键在于这个产品"
- 满足期待："看完你就明白了，太神奇了！"`,

    identity: `【身份宣称型口播】
- 锁定人群："所有XXX注意！这可能是你今年最有价值的视频！"
- 制造归属："刷到这条视频的XXX恭喜你，你找到了！"
- 共情引导："作为XXX，我太理解你的困扰了..."
- 专属福利："这款产品就是为我们XXX量身定制的！"`,

    data_shock: `【数据冲击型口播】
- 数据开场："调查显示：90%的人都用错了XXX，难怪无效！"
- 权威背书："根据专业机构测试，正确方法是..."
- 效果量化："使用这个产品后，效率提升了80%"
- 专业推荐："数据不会骗人，聪明的选择不言而喻"`,

    contrast: `【对比反差型口播】
- 对比开场："左边是普通产品，右边是这个产品，差别太大了！"
- 效果对比："用之前VS用之后，简直是天壤之别"
- 性价比对比："同样的价格，效果却好十倍"
- 选择引导："聪明的你，知道该怎么选了吧？"`,

    scarcity: `【优惠稀缺型口播】
- 紧迫开场："库存只剩200单，这个价格错过再等一年！"
- 稀缺强调："限量发售，手慢无！"
- 损失厌恶："不买真的会后悔，这个优惠太罕见"
- 行动刺激："点击下方链接，现在下单还来得及！"`,

    highlight: `【高能片段型口播】
- 惊喜开场："天啊！这个效果真的太震撼了！"
- 夸张展示："我都不敢相信自己的眼睛，怎么会这么厉害？"
- 情绪共鸣："当时我就惊呆了，必须分享给大家！"
- 紧迫收尾："这种好东西真的不多见，手慢无！"`,

    social_currency: `【社交货币型口播】
- 秘密开场："柜姐不会告诉你的护肤秘密，今天全公开！"
- 内行专属："内行人才知道的技巧，一般人我不告诉TA"
- 独家优势："只有小众圈子才知道这个好产品"
- 优越感制造："看完这个视频，你就比90%的人都懂了！"`
  };

  return guides[hookType] || guides.pain_point;
}

// 本地缓存
let localCache: Template[] | null = null;

// 检查是否在客户端环境
function isClient(): boolean {
  return typeof window !== 'undefined';
}

// 清理旧版缓存（不带用户 ID 的缓存）
function clearLegacyCache(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // ignore
  }
}

// 从API获取所有模板
export async function getTemplates(): Promise<Template[]> {
  // 服务端渲染时，直接返回空数组或本地缓存
  if (!isClient()) {
    return localCache || [];
  }
  
  // 清理旧版缓存
  clearLegacyCache();
  
  const cacheKey = getCacheKey();
  
  // 先尝试从本地缓存读取（快速响应）
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        localCache = parsed;
      }
    }
  } catch {
    // ignore
  }
  
  try {
    const response = await authFetch('/api/template-library');
    
    // 检查响应是否为 JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('[TemplateLibrary] API returned non-JSON, using local cache');
      return localCache || [];
    }
    
    const data = await response.json();
    
    if (data.success && Array.isArray(data.templates)) {
      // 如果 API 返回的数据为空，但本地缓存有数据，保留本地数据
      if (data.templates.length === 0 && localCache && localCache.length > 0) {
        console.log('[TemplateLibrary] API returned empty, keeping local cache:', localCache.length, 'templates');
        return localCache;
      }
      
      localCache = data.templates;
      // 更新本地缓存
      localStorage.setItem(cacheKey, JSON.stringify(data.templates));
      return data.templates;
    }
    
    return localCache || [];
  } catch (error) {
    console.error('[TemplateLibrary] Failed to fetch templates:', error);
    // 返回本地缓存
    return localCache || [];
  }
}

// 同步获取本地缓存（用于快速渲染）
export function getTemplatesLocal(): Template[] {
  if (localCache) return localCache;
  
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        localCache = JSON.parse(cached);
        return localCache || [];
      }
    } catch {
      // ignore
    }
  }
  
  return [];
}

// 获取单个模板
export async function getTemplate(id: string): Promise<Template | null> {
  const templates = await getTemplates();
  return templates.find(t => t.id === id) || null;
}

// 保存模板到服务器
async function saveTemplatesToServer(templates: Template[]): Promise<boolean> {
  // 先更新本地缓存（确保数据不丢失）
  localCache = templates;
  if (isClient()) {
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(templates));
      console.log('[TemplateLibrary] Saved to localStorage:', templates.length, 'templates');
    } catch (e) {
      console.error('[TemplateLibrary] Failed to save to localStorage:', e);
    }
  }
  
  // 服务端渲染时，无法保存到远程
  if (!isClient()) {
    return false;
  }
  
  try {
    const response = await authFetch('/api/template-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    });
    
    // 检查响应是否为 JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('[TemplateLibrary] API returned non-JSON response');
      return false;
    }
    
    const data = await response.json();
    
    return data.success === true;
  } catch (error) {
    console.error('[TemplateLibrary] Failed to save templates to server:', error);
    return false;
  }
}

// 保存模板
export async function saveTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<Template> {
  console.log('[TemplateLibrary] saveTemplate called');
  console.log('[TemplateLibrary] Template hookType:', template.hookType);
  console.log('[TemplateLibrary] Template hookTypeName:', template.hookTypeName);
  
  const templates = await getTemplates();
  const now = Date.now();
  
  const newTemplate: Template = {
    ...template,
    id: `tpl-${now}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  
  // 添加到列表开头
  templates.unshift(newTemplate);
  
  // 限制数量
  if (templates.length > MAX_TEMPLATES) {
    templates.splice(MAX_TEMPLATES);
  }
  
  // 保存到服务器
  await saveTemplatesToServer(templates);
  
  console.log('[TemplateLibrary] Saved template:', newTemplate.id, newTemplate.name);
  
  return newTemplate;
}

// 更新模板
export async function updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'createdAt'>>): Promise<Template | null> {
  try {
    // 先获取当前模板数据
    const templates = await getTemplates();
    const existingTemplate = templates.find(t => t.id === id);
    
    if (!existingTemplate) return null;
    
    const updatedTemplate = {
      ...existingTemplate,
      ...updates,
      updatedAt: Date.now(),
    };
    
    const response = await authFetch('/api/template-library', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTemplate),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新本地缓存
      if (localCache) {
        const index = localCache.findIndex(t => t.id === id);
        if (index !== -1) {
          localCache[index] = updatedTemplate;
        }
      }
      console.log('[TemplateLibrary] Updated template:', id);
      return updatedTemplate;
    }
    
    return null;
  } catch (error) {
    console.error('[TemplateLibrary] Failed to update template:', error);
    return null;
  }
}

// 删除模板
export async function deleteTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  // 直接调用 DELETE API
  try {
    const response = await authFetch(`/api/template-library?id=${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新本地缓存
      if (localCache) {
        localCache = localCache.filter(t => t.id !== id);
      }
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = getCacheKey();
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const templates = JSON.parse(cached);
            localStorage.setItem(cacheKey, JSON.stringify(templates.filter((t: Template) => t.id !== id)));
          }
        } catch {
          // ignore
        }
      }
      console.log('[TemplateLibrary] Deleted template:', id);
      return { success: true };
    }
    
    return { success: false, error: data.error || '删除失败' };
  } catch (error) {
    console.error('[TemplateLibrary] Failed to delete template:', error);
    return { success: false, error: '删除失败，请重试' };
  }
}

// 增加使用次数
export async function incrementTemplateUsage(id: string): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index !== -1) {
    templates[index].usageCount++;
    templates[index].updatedAt = Date.now();
    await saveTemplatesToServer(templates);
  }
}

// 搜索模板
export async function searchTemplates(query: string): Promise<Template[]> {
  const templates = await getTemplates();
  const lowerQuery = query.toLowerCase();
  
  return templates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.productInfo?.toLowerCase().includes(lowerQuery) ||
    t.category.toLowerCase().includes(lowerQuery)
  );
}

// 按类别筛选
export async function getTemplatesByCategory(category: string): Promise<Template[]> {
  const templates = await getTemplates();
  if (!category || category === 'all') return templates;
  return templates.filter(t => t.category === category);
}

// 更新关联产品的模板（当产品信息变更时调用）
export async function updateTemplatesByProductId(
  productId: string,
  productData: {
    name: string;
    description: string;
    sellingPoints?: string[];
    images?: Array<{ key?: string; url: string }>;
  }
): Promise<number> {
  const templates = await getTemplates();
  let updatedCount = 0;
  
  // 提取产品图片（转换为 { key, url } 格式）
  const productImages = productData.images?.map(img => ({
    key: img.key || extractKeyFromUrl(img.url) || img.url,
    url: img.url,
  })) || [];
  
  // 构建产品信息文本
  const productInfo = [
    productData.description,
    productData.sellingPoints && productData.sellingPoints.length > 0 
      ? `卖点：${productData.sellingPoints.join('、')}` 
      : '',
  ].filter(Boolean).join('\n');
  
  for (let i = 0; i < templates.length; i++) {
    if (templates[i].productId === productId) {
      templates[i] = {
        ...templates[i],
        productName: productData.name,
        productInfo: productInfo,
        productImages: productImages,
        sellingPoints: productData.sellingPoints?.join('、') || '',
        updatedAt: Date.now(),
      };
      updatedCount++;
      console.log(`[TemplateLibrary] Updated template: ${templates[i].id} (${templates[i].name})`);
    }
  }
  
  if (updatedCount > 0) {
    await saveTemplatesToServer(templates);
    console.log(`[TemplateLibrary] Updated ${updatedCount} templates for product: ${productId}`);
  }
  
  return updatedCount;
}

// 清空所有模板
export async function clearAllTemplates(): Promise<void> {
  await saveTemplatesToServer([]);
  console.log('[TemplateLibrary] Cleared all templates');
}

// 从生成结果创建模板
export async function createFromGenerated(
  generatedTemplate: {
    name: string;
    description: string;
    category: string;
    duration: number;
    hookType: string;
    hookTypeName?: string;
    targetAudience: string;
    segments: TemplateSegment[];
    templatePrompt?: TemplatePrompt; // 模板提示词
    finalPrompt?: string; // 最终生成提示词
  },
  options?: {
    productInfo?: string;
    sellingPoints?: string;
    useCreator?: boolean;
    creatorGender?: 'female' | 'male' | 'any';
    creatorAge?: string;
    enableNarration?: boolean; // 是否启用口播
    finalPrompt?: string; // 最终生成提示词
    productImages?: Array<{ key: string; url: string }>; // 产品图片
    productId?: string; // 关联的产品ID
    productName?: string; // 产品名称
  }
): Promise<Template> {
  console.log('[TemplateLibrary] createFromGenerated called');
  console.log('[TemplateLibrary] Input hookType:', generatedTemplate.hookType);
  console.log('[TemplateLibrary] Input hookTypeName:', generatedTemplate.hookTypeName);
  
  const result = await saveTemplate({
    name: generatedTemplate.name,
    description: generatedTemplate.description,
    category: generatedTemplate.category,
    duration: generatedTemplate.duration,
    hookType: generatedTemplate.hookType,
    hookTypeName: generatedTemplate.hookTypeName,
    targetAudience: generatedTemplate.targetAudience,
    useCreator: options?.useCreator ?? true,
    creatorGender: options?.creatorGender,
    creatorAge: options?.creatorAge,
    enableNarration: options?.enableNarration ?? true,
    segments: generatedTemplate.segments,
    templatePrompt: generatedTemplate.templatePrompt,
    productId: options?.productId,
    productName: options?.productName,
    productInfo: options?.productInfo,
    sellingPoints: options?.sellingPoints,
    finalPrompt: generatedTemplate.finalPrompt || options?.finalPrompt,
    productImages: options?.productImages || [],
  });
  
  console.log('[TemplateLibrary] Saved result hookType:', result.hookType);
  console.log('[TemplateLibrary] Saved result hookTypeName:', result.hookTypeName);
  
  return result;
}

// ============================================
// 自定义系统提示词模板相关函数
// ============================================

/**
 * 前端获取自定义模板（通过 API）
 */
export async function fetchCustomSystemPrompt(): Promise<string | null> {
  try {
    const response = await authFetch('/api/system-prompt');
    const data = await response.json();
    
    if (data.success && data.config?.system_prompt) {
      return data.config.system_prompt;
    }
    
    return null;
  } catch (error) {
    console.error('[TemplateLibrary] Fetch custom system prompt error:', error);
    return null;
  }
}

/**
 * 使用自定义模板生成最终提示词（前端版本）
 * @param customTemplate 自定义模板（包含 {{变量}} 占位符）
 * @param params 参数值
 */
export function generateFinalPromptWithTemplate(
  customTemplate: string,
  params: {
    productInfo: string;
    productCategory: string;
    targetAudience: string;
    sellingPoints: string;
    hookType: string;
    hookTypeName?: string;
    hookDescription?: string;
    hookTemplate?: string;
    duration: number;
    useCreator: boolean;
    creatorGender?: 'female' | 'male' | 'any';
    creatorAge?: string;
    enableNarration?: boolean;
  }
): string {
  const {
    productInfo,
    productCategory,
    targetAudience,
    sellingPoints,
    hookType,
    hookTypeName,
    hookDescription,
    hookTemplate,
    duration,
    useCreator,
    creatorGender,
    creatorAge,
    enableNarration = true,
  } = params;

  // 计算片段数量
  const imageSegmentCount = duration / 8 + 1;
  const videoSegmentCount = imageSegmentCount - 1;

  // 获取口播方向
  const narrationGuide = getNarrationGuide(hookType, hookTypeName);

  // 准备变量值
  const variableValues: Record<string, string | number | boolean> = {
    productInfo,
    productCategory,
    targetAudience: targetAudience ? (targetAudience.includes('岁') ? targetAudience : `${targetAudience}岁`) : '25-35岁',
    sellingPoints,
    hookType,
    hookTypeName: hookTypeName || '',
    hookDescription: hookDescription || '',
    hookTemplate: hookTemplate || '',
    duration,
    useCreator: useCreator.toString(),
    creatorGender: creatorGender || 'any',
    creatorAge: creatorAge || '不限',
    enableNarration: enableNarration.toString(),
    imageSegmentCount,
    videoSegmentCount,
    narrationGuide,
  };

  // 替换模板中的变量
  let result = customTemplate;
  for (const [key, value] of Object.entries(variableValues)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}
