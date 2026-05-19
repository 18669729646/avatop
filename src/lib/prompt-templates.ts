// 提示词模板管理工具 - TK电商专用版 V2
import { 
  cache, 
  withCache, 
  invalidateCache, 
  invalidateCacheByPrefix,
  CacheKeys,
  CACHE_TTL 
} from './cache';

// 模板分类
export type TemplateCategory = 
  | 'product'      // 产品展示
  | 'video'        // 视频内容
  | 'live'         // 直播素材
  | 'ad'           // 广告投放
  | 'social'       // 社交媒体
  | 'promo'        // 促销活动
  | 'custom';      // 自定义

// 模板类型
export type TemplateType = 'image' | 'video' | 'both';

// 变量定义
export interface TemplateVariable {
  key: string;           // 变量名，如 {{product_name}}
  label: string;         // 显示名称
  placeholder: string;   // 输入提示
  defaultValue?: string; // 默认值
  required?: boolean;    // 是否必填
  options?: string[];    // 预设选项，方便快速选择
}

// 模板接口
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  type: TemplateType;
  prompt: string;
  // 默认参数
  defaultParams?: {
    aspectRatio?: string;
    resolution?: string;
    model?: string;
    enhancePrompt?: boolean;
    enableUpsample?: boolean;
  };
  // 变量定义
  variables?: TemplateVariable[];
  // 是否为系统预设模板
  isSystem?: boolean;
  // 热门推荐标记
  isHot?: boolean;
  // 标签，便于搜索
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// 分类信息
export const CATEGORY_INFO: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  product: { label: '产品展示', icon: '📦', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' },
  video: { label: '视频内容', icon: '🎬', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400' },
  live: { label: '直播素材', icon: '📺', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' },
  ad: { label: '广告投放', icon: '📢', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' },
  social: { label: '社交媒体', icon: '📱', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400' },
  promo: { label: '促销活动', icon: '🎉', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400' },
  custom: { label: '自定义', icon: '⭐', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
};

// 热门标签
export const HOT_TAGS = [
  '爆款推荐', '新手必用', '高转化', '高点击',
  '美妆', '服装', '数码', '食品', '家居',
  '短视频', '直播', '信息流', '种草',
];

// 系统预设模板 - TK电商专用 V2
const SYSTEM_TEMPLATES: PromptTemplate[] = [
  // ==================== 产品展示类 ====================
  {
    id: 'tk-product-white',
    name: '电商白底主图',
    description: '纯白背景产品主图，适合TikTok Shop商品展示',
    category: 'product',
    type: 'image',
    isHot: true,
    tags: ['主图', '白底', '电商', '爆款推荐'],
    prompt: '{{product_name}}产品主图，纯白背景#FFFFFF，专业商品摄影，柔和均匀打光，高清细节展示，无阴影，电商标准主图，{{style}}',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：无线蓝牙耳机', required: true },
      { key: 'style', label: '风格', placeholder: '选择或输入风格', defaultValue: '商业级品质', 
        options: ['商业级品质', '科技感', '简约现代', '高端奢华', '清新自然', '时尚潮流'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-product-scene',
    name: '产品场景展示',
    description: '产品在使用场景中的展示效果，增强代入感',
    category: 'product',
    type: 'image',
    isHot: true,
    tags: ['场景', '生活化', '代入感', '新手必用'],
    prompt: '{{product_name}}在{{scene}}场景中使用，{{user_action}}，自然光线，生活化场景，高品质产品摄影，浅景深虚化背景，{{mood}}氛围',
    defaultParams: { aspectRatio: '4:5', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：便携榨汁机', required: true },
      { key: 'scene', label: '使用场景', placeholder: '选择或输入场景', defaultValue: '家居环境',
        options: ['家居环境', '办公室', '户外自然', '咖啡厅', '健身房', '卧室', '厨房', '浴室'] },
      { key: 'user_action', label: '使用动作', placeholder: '例如：正在使用', defaultValue: '自然摆放',
        options: ['自然摆放', '手持展示', '正在使用', '放在桌上', '悬挂展示'] },
      { key: 'mood', label: '氛围', placeholder: '选择或输入氛围', defaultValue: '轻松愉悦',
        options: ['轻松愉悦', '温馨舒适', '专业商务', '清新自然', '高端奢华', '活力青春'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-product-detail',
    name: '产品细节特写',
    description: '产品材质、工艺、功能细节展示',
    category: 'product',
    type: 'image',
    tags: ['细节', '微距', '质感', '工艺'],
    prompt: '{{product_name}}的{{detail}}微距特写，展示{{feature}}，极致细节，专业微距摄影，完美对焦，突出质感和工艺，{{style}}',
    defaultParams: { aspectRatio: '1:1', resolution: '4K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：真皮钱包', required: true },
      { key: 'detail', label: '展示部位', placeholder: '选择或输入部位', required: true,
        options: ['整体外观', '材质纹理', '接缝走线', '按钮细节', 'logo标志', '包装细节', '配件展示'] },
      { key: 'feature', label: '展示特点', placeholder: '例如：精致缝线', defaultValue: '材质质感',
        options: ['材质质感', '精致工艺', '功能细节', '设计亮点', '品质细节'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '商业级品质',
        options: ['商业级品质', '高端奢华', '科技感', '自然真实', '艺术感'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-product-multi',
    name: '产品多角度展示',
    description: '产品多角度组合展示图',
    category: 'product',
    type: 'image',
    tags: ['多角度', '组合图', '展示'],
    prompt: '{{product_name}}产品多角度展示组合图，包含正面、侧面、背面、细节特写，统一白底，专业产品摄影，电商主图风格，{{style}}',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：智能手表', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '商业级品质',
        options: ['商业级品质', '科技简约', '时尚潮流', '高端奢华'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-product-lifestyle',
    name: '生活方式产品图',
    description: '融入生活方式的产品展示，适合服装、美妆、家居等品类',
    category: 'product',
    type: 'image',
    isHot: true,
    tags: ['生活方式', 'ins风', '美妆', '服装', '家居'],
    prompt: '{{product_name}}生活方式产品图，{{scene}}场景，{{model_info}}使用/穿着/手持，{{mood}}氛围，ins风，自然光，高级感，{{style}}',
    defaultParams: { aspectRatio: '4:5', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：防晒霜', required: true },
      { key: 'scene', label: '场景', placeholder: '选择场景', defaultValue: '生活场景',
        options: ['生活场景', '海边沙滩', '咖啡厅', '公园草地', '居家室内', '城市街拍', '工作室'] },
      { key: 'model_info', label: '模特信息', placeholder: '例如：年轻女性', defaultValue: '人物互动',
        options: ['人物互动', '年轻女性', '年轻男性', '中年女性', '情侣', '家庭', '无人物'] },
      { key: 'mood', label: '氛围', placeholder: '选择氛围', defaultValue: '自然舒适',
        options: ['自然舒适', '清爽夏日', '温馨浪漫', '活力青春', '优雅知性', '酷帅潮流'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '高级质感',
        options: ['高级质感', 'ins风', '韩系清新', '欧美潮流', '日系简约', '复古文艺'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ==================== 视频内容类 ====================
  {
    id: 'tk-video-unboxing',
    name: '开箱视频',
    description: '产品开箱展示视频，适合TikTok开箱种草',
    category: 'video',
    type: 'video',
    isHot: true,
    tags: ['开箱', '种草', '短视频', '爆款推荐', '新手必用'],
    prompt: '{{product_name}}开箱视频，从拆快递开始，展示包装、取出产品、首次展示产品全貌，{{style}}风格，{{pace}}节奏，惊喜感，真实开箱体验',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：新款耳机', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '自然真实',
        options: ['自然真实', '惊喜夸张', '专业测评', '轻松幽默', '精致高端'] },
      { key: 'pace', label: '节奏', placeholder: '选择节奏', defaultValue: '适中节奏',
        options: ['适中节奏', '快节奏剪辑', '慢节奏展示', '节奏渐强'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-video-demo',
    name: '产品使用演示',
    description: '产品功能使用演示视频',
    category: 'video',
    type: 'video',
    isHot: true,
    tags: ['演示', '教程', '功能展示', '高转化'],
    prompt: '{{product_name}}使用演示视频，展示{{function}}功能，{{demo_steps}}，{{model_info}}使用，操作简单直观，解决{{pain_point}}痛点，实用性强',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：多功能料理机', required: true },
      { key: 'function', label: '演示功能', placeholder: '例如：榨汁功能', required: true },
      { key: 'demo_steps', label: '演示步骤', placeholder: '例如：放入水果、按下按钮', defaultValue: '操作过程' },
      { key: 'model_info', label: '使用人物', placeholder: '选择人物', defaultValue: '人物演示',
        options: ['人物演示', '年轻女性', '年轻男性', '家庭主妇', '专业厨师', '手部特写'] },
      { key: 'pain_point', label: '解决痛点', placeholder: '例如：省时省力', defaultValue: '使用需求',
        options: ['使用需求', '省时省力', '解决难题', '提升效率', '改善体验'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-video-review',
    name: '产品测评对比',
    description: '产品测评或与竞品对比视频',
    category: 'video',
    type: 'video',
    tags: ['测评', '对比', '专业', '种草'],
    prompt: '{{product_name}}测评视频，{{review_aspects}}，真实体验反馈，优缺点分析，{{comparison}}，客观公正，帮助观众决策，专业测评风格',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：新款手机', required: true },
      { key: 'review_aspects', label: '测评维度', placeholder: '例如：外观、性能、续航', required: true },
      { key: 'comparison', label: '对比内容', placeholder: '选择对比', defaultValue: '无对比',
        options: ['无对比', '与上代产品对比', '与竞品对比', '价格对比', '功能对比'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-video-before-after',
    name: '使用前后对比',
    description: '产品使用前后效果对比视频，适合美妆、清洁、护肤类',
    category: 'video',
    type: 'video',
    isHot: true,
    tags: ['对比', '效果', '美妆', '护肤', '高转化'],
    prompt: '{{product_name}}使用前后对比视频，展示使用前的问题状态，使用过程，使用后的改善效果，{{effect}}，真实有效，强烈对比，种草感强',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：美白精华', required: true },
      { key: 'effect', label: '效果描述', placeholder: '例如：肌肤明显提亮', required: true },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-video-tutorial',
    name: '使用教程/攻略',
    description: '产品使用教程或攻略视频',
    category: 'video',
    type: 'video',
    tags: ['教程', '攻略', '干货', '新手必用'],
    prompt: '{{product_name}}使用教程，{{tutorial_content}}，步骤清晰，{{tips}}，新手友好，实用干货，教育性强，帮助用户快速上手',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：空气炸锅', required: true },
      { key: 'tutorial_content', label: '教程内容', placeholder: '例如：5种美食做法', required: true },
      { key: 'tips', label: '小技巧', placeholder: '例如：温度控制技巧', defaultValue: '实用技巧' },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-video-story',
    name: '产品故事/种草',
    description: '通过故事情节自然植入产品',
    category: 'video',
    type: 'video',
    tags: ['故事', '种草', '软植入', '高转化'],
    prompt: '{{product_name}}种草视频，{{story}}故事线，自然引入产品，{{usage_scene}}使用场景，解决{{problem}}问题，真实感强，软植入不生硬，{{ending}}结尾',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：便携加湿器', required: true },
      { key: 'story', label: '故事线', placeholder: '例如：办公室太干燥引发的问题', required: true },
      { key: 'usage_scene', label: '使用场景', placeholder: '选择场景', defaultValue: '日常场景',
        options: ['日常场景', '办公室', '家里', '户外', '旅行途中', '约会前'] },
      { key: 'problem', label: '解决问题', placeholder: '例如：皮肤干燥', required: true },
      { key: 'ending', label: '结尾方式', placeholder: '选择结尾', defaultValue: '自然结尾',
        options: ['自然结尾', '推荐给朋友', '限时优惠', '点击购买', '关注看更多'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ==================== 直播素材类 ====================
  {
    id: 'tk-live-cover',
    name: '直播封面图',
    description: 'TikTok直播预告封面图，吸引点击',
    category: 'live',
    type: 'image',
    isHot: true,
    tags: ['直播', '封面', '高点击', '直播必备'],
    prompt: 'TikTok直播封面图，{{theme}}主题，{{product}}产品展示，{{style}}风格，高对比度，吸睛设计，{{text_hint}}文字提示区域，{{color}}配色，专业直播封面',
    defaultParams: { aspectRatio: '9:16', resolution: '2K' },
    variables: [
      { key: 'theme', label: '直播主题', placeholder: '例如：新品首发', required: true,
        options: ['新品首发', '限时秒杀', '品牌专场', '粉丝福利', '清仓甩卖', '主题专场'] },
      { key: 'product', label: '主推产品', placeholder: '例如：夏季新款连衣裙', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '吸睛设计',
        options: ['吸睛设计', '时尚潮流', '简约大气', '热闹喜庆', '高端奢华'] },
      { key: 'text_hint', label: '文字区域', placeholder: '选择文字提示', defaultValue: '标题区域',
        options: ['标题区域', '限时折扣', '今日直播', '新品上市', '爆款返场'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '品牌色',
        options: ['品牌色', '红橙暖色', '蓝紫冷色', '粉嫩少女', '黑金高端', '鲜艳撞色'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-live-bg',
    name: '直播背景图',
    description: '专业直播间背景图',
    category: 'live',
    type: 'image',
    tags: ['直播', '背景', '专业', '直播必备'],
    prompt: '直播间背景图，{{theme}}主题，{{style}}风格，{{products}}产品展示区域，简洁不杂乱，专业感，{{color}}配色，适合美妆/服装/数码直播',
    defaultParams: { aspectRatio: '16:9', resolution: '2K' },
    variables: [
      { key: 'theme', label: '直播主题', placeholder: '例如：品牌专场', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '专业商务',
        options: ['专业商务', '时尚潮流', '温馨家居', '科技现代', '清新自然'] },
      { key: 'products', label: '产品区域', placeholder: '选择布局', defaultValue: '产品展示区',
        options: ['产品展示区', '左侧产品架', '右侧产品架', '背景产品墙', '无产品展示'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '中性色调',
        options: ['中性色调', '暖色调', '冷色调', '品牌主色', '渐变色'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-live-product-board',
    name: '直播产品展示板',
    description: '直播时手持或展示的产品信息板',
    category: 'live',
    type: 'image',
    tags: ['直播', '展示板', '手持', '直播必备'],
    prompt: '直播产品展示板，{{product_name}}产品信息，{{price}}价格信息，{{highlights}}卖点，{{style}}设计风格，清晰易读，直播手持展示用，{{color}}配色',
    defaultParams: { aspectRatio: '4:5', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：xxx品牌面膜', required: true },
      { key: 'price', label: '价格信息', placeholder: '例如：¥99/3盒', required: true },
      { key: 'highlights', label: '核心卖点', placeholder: '例如：补水保湿、温和不刺激', required: true },
      { key: 'style', label: '设计风格', placeholder: '选择风格', defaultValue: '清晰专业',
        options: ['清晰专业', '简约大气', '醒目突出', '时尚设计'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '品牌色系',
        options: ['品牌色系', '红橙促销', '蓝绿清新', '粉紫少女', '黑白简约'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ==================== 广告投放类 ====================
  {
    id: 'tk-ad-feed',
    name: '信息流广告图',
    description: 'TikTok信息流广告素材图',
    category: 'ad',
    type: 'image',
    isHot: true,
    tags: ['广告', '信息流', '高点击', '广告必备'],
    prompt: 'TikTok信息流广告图，{{product_name}}，{{selling_point}}核心卖点，{{style}}风格，{{composition}}构图，高点击率设计，{{cta}}行动号召，吸引眼球，{{target}}目标人群',
    defaultParams: { aspectRatio: '9:16', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：智能翻译机', required: true },
      { key: 'selling_point', label: '核心卖点', placeholder: '例如：支持50种语言', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '吸睛设计',
        options: ['吸睛设计', '问题解决型', '对比展示型', '场景代入型', '故事叙述型'] },
      { key: 'composition', label: '构图', placeholder: '选择构图', defaultValue: '突出产品',
        options: ['突出产品', '人物+产品', '使用场景', '前后对比', '多产品组合'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '点击购买',
        options: ['点击购买', '立即抢购', '限时优惠', '立即试用', '了解更多', '马上领取'] },
      { key: 'target', label: '目标人群', placeholder: '选择人群', defaultValue: '广泛人群',
        options: ['广泛人群', '年轻女性', '年轻男性', '家庭主妇', '商务人士', '学生群体'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-ad-video',
    name: '广告视频素材',
    description: 'TikTok广告投放用视频素材',
    category: 'ad',
    type: 'video',
    isHot: true,
    tags: ['广告', '视频', '高转化', '广告必备'],
    prompt: 'TikTok广告视频，{{product_name}}，{{hook}}开场吸引，{{content}}核心内容，{{benefit}}用户利益点，{{cta}}行动号召，{{duration}}时长，高转化率设计，{{style}}风格',
    defaultParams: { aspectRatio: '9:16' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：减肥茶', required: true },
      { key: 'hook', label: '开场吸引', placeholder: '例如：30天瘦10斤？', required: true,
        options: ['提出问题', '惊人数据', '痛点共鸣', '悬念开场', '直接展示效果'] },
      { key: 'content', label: '核心内容', placeholder: '例如：产品使用过程', required: true },
      { key: 'benefit', label: '用户利益', placeholder: '选择利益点', defaultValue: '轻松解决问题',
        options: ['轻松解决问题', '省钱省时', '提升生活品质', '改变形象', '获得快乐'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '立即抢购',
        options: ['立即抢购', '点击购买', '限时优惠', '立即试用', '马上领取'] },
      { key: 'duration', label: '视频时长', placeholder: '选择时长', defaultValue: '短视频',
        options: ['短视频', '15秒', '30秒', '60秒'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '原生广告',
        options: ['原生广告', '真人演示', '动画解说', 'UGC风格', '专业拍摄'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-ad-brand',
    name: '品牌宣传图',
    description: '品牌形象宣传素材',
    category: 'ad',
    type: 'image',
    tags: ['品牌', '宣传', '形象', '高端'],
    prompt: '{{brand_name}}品牌宣传图，{{brand_value}}品牌价值，{{style}}风格，{{mood}}氛围，高端质感，{{composition}}构图，品牌调性统一，{{color}}品牌色',
    defaultParams: { aspectRatio: '1:1', resolution: '4K' },
    variables: [
      { key: 'brand_name', label: '品牌名称', placeholder: '例如：xxx品牌', required: true },
      { key: 'brand_value', label: '品牌价值', placeholder: '例如：品质、创新', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', required: true,
        options: ['极简', '奢华', '科技', '自然', '时尚', '复古'] },
      { key: 'mood', label: '氛围', placeholder: '选择氛围', defaultValue: '专业质感',
        options: ['专业质感', '温暖亲切', '高端大气', '年轻活力', '沉稳可靠'] },
      { key: 'composition', label: '构图', placeholder: '选择构图', defaultValue: '品牌展示',
        options: ['品牌展示', '留白设计', '产品+品牌', '场景+品牌'] },
      { key: 'color', label: '品牌色', placeholder: '选择配色', defaultValue: '品牌主色',
        options: ['品牌主色', '黑金', '白金', '蓝白', '红白', '自定义'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ==================== 社交媒体类 ====================
  {
    id: 'tk-social-tiktok-cover',
    name: 'TikTok视频封面',
    description: 'TikTok短视频封面图',
    category: 'social',
    type: 'image',
    isHot: true,
    tags: ['TikTok', '封面', '高点击', '短视频必备'],
    prompt: 'TikTok视频封面，{{content}}内容主题，{{style}}风格，{{hook}}吸引点，高点击率设计，{{color}}配色，{{text_area}}文字区域，原生感，{{emotion}}情绪表达',
    defaultParams: { aspectRatio: '9:16', resolution: '2K' },
    variables: [
      { key: 'content', label: '内容主题', placeholder: '例如：产品开箱', required: true,
        options: ['产品开箱', '使用教程', '测评对比', '种草推荐', '搞笑日常', '干货分享'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '吸睛设计',
        options: ['吸睛设计', '潮流酷炫', '清新简约', '夸张有趣', '专业大气'] },
      { key: 'hook', label: '吸引点', placeholder: '选择吸引点', defaultValue: '视觉冲击',
        options: ['视觉冲击', '表情夸张', '文字悬念', '美女帅哥', '产品特写'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '高对比',
        options: ['高对比', '鲜艳活泼', '柔和清新', '暗色酷炫', '品牌色系'] },
      { key: 'text_area', label: '文字区域', placeholder: '选择位置', defaultValue: '标题区域',
        options: ['标题区域', '底部标题', '顶部标题', '居中标题', '无文字'] },
      { key: 'emotion', label: '情绪', placeholder: '选择情绪', defaultValue: '吸引注意',
        options: ['吸引注意', '惊喜', '好奇', '兴奋', '疑惑', '开心'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-social-xiaohongshu',
    name: '小红书种草图',
    description: '小红书风格种草图文',
    category: 'social',
    type: 'image',
    isHot: true,
    tags: ['小红书', '种草', 'ins风', '高转化'],
    prompt: '小红书种草图，{{product_name}}，{{experience}}使用体验，{{style}}风格，{{layout}}排版，{{color}}配色，ins风，精致生活感，{{lighting}}光线，高颜值',
    defaultParams: { aspectRatio: '3:4', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：口红', required: true },
      { key: 'experience', label: '使用体验', placeholder: '例如：显白、不拔干', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: 'ins风',
        options: ['ins风', '韩系清新', '日系简约', '欧美潮流', '复古文艺', '法式优雅'] },
      { key: 'layout', label: '排版', placeholder: '选择排版', defaultValue: '居中构图',
        options: ['居中构图', '上下分栏', '左右分栏', '网格拼图', '自由布局'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '柔和色调',
        options: ['柔和色调', '马卡龙色', '莫兰迪色', '大地色系', '黑白灰', '品牌色系'] },
      { key: 'lighting', label: '光线', placeholder: '选择光线', defaultValue: '柔和光线',
        options: ['柔和光线', '自然光', '暖色调', '冷色调', '逆光效果'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-social-douyin-cover',
    name: '抖音视频封面',
    description: '抖音短视频封面图',
    category: 'social',
    type: 'image',
    tags: ['抖音', '封面', '高点击'],
    prompt: '抖音短视频封面，{{content}}内容，{{style}}风格，{{highlight}}亮点展示，{{text_area}}文字区域，吸睛设计，{{color}}配色，{{emotion}}情绪，高点击率',
    defaultParams: { aspectRatio: '9:16', resolution: '2K' },
    variables: [
      { key: 'content', label: '内容', placeholder: '例如：产品测评', required: true,
        options: ['产品测评', '使用教程', '开箱展示', '搞笑剧情', '干货分享', '日常vlog'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '吸睛设计',
        options: ['吸睛设计', '潮流酷炫', '清新简约', '夸张有趣', '专业大气'] },
      { key: 'highlight', label: '亮点', placeholder: '选择亮点', defaultValue: '视觉焦点',
        options: ['视觉焦点', '产品特写', '人物表情', '文字标题', '对比效果'] },
      { key: 'text_area', label: '文字区域', placeholder: '选择位置', defaultValue: '标题区',
        options: ['标题区', '顶部标题', '底部标题', '居中大字', '无文字'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '醒目配色',
        options: ['醒目配色', '高对比', '鲜艳活泼', '暗色酷炫', '品牌色系'] },
      { key: 'emotion', label: '情绪', placeholder: '选择情绪', defaultValue: '吸引注意',
        options: ['吸引注意', '惊喜', '好奇', '兴奋', '疑惑'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ==================== 促销活动类 ====================
  {
    id: 'tk-promo-flash-sale',
    name: '限时折扣海报',
    description: '限时折扣促销活动海报',
    category: 'promo',
    type: 'image',
    isHot: true,
    tags: ['促销', '限时', '折扣', '高转化'],
    prompt: '限时折扣海报，{{product_name}}，{{discount}}折扣信息，{{time_limit}}限时，{{style}}设计风格，紧迫感，{{cta}}行动号召，{{color}}配色，高转化设计',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：全场商品', required: true },
      { key: 'discount', label: '折扣', placeholder: '例如：5折起', required: true },
      { key: 'time_limit', label: '限时', placeholder: '选择限时', required: true,
        options: ['仅剩24小时', '最后3小时', '限时今日', '限时2天', '最后机会'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '促销风格',
        options: ['促销风格', '热烈火爆', '简约大气', '时尚潮流'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '马上抢',
        options: ['马上抢', '立即抢购', '点击购买', '限时抢购', '立即下单'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '促销色',
        options: ['促销色', '红橙暖色', '金色高端', '鲜艳撞色', '品牌色系'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-promo-new-arrival',
    name: '新品上架海报',
    description: '新品首发上架宣传海报',
    category: 'promo',
    type: 'image',
    tags: ['新品', '上架', '首发', '高级感'],
    prompt: '新品上架海报，{{product_name}}，{{highlight}}新品亮点，{{launch_time}}上市时间，{{style}}风格，{{color}}配色，期待感，{{cta}}行动号召，高级感设计',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '例如：夏季新款', required: true },
      { key: 'highlight', label: '新品亮点', placeholder: '例如：限量首发', required: true },
      { key: 'launch_time', label: '上市时间', placeholder: '选择时间', defaultValue: '即将上市',
        options: ['即将上市', '今日首发', '本周上新', '限量首发', '抢先体验'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '新品风格',
        options: ['新品风格', '高端奢华', '简约大气', '时尚潮流', '科技感'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '高级配色',
        options: ['高级配色', '黑金', '白金', '莫兰迪色', '品牌色系'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '立即购买',
        options: ['立即购买', '抢先体验', '立即预约', '了解更多', '点击查看'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-promo-holiday',
    name: '节日活动海报',
    description: '节日促销活动海报',
    category: 'promo',
    type: 'image',
    tags: ['节日', '活动', '促销', '氛围'],
    prompt: '{{holiday}}节日促销海报，{{product_name}}，{{offer}}优惠活动，{{elements}}节日元素，{{style}}风格，{{color}}配色，节日氛围，{{cta}}行动号召',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'holiday', label: '节日', placeholder: '选择节日', required: true,
        options: ['双11', '618', '春节', '情人节', '妇女节', '母亲节', '父亲节', '圣诞节', '元旦', '国庆'] },
      { key: 'product_name', label: '产品名称', placeholder: '例如：全场商品', required: true },
      { key: 'offer', label: '优惠活动', placeholder: '例如：满减、折扣', required: true },
      { key: 'elements', label: '节日元素', placeholder: '选择元素', defaultValue: '节日装饰',
        options: ['节日装饰', '红包礼盒', '烟花气球', '爱心玫瑰', '国旗灯笼', '圣诞树礼物'] },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '节日风格',
        options: ['节日风格', '热闹喜庆', '温馨浪漫', '欢乐活泼', '高端大气'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '节日配色',
        options: ['节日配色', '红色金色', '粉色浪漫', '绿色清新', '品牌色系'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '马上参与',
        options: ['马上参与', '立即抢购', '限时抢购', '点击参与', '立即下单'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tk-promo-bundle',
    name: '组合套装促销',
    description: '组合套装优惠促销海报',
    category: 'promo',
    type: 'image',
    tags: ['套装', '组合', '促销', '超值'],
    prompt: '组合套装促销海报，{{products}}产品组合，{{bundle_price}}套装价格，{{savings}}节省金额，{{style}}风格，超值感，{{color}}配色，{{cta}}行动号召',
    defaultParams: { aspectRatio: '1:1', resolution: '2K' },
    variables: [
      { key: 'products', label: '产品组合', placeholder: '例如：洁面+爽肤水+乳液', required: true },
      { key: 'bundle_price', label: '套装价格', placeholder: '例如：¥199', required: true },
      { key: 'savings', label: '节省金额', placeholder: '例如：立省¥100', required: true },
      { key: 'style', label: '风格', placeholder: '选择风格', defaultValue: '促销风格',
        options: ['促销风格', '超值感', '高端套装', '简约大气'] },
      { key: 'color', label: '配色', placeholder: '选择配色', defaultValue: '促销色',
        options: ['促销色', '橙黄色', '绿色清新', '蓝紫色', '品牌色系'] },
      { key: 'cta', label: '行动号召', placeholder: '选择CTA', defaultValue: '马上抢',
        options: ['马上抢', '立即抢购', '限时抢购', '立即下单'] },
    ],
    isSystem: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ==================== 存储管理 ====================

const STORAGE_KEYS = {
  CUSTOM_TEMPLATES: 'tk_custom_templates',
  RECENT_USED: 'tk_recent_templates',
  FAVORITES: 'tk_favorite_templates',
  USAGE_STATS: 'tk_template_stats',
};

const MAX_CUSTOM_TEMPLATES = 100;
const MAX_RECENT_TEMPLATES = 10;

// API 请求辅助函数
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // 在服务器端，需要使用完整的 URL
  const fullUrl = typeof window === 'undefined' 
    ? `http://localhost:5000${url}` 
    : url;
  
  // 获取认证 token
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('auth_token') 
    : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// ==================== 自定义模板 ====================

// 获取自定义模板（异步版本）
export async function getCustomTemplates(forceRefresh = false): Promise<PromptTemplate[]> {
  try {
    return await withCache(
      CacheKeys.promptTemplates(false),
      async () => {
        const result = await apiRequest<{ data: PromptTemplate[] }>('/api/prompt-templates?isSystem=false');
        return result.data || [];
      },
      { ttl: CACHE_TTL.PROMPT_TEMPLATES, forceRefresh }
    );
  } catch (error) {
    console.error('Failed to get custom templates:', error);
    return [];
  }
}

// 获取所有模板（系统+自定义）- 异步版本
export async function getAllTemplatesAsync(forceRefresh = false): Promise<PromptTemplate[]> {
  try {
    return await withCache(
      CacheKeys.promptTemplates(),
      async () => {
        const result = await apiRequest<{ data: PromptTemplate[] }>('/api/prompt-templates');
        return result.data || [];
      },
      { ttl: CACHE_TTL.PROMPT_TEMPLATES, forceRefresh }
    );
  } catch (error) {
    console.error('Failed to get all templates:', error);
    return [...SYSTEM_TEMPLATES];
  }
}

// 添加自定义模板（异步版本）
export async function addCustomTemplateAsync(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>): Promise<PromptTemplate | null> {
  try {
    const result = await apiRequest<{ data: PromptTemplate }>('/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({
        ...template,
        isSystem: false,
      }),
    });
    
    // 使缓存失效
    invalidateCacheByPrefix('prompt-templates:');
    
    return result.data;
  } catch (error) {
    console.error('Failed to add custom template:', error);
    return null;
  }
}

// 更新自定义模板（异步版本）
export async function updateCustomTemplateAsync(id: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate | null> {
  try {
    const result = await apiRequest<{ data: PromptTemplate }>('/api/prompt-templates', {
      method: 'POST',
      body: JSON.stringify({ id, ...updates }),
    });
    
    // 使缓存失效
    invalidateCacheByPrefix('prompt-templates:');
    
    return result.data;
  } catch (error) {
    console.error('Failed to update custom template:', error);
    return null;
  }
}

// 删除自定义模板（异步版本）
export async function deleteCustomTemplateAsync(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/prompt-templates?id=${id}`, { method: 'DELETE' });
    
    // 使缓存失效
    invalidateCacheByPrefix('prompt-templates:');
    
    return true;
  } catch (error) {
    console.error('Failed to delete custom template:', error);
    return false;
  }
}

// ==================== 最近使用 ====================

export interface RecentTemplate {
  id: string;
  usedAt: number;
  variableValues?: Record<string, string>;
}

// 内存缓存（用于同步版本）
let recentTemplatesCache: RecentTemplate[] | null = null;

// 异步版本
export async function getRecentTemplatesAsync(): Promise<RecentTemplate[]> {
  try {
    const result = await apiRequest<{ data: { recentTemplates: RecentTemplate[] } }>('/api/user-preferences');
    recentTemplatesCache = result.data?.recentTemplates || [];
    return recentTemplatesCache;
  } catch {
    return [];
  }
}

export async function addToRecentTemplatesAsync(id: string, variableValues?: Record<string, string>): Promise<void> {
  try {
    const recent = await getRecentTemplatesAsync();
    // 移除旧的记录
    const filtered = recent.filter(r => r.id !== id);
    // 添加到开头
    filtered.unshift({ id, usedAt: Date.now(), variableValues });
    // 限制数量
    const limited = filtered.slice(0, MAX_RECENT_TEMPLATES);
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ recentTemplates: limited }),
    });
    
    recentTemplatesCache = limited;
    
    // 使缓存失效
    invalidateCache(CacheKeys.userPreferences());
  } catch (error) {
    console.error('Failed to save recent templates:', error);
  }
}

export async function clearRecentTemplatesAsync(): Promise<void> {
  try {
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ recentTemplates: [] }),
    });
    recentTemplatesCache = [];
    invalidateCache(CacheKeys.userPreferences());
  } catch (error) {
    console.error('Failed to clear recent templates:', error);
  }
}

// 同步版本（兼容旧代码）
export function getRecentTemplates(): RecentTemplate[] {
  if (recentTemplatesCache) return recentTemplatesCache;
  // 触发异步加载
  getRecentTemplatesAsync();
  return [];
}

export function addToRecentTemplates(id: string, variableValues?: Record<string, string>): void {
  // 后台异步保存
  addToRecentTemplatesAsync(id, variableValues);
  
  // 立即更新本地缓存
  if (recentTemplatesCache) {
    recentTemplatesCache = recentTemplatesCache.filter(r => r.id !== id);
    recentTemplatesCache.unshift({ id, usedAt: Date.now(), variableValues });
    recentTemplatesCache = recentTemplatesCache.slice(0, MAX_RECENT_TEMPLATES);
  } else {
    recentTemplatesCache = [{ id, usedAt: Date.now(), variableValues }];
  }
}

export function clearRecentTemplates(): void {
  recentTemplatesCache = [];
  clearRecentTemplatesAsync();
}

// ==================== 收藏功能 ====================

let favoritesCache: string[] | null = null;

// 异步版本
export async function getFavoriteTemplatesAsync(): Promise<string[]> {
  try {
    const result = await apiRequest<{ data: { favoriteTemplates: string[] } }>('/api/user-preferences');
    favoritesCache = result.data?.favoriteTemplates || [];
    return favoritesCache;
  } catch {
    return [];
  }
}

export async function toggleFavoriteAsync(id: string): Promise<boolean> {
  try {
    const favorites = await getFavoriteTemplatesAsync();
    const index = favorites.indexOf(id);
    
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.unshift(id);
    }
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ favoriteTemplates: favorites }),
    });
    
    favoritesCache = favorites;
    invalidateCache(CacheKeys.userPreferences());
    
    return index === -1; // 返回是否新增收藏
  } catch {
    return false;
  }
}

export async function isFavoriteAsync(id: string): Promise<boolean> {
  const favorites = await getFavoriteTemplatesAsync();
  return favorites.includes(id);
}

// 同步版本（兼容旧代码）
export function getFavoriteTemplates(): string[] {
  if (favoritesCache) return favoritesCache;
  // 触发异步加载
  getFavoriteTemplatesAsync();
  return [];
}

export function toggleFavorite(id: string): boolean {
  // 后台异步保存
  const result = toggleFavoriteAsync(id);
  
  // 立即更新本地缓存
  if (favoritesCache) {
    const index = favoritesCache.indexOf(id);
    if (index > -1) {
      favoritesCache.splice(index, 1);
    } else {
      favoritesCache.unshift(id);
    }
  }
  
  return true; // 假设成功
}

export function isFavorite(id: string): boolean {
  return getFavoriteTemplates().includes(id);
}

// ==================== 使用统计 ====================

export interface TemplateUsageStats {
  [templateId: string]: number;
}

let usageStatsCache: TemplateUsageStats | null = null;

// 异步版本
export async function getUsageStatsAsync(): Promise<TemplateUsageStats> {
  try {
    const result = await apiRequest<{ data: { templateUsageStats: TemplateUsageStats } }>('/api/user-preferences');
    usageStatsCache = result.data?.templateUsageStats || {};
    return usageStatsCache;
  } catch {
    return {};
  }
}

export async function incrementUsageAsync(id: string): Promise<void> {
  try {
    const stats = await getUsageStatsAsync();
    stats[id] = (stats[id] || 0) + 1;
    
    await apiRequest('/api/user-preferences', {
      method: 'POST',
      body: JSON.stringify({ templateUsageStats: stats }),
    });
    
    usageStatsCache = stats;
    invalidateCache(CacheKeys.userPreferences());
  } catch {
    // ignore
  }
}

// 同步版本（兼容旧代码）
export function getUsageStats(): TemplateUsageStats {
  if (usageStatsCache) return usageStatsCache;
  // 触发异步加载
  getUsageStatsAsync();
  return {};
}

export function incrementUsage(id: string): void {
  // 后台异步保存
  incrementUsageAsync(id);
  
  // 立即更新本地缓存
  if (usageStatsCache) {
    usageStatsCache[id] = (usageStatsCache[id] || 0) + 1;
  } else {
    usageStatsCache = { [id]: 1 };
  }
}

// 同步版本（保持兼容性，使用内存缓存）
let customTemplatesCache: PromptTemplate[] | null = null;

export function getCustomTemplatesSync(): PromptTemplate[] {
  if (customTemplatesCache) {
    return customTemplatesCache;
  }
  // 触发异步加载
  getCustomTemplates().then(templates => {
    customTemplatesCache = templates;
  });
  return [];
}

export function getAllTemplates(): PromptTemplate[] {
  return [...SYSTEM_TEMPLATES, ...getCustomTemplatesSync()];
}

// ==================== 模板查询 ====================

// 按类型获取模板
export function getTemplatesByType(type: TemplateType): PromptTemplate[] {
  return getAllTemplates().filter(t => t.type === type || t.type === 'both');
}

// 按分类获取模板
export function getTemplatesByCategory(category: TemplateCategory): PromptTemplate[] {
  return getAllTemplates().filter(t => t.category === category);
}

// 按类型和分类获取模板
export function getTemplates(type: TemplateType, category?: TemplateCategory): PromptTemplate[] {
  let templates = getTemplatesByType(type);
  if (category) {
    templates = templates.filter(t => t.category === category);
  }
  return templates;
}

// 获取热门模板
export function getHotTemplates(type: TemplateType): PromptTemplate[] {
  return getTemplatesByType(type).filter(t => t.isHot);
}

// 获取收藏的模板
export function getFavoriteTemplatesList(type: TemplateType): PromptTemplate[] {
  const favorites = getFavoriteTemplates();
  return getTemplatesByType(type).filter(t => favorites.includes(t.id));
}

// 获取最近使用的模板（带模板详情）
export function getRecentTemplatesList(type: TemplateType): (RecentTemplate & { template: PromptTemplate })[] {
  const recent = getRecentTemplates();
  const allTemplates = getAllTemplates();
  return recent
    .filter(r => {
      const template = allTemplates.find(t => t.id === r.id);
      return template && (template.type === type || template.type === 'both');
    })
    .map(r => ({
      ...r,
      template: allTemplates.find(t => t.id === r.id)!,
    }));
}

// 获取单个模板
export function getTemplateById(id: string): PromptTemplate | undefined {
  return getAllTemplates().find(t => t.id === id);
}

// 搜索模板
export function searchTemplates(type: TemplateType, query: string): PromptTemplate[] {
  const templates = getTemplatesByType(type);
  if (!query.trim()) return templates;
  
  const lowerQuery = query.toLowerCase();
  return templates.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.prompt.toLowerCase().includes(lowerQuery) ||
    t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// ==================== 模板管理 ====================

// 添加自定义模板（同步版本，保持兼容性）
export function addCustomTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>): PromptTemplate {
  const newTemplate: PromptTemplate = {
    ...template,
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    isSystem: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  // 更新缓存
  if (customTemplatesCache) {
    customTemplatesCache.unshift(newTemplate);
  } else {
    customTemplatesCache = [newTemplate];
  }
  
  // 后台保存
  addCustomTemplateAsync(template);
  
  return newTemplate;
}

// 更新自定义模板（同步版本）
export function updateCustomTemplate(id: string, updates: Partial<PromptTemplate>): PromptTemplate | null {
  const customTemplates = getCustomTemplatesSync();
  const index = customTemplates.findIndex(t => t.id === id);
  
  if (index === -1) return null;
  
  customTemplates[index] = {
    ...customTemplates[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  // 更新缓存
  customTemplatesCache = customTemplates;
  
  // 后台保存
  updateCustomTemplateAsync(id, updates);
  
  return customTemplates[index];
}

// 删除自定义模板（同步版本）
export function deleteCustomTemplate(id: string): boolean {
  const customTemplates = getCustomTemplatesSync();
  const filtered = customTemplates.filter(t => t.id !== id);
  
  if (filtered.length === customTemplates.length) return false;
  
  // 更新缓存
  customTemplatesCache = filtered;
  
  // 后台删除
  deleteCustomTemplateAsync(id);
  
  // 同时清除相关数据（异步）
  getFavoriteTemplatesAsync().then(favorites => {
    const updated = favorites.filter(f => f !== id);
    if (updated.length !== favorites.length) {
      apiRequest('/api/user-preferences', {
        method: 'POST',
        body: JSON.stringify({ favoriteTemplates: updated }),
      });
      favoritesCache = updated;
    }
  });
  
  return true;
}

// 清空自定义模板
export async function clearCustomTemplates(): Promise<void> {
  const templates = await getCustomTemplates();
  await Promise.all(templates.map(t => deleteCustomTemplateAsync(t.id)));
  customTemplatesCache = [];
}

// ==================== 模板渲染 ====================

// 替换提示词中的变量
export function renderTemplate(template: PromptTemplate, values: Record<string, string>): string {
  let result = template.prompt;
  
  // 替换变量
  if (template.variables) {
    for (const variable of template.variables) {
      const value = values[variable.key] || variable.defaultValue || '';
      // 支持 {{key}} 和 {key} 两种格式
      result = result.replace(new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g'), value);
      result = result.replace(new RegExp(`\\{${variable.key}\\}`, 'g'), value);
    }
  }
  
  return result;
}

// 从提示词提取变量值（用于编辑场景）
export function extractVariableValues(template: PromptTemplate, prompt: string): Record<string, string> {
  const values: Record<string, string> = {};
  
  if (!template.variables) return values;
  
  // 简单实现：返回默认值
  for (const variable of template.variables) {
    values[variable.key] = variable.defaultValue || '';
  }
  
  return values;
}

// ==================== 辅助函数 ====================

// 获取所有分类
export function getCategories(): TemplateCategory[] {
  return ['product', 'video', 'live', 'ad', 'social', 'promo', 'custom'];
}

// 获取分类统计
export function getCategoryStats(type: TemplateType): Record<TemplateCategory, number> {
  const templates = getTemplatesByType(type);
  const stats: Record<TemplateCategory, number> = {
    product: 0,
    video: 0,
    live: 0,
    ad: 0,
    social: 0,
    promo: 0,
    custom: 0,
  };
  
  templates.forEach(t => {
    stats[t.category]++;
  });
  
  return stats;
}

// 复制提示词到剪贴板
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
