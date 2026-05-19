'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  Sparkles,
  Upload,
  Loader2,
  X,
  AlertCircle,
  Plus,
  Video,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScriptSegment, generateId } from '@/lib/shortfilm';
import { Product } from '@/lib/products';
import { TextApiConfig } from '@/lib/system-config';
import { Template as LibraryTemplate } from '@/lib/template-library';
import { ModelSelector } from '@/components/model-selector';

const SCRIPT_PROMPT_MAX_LENGTH = 20000;

interface Step1ScriptGenerationProps {
  remakeMode: boolean;
  isAdmin: boolean;
  scriptGenerationMode: 'ai' | 'manual';
  onScriptGenerationModeChange: (mode: 'ai' | 'manual') => void;
  productImages: Array<{ key: string; url: string }>;
  productDescription: string;
  selectedProductId: string | null;
  selectedProductName: string | null;
  scriptPrompt: string;
  duration: number;
  isGeneratingScript: boolean;
  scriptTaskError: string | null;
  scriptRequestBody: Record<string, unknown> | null;
  selectedAITemplate: LibraryTemplate | null;
  onSelectedAITemplateChange: (template: LibraryTemplate | null) => void;
  productList: Product[];
  selectedTextModelId: string;
  onSelectedTextModelIdChange: (id: string) => void;
  selectedTextModelConfig: TextApiConfig | null;
  onSelectedTextModelConfigChange: (config: TextApiConfig) => void;
  onProductSelect: (productId: string | null) => void;
  onProductImagesChange: (images: Array<{ key: string; url: string }>) => void;
  onProductDescriptionChange: (desc: string) => void;
  onScriptPromptChange: (prompt: string) => void;
  onDurationChange: (duration: number) => void;
  onGenerateScript: () => void;
  onRetryScript: () => void;
  onManualNext: (segments: ScriptSegment[]) => void;
  onShowAITemplateSelector: () => void;
  remakeVideoUrl: string | null;
  remakeSelectedFile: File | null;
  remakeUploading: boolean;
  remakeUploadProgress: number;
  remakeVideoUrlInput: string;
  isRemakeParsing: boolean;
  remakeParseError: string | null;
  remakeVideoDuration: number;
  onRemakeVideoUrlInputChange: (value: string) => void;
  onRemakeFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemakeUpload: () => void;
  onRemakeLinkSubmit: () => void;
  onRemakeParse: () => void;
  onRemakeVideoClear: () => void;
  onProductImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Step1ScriptGeneration({
  remakeMode,
  isAdmin,
  scriptGenerationMode,
  onScriptGenerationModeChange,
  productImages,
  productDescription,
  selectedProductId,
  selectedProductName,
  scriptPrompt,
  duration,
  isGeneratingScript,
  scriptTaskError,
  scriptRequestBody,
  selectedAITemplate,
  onSelectedAITemplateChange,
  productList,
  selectedTextModelId,
  onSelectedTextModelIdChange,
  selectedTextModelConfig,
  onSelectedTextModelConfigChange,
  onProductSelect,
  onProductImagesChange,
  onProductDescriptionChange,
  onScriptPromptChange,
  onDurationChange,
  onGenerateScript,
  onRetryScript,
  onManualNext,
  onShowAITemplateSelector,
  remakeVideoUrl,
  remakeSelectedFile,
  remakeUploading,
  remakeUploadProgress,
  remakeVideoUrlInput,
  isRemakeParsing,
  remakeParseError,
  remakeVideoDuration,
  onRemakeVideoUrlInputChange,
  onRemakeFileSelect,
  onRemakeUpload,
  onRemakeLinkSubmit,
  onRemakeParse,
  onRemakeVideoClear,
  onProductImageUpload,
}: Step1ScriptGenerationProps) {
  return (
    <div className="space-y-6">
      {remakeMode ? (
        <>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">视频复刻</h2>
            <p className="text-sm text-muted-foreground mb-4">
              上传或链接一个视频，AI将自动分析并生成复刻脚本
            </p>

            {remakeVideoUrl && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-green-700 dark:text-green-300">
                    视频已就绪
                  </span>
                  <Button variant="ghost" size="sm" onClick={onRemakeVideoClear}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <video
                  src={remakeVideoUrl}
                  className="w-full max-h-48 rounded-lg object-contain"
                  controls
                />
                {remakeVideoDuration > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    视频时长: {remakeVideoDuration}秒
                  </p>
                )}
              </div>
            )}

            {!remakeVideoUrl && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    拖拽视频文件到此处，或点击选择文件
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    支持 MP4、MOV、AVI、WebM，最大 500MB
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                      className="hidden"
                      onChange={onRemakeFileSelect}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span>选择视频文件</span>
                    </Button>
                  </label>
                </div>

                {remakeSelectedFile && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[200px]">{remakeSelectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(remakeSelectedFile.size / (1024 * 1024)).toFixed(1)}MB)
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={onRemakeUpload}
                      disabled={remakeUploading}
                    >
                      {remakeUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          上传中 {remakeUploadProgress}%
                        </>
                      ) : (
                        '上传'
                      )}
                    </Button>
                  </div>
                )}

                {remakeUploading && (
                  <Progress value={remakeUploadProgress} className="h-2" />
                )}

                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t" />
                  <span className="text-sm text-muted-foreground">或</span>
                  <div className="flex-1 border-t" />
                </div>

                <div className="space-y-2">
                  <Label>视频链接</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入 TikTok/YouTube/抖音/B站等视频链接"
                      value={remakeVideoUrlInput}
                      onChange={(e) => onRemakeVideoUrlInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onRemakeLinkSubmit();
                      }}
                    />
                    <Button
                      onClick={onRemakeLinkSubmit}
                      disabled={remakeUploading || !remakeVideoUrlInput.trim()}
                    >
                      {remakeUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    支持 TikTok、YouTube、Instagram、抖音、B站、小红书、快手等平台
                  </p>
                </div>
              </div>
            )}

            {remakeVideoUrl && (
              <div className="mt-4 space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onRemakeParse}
                  disabled={isRemakeParsing}
                >
                  {isRemakeParsing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI 正在深度解析视频...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      AI 深度解析视频
                    </>
                  )}
                </Button>
                {isRemakeParsing && (
                  <p className="text-sm text-center text-muted-foreground">
                    解析过程可能需要1-3分钟，请耐心等待...
                  </p>
                )}
                {remakeParseError && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {remakeParseError}
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">脚本生成方式</h2>

            <RadioGroup value={scriptGenerationMode} onValueChange={(value: 'ai' | 'manual') => onScriptGenerationModeChange(value)}>
              <div
                className={cn(
                  'flex items-start space-x-3 mb-4 p-4 border-2 rounded-lg cursor-pointer transition-all',
                  scriptGenerationMode === 'ai'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
                onClick={() => onScriptGenerationModeChange('ai')}
              >
                <RadioGroupItem value="ai" id="ai-generation" className="mt-1 pointer-events-none" />
                <div className="flex-1">
                  <Label htmlFor="ai-generation" className="font-medium cursor-pointer">
                    AI自动生成脚本
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    根据产品信息自动生成脚本，包含产品介绍、卖点、购买引导等
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  'flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all',
                  scriptGenerationMode === 'manual'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
                onClick={() => onScriptGenerationModeChange('manual')}
              >
                <RadioGroupItem value="manual" id="manual-input" className="mt-1 pointer-events-none" />
                <div className="flex-1">
                  <Label htmlFor="manual-input" className="font-medium cursor-pointer">
                    手动输入提示词
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    自定义每个段落的图片和视频提示词，无需产品信息
                  </p>
                </div>
              </div>
            </RadioGroup>
          </Card>

          {scriptGenerationMode === 'ai' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">生成视频脚本</h2>

              {selectedAITemplate && (
                <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      已选择模板: {selectedAITemplate.name}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onSelectedAITemplateChange(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {selectedAITemplate.description}
                  </p>
                </div>
              )}

              <div className="space-y-2 mb-4">
                <Label>选择已有产品（可选）</Label>
                <Select
                  value={selectedProductId || '__none__'}
                  onValueChange={(value) => onProductSelect(value === '__none__' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择产品，自动填充产品信息..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不选择产品</SelectItem>
                    {productList.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          {product.images[0]?.url && (
                            <img
                              src={product.images[0].url}
                              alt=""
                              loading="lazy"
                              className="w-5 h-5 rounded object-cover"
                            />
                          )}
                          <span>{product.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProductName && (
                  <div className="flex items-center gap-2 text-sm">
                    {productList.find((p) => p.id === selectedProductId) ? (
                      <p className="text-muted-foreground">
                        已选择: <span className="font-medium text-foreground">{selectedProductName}</span>
                      </p>
                    ) : (
                      <p className="text-amber-600 dark:text-amber-500">
                        ⚠️ 产品已删除: <span className="font-medium">{selectedProductName}</span>
                        <span className="text-muted-foreground ml-1">(产品信息已保存在项目中)</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <Label>产品图片</Label>
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                      <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      <button
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5"
                        onClick={() => {
                          const newImages = productImages.filter((_, i) => i !== idx);
                          onProductImagesChange(newImages);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={onProductImageUpload}
                    />
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </label>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <Label>产品描述</Label>
                <Textarea
                  value={productDescription}
                  onChange={(e) => onProductDescriptionChange(e.target.value)}
                  placeholder="描述产品的特点、卖点等..."
                  rows={3}
                />
              </div>

              {isAdmin && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <Label>脚本要求</Label>
                    <span className={cn(
                      'text-xs',
                      scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH
                        ? 'text-red-500 font-medium'
                        : scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH * 0.9
                        ? 'text-orange-500'
                        : 'text-muted-foreground'
                    )}>
                      {scriptPrompt.length.toLocaleString()} / {SCRIPT_PROMPT_MAX_LENGTH.toLocaleString()} 字
                    </span>
                  </div>
                  <Textarea
                    value={scriptPrompt}
                    onChange={(e) => onScriptPromptChange(e.target.value)}
                    placeholder="对脚本的具体要求，如风格、时长、场景等..."
                    rows={4}
                    className={cn(
                      scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH && 'border-red-500 focus-visible:ring-red-500'
                    )}
                  />
                  {scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      脚本要求已超过字数限制，请精简内容
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 mb-4">
                <Label>视频时长</Label>
                <Select value={duration.toString()} onValueChange={(v) => onDurationChange(parseInt(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8秒 (2段落)</SelectItem>
                    <SelectItem value="16">16秒 (3段落)</SelectItem>
                    <SelectItem value="24">24秒 (4段落)</SelectItem>
                    <SelectItem value="32">32秒 (5段落)</SelectItem>
                    <SelectItem value="40">40秒 (6段落)</SelectItem>
                    <SelectItem value="48">48秒 (7段落)</SelectItem>
                    <SelectItem value="56">56秒 (8段落)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="space-y-2 mb-6">
                  <Label>文本生成模型</Label>
                  <ModelSelector
                    type="text"
                    value={selectedTextModelId}
                    onChange={(id, config) => {
                      onSelectedTextModelIdChange(id);
                      onSelectedTextModelConfigChange(config as TextApiConfig);
                    }}
                    placeholder="选择文本模型"
                  />
                </div>
              )}

              <Button
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={isGeneratingScript || !productDescription.trim() || scriptPrompt.length > SCRIPT_PROMPT_MAX_LENGTH}
                onClick={onGenerateScript}
              >
                {isGeneratingScript ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    生成脚本
                  </>
                )}
              </Button>

              {scriptTaskError && !isGeneratingScript && (
                <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-700 font-medium">生成失败</p>
                      <p className="text-sm text-red-600 mt-1 whitespace-pre-wrap">{scriptTaskError}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-100"
                      onClick={onRetryScript}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {scriptGenerationMode === 'manual' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">
                  视频时长 <span className="text-red-500">*</span>
                </h3>
                <Badge variant="secondary">
                  将生成 {Math.floor(duration / 8) + 1} 个段落
                </Badge>
              </div>

              <RadioGroup value={duration.toString()} onValueChange={(v) => onDurationChange(parseInt(v))}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[8, 16, 24, 32, 40, 48, 56].map((d) => (
                    <div
                      key={d}
                      className={cn(
                        'flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all',
                        duration === d
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                      onClick={() => onDurationChange(d)}
                    >
                      <div className="text-xl font-bold mb-1">{d}秒</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.floor(d / 8) + 1}个段落
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              <Button
                className="w-full h-12 mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={!duration}
                onClick={() => {
                  const segmentCount = Math.floor(duration / 8) + 1;
                  const segments: ScriptSegment[] = [];
                  for (let i = 0; i < segmentCount; i++) {
                    segments.push({
                      id: generateId('seg'),
                      order: i + 1,
                      duration: 8,
                      description: '',
                      imagePrompt: '',
                      videoPrompt: '',
                    });
                  }
                  onManualNext(segments);
                }}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                下一步：确认脚本
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
