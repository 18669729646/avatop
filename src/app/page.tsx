'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { authFetch, useAuth } from '@/lib/auth-context';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  ImagePlus, X, Download, History, Trash2, User, Package, Check, Sparkles,
  FileText, ChevronLeft, ChevronRight, Loader2, ChevronDown, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { PromptTemplateDialog } from '@/components/prompt-template-dialog';
import { PromptTemplate } from '@/lib/prompt-templates';
import { 
  getImageHistory, removeImageFromHistory, 
  ImageHistoryItem,
  getCharacterLibrary,
  CharacterItem,
} from '@/lib/history';
import {
  Product,
  getProducts,
  getProductSelection,
} from '@/lib/products';
import {
  addTaskToQueue,
  ImageTaskParams,
} from '@/lib/queue';
import { getDefaultImageApi, ImageApiConfig } from '@/lib/system-config';
import { ModelSelector } from '@/components/model-selector';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { useTaskEvents } from '@/hooks/use-task-events';
import { OnboardingGuide } from '@/components/onboarding-guide';
import { useQueueStatsContext } from '@/lib/queue-stats-context';

const ASPECT_RATIOS = [
  { value: '1:1', label: '正方形 (1:1)' },
  { value: '16:9', label: '横版宽屏 (16:9)' },
  { value: '9:16', label: '竖版手机 (9:16)' },
  { value: '4:3', label: '传统横版 (4:3)' },
  { value: '3:4', label: '传统竖版 (3:4)' },
  { value: '4:5', label: '社交媒体 (4:5)' },
];

const RESOLUTIONS = [
  { value: '1K', label: '标准 (1K)' },
  { value: '2K', label: '高清 (2K)' },
  { value: '4K', label: '超高清 (4K)' },
];

const DEFAULT_CONSISTENCY_PROMPT = '真实手机拍摄质感，必须保证生成的图片中角色与参考图中完全一致，并换一身衣服。必须保证生成的图片中产品与参考图中完全一致的外形不允许任何修改。';

interface UploadedImage {
  id: string;
  file?: File; // 保留用于兼容，但不再使用
  preview: string; // Blob URL 用于预览
  url?: string; // 上传后的对象存储 URL（用于发送给 API）
  uploading?: boolean; // 上传中状态
}

