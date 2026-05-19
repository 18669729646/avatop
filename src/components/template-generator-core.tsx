'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Sparkles, Loader2, Zap, Target, Users, Palette, Clock, 
  Copy, Check, Download, ArrowRight, ArrowLeft, Film,
  Lightbulb, TrendingUp, MousePointer, Heart, Package, 
  Image as ImageIcon, X, Edit3, User
} from 'lucide-react';
import { getDefaultTextApi } from '@/lib/system-config';
import { ProductSelector } from '@/components/product-selector';
import { ProductSelection } from '@/lib/products';
import { 
  createFromGenerated, 
  getTemplates, 
  deleteTemplate, 
  updateTemplate,
  Template,
  generateFinalPrompt,
  generateFinalPromptWithTemplate,
  fetchCustomSystemPrompt,
} from '@/lib/template-library';

// 产品类别选项
const PRODUCT_CATEGORIES = [
  { value: 'beauty', label: '美妆护肤', icon: '💄', keywords: ['补水', '美白', '抗衰', '遮瑕', '持妆'] },
  { value: 'food', label: '食品饮料', icon: '🍔', keywords: ['健康', '美味', '营养', '低卡', '有机'] },
  { value: 'digital', label: '数码电子', icon: '📱', keywords: ['智能', '高性能', '便携', '黑科技', '性价比'] },
  { value: 'clothing', label: '服装服饰', icon: '👗', keywords: ['时尚', '舒适', '百搭', '质感', '显瘦'] },
  { value: 'home', label: '家居生活', icon: '🏠', keywords: ['实用', '美观', '品质', '便捷', '环保'] },
  { value: 'other', label: '其他产品', icon: '📦', keywords: ['品质', '实用', '性价比'] },
];

// 钩子类型选项 - 基于10种高转化钩子方法论
const HOOK_TYPES = [
  { 
    value: 'pain_point', 
    label: '痛点暴击', 
    description: '直接戳中用户痛点，制造"这说的就是我"的共鸣',
    template: '你是不是也{具体痛点}？',
    examples: ['你是不是也每天熬夜，皮肤却越来越差？', '你是不是也感觉减肥太难坚持？'],
    suitableFor: '功能性产品、解决痛点的产品',
    icon: '🎯'
  },
  { 
    value: 'subversion', 
    label: '颠覆认知', 
    description: '挑战普遍认知，制造信息差和好奇心',
    template: '别再{错误做法}了！/ 90%的人都不知道...',
    examples: ['别再用洗面奶洗脸了，医生说这招更管用！', '90%的人都不知道，睡前这样做反而伤身！'],
    suitableFor: '有独特卖点、能打破常规的产品',
    icon: '💡'
  },
  { 
    value: 'result_first', 
    label: '结果前置', 
    description: '直接展示惊人结果，激发"我也想要"的欲望',
    template: '{时间}内，{达成了什么惊人结果}',
    examples: ['30天，我从暗黄肌变成自带高光！', '只换了一个习惯，我一个月瘦了8斤！'],
    suitableFor: '效果明显、有对比性的产品',
    icon: '✨'
  },
  { 
    value: 'suspense', 
    label: '悬念提问', 
    description: '抛出反常问题，利用完形心理迫使观看',
    template: '为什么{反常现象}？/ 你绝对猜不到...',
    examples: ['为什么有些女生不化妆，皮肤却比化妆的还好？', '你绝对猜不到，这家快倒闭的店年赚百万！'],
    suitableFor: '有故事性、揭秘性的产品',
    icon: '❓'
  },
  { 
    value: 'identity', 
    label: '身份宣称', 
    description: '精准锁定目标人群，制造"被召唤"的归属感',
    template: '所有{特定人群}注意！/ 刷到这条视频的{人群}恭喜你！',
    examples: ['所有熬夜党注意！这可能是你今年最有价值的视频！', '家里有三年级小学生的家长，请一定看完！'],
    suitableFor: '有明确目标受众的产品',
    icon: '👥'
  },
  { 
    value: 'data_shock', 
    label: '数据冲击', 
    description: '用具体数字增强可信度和冲击力',
    template: '{权威数据} + {反差结论}',
    examples: ['73%的女生用错了护肤品，难怪越用越干！', '调研显示：92%的人刷牙时间不足45秒！'],
    suitableFor: '有数据支撑、专业性的产品',
    icon: '📊'
  },
  { 
    value: 'contrast', 
    label: '对比反差', 
    description: '用强烈的前后对比制造视觉冲击',
    template: '左边{失败案例} vs 右边{成功案例}',
    examples: ['同样是素颜出门，左边是我，右边也是我！', '使用前vs使用后，差距太大了！'],
    suitableFor: '效果对比明显的产品',
    icon: '⚡'
  },
  { 
    value: 'scarcity', 
    label: '优惠稀缺', 
    description: '制造紧迫感和稀缺感，促成立即行动',
    template: '限时/限量信息 + 不行动的损失',
    examples: ['库存只剩200单，这个价格错过再等一年！', '限时3天！这个价格手慢无！'],
    suitableFor: '促销、限时优惠活动',
    icon: '🔥'
  },
  { 
    value: 'highlight', 
    label: '高能片段', 
    description: '把最有情绪张力的片段直接放到开头',
    template: '直接展示戏剧性/冲突性片段',
    examples: ['展示使用产品时的惊喜表情', '直接展示惊艳的变身效果'],
    suitableFor: '有强烈视觉效果的产品',
    icon: '🎬'
  },
  { 
    value: 'social_currency', 
    label: '社交货币', 
    description: '让用户感觉"我知道别人不知道的"，制造优越感',
    template: '内行人才知道... / 只有小众圈子才知道...',
    examples: ['柜姐不会告诉你的护肤秘密，今天全公开！', '摄影圈内都在传的调色参数，绝不外传！'],
    suitableFor: '有行业秘密、小众好物',
    icon: '💎'
  },
];

