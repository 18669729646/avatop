'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
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
  ImagePlus, X, Download, History, Trash2, User, Package, Check, Video,
  FileText, ChevronLeft, ChevronRight, Loader2, ChevronDown, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { PromptTemplateDialog } from '@/components/prompt-template-dialog';
import { PromptTemplate } from '@/lib/prompt-templates';
import { 
  ImageHistoryItem, CharacterItem,
  getImageHistory, getCharacterLibrary,
  getVideoHistory, removeVideoFromHistory, VideoHistoryItem 
} from '@/lib/history';
import {
  Product,
  getProducts,
} from '@/lib/products';
import { addTaskToQueue } from '@/lib/queue';
import { getDefaultVideoApi, VideoApiConfig, FRAMES_MODELS, COMPONENTS_MODELS } from '@/lib/system-config';
import { ModelSelector } from '@/components/model-selector';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { useTaskEvents } from '@/hooks/use-task-events';
import { useQueueStatsContext } from '@/lib/queue-stats-context';

const ASPECT_RATIOS = [
  { value: '16:9', label: '横版 (16:9)' },
  { value: '9:16', label: '竖版 (9:16)' },
];

const SEEDANCE_ASPECT_RATIOS = [
  { value: '16:9', label: '横版 (16:9)' },
  { value: '9:16', label: '竖版 (9:16)' },
  { value: '3:4', label: '竖版 (3:4)' },
  { value: '4:3', label: '横版 (4:3)' },
  { value: '1:1', label: '方形 (1:1)' },
  { value: '21:9', label: '超宽 (21:9)' },
  { value: 'adaptive', label: '自适应' },
];

const SEEDANCE_RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p（仅标准版）' },
];

interface UploadedImage {
  id: string;
  file?: File; // 保留用于兼容
  preview: string; // Blob URL 用于预览
  url?: string; // 上传后的签名 URL
  uploading?: boolean; // 上传中状态
}

// Seedance 2.0 积分计算
function calculateSeedanceCredits(resolution: string, duration: number, model: string): number {
  const isFast = model.includes('fast');
  const priceMap: Record<string, number> = {
    '480p': isFast ? 60 : 80,
    '720p': isFast ? 100 : 120,
    '1080p': isFast ? 100 : 150, // fast 不支持 1080p，按 720p 算
  };
  const pricePerSec = priceMap[resolution] || 120;
  return pricePerSec * duration;
}