export default function ImageGenerator() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModelConfig, setSelectedModelConfig] = useState<ImageApiConfig | null>(null);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [resolution, setResolution] = useState('2K');
  const [prompt, setPrompt] = useState('');
  const [consistencyPrompt, setConsistencyPrompt] = useState(DEFAULT_CONSISTENCY_PROMPT);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false); // 拖拽悬停状态

  const [characterLibrary, setCharacterLibrary] = useState<CharacterItem[]>([]);
  const [productLibrary, setProductLibrary] = useState<Product[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  
  // 新手引导状态
  const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
  
  // 确认对话框状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTaskParams, setPendingTaskParams] = useState<ImageTaskParams | null>(null);
  
  // 预览请求体状态
  const [previewData, setPreviewData] = useState<{
    error?: string;
    requestFormat?: string;
    endpoint?: string;
    model?: string;
    imageCount?: number;
    // Gemini 格式
    parts?: Array<{
      type: string;
      imageInfo?: {
        type: string;
        url?: string;
      };
    }>;
    // NanoBanana 格式
    imageInfos?: Array<{
      type: string;
      url?: string;
      note?: string;
    }>;
    rawRequestBody?: Record<string, unknown>;
    requestSize?: string;
    generationConfig?: Record<string, unknown>;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { queueStats, refreshQueueStats } = useQueueStatsContext();
  
  // 折叠状态
  const [expandedSections, setExpandedSections] = useState({
    upload: true,
    character: false,
    product: false,
    history: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [charactersResult, productsResult, images] = await Promise.all([
          getCharacterLibrary().catch(() => []),
          getProducts().catch(() => []),
          getImageHistory().catch(() => []),
        ]);
        const characters = Array.isArray(charactersResult) ? charactersResult : charactersResult.data;
        const products = Array.isArray(productsResult) ? productsResult : productsResult.data;
        setCharacterLibrary(characters || []);
        setProductLibrary(products || []);
        setImageHistory(images || []);
      } catch (error) {
        console.log('[Page] Failed to load initial data:', error);
      }
    };
    
    loadData();
  }, [user]);

  // 检查是否显示新手引导
  useEffect(() => {
    // 延迟检查，确保 localStorage 和 user 都已加载完成
    const checkAndShowGuide = () => {
      try {
        const dontShow = localStorage.getItem('onboarding_dont_show');
        
        // 检查 URL 参数，如果包含 showGuide=true 则强制显示
        const urlParams = new URLSearchParams(window.location.search);
        const forceShow = urlParams.get('showGuide') === 'true';
        
        console.log('[新手引导] 检查条件:', {
          hasUser: !!user,
          userId: user?.id,
          dontShow,
          forceShow,
          shouldShow: !!user && (!dontShow || forceShow)
        });

        // 在以下情况显示引导：
        // 1. 已登录且 localStorage 中没有 'onboarding_dont_show' = 'true' 的明确标记
        // 2. 或者通过 URL 参数强制显示
        // 注意：只有 dontShow 严格等于 'true' 字符串时才不显示，其他值（包括 null/undefined/false/'false'）都显示
        if (user && (dontShow !== 'true' || forceShow)) {
          console.log('[新手引导] 触发显示');
          setShowOnboardingGuide(true);
          
          // 清除 URL 参数（避免刷新时重复显示）
          if (forceShow) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        }
      } catch (error) {
        console.error('[新手引导] 检查失败:', error);
      }
    };

    // 延迟 2 秒检查，让页面和数据都完全加载
    const timer = setTimeout(checkAndShowGuide, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  // SSE 实时更新任务状态
  useTaskEvents(
    async () => {
      // 任务状态变化时，刷新队列统计和历史图片
      const [, images] = await Promise.all([
        refreshQueueStats(),
        getImageHistory(),
      ]);
      setImageHistory(images);
    },
    { enabled: true }
  );

  // 上传单张图片到临时存储（带压缩）
  const uploadImageToStorage = async (file: File, imageId: string): Promise<string> => {
    // 压缩图片到 2K（2048px）以内，质量 100%
    const compressedBlob = await compressImage(file, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 1,
    });
    
    console.log(`[上传] 压缩: ${(file.size / 1024).toFixed(1)}KB → ${(compressedBlob.size / 1024).toFixed(1)}KB`);
    
    const formData = new FormData();
    formData.append('file', compressedBlob, file.name);
    formData.append('folder', `temp/${imageId}`);
    
    const response = await authFetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    if (result.success && result.url) {
      return result.url;
    }
    throw new Error(result.error || '上传失败');
  };

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // 先创建占位记录（显示上传中状态）
    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));
    
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 并行处理所有图片，上传到对象存储获取 URL
    const processPromises = newImages.map(async (image, index) => {
      const file = imageFiles[index];
      try {
        const url = await uploadImageToStorage(file, image.id);
        return { id: image.id, url, success: true };
      } catch (error) {
        console.error('上传失败:', error);
        return { id: image.id, error: error instanceof Error ? error.message : '上传失败', success: false };
      }
    });

    const results = await Promise.all(processPromises);

    // 更新状态
    results.forEach((result) => {
      if (result.success && result.url) {
        setImages((prev) => 
          prev.map(img => 
            img.id === result.id 
              ? { ...img, url: result.url, uploading: false } 
              : img
          )
        );
      } else {
        // 上传失败，移除该图片
        setImages((prev) => {
          const img = prev.find(i => i.id === result.id);
          if (img) URL.revokeObjectURL(img.preview);
          return prev.filter(i => i.id !== result.id);
        });
      }
    });
  }, [uploadImageToStorage]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    
    // 检查数量限制 - 使用 setImages 回调获取当前图片数量
    let currentImageCount = 0;
    let currentCharCount = 0;
    let currentProdCount = 0;
    
    setImages((prev) => {
      currentImageCount = prev.length;
      return prev; // 不修改，只是获取当前值
    });
    setSelectedCharacters((prev) => {
      currentCharCount = prev.size;
      return prev;
    });
    setSelectedProducts((prev) => {
      currentProdCount = prev.size;
      return prev;
    });
    
    const totalCurrent = currentImageCount + currentCharCount + currentProdCount;
    if (totalCurrent + files.length > 14) {
      setError('最多选择14张参考图片');
      return;
    }

    // 复用上传逻辑
    const newImages: UploadedImage[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));
    
    setImages((prev) => [...prev, ...newImages]);

    // 并行处理所有图片
    const processPromises = newImages.map(async (image, index) => {
      const file = files[index];
      try {
        const url = await uploadImageToStorage(file, image.id);
        return { id: image.id, url, success: true };
      } catch (error) {
        console.error('上传失败:', error);
        return { id: image.id, error: error instanceof Error ? error.message : '上传失败', success: false };
      }
    });

    const results = await Promise.all(processPromises);

    // 更新状态
    results.forEach((result) => {
      if (result.success && result.url) {
        setImages((prev) => 
          prev.map(img => 
            img.id === result.id 
              ? { ...img, url: result.url, uploading: false } 
              : img
          )
        );
      } else {
        setImages((prev) => {
          const img = prev.find(i => i.id === result.id);
          if (img) URL.revokeObjectURL(img.preview);
          return prev.filter(i => i.id !== result.id);
        });
      }
    });
  }, [uploadImageToStorage]);

  const toggleCharacterSelection = (id: string) => {
    setSelectedCharacters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // 准备添加到队列 - 显示确认对话框
  const prepareAddToQueue = async () => {
    const imageApiConfig = selectedModelConfig || getDefaultImageApi();
    // 检查配置是否存在（使用 apiKeyMasked 判断是否已配置，因为 apiKey 对普通用户隐藏）
    if (!imageApiConfig || (!imageApiConfig.apiKey && !imageApiConfig.apiKeyMasked)) {
      setError('请先在系统设置中配置图片生成API Key');
      return;
    }
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let finalPrompt = prompt;
      if (consistencyPrompt.trim()) {
        finalPrompt = `${prompt}\n\n${consistencyPrompt}`;
      }

      const allImages: string[] = [];
      
      // 检查是否有正在处理的图片
      const uploadingImages = images.filter(img => img.uploading);
      if (uploadingImages.length > 0) {
        setError('有图片正在处理中，请稍候...');
        setIsGenerating(false);
        return;
      }
      
      // 使用 URL 数据（前端已上传到对象存储）
      if (images.length > 0) {
        const urlData = images
          .filter(img => img.url)
          .map(img => img.url!);
        allImages.push(...urlData);
      }

      // 角色库和产品库的图片仍然是 URL，后端会处理
      if (selectedCharacters.size > 0) {
        allImages.push(...characterLibrary.filter(c => selectedCharacters.has(c.id)).map(c => c.url));
      }
      if (selectedProducts.size > 0) {
        allImages.push(...productLibrary
          .filter(p => selectedProducts.has(p.id))
          .map(p => {
            const primaryImg = p.images.find(img => img.isPrimary) || p.images[0];
            return primaryImg?.url || '';
          })
          .filter(Boolean)
        );
      }

      const taskParams: ImageTaskParams = {
        prompt: finalPrompt,
        consistencyPrompt,
        aspectRatio,
        resolution,
        images: allImages,
        model: selectedModelConfig?.model || 'gemini-3-pro-image-preview',
        apiKey: selectedModelConfig?.apiKey,
        baseUrl: selectedModelConfig?.baseUrl,
      };

      // 显示确认对话框
      setPendingTaskParams(taskParams);
      setShowConfirmDialog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '准备任务失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 确认添加到队列
  const confirmAddToQueue = async () => {
    if (!pendingTaskParams) return;
    
    const result = await addTaskToQueue('image', pendingTaskParams);
    if (!result.task) {
      setError(result.error || '添加任务失败，请清理历史任务后重试');
      return;
    }
    
    await refreshQueueStats();
    
    // 重置状态
    setPrompt('');
    setImages([]);
    setSelectedCharacters(new Set());
    setSelectedProducts(new Set());
    setPendingTaskParams(null);
    setShowConfirmDialog(false);
  };

  // 取消添加
  const cancelAddToQueue = () => {
    setPendingTaskParams(null);
    setPreviewData(null);
    setShowConfirmDialog(false);
  };
  
  // 预览最终请求体
  const handlePreviewRequest = async () => {
    if (!pendingTaskParams) return;
    
    setIsLoadingPreview(true);
    setPreviewData(null);
    
    try {
      // 获取认证 token
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/generate/preview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: pendingTaskParams.model,
          prompt: pendingTaskParams.prompt,
          aspectRatio: pendingTaskParams.aspectRatio,
          resolution: pendingTaskParams.resolution,
          images: pendingTaskParams.images,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPreviewData(data);
      } else {
        setPreviewData({ error: data.error || '预览失败' });
      }
    } catch (err) {
      setPreviewData({ error: err instanceof Error ? err.message : '预览失败' });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `generated-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleApplyTemplate = useCallback((templatePrompt: string, defaultParams?: PromptTemplate['defaultParams']) => {
    setPrompt(templatePrompt);
    if (defaultParams?.aspectRatio) setAspectRatio(defaultParams.aspectRatio);
    if (defaultParams?.resolution) setResolution(defaultParams.resolution);
  }, []);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalSelectedImages = images.length + selectedCharacters.size + selectedProducts.size;

  // 已选资源列表
  const selectedResources = [
    ...images.map(img => ({ type: 'upload', id: img.id, url: img.preview, name: '参考图' })),
    ...characterLibrary.filter(c => selectedCharacters.has(c.id)).map(c => ({ type: 'character', id: c.id, url: c.url, name: c.name })),
    ...productLibrary.filter(p => selectedProducts.has(p.id)).map(p => {
      const primaryImg = p.images.find(img => img.isPrimary) || p.images[0];
      return { type: 'product', id: p.id, url: primaryImg?.url || '', name: p.name };
    }),
  ];

  const removeSelectedResource = (type: string, id: string) => {
    if (type === 'upload') removeImage(id);
    else if (type === 'character') toggleCharacterSelection(id);
    else if (type === 'product') toggleProductSelection(id);
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">图片生成</h1>
              <Badge variant="secondary" className="text-xs">AI Powered</Badge>
            </div>
            <div className="flex items-center gap-2">
              {queueStats.running > 0 && (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  生成中 {queueStats.running}
                </Badge>
              )}
              {queueStats.pending > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-200">
                  排队中 {queueStats.pending}
                </Badge>
              )}
              <Link href="/queue">
                <Button variant="outline" size="sm">查看队列</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧资源面板 */}
          <aside className={cn(
            "border-r bg-muted/30 shrink-0 overflow-hidden flex flex-col transition-all duration-300",
            panelCollapsed ? "w-10" : "w-52"
          )}>
            {/* 折叠按钮 */}
            <div className="flex items-center justify-end p-1.5 border-b shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPanelCollapsed(!panelCollapsed)}
              >
                {panelCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
            </div>

            {!panelCollapsed && (
              <ScrollArea className="flex-1 h-full overflow-hidden">
                <div className="p-3 space-y-2">
                  {/* 已选资源汇总 */}
                  {totalSelectedImages > 0 && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>已选资源</span>
                          <Badge variant="default" className="text-xs">{totalSelectedImages}/14</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {/* 图片数量限制提示 */}
                        {(() => {
                          const remaining = 14 - totalSelectedImages;
                          if (totalSelectedImages >= 14) {
                            return (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                <span>⚠</span>
                                <span>已达到上限，最多支持 <strong>14</strong> 张参考图</span>
                              </div>
                            );
                          }
                          return (
                            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <span className="text-blue-500">ℹ</span>
                              <span>还可选 <strong>{remaining}</strong> 张参考图（共 14 张）</span>
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap gap-1.5">
                          {selectedResources.slice(0, 7).map(res => (
                            <div key={`${res.type}-${res.id}`} className="relative group" title={res.name}>
                              <img src={res.url} alt={res.name} loading="lazy" className="w-10 h-10 object-cover rounded border" />
                              <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-center text-muted-foreground truncate opacity-0 group-hover:opacity-100 transition-opacity">{res.name}</span>
                              <button
                                onClick={() => removeSelectedResource(res.type, res.id)}
                                className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {selectedResources.length > 7 && (
                            <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              +{selectedResources.length - 7}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 参考图 */}
                  <Collapsible open={expandedSections.upload} onOpenChange={() => toggleSection('upload')}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <ImagePlus className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">参考图</span>
                            {images.length > 0 && (
                              <Badge variant="secondary" className="text-xs">{images.length}</Badge>
                            )}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSections.upload && "rotate-180")} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3">
                          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                          
                          {/* 图片数量限制提示 */}
                          {(() => {
                            const remaining = 14 - totalSelectedImages;
                            if (totalSelectedImages >= 14) {
                              return (
                                <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                  <span>⚠</span>
                                  <span>已达到上限，最多支持 <strong>14</strong> 张参考图</span>
                                </div>
                              );
                            }
                            return (
                              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <span className="text-blue-500">ℹ</span>
                                <span>还可选 <strong>{remaining}</strong> 张参考图（共 14 张）</span>
                              </div>
                            );
                          })()}
                          
                          {/* 上传区域 - 支持拖拽 */}
                          <div
                            className={cn(
                              "relative w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 overflow-hidden",
                              isDraggingOver 
                                ? "border-primary bg-primary/10 scale-[1.02]" 
                                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
                              totalSelectedImages >= 14 && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => totalSelectedImages < 14 && fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            {/* 拖拽提示层 */}
                            {isDraggingOver && (
                              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10">
                                <div className="flex flex-col items-center gap-1">
                                  <ImagePlus className="w-6 h-6 text-primary animate-bounce" />
                                  <span className="text-sm font-medium text-primary">松开即可上传</span>
                                </div>
                              </div>
                            )}
                            {/* 默认提示 */}
                            {!isDraggingOver && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <ImagePlus className="w-5 h-5 text-muted-foreground transition-transform group-hover:scale-110" />
                                <span className="text-xs text-muted-foreground">点击或拖拽上传</span>
                              </div>
                            )}
                          </div>

                          {images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {images.map((image) => (
                                <div key={image.id} className="relative group aspect-square">
                                  <img src={image.preview} alt="参考图片" loading="lazy" className="w-full h-full object-cover rounded-md" />
                                  {/* 上传中遮罩 */}
                                  {image.uploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => removeImage(image.id)}
                                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* 角色图库 */}
                  <Collapsible open={expandedSections.character} onOpenChange={() => toggleSection('character')}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">角色图库</span>
                            {selectedCharacters.size > 0 && (
                              <Badge variant="default" className="text-xs bg-blue-500">{selectedCharacters.size}</Badge>
                            )}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSections.character && "rotate-180")} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3">
                          {characterLibrary.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {characterLibrary.map((item) => {
                                const isSelected = selectedCharacters.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      "relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all group",
                                      isSelected ? "border-blue-500 ring-2 ring-blue-300" : "border-transparent hover:border-border"
                                    )}
                                    onClick={() => toggleCharacterSelection(item.id)}
                                    title={`${item.name}${item.description ? `\n${item.description}` : ''}`}
                                  >
                                    <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                                    {/* 名称标签 */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                                      <span className="text-xs text-white font-medium truncate block">{item.name}</span>
                                    </div>
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-3">
                              <p className="text-xs text-muted-foreground mb-2">暂无角色图片</p>
                              <Link href="/library"><Button variant="outline" size="sm" className="h-7 text-xs">前往添加</Button></Link>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* 产品图库 */}
                  <Collapsible open={expandedSections.product} onOpenChange={() => toggleSection('product')}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">产品图库</span>
                            {selectedProducts.size > 0 && (
                              <Badge variant="default" className="text-xs bg-green-500">{selectedProducts.size}</Badge>
                            )}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSections.product && "rotate-180")} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3">
                          {productLibrary.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {productLibrary.map((item) => {
                                const isSelected = selectedProducts.has(item.id);
                                const primaryImg = item.images.find(img => img.isPrimary) || item.images[0];
                                const displayUrl = primaryImg?.url || '';
                                if (!displayUrl) return null;
                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      "relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all group",
                                      isSelected ? "border-green-500 ring-2 ring-green-300" : "border-transparent hover:border-border"
                                    )}
                                    onClick={() => toggleProductSelection(item.id)}
                                    title={`${item.name}${item.description ? `\n${item.description}` : ''}`}
                                  >
                                    <img src={displayUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                                    {/* 名称标签 */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                                      <span className="text-xs text-white font-medium truncate block">{item.name}</span>
                                    </div>
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                                        <Check className="w-3 h-3" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-3">
                              <p className="text-xs text-muted-foreground mb-2">暂无产品图片</p>
                              <Link href="/library"><Button variant="outline" size="sm" className="h-7 text-xs">前往添加</Button></Link>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </ScrollArea>
            )}
          </aside>

          {/* 主区域 */}
          <main className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 h-full overflow-hidden">
              <div className="p-6 max-w-2xl mx-auto space-y-6">
                {/* 提示词 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">提示词</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
                        <FileText className="w-4 h-4 mr-1" />
                        模板库
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="描述您想要生成的图片..."
                      className="min-h-[120px] resize-none"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-blue-600">一致性要求（可修改）</Label>
                      <Textarea
                        className="min-h-[80px] resize-none text-sm"
                        value={consistencyPrompt}
                        onChange={(e) => setConsistencyPrompt(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 参数 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">生成参数</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 hidden">
                      <Label>模型配置</Label>
                      <ModelSelector
                        type="image"
                        value={selectedModelId}
                        onChange={(id, config) => {
                          setSelectedModelId(id);
                          setSelectedModelConfig(config as ImageApiConfig);
                        }}
                        placeholder="选择模型配置"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>宽高比</Label>
                        <Select value={aspectRatio} onValueChange={setAspectRatio}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIOS.map((ar) => (
                              <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>清晰度</Label>
                        <Select value={resolution} onValueChange={setResolution}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RESOLUTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  onClick={prepareAddToQueue}
                  disabled={!prompt.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      添加中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      加入队列生成
                    </>
                  )}
                </Button>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>

      <PromptTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        type="image"
        onApply={handleApplyTemplate}
      />

      {/* 确认发送对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认 API 请求参数</DialogTitle>
            <DialogDescription>
              查看发送给 API 的请求体内容
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            {/* 前端请求体 - 仅管理员可见 */}
            {isAdmin && pendingTaskParams && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">前端请求体（发送前）</h4>
                <pre className="p-3 bg-slate-100 text-slate-800 rounded-lg text-xs overflow-auto font-mono whitespace-pre-wrap break-all max-h-40">
                  {JSON.stringify({
                    ...pendingTaskParams,
                    apiKey: pendingTaskParams.apiKey ? `***${pendingTaskParams.apiKey.substring(pendingTaskParams.apiKey.length - 4)}` : undefined,
                    images: pendingTaskParams.images,
                  }, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 预览按钮 - 仅管理员可见 */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePreviewRequest}
                  disabled={isLoadingPreview}
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      预览最终请求体
                    </>
                  )}
                </Button>
                <span className="text-xs text-slate-500">
                  点击查看经过 API 处理后发送给模型的最终请求体
                </span>
              </div>
            )}
            
            {/* 最终请求体预览 - 仅管理员可见 */}
            {isAdmin && previewData && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">
                  最终请求体
                </h4>
                {previewData.error ? (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {previewData.error as string}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* API 格式说明 */}
                    {previewData.requestFormat && (
                      <div className="p-2 bg-purple-50 rounded text-xs">
                        <span className="font-medium text-purple-700">API 格式: </span>
                        <span className="text-slate-600">{previewData.requestFormat as string}</span>
                      </div>
                    )}
                    
                    {/* 图片处理摘要 - Gemini 格式 */}
                    {Array.isArray(previewData.parts) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {previewData.parts.filter((p: { type: string }) => p.type === 'image').map((p: { 
                          type: string; 
                          imageInfo?: { 
                            type: string;
                            url?: string;
                          }; 
                        }, idx: number) => (
                          <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
                            <div className="font-medium text-blue-700">图片 {idx + 1}</div>
                            <div className="text-slate-600">
                              类型: {p.imageInfo?.type}
                              {p.imageInfo?.url && (
                                <div className="truncate">URL: {p.imageInfo.url}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 图片处理摘要 - NanoBanana 格式 */}
                    {Array.isArray(previewData.imageInfos) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {previewData.imageInfos.map((info: { type: string; url?: string; note?: string }, idx: number) => (
                          <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
                            <div className="font-medium text-blue-700">图片 {idx + 1}</div>
                            <div className="text-slate-600">
                              类型: {info.type}
                              {info.url && (
                                <div className="truncate">URL: {info.url.substring(0, 50)}...</div>
                              )}
                              {info.note && (
                                <div className="text-amber-600">{info.note}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 完整请求体 */}
                    <pre className="p-3 bg-slate-900 text-green-400 rounded-lg text-xs overflow-auto font-mono whitespace-pre-wrap break-all max-h-60">
                      {JSON.stringify(previewData.rawRequestBody || previewData, null, 2)}
                    </pre>
                    
                    {/* 总大小 */}
                    {previewData.requestSize && (
                      <div className="text-xs text-slate-500">
                        请求体总大小: <span className="font-medium">{previewData.requestSize as string}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={cancelAddToQueue} className="w-full sm:w-auto">
              取消
            </Button>
            <Button onClick={confirmAddToQueue} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
              <Sparkles className="w-4 h-4 mr-2" />
              确认加入队列
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新手引导 */}
      <OnboardingGuide 
        open={showOnboardingGuide} 
        onOpenChange={setShowOnboardingGuide} 
      />
    </AppLayout>
  );
}