// 时长选项
const DURATION_OPTIONS = [
  { value: 16, label: '16秒', description: '快节奏，适合产品展示', segments: 2 },
  { value: 24, label: '24秒', description: '标准时长，适合大多数场景', segments: 3 },
  { value: 32, label: '32秒', description: '深度展示，适合复杂产品', segments: 4 },
  { value: 40, label: '40秒', description: '长视频，适合产品介绍', segments: 5 },
  { value: 48, label: '48秒', description: '超长视频，适合详细演示', segments: 6 },
  { value: 56, label: '56秒', description: '完整演示，适合复杂场景', segments: 7 },
];

// 达人年龄范围选项（同时用于目标受众选择）
const AGE_OPTIONS = [
  { value: '18-24', label: '18-24岁', description: 'Z世代，年轻活力' },
  { value: '25-35', label: '25-35岁', description: '年轻白领，消费主力' },
  { value: '35-45', label: '35-45岁', description: '成熟稳重，品质追求' },
  { value: '45+', label: '45岁以上', description: '成熟群体，注重实用' },
  { value: 'any', label: '不限', description: '不限定年龄' },
];

// 生成模板的接口
export interface GeneratedTemplate {
  name: string;
  description: string;
  category: string;
  duration: number;
  hookType: string;
  hookTypeName?: string;
  targetAudience: string;
  segments: Array<{
    id: string;
    order: number;
    duration: number;
    description: string;
    imagePrompt: string;
    videoPrompt: string;
    hookType?: string;
    sellingPoint?: string;
  }>;
  templatePrompt?: {
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
    createdAt: number;
  };
  createdAt: number;
}

interface TemplateGeneratorCoreProps {
  onApply?: (template: GeneratedTemplate) => void;
  productDescription?: string;
  showApplyButton?: boolean;
  isApplying?: boolean;
}