export default function VideoGenerator() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModelConfig, setSelectedModelConfig] = useState<VideoApiConfig | null>(null);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [enableUpsample, setEnableUpsample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seedance 参数
  const [seedanceResolution, setSeedanceResolution] = useState('720p');
  const [seedanceDuration, setSeedanceDuration] = useState(5);
  const [seedanceAspectRatio, setSeedanceAspectRatio] = useState('16:9');
  const [seedanceWatermark, setSeedanceWatermark] = useState(false);
  const [seedanceRealPersonMode, setSeedanceRealPersonMode] = useState(false);
  const [seedanceMovementAmplitude, setSeedanceMovementAmplitude] = useState('');
  const [seedanceCameraControl, setSeedanceCameraControl] = useState('');

  // Seedance 三区域图片状态
  const [seedanceFirstFrame, setSeedanceFirstFrame] = useState<UploadedImage | null>(null);
  const [seedanceLastFrame, setSeedanceLastFrame] = useState<UploadedImage | null>(null);
  const [seedanceRefImages, setSeedanceRefImages] = useState<UploadedImage[]>([]);
  // Seedance 三区域图库选择
  const [seedanceFirstFrameId, setSeedanceFirstFrameId] = useState<string | null>(null);
  const [seedanceLastFrameId, setSeedanceLastFrameId] = useState<string | null>(null);

  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [characterLibrary, setCharacterLibrary] = useState<CharacterItem[]>([]);
  const [productLibrary, setProductLibrary] = useState<Product[]>([]);
  const [selectedHistoryImages, setSelectedHistoryImages] = useState<Set<string>>(new Set());
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  
  // 确认对话框状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  type PendingTaskParamsType = {
    prompt: string;
    aspectRatio?: string;
    images: string[];
    model: string;
    enhancePrompt: boolean;
    enableUpsample: boolean;
    apiKey?: string;
    baseUrl?: string;
    // 非Seedance模型的首帧/尾帧
    image?: string;
    imageTail?: string;
    // Seedance模型参数
    seedanceResolution?: string;
    seedanceDuration?: number;
    seedanceWatermark?: boolean;
    seedanceRealPersonMode?: boolean;
    seedanceMovementAmplitude?: string;
    seedanceCameraControl?: string;
    seedanceAspectRatio?: string;
    seedanceImageTail?: string;
    seedanceVideoRef?: string;
    seedanceAudioRef?: string;
  };

  const [pendingTaskParams, setPendingTaskParams] = useState<PendingTaskParamsType | null>(null);
  
  // 预览请求体状态
  const [previewData, setPreviewData] = useState<{
    error?: string;
    parts?: Array<{
      type: string;
      imageInfo?: {
        originalFormat: string;
        mimeType?: string;
        originalSizeKB?: number;
        compressedSizeKB?: number;
        url?: string;
        note?: string;
      };
    }>;
    rawRequestBody?: Record<string, unknown>;
    requestSize?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { queueStats, refreshQueueStats } = useQueueStatsContext();
  
  // 折叠状态
  const [expandedSections, setExpandedSections] = useState({
    upload: true,
    history: false,
    character: false,
    product: false,
    videoHistory: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Seedance 三区域各一个 file input
  const seedanceFirstFrameInputRef = useRef<HTMLInputElement>(null);
  const seedanceLastFrameInputRef = useRef<HTMLInputElement>(null);
  const seedanceRefInputRef = useRef<HTMLInputElement>(null);

  const currentModel = selectedModelConfig?.model || 'veo3-fast';
  const isSeedanceModel = currentModel.includes('seedance');

  // 当模型切换时，检查并限制已上传的图片数量
  useEffect(() => {
    // 模型切换时重置 Seedance 三区域状态
    if (!isSeedanceModel) {
      setSeedanceFirstFrame(null);
      setSeedanceLastFrame(null);
      setSeedanceRefImages([]);
    }
  }, [isSeedanceModel]);

  // 从模型配置中加载 Seedance 默认参数
  useEffect(() => {
    if (!selectedModelConfig || !currentModel.includes('seedance')) return;
    const cfg = selectedModelConfig;
    if (cfg.defaultResolution) {
      setSeedanceResolution(cfg.defaultResolution);
    }
    if (cfg.seedanceDefaultDuration) {
      setSeedanceDuration(cfg.seedanceDefaultDuration);
    }
    if (cfg.defaultAspectRatio) {
      setSeedanceAspectRatio(cfg.defaultAspectRatio);
    }
    if (cfg.seedanceDefaultWatermark !== undefined) {
      setSeedanceWatermark(cfg.seedanceDefaultWatermark);
    }
    if (cfg.seedanceDefaultRealPersonMode !== undefined) {
      setSeedanceRealPersonMode(cfg.seedanceDefaultRealPersonMode);
    }
  }, [selectedModelConfig?.id]);

  useEffect(() => {
    if (images.length === 0) return;
    
    const isFramesModel = FRAMES_MODELS.includes(currentModel as typeof FRAMES_MODELS[number]);
    const isComponentsModel = COMPONENTS_MODELS.includes(currentModel as typeof COMPONENTS_MODELS[number]);
    const maxImages = isSeedanceModel ? 9 : (isFramesModel ? 2 : (isComponentsModel ? 3 : 0));
    
    if (maxImages > 0 && images.length > maxImages) {
      const removedCount = images.length - maxImages;
      setImages(prev => prev.slice(0, maxImages));
      setError(`模型切换后只支持 ${maxImages} 张参考图，已自动移除 ${removedCount} 张`);
    } else if (maxImages === 0 && images.length > 0 && currentModel !== 'veo3-fast') {
      setImages([]);
      setError(`当前模型不支持参考图，已清空所有图片`);
    }
  }, [currentModel]);

  useEffect(() => {
    // 异步加载历史数据
    const loadData = async () => {
      try {
        const [images, videos, charactersResult, productsResult] = await Promise.all([
          getImageHistory().catch(() => []),
          getVideoHistory().catch(() => []),
          getCharacterLibrary().catch(() => []),
          getProducts().catch(() => []),
        ]);
        const characters = Array.isArray(charactersResult) ? charactersResult : charactersResult.data;
        const products = Array.isArray(productsResult) ? productsResult : productsResult.data;
        setImageHistory(images || []);
        setVideoHistory(videos || []);
        setCharacterLibrary(characters || []);
        setProductLibrary(products || []);
      } catch (error) {
        console.error('[VideoPage] Failed to load initial data:', error);
      }
    };
    
    loadData();
  }, []);

  // SSE 实时更新任务状态
  useTaskEvents(
    async () => {
      // 任务状态变化时，刷新队列统计和历史记录
      const [, images, videos] = await Promise.all([
        refreshQueueStats(),
        getImageHistory(),
        getVideoHistory(),
      ]);
      setImageHistory(images);
      setVideoHistory(videos);
    },
    { enabled: true }
  );

  // 兜底轮询：当有 running/pending 任务时，每 30 秒刷新一次
  // 防止 SSE 推送遗漏导致前端状态不同步
  useEffect(() => {
    const hasActiveTasks = queueStats.running > 0 || queueStats.pending > 0;
    if (!hasActiveTasks) return;

    const pollInterval = setInterval(async () => {
      const [, images, videos] = await Promise.all([
        refreshQueueStats(),
        getImageHistory(),
        getVideoHistory(),
      ]);
      setImageHistory(images);
      setVideoHistory(videos);
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [queueStats.running, queueStats.pending]);

  // 压缩并上传单张图片，返回上传后的 URL
  const compressAndUploadImage = async (file: File): Promise<string> => {
    // 压缩图片到 2K（2048px）以内，质量 100%
    const compressedBlob = await compressImage(file, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 1,
    });
    
    console.log(`[上传] 压缩: ${(file.size / 1024).toFixed(1)}KB → ${(compressedBlob.size / 1024).toFixed(1)}KB`);

    const formData = new FormData();
    formData.append('file', compressedBlob, file.name);
    formData.append('type', 'temp');

    const response = await authFetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('上传失败');

    const result = await response.json();
    if (!result.success || !result.url) throw new Error('上传失败');

    return result.url;
  };

  // Seedance 三区域上传处理
  const handleSeedanceFirstFrameUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    
    // 清理旧预览
    if (seedanceFirstFrame?.preview) {
      URL.revokeObjectURL(seedanceFirstFrame.preview);
    }

    const preview = URL.createObjectURL(file);
    const tempId = `seedance-ff-${Date.now()}`;
    setSeedanceRefImages([]); // 首帧模式：清空参考图
    setSeedanceFirstFrame({ id: tempId, preview, url: '', uploading: true });
    if (seedanceFirstFrameInputRef.current) seedanceFirstFrameInputRef.current.value = '';

    try {
      const url = await compressAndUploadImage(file);
      setSeedanceFirstFrame({ id: tempId, preview, url, uploading: false });
    } catch {
      setSeedanceFirstFrame(null);
      setError('首帧图片上传失败');
    }
  }, [seedanceFirstFrame, seedanceFirstFrameInputRef]);

  const handleSeedanceLastFrameUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    
    if (seedanceLastFrame?.preview) {
      URL.revokeObjectURL(seedanceLastFrame.preview);
    }

    const preview = URL.createObjectURL(file);
    const tempId = `seedance-lf-${Date.now()}`;
    setSeedanceRefImages([]); // 尾帧模式：清空参考图
    setSeedanceLastFrame({ id: tempId, preview, url: '', uploading: true });
    if (seedanceLastFrameInputRef.current) seedanceLastFrameInputRef.current.value = '';

    try {
      const url = await compressAndUploadImage(file);
      setSeedanceLastFrame({ id: tempId, preview, url, uploading: false });
    } catch {
      setSeedanceLastFrame(null);
      setError('尾帧图片上传失败');
    }
  }, [seedanceLastFrame, seedanceLastFrameInputRef]);

  const handleSeedanceRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const currentCount = seedanceRefImages.length;
    const maxImages = 9;
    const availableSlots = Math.max(0, maxImages - currentCount);
    
    if (currentCount >= maxImages) {
      setError(`参考图最多支持 ${maxImages} 张，已达到上限`);
      if (seedanceRefInputRef.current) seedanceRefInputRef.current.value = '';
      return;
    }

    const filesToUpload = imageFiles.slice(0, availableSlots);
    if (imageFiles.length > filesToUpload.length) {
      setError(`参考图最多支持 ${maxImages} 张，已选择前 ${filesToUpload.length} 张`);
    }

    // 互斥：上传参考图时清除首帧和尾帧
    setSeedanceFirstFrame(null);
    setSeedanceLastFrame(null);

    // 先创建占位记录
    const newImages: UploadedImage[] = filesToUpload.map(file => ({
      id: `seedance-ref-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));
    
    setSeedanceRefImages(prev => [...prev, ...newImages]);
    if (seedanceRefInputRef.current) seedanceRefInputRef.current.value = '';

    // 并行上传
    const uploadPromises = newImages.map(async (image, index) => {
      const file = filesToUpload[index];
      try {
        const url = await compressAndUploadImage(file);
        setSeedanceRefImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, url, uploading: false } : img
        ));
      } catch {
        // 上传失败，移除占位
        setSeedanceRefImages(prev => prev.filter(img => img.id !== image.id));
      }
    });

    await Promise.all(uploadPromises);
  }, [seedanceRefImages, seedanceRefInputRef]);

  // 非 Seedance 模型：统一区域上传
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // 根据模型计算最大图片数量
    const currentModelName = selectedModelConfig?.model || '';
    const isFramesModel = FRAMES_MODELS.includes(currentModelName as typeof FRAMES_MODELS[number]);
    const isComponentsModel = COMPONENTS_MODELS.includes(currentModelName as typeof COMPONENTS_MODELS[number]);
    const maxImages = isSeedanceModel ? 9 : (isFramesModel ? 2 : (isComponentsModel ? 3 : 0));
    
    // 检查当前已上传的图片数量
    const currentCount = images.length;
    const availableSlots = maxImages > 0 ? Math.max(0, maxImages - currentCount) : 999;
    
    // 如果模型不支持参考图，提示用户
    if (maxImages === 0 && currentModelName) {
      setError(`当前模型 "${currentModelName}" 不支持参考图，请选择支持参考图的模型`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // 检查是否已达到上限
    if (maxImages > 0 && currentCount >= maxImages) {
      setError(`当前模型最多支持 ${maxImages} 张参考图，已达到上限`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // 限制上传数量
    const filesToUpload = imageFiles.slice(0, availableSlots);
    if (filesToUpload.length < imageFiles.length) {
      setError(`当前模型最多支持 ${maxImages} 张参考图，已选择前 ${filesToUpload.length} 张`);
    }

    // 先创建占位记录（显示上传中状态）
    const newImages: UploadedImage[] = filesToUpload.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));
    
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 并行上传所有图片（带压缩）
    const uploadPromises = newImages.map(async (image, index) => {
      const file = filesToUpload[index];
      try {
        const url = await compressAndUploadImage(file);
        // 更新图片 URL
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, url, uploading: false }
              : img
          )
        );
      } catch (error) {
        console.error('图片上传失败:', error);
        // 上传失败时移除图片
        setImages((prev) => {
          const img = prev.find(i => i.id === image.id);
          if (img) URL.revokeObjectURL(img.preview);
          return prev.filter(i => i.id !== image.id);
        });
      }
    });

    // 并行执行上传，不阻塞 UI
    Promise.all(uploadPromises).catch(console.error);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const toggleSelection = (id: string, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setFn((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // 获取已上传图片的 URL（不再需要上传，因为上传时已经处理）
  const getUploadedUrls = (images: UploadedImage[]): string[] => {
    return images
      .filter(img => img.url && !img.uploading) // 只使用已上传完成的图片
      .map(img => img.url as string);
  };

  // 准备添加到队列 - 显示确认对话框
  const prepareAddToQueue = async () => {
    const videoApiConfig = selectedModelConfig || getDefaultVideoApi();
    // 检查配置是否存在（使用 apiKeyMasked 判断是否已配置，因为 apiKey 对普通用户隐藏）
    if (!videoApiConfig || (!videoApiConfig.apiKey && !videoApiConfig.apiKeyMasked)) {
      setError('请先在系统设置中配置视频生成API Key');
      return;
    }
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setError(null);

    const allImageUrls: string[] = [];
    if (images.length > 0) {
      // 检查是否有图片正在上传中
      const uploadingImages = images.filter(img => img.uploading);
      if (uploadingImages.length > 0) {
        setError('请等待图片上传完成');
        return;
      }
      // 直接使用已上传的 URL
      const uploadedUrls = getUploadedUrls(images);
      allImageUrls.push(...uploadedUrls);
    }
    allImageUrls.push(...imageHistory.filter(img => selectedHistoryImages.has(img.id)).map(img => img.url));
    allImageUrls.push(...characterLibrary.filter(c => selectedCharacters.has(c.id)).map(c => c.url));
    allImageUrls.push(...productLibrary
      .filter(p => selectedProducts.has(p.id))
      .map(p => {
        const primaryImg = p.images.find(img => img.isPrimary) || p.images[0];
        return primaryImg?.url;
      })
      .filter((url): url is string => !!url)
    );

    const currentModel = videoApiConfig.model || 'veo3-fast';

    // Seedance 三区域图片处理
    const seedanceFirstFrameUrl = seedanceFirstFrame?.url || '';
    const seedanceLastFrameUrl = seedanceLastFrame?.url || '';
    const seedanceRefUrls = seedanceRefImages.map(img => img.url);

    // 构建 seedanceImages 列表：参考图（最多8张），不含首帧
    // 注意：首帧走 image 参数，参考图走 images 参数，两者不能混用（API 会报错）
    const seedanceRefImageList = seedanceRefUrls.slice(0, 8);
    // 参考图模式的 images 数组不包含首帧，首帧由单独的 image 参数传递
    const seedanceAllRefImages = [...seedanceRefImageList];

    const taskParams = {
      prompt,
      aspectRatio: (currentModel.startsWith('veo3') || currentModel.startsWith('veo_3')) ? aspectRatio : (isSeedanceModel ? seedanceAspectRatio : undefined),
      model: currentModel,
      enhancePrompt,
      enableUpsample,
      apiKey: videoApiConfig.apiKey,
      baseUrl: videoApiConfig.baseUrl,
      // 非 Seedance 模型：使用统一图片区域
      ...(isSeedanceModel ? {} : { images: allImageUrls }),
      // Seedance 模型：三区域参数
      ...(isSeedanceModel ? {
        image: seedanceFirstFrameUrl || undefined,
        imageTail: seedanceLastFrameUrl || undefined,
        images: seedanceAllRefImages.length > 0 ? seedanceAllRefImages : undefined,
        seedanceResolution,
        seedanceDuration,
        seedanceWatermark,
        seedanceRealPersonMode,
        seedanceMovementAmplitude: seedanceMovementAmplitude || undefined,
        seedanceCameraControl: seedanceCameraControl || undefined,
      } : {}),
    };

    // 显示确认对话框
    setPendingTaskParams(taskParams as PendingTaskParamsType as Parameters<typeof setPendingTaskParams>[0]);
    setShowConfirmDialog(true);
  };
  
  // 预览最终请求体
  const handlePreviewRequest = async () => {
    if (!pendingTaskParams) return;
    
    setIsLoadingPreview(true);
    setPreviewData(null);
    
    try {
      // 获取认证 token
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/video/preview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: pendingTaskParams.model,
          prompt: pendingTaskParams.prompt,
          aspectRatio: pendingTaskParams.aspectRatio,
          images: pendingTaskParams.images,
          enhancePrompt: pendingTaskParams.enhancePrompt,
          enableUpsample: pendingTaskParams.enableUpsample,
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
  
  // 确认添加到队列
  const confirmAddToQueue = async () => {
    if (!pendingTaskParams) return;
    
    const result = await addTaskToQueue('video', pendingTaskParams);
    if (!result.task) {
      setError(result.error || '添加任务失败，请清理历史任务后重试');
      return;
    }
    
    await refreshQueueStats();
    setPrompt('');
    setImages([]);
    setSelectedHistoryImages(new Set());
    setSelectedCharacters(new Set());
    setSelectedProducts(new Set());
    setPendingTaskParams(null);
    setPreviewData(null);
    setShowConfirmDialog(false);
  };
  
  // 取消添加
  const cancelAddToQueue = () => {
    setPendingTaskParams(null);
    setPreviewData(null);
    setShowConfirmDialog(false);
  };

  const downloadVideo = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `video-${Date.now()}.mp4`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleApplyTemplate = useCallback((templatePrompt: string, defaultParams?: PromptTemplate['defaultParams']) => {
    setPrompt(templatePrompt);
    if (defaultParams?.aspectRatio) setAspectRatio(defaultParams.aspectRatio);
  }, []);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalSelectedImages = images.length + selectedHistoryImages.size + selectedCharacters.size + selectedProducts.size;

  // 已选资源列表
  const selectedResources = [
    ...images.map(img => ({ type: 'upload', id: img.id, url: img.preview, name: '参考图片' })),
    ...imageHistory.filter(i => selectedHistoryImages.has(i.id)).map(i => ({ type: 'history', id: i.id, url: i.url, name: '历史图片' })),
    ...characterLibrary.filter(c => selectedCharacters.has(c.id)).map(c => ({ type: 'character', id: c.id, url: c.url, name: c.name })),
    ...productLibrary.filter(p => selectedProducts.has(p.id)).map(p => {
      const primaryImg = p.images.find(img => img.isPrimary) || p.images[0];
      return { type: 'product', id: p.id, url: primaryImg?.url || '', name: p.name };
    }),
  ];

  const removeSelectedResource = (type: string, id: string) => {
    if (type === 'upload') removeImage(id);
    else if (type === 'history') toggleSelection(id, setSelectedHistoryImages);
    else if (type === 'character') toggleSelection(id, setSelectedCharacters);
    else if (type === 'product') toggleSelection(id, setSelectedProducts);
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">视频生成</h1>
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
                          <Badge variant="default" className="text-xs">{totalSelectedImages}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        {/* 模型图片限制提示 */}
                        {(() => {
                          const currentModelName = selectedModelConfig?.model || '';
                          const isFramesModel = FRAMES_MODELS.includes(currentModelName as typeof FRAMES_MODELS[number]);
                          const isComponentsModel = COMPONENTS_MODELS.includes(currentModelName as typeof COMPONENTS_MODELS[number]);
                          const maxImages = isSeedanceModel ? 9 : (isFramesModel ? 2 : (isComponentsModel ? 3 : 0));
                          const currentCount = totalSelectedImages;
                          
                          if (maxImages > 0 && currentCount > maxImages) {
                            return (
                              <div className="text-xs text-destructive mb-2 flex items-center gap-1">
                                <span>⚠</span>
                                <span>超出限制：已选 <strong>{currentCount}</strong> 张，当前模型最多支持 <strong>{maxImages}</strong> 张</span>
                              </div>
                            );
                          } else if (maxImages > 0) {
                            const remaining = maxImages - currentCount;
                            return (
                              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <span className="text-blue-500">ℹ</span>
                                {isFramesModel && <span>首尾帧模型：还可选 <strong>{remaining}</strong> 张（共 {maxImages} 张）</span>}
                                {isComponentsModel && <span>参考图模型：还可选 <strong>{remaining}</strong> 张（共 {maxImages} 张）</span>}
                                {isSeedanceModel && <span>参考图：还可选 <strong>{remaining}</strong> 张（最多 {maxImages} 张）</span>}
                              </div>
                            );
                          } else if (currentModelName) {
                            return (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                <span>⚠</span>
                                <span>当前模型不支持参考图</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="flex flex-wrap gap-1.5">
                          {selectedResources.slice(0, isSeedanceModel ? 9 : 7).map(res => (
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

                  {/* 上传图片 */}
                  <Collapsible open={expandedSections.upload} onOpenChange={() => toggleSection('upload')}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <ImagePlus className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">上传参考图</span>
                            {images.length > 0 && (
                              <Badge variant="secondary" className="text-xs">{images.length}</Badge>
                            )}
                          </div>
                          <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSections.upload && "rotate-180")} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3">
                          {/* Seedance 模型：三区域上传 */}
                          {isSeedanceModel ? (
                            <div className="space-y-4">
                              <p className="text-xs text-muted-foreground">支持上传首帧、尾帧和参考图，最多 9 张参考图</p>
                              
                              {/* 首帧区域（参考图有内容时禁用） */}
                              <div className={seedanceRefImages.length > 0 ? 'opacity-40 pointer-events-none select-none' : ''}>
                                <div className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                  <span className="text-orange-500">●</span>首帧（可选，生成视频的起始画面）
                                </div>
                                <div className="flex gap-2">
                                  <input ref={seedanceFirstFrameInputRef} type="file" accept="image/*" className="hidden" onChange={handleSeedanceFirstFrameUpload} />
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-20 border-dashed"
                                    onClick={() => seedanceFirstFrameInputRef.current?.click()}
                                  >
                                    {seedanceFirstFrame ? (
                                      <div className="relative w-full h-full">
                                        <img src={seedanceFirstFrame.preview} alt="首帧" className="w-full h-full object-contain rounded" />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSeedanceFirstFrame(null); }}
                                          className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 rounded-b">首帧</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">上传首帧</span>
                                      </div>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* 尾帧区域（参考图有内容时禁用） */}
                              <div className={seedanceRefImages.length > 0 ? 'opacity-40 pointer-events-none select-none' : ''}>
                                <div className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                  <span className="text-purple-500">●</span>尾帧（可选，生成视频的结束画面）
                                </div>
                                <div className="flex gap-2">
                                  <input ref={seedanceLastFrameInputRef} type="file" accept="image/*" className="hidden" onChange={handleSeedanceLastFrameUpload} />
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-20 border-dashed"
                                    onClick={() => seedanceLastFrameInputRef.current?.click()}
                                  >
                                    {seedanceLastFrame ? (
                                      <div className="relative w-full h-full">
                                        <img src={seedanceLastFrame.preview} alt="尾帧" className="w-full h-full object-contain rounded" />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSeedanceLastFrame(null); }}
                                          className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 rounded-b">尾帧</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">上传尾帧</span>
                                      </div>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* 参考图区域（首帧或尾帧有内容时禁用） */}
                              <div className={(seedanceFirstFrame !== null || seedanceLastFrame !== null) ? 'opacity-40 pointer-events-none select-none' : ''}>
                                <div className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                  <span className="text-blue-500">●</span>参考图（可选，最多 9 张）
                                  <span className="text-muted-foreground font-normal ml-1">用于保持风格、角色、场景一致性</span>
                                </div>
                                <input ref={seedanceRefInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSeedanceRefUpload} />
                                <Button
                                  variant="outline"
                                  className="w-full h-16 border-dashed"
                                  onClick={() => seedanceRefInputRef.current?.click()}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">点击上传参考图（最多 9 张）</span>
                                  </div>
                                </Button>
                                
                                {seedanceRefImages.length > 0 && (
                                  <div className="grid grid-cols-5 gap-2 mt-2">
                                    {seedanceRefImages.map((image) => (
                                      <div key={image.id} className="relative group aspect-square">
                                        <img src={image.preview} alt="参考图" loading="lazy" className="w-full h-full object-cover rounded-md" />
                                        {image.uploading && (
                                          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                          </div>
                                        )}
                                        <button
                                          onClick={() => setSeedanceRefImages(prev => {
                                            const removed = prev.find(i => i.id === image.id);
                                            if (removed) URL.revokeObjectURL(removed.preview);
                                            return prev.filter(i => i.id !== image.id);
                                          })}
                                          className="absolute top-0.5 right-0.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* 非 Seedance 模型：原有单区域上传 */}
                              {/* 模型图片限制提示 */}
                              {(() => {
                                const currentModelName = selectedModelConfig?.model || '';
                                const isFramesModel = FRAMES_MODELS.includes(currentModelName as typeof FRAMES_MODELS[number]);
                                const isComponentsModel = COMPONENTS_MODELS.includes(currentModelName as typeof COMPONENTS_MODELS[number]);
                                const maxImages = isFramesModel ? 2 : (isComponentsModel ? 3 : 0);
                                
                                if (maxImages > 0) {
                                  return (
                                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                      <span className="text-blue-500">ℹ</span>
                                      {isFramesModel && <span>首尾帧模型最多支持 <strong>2</strong> 张参考图（首帧+尾帧）</span>}
                                      {isComponentsModel && <span>参考图模型最多支持 <strong>3</strong> 张参考图</span>}
                                    </div>
                                  );
                                } else if (currentModelName) {
                                  return (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                      <span>⚠</span>
                                      <span>当前模型不支持参考图</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              
                              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                              
                              <Button
                                variant="outline"
                                className="w-full h-16 border-dashed"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">点击上传</span>
                                </div>
                              </Button>

                              {images.length > 0 && (
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    {images.map((image) => (
                                      <div key={image.id} className="relative group aspect-square">
                                        <img src={image.preview} alt="参考图片" loading="lazy" className="w-full h-full object-cover rounded-md" />
                                        {image.uploading && (
                                          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                            </>
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
                                    onClick={() => toggleSelection(item.id, setSelectedCharacters)}
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
                                    onClick={() => toggleSelection(item.id, setSelectedProducts)}
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
                  <CardContent>
                    <Textarea
                      placeholder="描述您想要生成的视频内容..."
                      className="min-h-[120px] resize-none"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {/* 参数 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">生成参数</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>模型配置</Label>
                      <ModelSelector
                        type="video"
                        value={selectedModelId}
                        onChange={(id, config) => {
                          setSelectedModelId(id);
                          setSelectedModelConfig(config as VideoApiConfig);
                        }}
                        placeholder="选择模型配置"
                      />
                    </div>

                    {(currentModel.startsWith('veo3') || currentModel.startsWith('veo_3')) && (
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
                    )}

                    {isSeedanceModel && (
                      <div className="space-y-4 pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Seedance 2.0 参数</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">PRO</span>
                        </div>

                        {/* 分辨率 */}
                        <div className="space-y-2">
                          <Label className="text-sm">分辨率</Label>
                          <Select value={seedanceResolution} onValueChange={setSeedanceResolution}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="480p">480p</SelectItem>
                              <SelectItem value="720p">720p</SelectItem>
                              <SelectItem value="1080p">1080p（仅标准版）</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">分辨率越高画质越好，耗时和积分消耗也越多</p>
                        </div>

                        {/* 时长 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">视频时长</Label>
                            <span className="text-sm font-medium">{seedanceDuration} 秒</span>
                          </div>
                          <Slider
                            value={[seedanceDuration]}
                            onValueChange={([v]) => setSeedanceDuration(v)}
                            min={4}
                            max={15}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>4秒</span>
                            <span>15秒</span>
                          </div>
                        </div>

                        {/* 宽高比 */}
                        <div className="space-y-2">
                          <Label className="text-sm">宽高比</Label>
                          <Select value={seedanceAspectRatio} onValueChange={setSeedanceAspectRatio}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="16:9">16:9 横屏</SelectItem>
                              <SelectItem value="9:16">9:16 竖屏</SelectItem>
                              <SelectItem value="4:3">4:3 横屏</SelectItem>
                              <SelectItem value="3:4">3:4 竖屏</SelectItem>
                              <SelectItem value="1:1">1:1 方形</SelectItem>
                              <SelectItem value="21:9">21:9 超宽屏</SelectItem>
                              <SelectItem value="adaptive">adaptive 自适应</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">选择 adaptive 时模型根据参考图自动选择宽高比</p>
                        </div>

                        {/* 真人模式 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">真人模式</Label>
                            <p className="text-xs text-muted-foreground">参考图含真人时需开启</p>
                          </div>
                          <Switch checked={seedanceRealPersonMode} onCheckedChange={setSeedanceRealPersonMode} />
                        </div>

                        {/* 水印 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">AI 水印</Label>
                            <p className="text-xs text-muted-foreground">是否添加 AI 生成水印</p>
                          </div>
                          <Switch checked={seedanceWatermark} onCheckedChange={setSeedanceWatermark} />
                        </div>

                        {/* 运动幅度 */}
                        <div className="space-y-2">
                          <Label className="text-sm">运动幅度 <span className="text-muted-foreground font-normal">（可选）</span></Label>
                          <Input
                            placeholder="如: low / medium / high"
                            value={seedanceMovementAmplitude}
                            onChange={(e) => setSeedanceMovementAmplitude(e.target.value)}
                            className="h-9"
                          />
                        </div>

                        {/* 镜头控制 */}
                        <div className="space-y-2">
                          <Label className="text-sm">镜头控制 <span className="text-muted-foreground font-normal">（可选）</span></Label>
                          <Input
                            placeholder="如: pan_left / zoom_in / orbit_right"
                            value={seedanceCameraControl}
                            onChange={(e) => setSeedanceCameraControl(e.target.value)}
                            className="h-9"
                          />
                        </div>

                        {/* 积分预估 */}
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">预估积分消耗</span>
                            <span className="font-semibold">{calculateSeedanceCredits(seedanceResolution, seedanceDuration, currentModel)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">按 {seedanceResolution} × {seedanceDuration}秒 计算</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 高级选项 */}
                <Card className="hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">高级选项</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">提示词增强</Label>
                        <p className="text-xs text-muted-foreground">自动将中文提示词翻译为英文</p>
                      </div>
                      <Switch checked={enhancePrompt} onCheckedChange={setEnhancePrompt} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">超采样</Label>
                        <p className="text-xs text-muted-foreground">提升视频质量</p>
                      </div>
                      <Switch checked={enableUpsample} onCheckedChange={setEnableUpsample} />
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  onClick={prepareAddToQueue}
                  disabled={!prompt.trim()}
                >
                  <Video className="w-5 h-5 mr-2" />
                  加入队列生成
                </Button>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>

      <PromptTemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        type="video"
        onApply={handleApplyTemplate}
      />

      {/* 确认发送对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认视频生成参数</DialogTitle>
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
                    images: pendingTaskParams.images.map((img: string) => 
                      img.startsWith('data:') 
                        ? `${img.substring(0, 50)}...(base64 ${Math.round(img.length/1024)}KB)`
                        : img
                    )
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
                  点击查看经过 API 处理后发送给视频模型的最终请求体
                </span>
              </div>
            )}
            
            {/* 最终请求体预览 - 仅管理员可见 */}
            {isAdmin && previewData && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">
                  最终请求体（发送给视频 API）
                </h4>
                {previewData.error ? (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {previewData.error}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 图片处理摘要 */}
                    {previewData.parts && previewData.parts.filter((p) => p.type === 'image').length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {previewData.parts.filter((p) => p.type === 'image').map((p, idx) => {
                          const info = p.imageInfo;
                          const isBase64 = info?.originalFormat === 'base64';
                          
                          return (
                            <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
                              <div className="font-medium text-blue-700">图片 {idx + 1}</div>
                              <div className="text-slate-600">
                                格式: {info?.originalFormat || '未知'}<br/>
                                {isBase64 ? (
                                  <>
                                    <span className="text-orange-600">{info?.url}</span>
                                    {info?.note && <div className="text-slate-500 mt-1">{info.note}</div>}
                                  </>
                                ) : (
                                  <span className="break-all">{info?.url}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* 完整请求体 */}
                    <pre className="p-3 bg-slate-900 text-green-400 rounded-lg text-xs overflow-auto font-mono whitespace-pre-wrap break-all max-h-60">
                      {JSON.stringify(previewData.rawRequestBody || previewData, null, 2)}
                    </pre>
                    
                    {/* 总大小 */}
                    {previewData.requestSize && (
                      <div className="text-xs text-slate-500">
                        请求体总大小: <span className="font-medium">{previewData.requestSize}</span>
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
            <Button onClick={confirmAddToQueue} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Sparkles className="w-4 h-4 mr-2" />
              确认加入队列
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