export function TemplateGeneratorCore({
  onApply,
  productDescription: initialProductDescription = '',
  showApplyButton = true,
  isApplying = false,
}: TemplateGeneratorCoreProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false); // 确认对话框

  // 自定义系统提示词模板
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(null);

  // 产品选择器状态
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSelection | null>(null);

  // 表单状态
  const [templateName, setTemplateName] = useState(''); // 模板名称
  const [productInfo, setProductInfo] = useState(initialProductDescription);
  const [productCategory, setProductCategory] = useState('other');
  const [targetAudience, setTargetAudience] = useState('25-35'); // 目标受众，默认25-35岁
  const [sellingPoints, setSellingPoints] = useState('');
  const [hookType, setHookType] = useState('pain_point');
  const [duration, setDuration] = useState(16);
  const [useCreator, setUseCreator] = useState(true); // 达人出境，默认开启
  const [creatorGender, setCreatorGender] = useState<'female' | 'male' | 'any'>('male'); // 达人性别，默认男性
  const [creatorAge, setCreatorAge] = useState<string>('25-35'); // 达人年龄，默认25-35岁
  const [enableNarration, setEnableNarration] = useState(true); // 启用口播，默认开启

  // 加载自定义系统提示词模板
  useEffect(() => {
    async function loadCustomTemplate() {
      try {
        const template = await fetchCustomSystemPrompt();
        if (template) {
          setCustomSystemPrompt(template);
          console.log('[TemplateGenerator] Loaded custom system prompt template');
        }
      } catch (error) {
        console.error('[TemplateGenerator] Failed to load custom template:', error);
      }
    }
    loadCustomTemplate();
  }, []);

  // 计算片段数量：8秒2段落，16秒3段落，24秒4段落
  // 段落数 = 时长/8 + 1，视频数 = 段落数 - 1
  const imageSegmentCount = duration / 8 + 1;
  const videoSegmentCount = imageSegmentCount - 1;

  // 处理产品选择
  const handleProductSelect = (product: ProductSelection) => {
    setSelectedProduct(product);
    // 自动填充产品信息
    setProductInfo(product.description || product.name);
    // 如果产品有目标受众，自动填充
    if (product.targetAudience) {
      setTargetAudience(product.targetAudience);
    }
    // 如果产品有卖点，自动填充
    if (product.sellingPoints && product.sellingPoints.length > 0) {
      setSellingPoints(product.sellingPoints.join('、'));
    }
    // 如果产品有关键词，补充到卖点
    if (product.keywords && product.keywords.length > 0) {
      const keywords = product.keywords.slice(0, 3).join('、');
      if (sellingPoints) {
        setSellingPoints(prev => prev ? `${prev}、${keywords}` : keywords);
      }
    }
  };

  // 清除已选择的产品
  const handleClearProduct = () => {
    setSelectedProduct(null);
    setProductInfo('');
    setTargetAudience('');
    setSellingPoints('');
    setProductCategory('other');
  };

  // 点击生成按钮 - 显示确认对话框
  const handleGenerateClick = () => {
    if (!productInfo.trim()) {
      setError('请输入产品信息');
      return;
    }
    setError(null);
    setShowConfirmDialog(true);
  };

  // 确认保存模板 - 直接保存提示词配置
  const handleConfirmGenerate = async () => {
    setShowConfirmDialog(false);
    setIsGenerating(true);
    setError(null);

    console.log('[TemplateGenerator] handleConfirmGenerate called');
    console.log('[TemplateGenerator] hookType state:', hookType);
    console.log('[TemplateGenerator] hookType label:', HOOK_TYPES.find(h => h.value === hookType)?.label);

    try {
      // 获取选中的钩子信息
      console.log('[TemplateGenerator] Before finding selectedHookInfo:');
      console.log('  - hookType state:', hookType);
      console.log('  - HOOK_TYPES count:', HOOK_TYPES.length);
      
      const selectedHookInfo = HOOK_TYPES.find(h => h.value === hookType);
      const selectedCategoryInfo = PRODUCT_CATEGORIES.find(c => c.value === productCategory);
      
      console.log('[TemplateGenerator] After finding selectedHookInfo:');
      console.log('  - selectedHookInfo:', selectedHookInfo ? `${selectedHookInfo.label} (${selectedHookInfo.value})` : 'null');
      console.log('  - selectedCategoryInfo:', selectedCategoryInfo ? selectedCategoryInfo.label : 'null');
      
      // 构建模板提示词（请求体内容）
      const templatePrompt = {
        // 产品信息
        productInfo: productInfo.trim(),
        productCategory: selectedCategoryInfo?.label || productCategory,
        targetAudience: targetAudience || '25-35',
        sellingPoints: sellingPoints.trim() || '品质优良、性价比高、使用方便',
        
        // 钩子设置
        hookType: hookType,
        hookTypeName: selectedHookInfo?.label || hookType,
        hookDescription: selectedHookInfo?.description || '',
        hookTemplate: selectedHookInfo?.template || '',
        
        // 视频设置
        duration: duration,
        useCreator: useCreator,
        creatorGender: creatorGender,
        creatorAge: creatorAge,
        enableNarration: enableNarration,
        
        // 时间戳
        createdAt: Date.now(),
      };

      // 生成最终提示词（优先使用自定义模板）
      const promptParams = {
        productInfo: productInfo.trim(),
        productCategory: selectedCategoryInfo?.label || productCategory,
        targetAudience: targetAudience || '25-35',
        sellingPoints: sellingPoints.trim() || '品质优良、性价比高、使用方便',
        hookType: hookType,
        hookTypeName: selectedHookInfo?.label || hookType,
        hookDescription: selectedHookInfo?.description || '',
        hookTemplate: selectedHookInfo?.template || '',
        duration: duration,
        useCreator: useCreator,
        creatorGender: creatorGender,
        creatorAge: creatorAge,
        enableNarration: enableNarration,
      };
      
      console.log('[TemplateGenerator] templatePrompt created:');
      console.log('  - hookType:', templatePrompt.hookType);
      console.log('  - hookTypeName:', templatePrompt.hookTypeName);
      
      const finalPrompt = customSystemPrompt 
        ? generateFinalPromptWithTemplate(customSystemPrompt, promptParams)
        : generateFinalPrompt(promptParams);

      // 计算片段数量：8秒2段落，16秒3段落，24秒4段落
      // 段落数 = 时长/8 + 1，视频数 = 段落数 - 1
      const imageSegmentCount = duration / 8 + 1;
      const videoSegmentCount = imageSegmentCount - 1;

      // 创建模板对象
      const newTemplate: GeneratedTemplate = {
        name: templateName.trim() || `${productInfo.substring(0, 15)}模板`,
        description: `基于${selectedHookInfo?.label || '爆款'}方法论生成的${duration}秒带货短视频模板`,
        category: productCategory,
        duration: duration,
        hookType: hookType,
        hookTypeName: selectedHookInfo?.label,
        targetAudience: targetAudience.trim() || '18-35岁年轻消费者',
        segments: [], // 空数组，实际内容在使用时生成
        createdAt: Date.now(),
        // 存储原始提示词数据
        templatePrompt: templatePrompt,
        // 存储最终提示词
        finalPrompt: finalPrompt,
      } as GeneratedTemplate & { templatePrompt: typeof templatePrompt; finalPrompt: string };
      
      console.log('[TemplateGenerator] newTemplate created:');
      console.log('  - name:', newTemplate.name);
      console.log('  - hookType:', newTemplate.hookType);
      console.log('  - hookTypeName:', newTemplate.hookTypeName);
      
      setGeneratedTemplate(newTemplate);
      
      // 获取产品图片
      const productImages = selectedProduct?.allImages || [];
      const productId = selectedProduct?.id;
      const productName = selectedProduct?.name;
      
      // 保存到模板库
      const savedTemplate = await createFromGenerated(newTemplate, {
        productInfo: productInfo.trim(),
        sellingPoints: sellingPoints.trim(),
        useCreator,
        creatorGender,
        creatorAge,
        enableNarration,
        finalPrompt,
        productImages,
        productId,
        productName,
      });
      
      console.log('[TemplateGenerator] Template saved to library:', savedTemplate.id);
      console.log('[TemplateGenerator] Saved template hookType:', savedTemplate.hookType);
      console.log('[TemplateGenerator] Saved template hookTypeName:', savedTemplate.hookTypeName);
      console.log('[TemplateGenerator] Final prompt length:', finalPrompt.length);
      console.log('[TemplateGenerator] Product images:', productImages.length);
      
      // 跳转到模板库页面
      router.push('/shortfilm/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : '模板保存失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 应用模板
  const handleApply = () => {
    if (generatedTemplate && onApply) {
      onApply(generatedTemplate);
    }
  };

  // 重新生成
  const handleReset = () => {
    setStep(1);
    setGeneratedTemplate(null);
    setError(null);
  };

  // 复制模板 JSON
  const handleCopyJson = async () => {
    if (generatedTemplate) {
      await navigator.clipboard.writeText(JSON.stringify(generatedTemplate, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 下载模板
  const handleDownload = () => {
    if (generatedTemplate) {
      const blob = new Blob([JSON.stringify(generatedTemplate, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 获取选中的钩子信息
  const selectedHook = HOOK_TYPES.find(h => h.value === hookType);
  const selectedDuration = DURATION_OPTIONS.find(d => d.value === duration);
  const selectedCategory = PRODUCT_CATEGORIES.find(c => c.value === productCategory);

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
            step >= 1 ? 'bg-purple-600 text-white' : 'bg-slate-200'
          }`}>
            1
          </div>
          <span className="font-medium">配置参数</span>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
            step >= 2 ? 'bg-purple-600 text-white' : 'bg-slate-200'
          }`}>
            2
          </div>
          <span className="font-medium">预览结果</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：表单 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 模板基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Film className="w-5 h-5 text-purple-500" />
                  模板基本信息
                </CardTitle>
                <CardDescription>为模板命名，方便后续查找和使用</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">模板名称 *</Label>
                  <Input
                    id="templateName"
                    placeholder="例如：美妆产品痛点暴击模板"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    建议使用"产品类型+钩子类型+模板"的命名方式
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* 产品信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  产品信息
                </CardTitle>
                <CardDescription>从产品库选择产品，或手动输入产品信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 产品选择区域 */}
                {selectedProduct ? (
                  <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <div className="flex gap-3">
                      {/* 产品图片 */}
                      {selectedProduct.primaryImage && (
                        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
                          <img
                            src={selectedProduct.primaryImage}
                            alt={selectedProduct.name}
                            loading="lazy"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {/* 产品信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium truncate">{selectedProduct.name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={handleClearProduct}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {selectedProduct.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedProduct.allImages.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              {selectedProduct.allImages.length} 张图片
                            </Badge>
                          )}
                          {selectedProduct.sellingPoints.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Lightbulb className="w-3 h-3 mr-1" />
                              {selectedProduct.sellingPoints.length} 个卖点
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 可编辑的产品描述 */}
                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">可编辑产品描述（用于AI生成）</span>
                      </div>
                      <Textarea
                        placeholder="产品描述..."
                        className="min-h-[80px] bg-white dark:bg-slate-900"
                        value={productInfo}
                        onChange={(e) => setProductInfo(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 选择产品按钮 */}
                    <Button
                      variant="outline"
                      className="w-full h-20 border-dashed border-2 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                      onClick={() => setShowProductSelector(true)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package className="w-6 h-6 text-slate-400" />
                        <span className="text-sm">从产品库选择产品</span>
                      </div>
                    </Button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">
                          或手动输入
                        </span>
                      </div>
                    </div>

                    {/* 手动输入产品描述 */}
                    <div className="space-y-2">
                      <Label>
                        产品描述 <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        placeholder="请详细描述您的产品，包括：产品名称、主要功能、核心特点、使用场景等..."
                        className="min-h-[100px]"
                        value={productInfo}
                        onChange={(e) => setProductInfo(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-500" />
                    产品类别
                  </Label>
                  <Select value={productCategory} onValueChange={setProductCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择产品类别" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="mr-2">{cat.icon}</span>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategory && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedCategory.keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => setSellingPoints(prev => prev ? `${prev}、${kw}` : kw)}>
                          + {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-500" />
                    核心卖点
                  </Label>
                  <Textarea
                    placeholder="请输入产品的核心卖点，如：性价比高、功能独特、品质优良..."
                    className="min-h-[60px]"
                    value={sellingPoints}
                    onChange={(e) => setSellingPoints(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 产品选择器弹窗 */}
            <ProductSelector
              open={showProductSelector}
              onOpenChange={setShowProductSelector}
              onSelect={handleProductSelect}
              selectedProductId={selectedProduct?.id}
              title="选择产品"
              description="选择产品后，产品信息将自动填充到表单中，您可以在此基础上进行编辑"
            />

            {/* 开场钩子类型 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">开场钩子类型</CardTitle>
                <CardDescription>选择适合您产品的钩子类型，黄金3秒决定视频生死</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {HOOK_TYPES.map((h) => (
                    <div
                      key={h.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        hookType === h.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                      onClick={() => setHookType(h.value)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{h.icon}</span>
                        <span className="font-medium">{h.label}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {h.description}
                      </div>
                      {hookType === h.value && (
                        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="text-xs">
                            <span className="text-muted-foreground">话术模板：</span>
                            <span className="text-purple-600 dark:text-purple-400 ml-1">{h.template}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted-foreground">适用：</span>
                            <span className="ml-1">{h.suitableFor}</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            {h.examples.map((ex, i) => (
                              <p key={i} className="text-xs text-muted-foreground italic">
                                示例：{ex}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 视频时长 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-orange-500" />
                  视频时长
                </CardTitle>
                <CardDescription>不同时长适合不同的展示需求</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {DURATION_OPTIONS.map((d) => (
                    <div
                      key={d.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        duration === d.value
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      }`}
                      onClick={() => setDuration(d.value)}
                    >
                      <div className="font-bold text-2xl">{d.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{d.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">约 {d.segments} 个段落</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 达人出境选项 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-green-500" />
                  达人出境
                </CardTitle>
                <CardDescription>选择是否在视频中展示达人形象</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <div className="font-medium">启用达人出境</div>
                    <p className="text-sm text-muted-foreground">
                      开启后，AI将生成包含达人展示产品的场景，增强真实感和信任度
                    </p>
                  </div>
                  <Switch
                    checked={useCreator}
                    onCheckedChange={setUseCreator}
                  />
                </div>
                
                {/* 达人性别选择 */}
                {useCreator && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      达人性别
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          creatorGender === 'female'
                            ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/20'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        }`}
                        onClick={() => setCreatorGender('female')}
                      >
                        <div className="text-2xl mb-1">👩</div>
                        <div className="text-sm font-medium">女性达人</div>
                      </div>
                      <div
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          creatorGender === 'male'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        }`}
                        onClick={() => setCreatorGender('male')}
                      >
                        <div className="text-2xl mb-1">👨</div>
                        <div className="text-sm font-medium">男性达人</div>
                      </div>
                      <div
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          creatorGender === 'any'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        }`}
                        onClick={() => setCreatorGender('any')}
                      >
                        <div className="text-2xl mb-1">👤</div>
                        <div className="text-sm font-medium">不限</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      选择达人性别，AI将生成对应性别的达人形象。选择"不限"可由AI自动决定。
                    </p>
                  </div>
                )}
                
                {/* 达人年龄选择 */}
                {useCreator && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      达人年龄
                    </Label>
                    <div className="grid grid-cols-5 gap-2">
                      {AGE_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className={`p-2 rounded-lg border-2 cursor-pointer transition-all text-center ${
                            creatorAge === option.value
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                          }`}
                          onClick={() => {
                            setCreatorAge(option.value);
                            // 同步更新目标受众
                            setTargetAudience(option.value);
                          }}
                          title={option.description}
                        >
                          <div className="text-sm font-medium">{option.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      选择达人年龄范围，AI将生成符合该年龄段特征的达人形象。
                    </p>
                  </div>
                )}
                
                {/* 启用口播选项 */}
                {useCreator && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                    <div className="space-y-0.5">
                      <div className="font-medium flex items-center gap-2">
                        <span className="text-lg">🎙️</span>
                        启用口播
                      </div>
                      <p className="text-sm text-muted-foreground">
                        开启后，达人将在视频中口播解说产品，增强说服力和互动感
                      </p>
                    </div>
                    <Switch
                      checked={enableNarration}
                      onCheckedChange={setEnableNarration}
                    />
                  </div>
                )}
                
                {useCreator && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="text-sm text-green-700 dark:text-green-300">
                        <span className="font-medium">
                          达人出境模式已启用 · {creatorGender === 'female' ? '女性达人' : creatorGender === 'male' ? '男性达人' : '性别不限'} · {AGE_OPTIONS.find(o => o.value === creatorAge)?.label || creatorAge}
                        </span>
                        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                          AI将自动生成达人展示产品、使用产品等场景，提升视频感染力和转化率
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 错误提示 */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-red-600">
                {error}
              </div>
            )}

            {/* 生成按钮 */}
            <Button 
              onClick={handleGenerateClick} 
              disabled={isGenerating || !productInfo.trim()}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  正在保存模板...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  保存模板
                </>
              )}
            </Button>
          </div>

          {/* 右侧：方法论提示 */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Film className="w-5 h-5 text-purple-500" />
                  爆款方法论
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs">1</span>
                    黄金3秒法则
                  </h4>
                  <p className="text-xs text-muted-foreground pl-8">
                    开场前3秒决定观众是否继续观看，必须使用强力钩子抓住注意力
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">2</span>
                    中段爆点策略
                  </h4>
                  <p className="text-xs text-muted-foreground pl-8">
                    每5-10秒切换信息点，场景化痛点+产品解决方案，维持观众注意力
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">3</span>
                    结尾转化技巧
                  </h4>
                  <p className="text-xs text-muted-foreground pl-8">
                    明确行动号召，限时优惠刺激，社交证明增强信任，制造紧迫感
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">当前配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">产品类别</span>
                  <Badge variant="outline">{selectedCategory?.icon} {selectedCategory?.label}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">钩子类型</span>
                  <Badge variant="outline">{selectedHook?.icon} {selectedHook?.label}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">视频时长</span>
                  <Badge variant="outline">{duration}秒</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">预计段落</span>
                  <Badge variant="outline">{selectedDuration?.segments} 段</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">适用场景</span>
                  <span className="text-xs text-right max-w-[150px]">{selectedHook?.suitableFor}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">达人出境</span>
                  <Badge variant={useCreator ? 'default' : 'outline'} className={useCreator ? 'bg-green-500 hover:bg-green-600' : ''}>
                    {useCreator ? '✓ 已启用' : '未启用'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 生成结果 */}
          {generatedTemplate && (
            <>
              {/* 模板概览 */}
              <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{generatedTemplate.name}</CardTitle>
                      <CardDescription className="mt-1">{generatedTemplate.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyJson}>
                        {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copied ? '已复制' : '复制 JSON'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{generatedTemplate.duration}秒</Badge>
                    <Badge variant="secondary">
                      {HOOK_TYPES.find(h => h.value === generatedTemplate.hookType)?.label}
                    </Badge>
                    <Badge variant="outline">
                      {PRODUCT_CATEGORIES.find(c => c.value === generatedTemplate.category)?.label}
                    </Badge>
                    <Badge variant="outline">{generatedTemplate.targetAudience}</Badge>
                    <Badge variant="outline">{generatedTemplate.hookType}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 段落详情 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-500" />
                    脚本段落详情
                    <Badge variant="secondary" className="ml-2">{generatedTemplate.segments.length} 段</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="overview">概览</TabsTrigger>
                      <TabsTrigger value="detail">详细</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4">
                      <div className="space-y-3">
                        {generatedTemplate.segments.map((seg, index) => (
                          <div 
                            key={seg.id} 
                            className="p-4 border rounded-lg hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                                  {seg.order}
                                </span>
                                <span className="font-medium">段落 {seg.order}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{seg.duration}秒</Badge>
                                {seg.hookType && (
                                  <Badge className="bg-yellow-500 text-white">{seg.hookType}</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{seg.description}</p>
                            {seg.sellingPoint && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Target className="w-3 h-3" />
                                卖点：{seg.sellingPoint}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="detail" className="mt-4">
                      <div className="space-y-4">
                        {generatedTemplate.segments.map((seg, index) => (
                          <div key={seg.id} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">段落 {seg.order}</h4>
                              <Badge variant="outline">{seg.duration}秒</Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs text-muted-foreground">内容描述</Label>
                                <p className="text-sm mt-1">{seg.description}</p>
                              </div>
                              
                              <Separator />
                              
                              <div>
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> 图片提示词
                                </Label>
                                <p className="text-sm mt-1 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                                  {seg.imagePrompt}
                                </p>
                              </div>
                              
                              {seg.videoPrompt && (
                                <>
                                  <Separator />
                                  <div>
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Film className="w-3 h-3" /> 视频提示词
                                    </Label>
                                    <p className="text-sm mt-1 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                                      {seg.videoPrompt}
                                    </p>
                                  </div>
                                </>
                              )}
                              
                              <div className="flex gap-2 pt-2">
                                {seg.hookType && (
                                  <Badge className="bg-yellow-500 text-white">{seg.hookType}</Badge>
                                )}
                                {seg.sellingPoint && (
                                  <Badge variant="secondary">
                                    <Target className="w-3 h-3 mr-1" />
                                    {seg.sellingPoint}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleReset}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
                {showApplyButton && onApply && (
                  <Button onClick={handleApply} size="lg" disabled={isApplying}>
                    {isApplying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    应用模板
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 确认生成对话框 */}
      {/* 确认保存对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认保存模板</DialogTitle>
            <DialogDescription>
              模板将保存以下配置信息，在生成视频脚本时使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {/* 模板名称 */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <Film className="w-4 h-4" />
                模板名称
              </h4>
              <p className="text-sm font-medium">
                {templateName || `${productInfo.substring(0, 15)}模板`}
              </p>
            </div>

            {/* 参数预览 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">模板配置</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">产品类别：</span>
                  <Badge variant="outline" className="ml-1">
                    {selectedCategory?.icon} {selectedCategory?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">视频时长：</span>
                  <Badge variant="outline" className="ml-1">{duration}秒</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">钩子类型：</span>
                  <Badge variant="outline" className="ml-1">
                    {selectedHook?.icon} {selectedHook?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">达人出境：</span>
                  <Badge variant={useCreator ? 'default' : 'outline'} className={`ml-1 ${useCreator ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                    {useCreator ? '已启用' : '未启用'}
                  </Badge>
                </div>
                {useCreator && (
                  <div>
                    <span className="text-muted-foreground">达人性别：</span>
                    <Badge variant="outline" className="ml-1">
                      {creatorGender === 'female' ? '👩 女性' : creatorGender === 'male' ? '👨 男性' : '👤 不限'}
                    </Badge>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">目标受众：</span>
                  <span className="ml-1">{targetAudience || '18-35岁年轻消费者'}</span>
                </div>
              </div>
            </div>

            {/* 产品信息 */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">产品信息</h4>
              <div className="text-sm text-muted-foreground max-h-20 overflow-y-auto whitespace-pre-wrap">
                {productInfo}
              </div>
              {sellingPoints && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">核心卖点：</span>{sellingPoints}
                </div>
              )}
            </div>

            {/* 达人出境提示 */}
            {useCreator && (
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <span className="font-medium">达人出境模式</span>
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      图片提示词将包含达人形象描述，达人将展示产品、与观众互动
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* API 配置 */}
            {(() => {
              const textApiConfig = getDefaultTextApi();
              const maskApiKey = (key: string | undefined) => {
                if (!key) return '未设置';
                if (key.length <= 8) return '****';
                return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
              };
              
              return (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400">API 配置</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <span className="ml-1 font-mono">{textApiConfig?.model || '默认'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">API Key:</span>
                      <span className="ml-1 font-mono">{maskApiKey(textApiConfig?.apiKey)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 完整请求体 - Gemini API */}
            {(() => {
              const textApiConfig = getDefaultTextApi();
              const maskApiKey = (key: string | undefined) => {
                if (!key) return '未设置';
                if (key.length <= 8) return '****';
                return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
              };
              
              // 构建完整的系统提示词（与后端一致）
              const systemPromptContent = `你是一位专业的短视频脚本策划专家，精通TikTok、抖音、小红书等平台的爆款带货短视频创作方法论。

## 核心：黄金3秒钩子法则

开场3秒决定视频生死，必须用强力钩子抓住注意力。以下是经过验证的10种高转化钩子：

### 1. 痛点暴击钩子
直接戳中用户痛点，制造"这说的就是我"的共鸣感。
- 结构："你是不是也(具体痛点)?"
- 案例："你是不是也每天忙到深夜，皮肤却越来越差?"
- 适用：功能性产品、解决痛点的产品

### 2. 颠覆认知钩子
挑战普遍认知，制造信息差和好奇心。
- 结构："别再(错误做法)了!/ 90%的人都不知道..."
- 案例："别再用洗面奶洗脸了，皮肤科医生说这招更管用!"
- 适用：有独特卖点、能打破常规的产品

### 3. 结果前置钩子
直接展示惊人结果，激发"我也想要"的欲望。
- 结构："(时间)内，(达成了什么惊人结果)"
- 案例："30天，我从暗黄肌变成自带高光!"
- 适用：效果明显、有对比性的产品

### 4. 悬念提问钩子
抛出反常问题，利用完形心理迫使观看。
- 结构："为什么(反常现象)?/ 你绝对猜不到..."
- 案例："为什么有些女生不化妆，皮肤却比化妆的还好?"
- 适用：有故事性、揭秘性的产品

### 5. 身份宣称钩子
精准锁定目标人群，制造"被召唤"的归属感。
- 结构："所有(特定人群)注意!/ 刷到这条视频的(人群)恭喜你!"
- 案例："所有熬夜党注意!这可能是你今年刷到最有价值的视频!"
- 适用：有明确目标受众的产品

### 6. 数据冲击钩子
用具体数字增强可信度和冲击力。
- 结构："(权威数据)+ (反差结论)"
- 案例："2024调研显示：73%的女生用错了护肤品，难怪越用越干!"
- 适用：有数据支撑、专业性的产品

### 7. 对比反差钩子
用强烈的前后对比制造视觉冲击。
- 结构："左边(失败案例) vs 右边(成功案例)"
- 案例："同样是素颜出门，左边是我，右边也是我——只差这一个步骤!"
- 适用：效果对比明显的产品

### 8. 优惠稀缺钩子
制造紧迫感和稀缺感，促成立即行动。
- 结构："限时/限量信息 + 不行动的损失"
- 案例："库存只剩200单，这个价格错过再等一年!"
- 适用：促销、限时优惠活动

### 9. 高能片段钩子
把最有情绪张力的片段直接放到开头。
- 结构：直接展示戏剧性/冲突性片段
- 案例：展示使用产品时的惊喜表情或惊艳效果
- 适用：有强烈视觉效果的产品

### 10. 社交货币钩子
让用户感觉"我知道别人不知道的"，制造优越感。
- 结构："内行人才知道.../ 只有小众圈子才知道..."
- 案例："柜姐不会告诉你的护肤秘密，今天全公开!"
- 适用：有行业秘密、小众好物

## 开场吸引力公式
吸引力 = (痛点精准度 × 形式新颖度) ÷ (认知复杂度 + 执行难度)
- 痛点越精准、形式越新颖，吸引力越强
- 认知复杂度越低、执行难度越低，吸引力越强

## 中段爆点策略（维持注意力）
- 每5-8秒切换信息点，保持节奏
- 痛点场景化：用具象场景替代抽象描述
- 产品证明：对比测试、数据量化、细节特写
- 情绪递进：问题→颠覆→解决方案

## 结尾转化技巧
- 明确行动指令："点击下方小黄车"
- 风险消除："支持7天无理由退换"
- 制造紧迫感："限量X件，售完即止"
- 价值承诺："让你(获得具体好处)"

## 重要：图片与视频的关系

短片创作流程：先生成每段的图片，然后以图片作为首帧生成视频。
- **段落1**：只需要图片提示词，不需要视频提示词（开场图片，后续视频从段落2开始）
- **段落2及以后**：需要图片提示词和视频提示词
- **视频提示词**：描述从当前段落的图片开始的动态效果、运镜、转场

${useCreator ? `## 达人出境模式（已启用）

**重要：本视频需要达人出境展示产品！**

${creatorGender === 'female' ? `### 达人性别要求
**必须使用女性达人**，年龄约25-35岁，形象气质佳，符合目标受众审美。

### 女性达人形象模板
- "一位年轻女性达人（25-30岁），皮肤白皙，穿着简约时尚的白色上衣，化淡妆，气质温婉亲切..."
- "女性达人微笑着拿起产品，眼神温柔看向镜头，手势优雅..."
- "女性达人轻轻转动产品，展示各个角度的细节，表情满意..."
` : creatorGender === 'male' ? `### 达人性别要求
**必须使用男性达人**，年龄约25-35岁，形象阳光自信，符合目标受众审美。

### 男性达人形象模板
- "一位年轻男性达人（25-35岁），面容干净清爽，穿着简约休闲的T恤或衬衫，气质阳光自信..."
- "男性达人自信地拿起产品，眼神坚定看向镜头，手势有力..."
- "男性达人展示产品细节，表情专注专业..."
` : `### 达人性别要求
**性别不限**，可由AI根据产品特点自行选择最合适的达人性别。年龄约25-35岁，形象符合目标受众审美。
`}

### 达人出境要求
1. **开场段落**：达人出镜，手持或展示产品，用亲切自然的语气说出开场白
2. **产品展示段落**：达人展示产品细节、使用方法、效果对比
3. **互动感**：达人与镜头/观众有眼神交流，手势丰富自然
4. **专业形象**：达人穿着得体，符合产品调性和目标受众审美

### 图片提示词中必须包含
- 达人形象描述（年龄、${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : '性别'}、外貌特征、穿着风格）
- 达人姿态和动作（手持产品、展示细节、使用演示）
- 表情和眼神（自信、亲切、惊讶、满意等）
- 达人与产品的互动方式

### 视频提示词中必须包含
- 达人的动作变化（根据具体产品设计）
- 手势和表情的自然过渡
- 镜头运动与达人配合（推近达人手部特写、拉远展示全身等）

### 达人描述模板
- "一位年轻${creatorGender === 'female' ? '女性' : creatorGender === 'male' ? '男性' : ''}达人（25-30岁），穿着简约时尚..."
- "达人微笑着拿起产品，眼神看向镜头..."
- "达人轻轻转动产品，展示各个角度的细节..."
` : `## 产品展示模式（达人不出境）

**本视频以产品为主体，不展示达人形象。**

### 产品展示要求
1. **开场段落**：产品特写或使用场景，配合文字或旁白开场
2. **产品展示段落**：产品细节、使用效果、场景应用
3. **视觉效果**：强调光影、质感、构图的专业性
4. **动态展示**：产品旋转、开盖、使用过程等

### 图片提示词重点
- 产品主体清晰，占据画面主要位置
- 光影质感高级，适合电商展示
- 背景简洁或符合产品使用场景
- 必要时添加道具辅助展示

### 视频提示词重点
- 产品的动态效果（旋转、开盖、倒出等）
- 镜头运动（推拉摇移、特写到全景）
- 场景转换和光影变化
`}## 输出要求

生成 ${imageSegmentCount} 个图片段落，用于生成 ${videoSegmentCount} 个视频片段（从段落2开始）：

每个段落包含：
1. **order**: 段落序号（从1开始）
2. **duration**: 该段时长（秒）
3. **description**: 该段落的内容描述
4. **imagePrompt**: 图片生成提示词（详细描述画面内容、构图、光影、产品展示方式，专业电商摄影风格）
5. **videoPrompt**: 视频生成提示词（仅段落2及以后需要，描述从当前图片开始的动态效果、运镜、转场）
6. **hookType**: 该段落使用的钩子类型（仅第一个段落需要填写，从上述10种钩子中选择最合适的一种）
7. **sellingPoint**: 该段落突出的产品卖点

## 格式要求
- 必须以JSON数组格式输出
- 所有内容使用中文
- 段落1的videoPrompt必须为空字符串""
- 图片提示词要详细、具体，适合AI生图
- 视频提示词要与图片内容强相关，描述画面中的运动变化
- 第一个段落必须使用黄金3秒钩子开场，hookType要明确标注使用的钩子类型`;

              // 构建用户消息
              const userMessageContent = `请为以下产品创作一个${duration}秒的爆款带货短视频脚本模板：

## 产品信息
${productInfo.trim()}

## 产品类别
${selectedCategory?.label || '综合产品'}

## 目标受众
${targetAudience.trim() || '18-35岁年轻消费者'}

## 核心卖点
${sellingPoints.trim() || '品质优良、性价比高、使用方便'}

## 指定钩子类型
**必须使用：${selectedHook?.label || '痛点暴击'}钩子**
- 描述：${selectedHook?.description || ''}
- 话术模板：${selectedHook?.template || ''}
- 参考示例：${selectedHook?.examples?.join(' / ') || ''}

## 要求
1. 第一个段落（前3秒）必须使用【${selectedHook?.label || '痛点暴击'}钩子】开场，严格按照上述话术模板设计开场白
2. 第一个段落的hookType字段必须填写"${selectedHook?.label || '痛点暴击'}钩子"
3. 中间段落展示产品卖点和使用场景，每5-8秒切换信息点
4. 最后一个段落包含明确的行动号召和紧迫感
5. 生成 ${imageSegmentCount} 个图片段落
6. 段落1的videoPrompt必须为空字符串""
7. 段落2及以后的videoPrompt描述从该段图片开始的动态效果
8. 图片和视频提示词要高度相关，视频是图片的动态延续
${useCreator ? `9. **达人出境要求**：每个段落的图片提示词必须包含达人形象描述，达人需要展示产品、与观众互动
10. 达人形象要统一，年龄约25-35岁，穿着风格符合产品调性` : `9. **产品展示模式**：以产品为主体，不出现人物，重点展示产品质感和细节`}
11. 直接输出JSON数组，不要包含其他文字`;

              // 完整的Gemini API请求体
              const fullRequestBody = {
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: systemPromptContent + '\n\n' + userMessageContent }]
                  }
                ],
                generationConfig: {
                  temperature: 0.8,
                  maxOutputTokens: 8192,
                }
              };

              return (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-700 dark:text-slate-300">完整 Gemini API 请求体</h4>
                    <div className="text-xs text-muted-foreground">
                      Endpoint: {textApiConfig?.baseUrl || '未设置'}/models/{textApiConfig?.model || '默认'}:generateContent
                    </div>
                  </div>
                  <pre className="text-xs font-mono bg-background p-3 rounded border overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(fullRequestBody, null, 2)}
                  </pre>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>API Key: {maskApiKey(textApiConfig?.apiKey)}</span>
                    <span>|</span>
                    <span>Temperature: 0.8</span>
                    <span>|</span>
                    <span>MaxTokens: 8192</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmGenerate}>
              <Sparkles className="w-4 h-4 mr-2" />
              确认保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
