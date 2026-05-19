'use client';

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authFetch, useAuth } from '@/lib/auth-context';
import {
  ShortFilmProject,
  ScriptSegment,
  ImageTask,
  VideoTask,
  GeneratedImage,
  GeneratedVideo,
  createNewProject,
  saveProject,
  saveProjectSync,
  getProjectsSync,
  getProjects,
  getProject,
  generateId,
} from '@/lib/shortfilm';
import {
  addTaskToQueue,
  getTaskQueue,
  QueueTask,
  processQueue,
  retryTask,
  VideoTaskParams,
} from '@/lib/queue';
import { useTaskEvents, TaskEventData } from '@/hooks/use-task-events';
import { CharacterItem } from '@/lib/history';

// 脚本要求最大字数限制
const SCRIPT_PROMPT_MAX_LENGTH = 20000;
import { getProducts, Product } from '@/lib/products';
import { CharacterLibraryDialog } from '@/components/character-library-dialog';
import { ReferenceImageDialog } from '@/components/reference-image-dialog';
import { VideoMergerDialog } from '@/components/video-merger-dialog';
import { TemplateSelector } from '@/components/template-selector';
import { 
  Template as LibraryTemplate,
  getTemplates as getLibraryTemplates,
  incrementTemplateUsage 
} from '@/lib/template-library';
import { getDefaultImageApi, getDefaultTextApi, getDefaultVideoApi, TextApiConfig, ImageApiConfig, VideoApiConfig } from '@/lib/system-config';
import { useModelConfig } from '@/hooks/use-model-config';
import { useRemakeMode } from '@/hooks/use-remake-mode';
import { StepIndicator } from '@/components/shortfilm/step-indicator';
import { ScriptConfirmDialog } from '@/components/shortfilm/script-confirm-dialog';
import { ImageConfirmDialog } from '@/components/shortfilm/image-confirm-dialog';
import { VideoConfirmDialog } from '@/components/shortfilm/video-confirm-dialog';
import { Step5Preview } from '@/components/shortfilm/step5-preview';
import { Step2ScriptConfirm } from '@/components/shortfilm/step2-script-confirm';
import { Step3ImageGeneration } from '@/components/shortfilm/step3-image-generation';
import { Step4VideoGeneration, SeedanceParams } from '@/components/shortfilm/step4-video-generation';
import { Step1ScriptGeneration } from '@/components/shortfilm/step1-script-generation';
import { VideoPreviewDialog } from '@/components/shortfilm/video-preview-dialog';
import { ImagePreviewOverlay } from '@/components/shortfilm/image-preview-overlay';
import { ModelSelector } from '@/components/model-selector';
import { AppLayout } from '@/components/app-layout';

function ShortFilmNewContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ShortFilmProject | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0); // 记录已完成的最高步骤
  
  // 步骤1状态
  const [scriptGenerationMode, setScriptGenerationMode] = useState<'ai' | 'manual'>('ai');
  const [productImages, setProductImages] = useState<Array<{ key: string; url: string }>>([]);
  const [productDescription, setProductDescription] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [scriptPrompt, setScriptPrompt] = useState('');
  const [duration, setDuration] = useState(16);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  
  const {
    remakeMode,
    setRemakeMode,
    remakeVideoKey,
    setRemakeVideoKey,
    remakeVideoUrl,
    setRemakeVideoUrl,
    remakeVideoDuration,
    setRemakeVideoDuration,
    remakeUploading,
    remakeUploadProgress,
    remakeSelectedFile,
    setRemakeSelectedFile,
    remakeVideoUrlInput,
    setRemakeVideoUrlInput,
    isRemakeParsing,
    remakeParseError,
    setRemakeParseError,
    handleRemakeFileSelect,
    handleRemakeUpload: _handleRemakeUpload,
    handleRemakeLinkSubmit: _handleRemakeLinkSubmit,
    handleRemakeParse: _handleRemakeParse,
  } = useRemakeMode();
  
  // AI模板选择器状态
  const [showAITemplateSelector, setShowAITemplateSelector] = useState(false);
  const [selectedAITemplate, setSelectedAITemplate] = useState<LibraryTemplate | null>(null);
  
  // 步骤2状态
  const [scriptSegments, setScriptSegments] = useState<ScriptSegment[]>([]);
  
  // 步骤3状态
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  // 图片任务与队列任务的映射关系（shortfilmTaskId -> queueTaskId）
  const imageTaskMappingRef = useRef<Map<string, string>>(new Map());
  // 用于触发轮询的版本号（每次检测到 generating 任务时递增）
  const [pollingTrigger, setPollingTrigger] = useState(0);
  
  // 步骤4状态
  const [videoTasks, setVideoTasks] = useState<VideoTask[]>([]);
  // 视频任务与队列任务的映射关系（shortfilmTaskId -> queueTaskId）
  const videoTaskMappingRef = useRef<Map<string, string>>(new Map());
  
  // 图库对话框状态
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<CharacterItem[]>([]);
  
  // 参考图选择状态
  const [showReferenceDialog, setShowReferenceDialog] = useState(false);
  const [currentEditingTaskId, setCurrentEditingTaskId] = useState<string | null>(null);
  const [currentEditingReferences, setCurrentEditingReferences] = useState<string[]>([]); // 当前编辑的参考图列表

  // 图片生成确认对话框状态
  const [showImageConfirm, setShowImageConfirm] = useState(false);
  const [pendingImageTask, setPendingImageTask] = useState<{
    taskId: string;
    prompt: string;
    images: string[];
    model: string;
    baseUrl: string;
    referenceImages: string[];
  } | null>(null);

  // 图片预览状态
  const [previewImages, setPreviewImages] = useState<{ url: string; id: string }[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  // 图片加载失败状态
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  // 视频预览状态
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // 存储警告状态
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // 轮询状态跟踪
  const pollingTaskIdsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef<boolean>(true);
  const projectRef = useRef<ShortFilmProject | null>(null);
  const imageTasksRef = useRef<ImageTask[]>([]);
  const videoTasksRef = useRef<VideoTask[]>([]);
  const productImagesRef = useRef<Array<{ key: string; url: string }>>([]);
  const productDescriptionRef = useRef<string>('');
  const scriptPromptRef = useRef<string>('');
  const durationRef = useRef<number>(16);
  const isProjectInitializedRef = useRef<boolean>(false); // 跟踪项目是否已初始化
  const isSavingNewProjectRef = useRef<boolean>(false); // 防止新项目保存过程中的竞争条件
  
  // 防抖保存计时器
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<Partial<ShortFilmProject> | null>(null);
  
  const {
    selectedTextModelId,
    selectedTextModelConfig,
    selectedImageModelId,
    selectedImageModelConfig,
    selectedVideoModelId,
    selectedVideoModelConfig,
    setSelectedTextModelId,
    setSelectedTextModelConfig,
    setSelectedImageModelId,
    setSelectedImageModelConfig,
    setSelectedVideoModelId,
    setSelectedVideoModelConfig,
  } = useModelConfig();

  // 同步状态到 ref（用于异步回调中获取最新值）
  useEffect(() => {
    productDescriptionRef.current = productDescription;
  }, [productDescription]);
  
  useEffect(() => {
    scriptPromptRef.current = scriptPrompt;
  }, [scriptPrompt]);
  
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  
  // 步骤切换时滚动到页面顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // 追踪首张图片选中ID的变化，用于触发其他段落参考图更新
  const firstTaskSelectedIdRef = useRef<string | undefined>(undefined);

  // 当首张图片选中变化时，自动更新其他段落的参考图
  useEffect(() => {
    if (imageTasks.length <= 1) return; // 只有一个任务时不需要更新
    
    const firstTask = imageTasks[0];
    if (!firstTask || firstTask.order !== 1) return;
    
    const firstSelectedImage = firstTask.generatedImages.find(img => img.id === firstTask.selectedImageId);
    
    // 检查首张图片选中是否变化
    const prevSelectedId = firstTaskSelectedIdRef.current;
    const currentSelectedId = firstTask.selectedImageId;
    
    // 如果首张图片选中没有变化，跳过（但先更新 ref）
    if (prevSelectedId === currentSelectedId) {
      // 确保初始化时 ref 有值
      if (prevSelectedId === undefined) {
        firstTaskSelectedIdRef.current = currentSelectedId;
      }
      return;
    }
    
    // 更新 ref 为当前值
    firstTaskSelectedIdRef.current = currentSelectedId;
    
    // 如果首张图片未选中，跳过
    if (!firstSelectedImage) return;
    
    // 首张图片选中变化了，更新所有未手动设置参考图的段落
    const needsUpdate = imageTasks.slice(1).some(task => !task.isReferenceManuallySet);
    if (!needsUpdate) return;
    
    console.log('[参考图自动更新] 首张图片选中变化，更新其他段落参考图', {
      prevId: prevSelectedId,
      newId: currentSelectedId,
      newUrl: firstSelectedImage.url.substring(0, 50)
    });
    
    setImageTasks(prev => prev.map((task, idx) => {
      if (idx === 0) return task; // 跳过首张
      if (task.isReferenceManuallySet) return task; // 用户手动设置的保留
      
      return {
        ...task,
        referenceImages: [firstSelectedImage.url],
      };
    }));
  }, [imageTasks]);

  // 确认对话框状态
  const [showScriptConfirm, setShowScriptConfirm] = useState(false);
  const [scriptRequestBody, setScriptRequestBody] = useState<Record<string, unknown> | null>(null);
  const [scriptTaskId, setScriptTaskId] = useState<string | null>(null); // 脚本任务ID
  const [scriptTaskError, setScriptTaskError] = useState<string | null>(null); // 脚本任务失败信息
  const [scriptRawResponse, setScriptRawResponse] = useState<string | null>(null); // 完整的LLM返回内容
  const [showVideoConfirm, setShowVideoConfirm] = useState(false);
  const [pendingVideoTask, setPendingVideoTask] = useState<{
    taskId: string;
    prompt: string;
    startFrameUrl?: string;
    endFrameUrl?: string;
    model: string;
    baseUrl: string;
    seedanceParams?: SeedanceParams;
  } | null>(null);

  // Seedance 2.0 参数
  const [seedanceParams, setSeedanceParams] = useState<SeedanceParams>({
    aspectRatio: '16:9',
    resolution: '720p',
    duration: 5,
    watermark: false,
    realPersonMode: false,
  });
  
  // 视频合成对话框状态
  const [showVideoMerger, setShowVideoMerger] = useState(false);
  
  // 产品列表状态（用于参考图选择）
  const [productList, setProductList] = useState<Product[]>([]);

  // 迁移 base64 图片到对象存储
  const migrateBase64Images = useCallback(async (images: string[]): Promise<string[]> => {
    const migratedImages: string[] = [];
    for (const image of images) {
      if (image.startsWith('data:')) {
        try {
          const response = await authFetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image,
              fileName: `migrated-${Date.now()}.jpg`,
              folder: 'shortfilm/products',
            }),
          });
          const data = await response.json();
          if (data.success && data.url) {
            migratedImages.push(data.url);
          } else {
            // 上传失败，跳过该图片而不是保留 base64
            console.error('[迁移图片] 上传失败:', data.error);
          }
        } catch (error) {
          // 上传异常，跳过该图片
          console.error('[迁移图片] 上传异常:', error);
        }
      } else {
        migratedImages.push(image);
      }
    }
    return migratedImages;
  }, []);

  // 更新项目状态
  // 返回 Promise，允许调用者等待保存完成
  const updateProject = useCallback((updates: Partial<ShortFilmProject>, immediate = false): Promise<void> => {
    console.log('[updateProject] 开始更新项目, immediate:', immediate, 'updates keys:', Object.keys(updates));
    
    return new Promise((resolve) => {
      setProject(prev => {
        if (!prev) {
          console.warn('[updateProject] 项目不存在，跳过更新');
          resolve();
          return prev;
        }
        const updated = { ...prev, ...updates, updatedAt: Date.now() };
        projectRef.current = updated;
        if (updates.imageTasks) {
          console.log('[updateProject] 更新 imageTasks, 数量:', updates.imageTasks.length, 'generating 数量:', updates.imageTasks.filter(t => t.status === 'generating').length);
          imageTasksRef.current = updates.imageTasks;
        }
        
        // 判断是否使用 forceUpdate（项目已初始化后，确定项目已存在，直接调用 PUT）
        const useForceUpdate = isProjectInitializedRef.current;
        console.log('[updateProject] useForceUpdate:', useForceUpdate);
        
        // 立即保存或防抖保存
        if (immediate) {
          console.log('[updateProject] 立即保存项目');
          saveProject(updated, useForceUpdate).then(() => {
            console.log('[updateProject] 保存完成');
            resolve();
          });
          pendingUpdateRef.current = null;
        } else {
          pendingUpdateRef.current = { ...pendingUpdateRef.current, ...updates };
          
          if (saveDebounceRef.current) {
            clearTimeout(saveDebounceRef.current);
          }
          
          saveDebounceRef.current = setTimeout(async () => {
            if (pendingUpdateRef.current) {
              await saveProject(updated, useForceUpdate);
              pendingUpdateRef.current = null;
            }
            resolve();
          }, 500);
        }
        
        return updated;
      });
    });
  }, []);

  // SSE 任务状态更新处理
  const handleTaskEvent = useCallback((data: TaskEventData) => {
    console.log(`[SSE] 收到任务事件: taskId=${data.taskId}, type=${data.type}, status=${data.status}, projectId=${data.projectId}`);
    
    // 处理脚本任务
    if (data.type === 'script') {
      console.log(`[SSE] 处理脚本任务更新, status=${data.status}, result=`, data.result);
      
      // 检查是否是当前项目的脚本任务
      if (data.projectId && data.projectId !== project?.id) {
        console.log(`[SSE] 脚本任务不属于当前项目，跳过`);
        return;
      }
      
      if (data.status === 'success' && data.result?.segments) {
        // 脚本生成成功
        const segments: ScriptSegment[] = data.result.segments.map((seg, idx) => ({
          id: `seg-${idx + 1}`,
          order: seg.order || idx + 1,
          duration: seg.duration || 4,
          imagePrompt: seg.imagePrompt || '',
          videoPrompt: seg.videoPrompt || '',
          description: seg.description || '',
          hookType: seg.hookType,
          sellingPoint: seg.sellingPoint,
          startTime: seg.startTime,
          endTime: seg.endTime,
          shotType: seg.shotType,
          cameraMovement: seg.cameraMovement,
          speechText: seg.speechText,
          audioPrompt: seg.audioPrompt,
          backgroundMusic: seg.backgroundMusic,
        }));
        
        setScriptSegments(segments);
        setScriptRawResponse(data.result.rawResponse || null);
        setCurrentStep(2);
        updateMaxCompletedStep(1); // 步骤1已完成
        setIsGeneratingScript(false);
        setScriptTaskId(null);
        setShowScriptConfirm(false);
        
        // 保存到项目
        updateProject({ 
          scriptSegments: segments, 
          productImages: productImagesRef.current,
          productDescription: productDescriptionRef.current,
          scriptPrompt: scriptPromptRef.current,
          totalDuration: durationRef.current,
          currentStep: 2,
          productId: projectRef.current?.productId,
          productName: projectRef.current?.productName,
        }, true);
        
        console.log(`[SSE] 脚本任务完成: ${data.taskId}`);
        return;
      }
      
      if (data.status === 'failed') {
        // 脚本生成失败
        setIsGeneratingScript(false);
        setScriptTaskId(null);
        setShowScriptConfirm(false);
        setScriptTaskError(data.error || '脚本生成失败');
        console.error(`[SSE] 脚本任务失败: ${data.taskId}`, data.error);
        return;
      }
      
      return;
    }
    
    // 查找对应的 shortfilm 任务
    let shortfilmTaskId: string | null = null;
    let isImageTask = false;

    // 在图片任务映射中查找
    console.log(`[SSE] 当前图片映射表内容:`, Array.from(imageTaskMappingRef.current.entries()));
    for (const [sfTaskId, queueTaskId] of imageTaskMappingRef.current) {
      if (queueTaskId === data.taskId) {
        shortfilmTaskId = sfTaskId;
        isImageTask = true;
        console.log(`[SSE] 在图片映射中找到匹配: shortfilmTaskId=${sfTaskId}, queueTaskId=${queueTaskId}`);
        break;
      }
    }

    // 在视频任务映射中查找
    if (!shortfilmTaskId) {
      console.log(`[SSE] 当前视频映射表内容:`, Array.from(videoTaskMappingRef.current.entries()));
      for (const [sfTaskId, queueTaskId] of videoTaskMappingRef.current) {
        if (queueTaskId === data.taskId) {
          shortfilmTaskId = sfTaskId;
          console.log(`[SSE] 在视频映射中找到匹配: shortfilmTaskId=${sfTaskId}, queueTaskId=${queueTaskId}`);
          break;
        }
      }
    }

    if (!shortfilmTaskId) {
      console.warn(`[SSE] 未找到对应的 shortfilm 任务映射，taskId=${data.taskId}`);
      return;
    }

    console.log(`[SSE] 收到任务更新: ${data.taskId} -> ${data.status}, shortfilmTaskId: ${shortfilmTaskId}`);

    if (isImageTask) {
      console.log(`[SSE] 处理图片任务更新, status=${data.status}, result=`, data.result);
      setImageTasks(prevTasks => {
        const updatedTasks = prevTasks.map(iTask => {
          if (iTask.id !== shortfilmTaskId) return iTask;

          console.log(`[SSE] 匹配到图片任务: ${iTask.id}, 当前状态: ${iTask.status}`);
          
          if (data.status === 'success') {
            // 检查 result 中的 url 字段
            const imageUrl = data.result?.url;
            console.log(`[SSE] 任务成功, url=${imageUrl ? imageUrl.substring(0, 60) + '...' : 'undefined'}`);
            
            if (imageUrl) {
              const newImage: GeneratedImage = {
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: imageUrl,
                createdAt: Date.now(),
              };

              console.log(`[SSE] 更新图片任务状态为 completed, 新图片ID: ${newImage.id}`);
              
              // 追加新图片，最多保留10次生成结果
              const allImages = [...iTask.generatedImages, newImage];
              const limitedImages = allImages.length > 10 ? allImages.slice(-10) : allImages;
              
              // 检查之前选中的图片是否被删除了，如果被删除则更新为最新图片
              const isPreviousSelectionStillValid = limitedImages.some(img => img.id === iTask.selectedImageId);
              const finalSelectedImageId = isPreviousSelectionStillValid ? iTask.selectedImageId : newImage.id;
              
              console.log(`[SSE] 图片 ${iTask.order} 生成完成，总数: ${limitedImages.length}, 选中图片有效: ${isPreviousSelectionStillValid}`);
              
              return {
                ...iTask,
                status: 'completed' as const,
                generatedImages: limitedImages,
                selectedImageId: finalSelectedImageId,
              };
            } else {
              console.error(`[SSE] 任务成功但缺少 url 字段, result:`, data.result);
              return {
                ...iTask,
                status: 'failed' as const,
              };
            }
          } else if (data.status === 'failed') {
            console.log(`[SSE] 更新图片任务状态为 failed`);
            return {
              ...iTask,
              status: 'failed' as const,
            };
          }

          return iTask;
        });

        // 更新 ref 并保存项目
        imageTasksRef.current = updatedTasks;
        setTimeout(() => updateProject({ imageTasks: updatedTasks }, true), 0);

        return updatedTasks;
      });
    } else {
      console.log(`[SSE] 处理视频任务更新, status=${data.status}, result=`, data.result);
      setVideoTasks(prevTasks => {
        const updatedTasks = prevTasks.map(vTask => {
          if (vTask.id !== shortfilmTaskId) return vTask;

          console.log(`[SSE] 匹配到视频任务: ${vTask.id}, 当前状态: ${vTask.status}`);
          
          if (data.status === 'success') {
            const videoUrl = data.result?.videoUrl || data.result?.url;
            console.log(`[SSE] 视频任务成功, videoUrl=${videoUrl ? videoUrl.substring(0, 60) + '...' : 'undefined'}`);
            
            if (videoUrl) {
              const newVideo: GeneratedVideo = {
                id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: videoUrl,
                thumbnailUrl: data.result?.thumbnailUrl,
                taskId: data.taskId,
                createdAt: Date.now(),
              };

              console.log(`[SSE] 更新视频任务状态为 completed, 新视频ID: ${newVideo.id}`);
              
              // 追加新视频，最多保留10次生成结果
              const allVideos = [...vTask.generatedVideos, newVideo];
              const limitedVideos = allVideos.length > 10 ? allVideos.slice(-10) : allVideos;
              
              // 检查之前选中的视频是否被删除了，如果被删除则更新为最新视频
              const isPreviousSelectionStillValid = limitedVideos.some(vid => vid.id === vTask.selectedVideoId);
              const finalSelectedVideoId = isPreviousSelectionStillValid ? vTask.selectedVideoId : newVideo.id;
              
              console.log(`[SSE] 视频 ${vTask.order} 生成完成，总数: ${limitedVideos.length}, 选中视频有效: ${isPreviousSelectionStillValid}`);
              
              return {
                ...vTask,
                status: 'completed' as const,
                generatedVideos: limitedVideos,
                selectedVideoId: finalSelectedVideoId,
              };
            } else {
              console.error(`[SSE] 视频任务成功但缺少 videoUrl 字段, result:`, data.result);
              return {
                ...vTask,
                status: 'failed' as const,
              };
            }
          } else if (data.status === 'failed') {
            console.log(`[SSE] 更新视频任务状态为 failed`);
            return {
              ...vTask,
              status: 'failed' as const,
            };
          }

          return vTask;
        });

        // 同步更新 ref
        videoTasksRef.current = updatedTasks;
        setTimeout(() => updateProject({ videoTasks: updatedTasks }, true), 0);

        return updatedTasks;
      });
    }
  }, [updateProject, project?.id]);

  // 订阅 SSE 事件
  useTaskEvents(handleTaskEvent);

  const handleRemakeUpload = () => _handleRemakeUpload(project?.id || '', updateProject);
  const handleRemakeLinkSubmit = () => _handleRemakeLinkSubmit(project?.id || '', updateProject);
  const handleRemakeParse = () => _handleRemakeParse(project?.id || '', {
    setScriptSegments,
    setDuration,
    setCurrentStep,
    setScriptGenerationMode,
    updateMaxCompletedStep,
    updateProject,
  });

  // 执行脚本生成（使用任务队列）
  const executeGenerateScript = useCallback(async (requestBody: Record<string, unknown>) => {
    setIsGeneratingScript(true);
    setShowScriptConfirm(false);
    setScriptTaskError(null); // 清除之前的错误
    
    try {
      // 创建任务到队列
      const result = await addTaskToQueue('script', {
        productImages: requestBody.productImages as string[] | undefined,
        productDescription: requestBody.productDescription as string | undefined,
        scriptPrompt: requestBody.scriptPrompt as string,
        duration: requestBody.duration as number,
        apiKey: requestBody.apiKey as string | undefined,
        baseUrl: requestBody.baseUrl as string | undefined,
        model: requestBody.model as string | undefined,
        isFullPrompt: requestBody.isFullPrompt as boolean | undefined,
      }, project?.id);

      if (result.error || !result.task) {
        throw new Error(result.error || '创建任务失败');
      }

      // 保存任务ID，等待 SSE 事件通知完成
      setScriptTaskId(result.task.id);
      console.log(`[脚本任务] 已创建任务: ${result.task.id}，等待 SSE 通知`);
      
      // 触发队列处理
      processQueue();
      
    } catch (error) {
      console.error('Failed to create script task:', error);
      setIsGeneratingScript(false);
      setScriptTaskError(error instanceof Error ? error.message : '创建任务失败');
    }
  }, [project?.id]);

  // 执行图片生成（使用任务队列）
  const executeImageGeneration = useCallback(async (taskInfo: {
    taskId: string;
    prompt: string;
    images: string[];
    model: string;
    baseUrl: string;
    referenceImages: string[];
  }) => {
    console.log('[图片生成] 开始执行图片生成, taskId:', taskInfo.taskId);
    setShowImageConfirm(false);
    
    const taskId = taskInfo.taskId;
    const task = imageTasks.find(t => t.id === taskId);
    if (!task) {
      console.error('[图片生成] 找不到对应的图片任务, taskId:', taskId, 'imageTasks:', imageTasks.map(t => t.id));
      return;
    }

    // 检查映射表中是否已存在该任务
    const existingMapping = imageTaskMappingRef.current.get(taskId);
    if (existingMapping) {
      console.log(`[图片生成] 映射表中已存在映射: ${taskId} -> ${existingMapping}`);
      
      // 重要：需要检查队列中是否真的有这个任务，防止映射关系残留
      try {
        const queueResult = await getTaskQueue();
        const activeTaskInQueue = queueResult.tasks.find(t => 
          t.id === existingMapping &&
          ['pending', 'running', 'retrying'].includes(t.status)
        );
        
        if (activeTaskInQueue) {
          console.log(`[图片生成] 队列中确实有活跃任务，恢复轮询`);
          // 更新状态为生成中
          const updatedTasks = imageTasks.map(t => t.id === taskId ? { 
            ...t, 
            status: 'generating' as const,
            referenceImages: taskInfo.images,
          } : t);
          setImageTasks(updatedTasks);
          imageTasksRef.current = updatedTasks;
          
          // 保存到项目
          await updateProject({ imageTasks: updatedTasks }, true);
          
          // 触发轮询
          setPollingTrigger(prev => prev + 1);
          return;
        } else {
          console.log(`[图片生成] 队列中没有对应的活跃任务，清除残留映射并创建新任务`);
          // 清除残留的映射关系
          imageTaskMappingRef.current.delete(taskId);
        }
      } catch (error) {
        console.error('[图片生成] 检查队列失败，清除残留映射:', error);
        // 检查失败，清除映射，创建新任务
        imageTaskMappingRef.current.delete(taskId);
      }
    }

    // 检查队列中是否已存在该任务（通过 shortfilmTaskId 查找）
    try {
      const queueResult = await getTaskQueue();
      const existingTaskInQueue = queueResult.tasks.find(t =>
        t.type === 'image' &&
        (t.params as { shortfilmTaskId?: string })?.shortfilmTaskId === taskId
      );

      if (existingTaskInQueue) {
        console.log(`[图片生成] 队列中找到任务: ${taskId} -> ${existingTaskInQueue.id}, 状态: ${existingTaskInQueue.status}`);

        // 根据任务状态决定如何处理
        if (existingTaskInQueue.status === 'failed') {
          // 任务失败，直接重试
          console.log(`[图片生成] 任务状态为 failed，开始重试`);
          const retryResult = await retryTask(existingTaskInQueue.id);
          if (retryResult.success) {
            // 重试成功，保存映射关系并恢复轮询
            imageTaskMappingRef.current.set(taskId, existingTaskInQueue.id);
            const updatedTasks = imageTasks.map(t => t.id === taskId ? {
              ...t,
              status: 'generating' as const,
              referenceImages: taskInfo.images,
            } : t);
            setImageTasks(updatedTasks);
            imageTasksRef.current = updatedTasks;
            await updateProject({ imageTasks: updatedTasks }, true);
            setPollingTrigger(prev => prev + 1);
            return;
          } else {
            console.error('[图片生成] 重试任务失败:', retryResult.error);
            // 重试失败，继续创建新任务
          }
        } else if (['pending', 'running', 'retrying'].includes(existingTaskInQueue.status)) {
          // 任务活跃，恢复轮询
          console.log(`[图片生成] 任务状态为 ${existingTaskInQueue.status}，恢复轮询`);
          imageTaskMappingRef.current.set(taskId, existingTaskInQueue.id);
          const updatedTasks = imageTasks.map(t => t.id === taskId ? {
            ...t,
            status: 'generating' as const,
            referenceImages: taskInfo.images,
          } : t);
          setImageTasks(updatedTasks);
          imageTasksRef.current = updatedTasks;
          await updateProject({ imageTasks: updatedTasks }, true);
          setPollingTrigger(prev => prev + 1);
          return;
        } else {
          // 任务已完成（success），需要创建新任务
          console.log(`[图片生成] 任务状态为 ${existingTaskInQueue.status}，将创建新任务`);
          // 清除旧映射，继续创建新任务
        }
      } else {
        console.log(`[图片生成] 队列中未找到任务，将创建新任务`);
      }
    } catch (error) {
      console.error('[图片生成] 检查队列失败:', error);
      // 继续执行，创建新任务
    }
    
    // 更新状态为生成中，并保存实际使用的参考图
    // 保留历史生成的图片，不清空
    const updatedTasks = imageTasks.map(t => t.id === taskId ? { 
      ...t, 
      status: 'generating' as const,
      referenceImages: taskInfo.images, // 保存实际使用的所有参考图
    } : t);
    console.log('[图片生成] 更新图片任务状态为 generating, taskId:', taskId, '当前已有图片:', task.generatedImages.length);
    setImageTasks(updatedTasks);
    imageTasksRef.current = updatedTasks;
    
    // 立即保存到项目数据库（重要！确保切换页面后状态不丢失）
    // 等待保存完成，确保状态正确持久化
    console.log('[图片生成] 调用 updateProject 保存图片任务状态');
    await updateProject({ imageTasks: updatedTasks }, true);
    console.log('[图片生成] 项目状态已保存，状态为 generating');

    try {
      // 获取图片模型配置
      const imageConfig = selectedImageModelConfig;
      if (!imageConfig?.apiKeyMasked) {
        throw new Error('请先配置图片生成模型');
      }
      
      console.log(`[图片生成] 创建任务队列任务: 图片 ${task.order}`);
      
      // 添加到任务队列
      const result = await addTaskToQueue('image', {
        prompt: taskInfo.prompt,
        images: taskInfo.images,
        aspectRatio: '9:16',
        resolution: '2K',
        model: taskInfo.model || imageConfig.model || '',
        apiKey: imageConfig.apiKey,
        baseUrl: taskInfo.baseUrl || imageConfig.baseUrl,
        shortfilmTaskId: taskId, // 保存短片图片任务ID，用于恢复任务状态
      }, project?.id); // 传入短片项目ID
      
      if (result.error || !result.task) {
        throw new Error(result.error || '创建任务失败');
      }
      
      // 保存映射关系（shortfilm taskId -> queue taskId）
      imageTaskMappingRef.current.set(taskId, result.task.id);
      console.log(`[图片生成] 映射关系已保存: shortfilmTaskId=${taskId} -> queueTaskId=${result.task.id}`);
      console.log(`[图片生成] 当前映射表:`, Array.from(imageTaskMappingRef.current.entries()));
      
      console.log(`[图片生成] 任务已添加到队列: ${result.task.id}`);
      
      // 触发轮询（重要！让轮询 useEffect 重新检测生成中的任务）
      console.log(`[图片生成] 触发轮询...`);
      setPollingTrigger(prev => {
        console.log(`[图片生成] pollingTrigger 从 ${prev} 更新为 ${prev + 1}`);
        return prev + 1;
      });
      
      // 触发队列处理
      processQueue();
      
    } catch (error) {
      console.error('[图片生成] 创建任务失败:', error);
      const failedTasks = imageTasks.map(t => 
        t.id === taskId ? { ...t, status: 'failed' as const } : t
      );
      setImageTasks(failedTasks);
      imageTasksRef.current = failedTasks;
      updateProject({ imageTasks: failedTasks }, true);
      setStorageWarning(error instanceof Error ? error.message : '图片生成失败');
    }
  }, [imageTasks, selectedImageModelConfig, updateProject]);

  // 执行视频生成（使用任务队列）
  const executeVideoGeneration = useCallback(async (taskInfo: {
    taskId: string;
    prompt: string;
    startFrameUrl?: string;
    endFrameUrl?: string;
    model: string;
    baseUrl: string;
    seedanceParams?: SeedanceParams;
  }) => {
    setShowVideoConfirm(false);
    
    const taskId = taskInfo.taskId;
    const task = videoTasks.find(t => t.id === taskId);
    if (!task) return;

    // 检查映射表中是否已存在该任务
    const existingMapping = videoTaskMappingRef.current.get(taskId);
    if (existingMapping) {
      console.log(`[视频生成] 映射表中已存在映射: ${taskId} -> ${existingMapping}`);
      
      // 重要：需要检查队列中是否真的有这个任务，防止映射关系残留
      try {
        const queueResult = await getTaskQueue();
        const activeTaskInQueue = queueResult.tasks.find(t => 
          t.id === existingMapping &&
          ['pending', 'running', 'retrying'].includes(t.status)
        );
        
        if (activeTaskInQueue) {
          console.log(`[视频生成] 队列中确实有活跃任务，恢复轮询`);
          // 更新状态为生成中
          const updatedTasks = videoTasks.map(t => t.id === taskId ? { 
            ...t, 
            status: 'generating' as const,
          } : t);
          setVideoTasks(updatedTasks);
          videoTasksRef.current = updatedTasks;
          
          // 保存到项目
          await updateProject({ videoTasks: updatedTasks }, true);
          
          // 触发轮询
          setPollingTrigger(prev => prev + 1);
          return;
        } else {
          console.log(`[视频生成] 队列中没有对应的活跃任务，清除残留映射并创建新任务`);
          // 清除残留的映射关系
          videoTaskMappingRef.current.delete(taskId);
        }
      } catch (error) {
        console.error('[视频生成] 检查队列失败，清除残留映射:', error);
        // 检查失败，清除映射，创建新任务
        videoTaskMappingRef.current.delete(taskId);
      }
    }

    // 检查队列中是否已存在该任务（通过 shortfilmTaskId 查找）
    try {
      const queueResult = await getTaskQueue();
      const existingTaskInQueue = queueResult.tasks.find(t => 
        t.type === 'video' && 
        (t.params as { shortfilmTaskId?: string })?.shortfilmTaskId === taskId &&
        // 只恢复活跃状态的任务（pending/running/retrying），不恢复已完成或失败的任务
        ['pending', 'running', 'retrying'].includes(t.status)
      );
      
      if (existingTaskInQueue) {
        console.log(`[视频生成] 队列中已存在活跃任务: ${taskId} -> ${existingTaskInQueue.id}, 状态: ${existingTaskInQueue.status}`);
        // 恢复映射关系
        videoTaskMappingRef.current.set(taskId, existingTaskInQueue.id);
        
        // 更新状态为生成中
        const updatedTasks = videoTasks.map(t => t.id === taskId ? { 
          ...t, 
          status: 'generating' as const,
        } : t);
        setVideoTasks(updatedTasks);
        videoTasksRef.current = updatedTasks;
        
        // 保存到项目
        await updateProject({ videoTasks: updatedTasks }, true);
        
        // 触发轮询（不清空旧视频，保留历史生成结果）
        setPollingTrigger(prev => prev + 1);
        return;
      } else {
        console.log(`[视频生成] 队列中未找到活跃任务，将创建新任务`);
      }
    } catch (error) {
      console.error('[视频生成] 检查队列失败:', error);
      // 继续执行，创建新任务
    }
    
    // 更新状态为生成中
    // 保留历史生成的视频，不清空
    const updatedTasks = videoTasks.map(t => t.id === taskId ? { 
      ...t, 
      status: 'generating' as const,
    } : t);
    console.log('[视频生成] 更新视频任务状态为 generating, taskId:', taskId, '当前已有视频:', task.generatedVideos.length);
    setVideoTasks(updatedTasks);
    videoTasksRef.current = updatedTasks;
    
    // 立即保存到项目数据库（重要！确保切换页面后状态不丢失）
    // 等待保存完成，确保状态正确持久化
    await updateProject({ videoTasks: updatedTasks }, true);
    console.log('[视频生成] 项目状态已保存，状态为 generating');
    
    try {
      // 获取视频模型配置
      const videoConfig = selectedVideoModelConfig;
      if (!videoConfig?.apiKeyMasked) {
        throw new Error('请先配置视频模型');
      }
      
      // 构建参考图列表（首帧 + 尾帧）
      const images: string[] = [];
      if (taskInfo.startFrameUrl) {
        images.push(taskInfo.startFrameUrl);
      }
      if (taskInfo.endFrameUrl) {
        images.push(taskInfo.endFrameUrl);
      }
      
      const segment = scriptSegments.find(s => s.order === task.order);
      const hasAudio = remakeMode && (segment?.speechText || segment?.audioPrompt);

      console.log(`[视频生成] 创建任务队列任务: 视频 ${task.order}`);
      
      // 判断是否为 Seedance 模型
      const isSeedanceModel = taskInfo.model?.startsWith('doubao-seedance');
      
      const taskParams: VideoTaskParams = {
        prompt: taskInfo.prompt,
        images,
        model: videoConfig.model || 'veo3-fast-frames',
        aspectRatio: isSeedanceModel
          ? (taskInfo.seedanceParams?.aspectRatio || '16:9')
          : (videoConfig.defaultAspectRatio || '9:16'),
        enhancePrompt: !isSeedanceModel, // Seedance 不需要增强提示词
        enableUpsample: false,
        apiKey: videoConfig.apiKey,
        baseUrl: videoConfig.baseUrl,
        shortfilmTaskId: taskId,
        generateAudio: !!hasAudio,
      };

      // Seedance 专用参数
      if (isSeedanceModel && taskInfo.seedanceParams) {
        taskParams.seedanceResolution = taskInfo.seedanceParams.resolution;
        taskParams.seedanceDuration = taskInfo.seedanceParams.duration;
        taskParams.seedanceWatermark = taskInfo.seedanceParams.watermark;
        taskParams.seedanceRealPersonMode = taskInfo.seedanceParams.realPersonMode;
        taskParams.seedanceImageTail = taskInfo.endFrameUrl;
        // Seedance 多图参考：如果有3张以上参考图，使用 seedanceImages
        if (images.length > 2) {
          taskParams.seedanceImages = images;
          taskParams.images = [images[0]]; // 首帧仍放 images[0]
        }
      }

      const result = await addTaskToQueue('video', taskParams, project?.id);
      
      if (result.error || !result.task) {
        throw new Error(result.error || '创建任务失败');
      }
      
      // 保存映射关系（shortfilm taskId -> queue taskId）
      videoTaskMappingRef.current.set(taskId, result.task.id);
      
      console.log(`[视频生成] 任务已添加到队列: ${result.task.id}`);
      
      // 触发轮询（重要！让轮询 useEffect 重新检测生成中的任务）
      console.log(`[视频生成] 触发轮询...`);
      setPollingTrigger(prev => {
        console.log(`[视频生成] pollingTrigger 从 ${prev} 更新为 ${prev + 1}`);
        return prev + 1;
      });
      
      // 触发队列处理
      processQueue();
      
    } catch (error) {
      console.error('[视频生成] 创建任务失败:', error);
      const failedTasks = videoTasks.map(t => 
        t.id === taskId ? { ...t, status: 'failed' as const } : t
      );
      setVideoTasks(failedTasks);
      videoTasksRef.current = failedTasks;
      updateProject({ videoTasks: failedTasks }, true);
      setStorageWarning(error instanceof Error ? error.message : '视频生成失败');
    }
  }, [videoTasks, selectedVideoModelConfig, updateProject]);

  // 初始化项目
  useEffect(() => {
    let isMounted = true;
    
    const initProject = async () => {
      // 如果已经初始化过，跳过（防止 React Strict Mode 重复执行）
      if (isProjectInitializedRef.current) {
        console.log('[初始化项目] 已初始化，跳过');
        return;
      }
      
      // 立即标记为已初始化，防止 React Strict Mode 重复执行
      // 重要：必须在任何 await 之前设置，否则第二次执行可能在 await 之后开始
      isProjectInitializedRef.current = true;
      
      const projectId = searchParams.get('id');
      const fromTemplate = searchParams.get('from_template');
      const urlStep = searchParams.get('step');
      const mode = searchParams.get('mode');
      
      if (mode === 'remake') {
        setRemakeMode(true);
      }
      
      if (projectId) {
        const needRefresh = !!urlStep || mode === 'remake';
        
        const projects = getProjectsSync();
        let existingProject = projects.find(p => p.id === projectId);
        
        if (needRefresh || !existingProject) {
          console.log('[初始化项目] 从 API 获取最新数据:', projectId, '原因:', needRefresh ? (mode === 'remake' ? '复刻模式需刷新视频URL' : 'URL指定步骤') : '缓存未找到');
          try {
            if (mode === 'remake') {
              const freshProject = await getProject(projectId, true);
              if (freshProject) {
                existingProject = freshProject;
              }
            }
            if (!existingProject) {
              const refreshedProjects = await getProjects(true);
              existingProject = refreshedProjects.find(p => p.id === projectId);
            }
            
            // 如果脚本分段为空但 URL 指定步骤2，尝试从任务队列恢复
            if (urlStep === '2' && existingProject && (!existingProject.scriptSegments || existingProject.scriptSegments.length === 0)) {
              console.log('[初始化项目] 脚本为空但步骤为2，尝试从任务队列恢复');
              try {
                const queueResult = await getTaskQueue();
                const queueTasks = queueResult.tasks;
                // 查找匹配的脚本任务（已完成且有结果）
                const scriptTask = queueTasks.find(t => 
                  t.type === 'script' && 
                  t.projectId === projectId && 
                  t.status === 'success' && 
                  t.result
                );
                
                if (scriptTask && scriptTask.result) {
                  const scriptResult = scriptTask.result as { segments?: Array<{
                    order: number;
                    duration: number;
                    imagePrompt: string;
                    videoPrompt: string;
                    description: string;
                    hookType?: string;
                    sellingPoint?: string;
                    startTime?: number;
                    endTime?: number;
                    shotType?: string;
                    cameraMovement?: string;
                    speechText?: string;
                    audioPrompt?: string;
                    backgroundMusic?: string;
                  }> };
                  
                  if (scriptResult.segments && scriptResult.segments.length > 0) {
                    console.log('[初始化项目] 从任务队列恢复脚本分段, 数量:', scriptResult.segments.length);
                    
                    const recoveredSegments: ScriptSegment[] = scriptResult.segments.map((seg, idx) => ({
                      id: `seg-${idx + 1}`,
                      order: seg.order || idx + 1,
                      duration: seg.duration || 8,
                      imagePrompt: seg.imagePrompt || '',
                      videoPrompt: seg.videoPrompt || '',
                      description: seg.description || '',
                      hookType: seg.hookType,
                      sellingPoint: seg.sellingPoint,
                      startTime: seg.startTime,
                      endTime: seg.endTime,
                      shotType: seg.shotType,
                      cameraMovement: seg.cameraMovement,
                      speechText: seg.speechText,
                      audioPrompt: seg.audioPrompt,
                      backgroundMusic: seg.backgroundMusic,
                    }));
                    
                    // 更新项目
                    existingProject = {
                      ...existingProject,
                      scriptSegments: recoveredSegments,
                    };
                    
                    // 保存到数据库
                    updateProject({ scriptSegments: recoveredSegments }, true);
                  }
                }
              } catch (e) {
                console.error('[初始化项目] 从任务队列恢复失败:', e);
              }
            }
            
            console.log('[初始化项目] API 返回项目:', existingProject ? '找到' : '未找到', 
              existingProject ? `productImages: ${existingProject.productImages?.length || 0}` : '');
          } catch (e) {
            console.error('[初始化项目] 获取项目失败:', e);
          }
        }
        
        if (existingProject) {
          console.log('[初始化项目] 加载项目数据:', {
            id: existingProject.id,
            productImages: existingProject.productImages?.length || 0,
            productDescription: existingProject.productDescription ? '有内容' : '空',
            scriptPrompt: existingProject.scriptPrompt ? '有内容' : '空',
            scriptSegments: existingProject.scriptSegments?.length || 0,
            currentStep: existingProject.currentStep,
            status: existingProject.status,
            productId: existingProject.productId || '无',
            productName: existingProject.productName || '无',
          });
          setProject(existingProject);
          projectRef.current = existingProject;
          // 如果项目已完成（有合成视频或状态为completed），自动跳到第5步
          const hasMergedVideos = existingProject.mergedVideos && existingProject.mergedVideos.length > 0;
          const isCompleted = existingProject.status === 'completed' || hasMergedVideos;
          
          // 优先使用 URL 参数指定的步骤（用于从任务队列跳转）
          const targetStep = isCompleted ? 5 
            : urlStep ? parseInt(urlStep, 10) 
            : (existingProject.currentStep || 1);
          console.log('[初始化项目] 设置当前步骤:', targetStep, '已完成:', isCompleted, '有合成视频:', hasMergedVideos, 'URL步骤:', urlStep);
          setCurrentStep(targetStep);
          
          // 智能计算 maxCompletedStep：根据任务完成情况判断
          let calculatedMaxStep = 0;
          const allVideosCompleted = existingProject.videoTasks?.length > 0 && 
                     existingProject.videoTasks.every(v => v.status === 'completed');
          const allImagesCompleted = existingProject.imageTasks?.length > 0 && 
                     existingProject.imageTasks.every(i => i.status === 'completed');
          const hasScript = existingProject.scriptSegments?.length > 0;
          const hasProductInfo = existingProject.productImages?.length > 0 || 
                     existingProject.productDescription;
          
          console.log('[初始化项目] 任务状态检查:', {
            allVideosCompleted,
            allImagesCompleted, 
            hasScript,
            hasProductInfo,
            hasMergedVideos
          });
          
          if (hasMergedVideos) {
            calculatedMaxStep = 5; // 有合成视频，全部完成
          } else if (allVideosCompleted) {
            calculatedMaxStep = 4; // 所有视频任务完成
          } else if (allImagesCompleted) {
            calculatedMaxStep = 3; // 所有图片任务完成
          } else if (hasScript) {
            calculatedMaxStep = 2; // 脚本已生成
          } else if (hasProductInfo) {
            calculatedMaxStep = 1; // 产品信息已填写
          }
          // 如果计算值比当前步骤小，使用当前步骤-1
          const finalMaxStep = Math.max(calculatedMaxStep, targetStep > 1 ? targetStep - 1 : 0);
          console.log('[初始化项目] 计算maxCompletedStep:', calculatedMaxStep, '最终值:', finalMaxStep);
          setMaxCompletedStep(finalMaxStep);
          
          // 如果项目有合成视频但状态不是 completed，更新状态
          if (hasMergedVideos && existingProject.status !== 'completed') {
            console.log('[初始化项目] 检测到有合成视频但状态未更新，自动更新为 completed');
            const updatedProject = { ...existingProject, status: 'completed' as const, currentStep: 5 as const };
            saveProject(updatedProject, true);
            projectRef.current = updatedProject;
            setProject(updatedProject);
          }
          setScriptSegments(existingProject.scriptSegments || []);
          console.log('[初始化项目] 设置脚本分段, 数量:', existingProject.scriptSegments?.length || 0, 
            existingProject.scriptSegments?.length > 0 ? `第一段: ${existingProject.scriptSegments[0]?.description?.substring(0, 50)}...` : '');
          
          if (existingProject.sourceType === 'remake') {
            setRemakeMode(true);
            setRemakeVideoKey(existingProject.sourceVideoKey || null);
            
            if (!existingProject.sourceVideoUrl && existingProject.sourceVideoKey) {
              getProject(existingProject.id, true).then(freshProject => {
                if (freshProject?.sourceVideoUrl) {
                  setRemakeVideoUrl(freshProject.sourceVideoUrl);
                }
              }).catch(() => {});
            } else {
              setRemakeVideoUrl(existingProject.sourceVideoUrl || null);
            }
            
            setRemakeVideoDuration(existingProject.videoDuration || 0);
          }
          
          // 检查是否有正在生成的脚本任务（如果没有脚本分段但有产品信息）
          if ((!existingProject.scriptSegments || existingProject.scriptSegments.length === 0) && 
              (existingProject.productImages?.length > 0 || existingProject.productDescription)) {
            console.log('[初始化项目] 项目没有脚本分段但有产品信息，检查是否有正在生成的脚本任务');
            try {
              const queueResult = await getTaskQueue();
              const queueTasks = queueResult.tasks;
              const scriptTask = queueTasks.find(t => 
                t.type === 'script' && 
                t.projectId === existingProject.id &&
                (t.status === 'running' || t.status === 'pending' || t.status === 'retrying')
              );
              
              if (scriptTask) {
                console.log('[初始化项目] 发现正在生成的脚本任务:', scriptTask.id, '状态:', scriptTask.status);
                setScriptTaskId(scriptTask.id);
                setIsGeneratingScript(true);
              }
            } catch (e) {
              console.error('[初始化项目] 检查脚本任务状态失败:', e);
            }
          }
          
          // 暂时不设置 imageTasks，等待映射恢复后再设置
          // setImageTasks(existingProject.imageTasks || []);
          setVideoTasks(existingProject.videoTasks || []);
          // 初始化 ref（重要：确保 ref 与 state 同步）
          imageTasksRef.current = existingProject.imageTasks || [];
          videoTasksRef.current = existingProject.videoTasks || [];
          
          // 用于标记是否需要保存更新后的任务状态
          let needSaveUpdatedTasks = false;
          const updatedImageTasks = [...(existingProject.imageTasks || [])];
          const updatedVideoTasks = [...(existingProject.videoTasks || [])];
          
          // 恢复图片任务的队列映射关系（如果有未完成的任务）
          // 重要：必须在 setImageTasks 之前恢复映射，否则监听 useEffect 启动时映射为空
          const hasIncompleteImageTasks = existingProject.imageTasks?.some(t => t.status !== 'completed');
          if (hasIncompleteImageTasks) {
            console.log('[初始化项目] 检测到未完成的图片任务，尝试恢复队列映射');
            try {
              const queueResult = await getTaskQueue();
              const queueTasks = queueResult.tasks;
              for (let i = 0; i < updatedImageTasks.length; i++) {
                const iTask = updatedImageTasks[i];
                // 处理所有未完成的任务（generating、pending、failed）
                if (iTask.status === 'completed') continue;
                // 从队列中查找对应的任务（通过 shortfilmTaskId 匹配）
                const queueTask = queueTasks.find(t => 
                  t.type === 'image' && 
                  (t.params as { shortfilmTaskId?: string })?.shortfilmTaskId === iTask.id
                );
                if (queueTask) {
                  imageTaskMappingRef.current.set(iTask.id, queueTask.id);
                  console.log(`[初始化项目] 恢复图片任务映射: ${iTask.id} -> ${queueTask.id}`);
                  
                  // 如果队列任务已完成，更新图片任务状态
                  if (queueTask.status === 'success' && queueTask.result) {
                    needSaveUpdatedTasks = true;
                    const imageResult = queueTask.result as { url?: string };
                    const newImage: GeneratedImage = {
                      id: generateId('img'),
                      url: imageResult.url || '',
                      createdAt: Date.now(),
                    };
                    // 更新图片任务状态
                    // 追加新图片，最多保留10次生成结果
                    const allImages = [...iTask.generatedImages, newImage];
                    const limitedImages = allImages.length > 10 ? allImages.slice(-10) : allImages;
                    
                    // 检查之前选中的图片是否被删除了，如果被删除则更新为最新图片
                    const isPreviousSelectionStillValid = limitedImages.some(img => img.id === iTask.selectedImageId);
                    const finalSelectedImageId = isPreviousSelectionStillValid ? iTask.selectedImageId : newImage.id;
                    
                    updatedImageTasks[i] = {
                      ...iTask,
                      status: 'completed' as const,
                      generatedImages: limitedImages,
                      selectedImageId: finalSelectedImageId,
                    };
                    console.log(`[初始化项目] 图片 ${iTask.order} 已完成，URL: ${imageResult.url?.substring(0, 60)}，总数: ${limitedImages.length}, 选中图片有效: ${isPreviousSelectionStillValid}`);
                  } else if (queueTask.status === 'failed') {
                    // 只有当状态不同时才更新
                    if (iTask.status !== 'failed') {
                      needSaveUpdatedTasks = true;
                      updatedImageTasks[i] = { ...iTask, status: 'failed' as const };
                      console.log(`[初始化项目] 图片 ${iTask.order} 生成失败`);
                    }
                  } else if (queueTask.status === 'running' || queueTask.status === 'retrying') {
                    // 队列任务正在执行中或正在重试
                    needSaveUpdatedTasks = true;
                    updatedImageTasks[i] = { ...iTask, status: 'generating' as const };
                    console.log(`[初始化项目] 图片 ${iTask.order} 正在执行（状态: ${queueTask.status}）`);
                  }
                  // pending 状态保持不变
                } else {
                  // 队列中没有找到对应任务
                  // 如果任务是 generating 状态，说明队列任务已被清理或丢失，标记为失败
                  if (iTask.status === 'generating') {
                    console.log(`[初始化项目] 未找到图片任务 ${iTask.id} 对应的队列任务（正在生成中），标记为失败`);
                    needSaveUpdatedTasks = true;
                    updatedImageTasks[i] = { ...iTask, status: 'failed' as const };
                  }
                  // pending 或 failed 状态保持不变
                }
              }
              // 更新 state 和 ref（无论是否有变化都要设置，因为初始化时还没设置）
              setImageTasks(updatedImageTasks);
              imageTasksRef.current = updatedImageTasks;
            } catch (e) {
              console.error('[初始化项目] 恢复图片任务映射失败:', e);
              // 即使恢复失败，也要设置 imageTasks
              setImageTasks(existingProject.imageTasks || []);
              imageTasksRef.current = existingProject.imageTasks || [];
            }
          } else {
            // 没有正在生成中的图片任务，直接设置
            setImageTasks(existingProject.imageTasks || []);
            imageTasksRef.current = existingProject.imageTasks || [];
          }
          
          // 重置保存标志
          needSaveUpdatedTasks = false;
          
          // 恢复视频任务的队列映射关系
          // 检查所有未完成的视频任务，从队列中恢复状态
          const hasIncompleteVideoTasks = existingProject.videoTasks?.some(t => t.status !== 'completed');
          if (hasIncompleteVideoTasks) {
            console.log('[初始化项目] 检测到未完成的视频任务，尝试恢复队列映射和状态');
            try {
              const queueResult = await getTaskQueue();
              const queueTasks = queueResult.tasks;
              console.log('[初始化项目] 获取到队列任务数量:', queueTasks.length, '视频队列任务:', queueTasks.filter(t => t.type === 'video').length);
              for (let i = 0; i < updatedVideoTasks.length; i++) {
                const vTask = updatedVideoTasks[i];
                // 只处理未完成的任务
                if (vTask.status === 'completed') continue;
                // 从队列中查找对应的任务（通过 shortfilmTaskId 匹配）
                const queueTask = queueTasks.find(t => 
                  t.type === 'video' && 
                  (t.params as { shortfilmTaskId?: string })?.shortfilmTaskId === vTask.id
                );
                if (queueTask) {
                  videoTaskMappingRef.current.set(vTask.id, queueTask.id);
                  console.log(`[初始化项目] 恢复视频任务映射: ${vTask.id} -> ${queueTask.id}, 队列状态: ${queueTask.status}`);
                  
                  // 根据队列任务状态更新视频任务状态
                  if (queueTask.status === 'success' && queueTask.result) {
                    needSaveUpdatedTasks = true;
                    const videoResult = queueTask.result as { videoUrl?: string; thumbnailUrl?: string; taskId?: string };
                    const newVideo: GeneratedVideo = {
                      id: generateId('vid'),
                      url: videoResult.videoUrl || '',
                      taskId: videoResult.taskId || '',
                      createdAt: Date.now(),
                    };
                    // 更新视频任务状态
                    // 追加新视频，最多保留10次生成结果
                    const allVideos = [...vTask.generatedVideos, newVideo];
                    const limitedVideos = allVideos.length > 10 ? allVideos.slice(-10) : allVideos;
                    
                    // 检查之前选中的视频是否被删除了，如果被删除则更新为最新视频
                    const isPreviousSelectionStillValid = limitedVideos.some(vid => vid.id === vTask.selectedVideoId);
                    const finalSelectedVideoId = isPreviousSelectionStillValid ? vTask.selectedVideoId : newVideo.id;
                    
                    updatedVideoTasks[i] = {
                      ...vTask,
                      status: 'completed' as const,
                      generatedVideos: limitedVideos,
                      selectedVideoId: finalSelectedVideoId,
                    };
                    console.log(`[初始化项目] 视频 ${vTask.order} 已完成，URL: ${videoResult.videoUrl?.substring(0, 60)}，总数: ${limitedVideos.length}, 选中视频有效: ${isPreviousSelectionStillValid}`);
                  } else if (queueTask.status === 'failed') {
                    // 只有当状态不同时才更新
                    if (vTask.status !== 'failed') {
                      needSaveUpdatedTasks = true;
                      updatedVideoTasks[i] = { ...vTask, status: 'failed' as const };
                      console.log(`[初始化项目] 视频 ${vTask.order} 生成失败`);
                    }
                  } else if (queueTask.status === 'running' || queueTask.status === 'retrying') {
                    // 任务正在执行或正在重试，更新状态为 generating
                    needSaveUpdatedTasks = true;
                    updatedVideoTasks[i] = { ...vTask, status: 'generating' as const };
                    console.log(`[初始化项目] 视频 ${vTask.order} 正在执行（状态: ${queueTask.status}），更新为 generating`);
                  }
                  // pending 状态保持不变
                } else {
                  // 队列中没有找到对应任务
                  // 如果任务是 generating 状态，说明队列任务已被清理或丢失，标记为失败
                  if (vTask.status === 'generating') {
                    console.log(`[初始化项目] 视频 ${vTask.order} 状态为 generating 但未找到队列任务，标记为失败`);
                    needSaveUpdatedTasks = true;
                    updatedVideoTasks[i] = { ...vTask, status: 'failed' as const };
                  }
                  // pending 或 failed 状态保持不变
                }
              }
              // 更新 state（无论是否有变化都设置，确保状态同步）
              setVideoTasks(updatedVideoTasks);
              videoTasksRef.current = updatedVideoTasks;
            } catch (e) {
              console.error('[初始化项目] 恢复视频任务映射失败:', e);
            }
          }
          
          setProductImages(existingProject.productImages || []);
          productImagesRef.current = existingProject.productImages || [];
          setProductDescription(existingProject.productDescription || '');
          // 恢复产品选择状态
          setSelectedProductId(existingProject.productId || null);
          setSelectedProductName(existingProject.productName || null);
          setScriptPrompt(existingProject.scriptPrompt || '');
          setDuration(existingProject.totalDuration || 16);
          // 恢复脚本生成方式
          setScriptGenerationMode((existingProject as any).scriptGenerationMode || 'ai');
          // 恢复选中的达人图
          if (existingProject.selectedCharacters && existingProject.selectedCharacters.length > 0) {
            setSelectedCharacters(existingProject.selectedCharacters.map(c => ({
              id: c.id,
              name: c.name,
              url: c.url,
              createdAt: Date.now(),
            })));
          }
          
          // 如果任务状态有变化，保存到项目
          const finalImageTasks = imageTasksRef.current;
          const finalVideoTasks = updatedVideoTasks;
          if (finalImageTasks.some((t, idx) => {
            const orig = existingProject.imageTasks?.[idx];
            return orig && t.status !== orig.status;
          }) || finalVideoTasks.some((t, idx) => {
            const orig = existingProject.videoTasks?.[idx];
            return orig && t.status !== orig.status;
          })) {
            console.log('[初始化项目] 任务状态有变化，保存到项目');
            const updatedProject = {
              ...existingProject,
              imageTasks: finalImageTasks,
              videoTasks: finalVideoTasks,
              updatedAt: Date.now(),
            };
            await saveProject(updatedProject, true);
            projectRef.current = updatedProject;
          }
        }
      } else {
        // 标记正在保存新项目，防止自动保存的竞争条件
        isSavingNewProjectRef.current = true;
        
        const newProject = createNewProject('未命名短片', {
          sourceType: mode === 'remake' ? 'remake' : 'original',
        });
        setProject(newProject);
        projectRef.current = newProject;
        
        // 等待保存完成
        await saveProject(newProject);
        
        // 保存完成后，允许后续的自动保存
        isSavingNewProjectRef.current = false;
        
        // 如果是从模板进入，读取模板信息
        if (fromTemplate === '1') {
          console.log('[初始化项目] 检测到 from_template 参数，准备读取模板数据');
          try {
            const templateStr = sessionStorage.getItem('selected_template');
            const projectName = sessionStorage.getItem('new_project_name');
            console.log('[初始化项目] sessionStorage 模板数据:', templateStr ? '有数据' : '无数据', '项目名称:', projectName);
            if (templateStr) {
              const template = JSON.parse(templateStr) as LibraryTemplate;
              console.log('[初始化项目] 解析模板数据:', {
                name: template.name,
                hookType: template.hookType,
                hookTypeName: template.hookTypeName,
                productImages: template.productImages?.length || 0,
                productInfo: template.productInfo ? '有内容' : '无内容',
                productId: template.productId,
                productName: template.productName,
                finalPrompt: template.finalPrompt ? '有内容' : '无内容',
              });
              setSelectedAITemplate(template);
              
              // 从 templatePrompt 中提取钩子类型信息（如果有）
              const hookTypeFromTemplate = template.templatePrompt?.hookType || template.hookType || '';
              const hookTypeNameFromTemplate = template.templatePrompt?.hookTypeName || template.hookTypeName || '';
              
              console.log('[初始化项目] 提取钩子类型:', {
                hookType: hookTypeFromTemplate,
                hookTypeName: hookTypeNameFromTemplate,
              });
              
              // 设置脚本要求，如果超过字数限制则截断
              const promptContent = template.finalPrompt || template.description || '';
              if (promptContent.length > SCRIPT_PROMPT_MAX_LENGTH) {
                console.warn(`[脚本要求] 模板内容超过字数限制 (${promptContent.length} > ${SCRIPT_PROMPT_MAX_LENGTH})，已截断`);
                setScriptPrompt(promptContent.substring(0, SCRIPT_PROMPT_MAX_LENGTH));
              } else {
                setScriptPrompt(promptContent);
              }
              if (template.duration) {
                setDuration(template.duration);
              }
              // 设置产品图片
              const templateProductImages = template.productImages && template.productImages.length > 0 
                ? template.productImages 
                : [];
              console.log('[初始化项目] 设置产品图片:', templateProductImages.length, '张');
              if (templateProductImages.length > 0) {
                setProductImages(templateProductImages);
                productImagesRef.current = templateProductImages;
              }
              // 设置产品描述
              const templateProductInfo = template.productInfo || '';
              console.log('[初始化项目] 设置产品描述:', templateProductInfo ? '有内容' : '无内容');
              if (templateProductInfo) {
                setProductDescription(templateProductInfo);
              }
              // 设置产品选择器状态（如果模板关联了产品）
              if (template.productId) {
                setSelectedProductId(template.productId);
                setSelectedProductName(template.productName || null);
              }
              // 清除 sessionStorage 中的模板信息和项目名称
              sessionStorage.removeItem('selected_template');
              sessionStorage.removeItem('new_project_name');
              
              // 立即保存模板数据到项目（重要！确保数据不会丢失）
              const updatedProject = {
                ...newProject,
                name: projectName || template.name || newProject.name, // 使用用户输入的名称
                productId: template.productId,
                productName: template.productName,
                productImages: templateProductImages,
                productDescription: templateProductInfo,
                scriptPrompt: template.finalPrompt || template.description,
                totalDuration: template.duration || 16,
              };
              console.log('[初始化项目] 保存更新后的项目:', {
                name: updatedProject.name,
                productImages: updatedProject.productImages.length,
                productDescription: updatedProject.productDescription ? '有内容' : '无内容',
              });
              await saveProject(updatedProject, true);
              // 更新 React state（重要！确保后续操作能获取正确的项目状态）
              setProject(updatedProject);
              projectRef.current = updatedProject;
            } else {
              console.warn('[初始化项目] sessionStorage 中没有找到模板数据');
            }
          } catch (e) {
            console.error('Failed to parse template from sessionStorage:', e);
          }
        }
      }
      
      // 重要：清除所有残留的映射关系，防止重新生成时出错
      imageTaskMappingRef.current.clear();
      videoTaskMappingRef.current.clear();
      console.log('[初始化项目] 已清除所有残留的映射关系');
      
      // 初始化完成后，检查是否有正在生成中的任务，触发轮询
      const hasGeneratingImageTasks = imageTasksRef.current.some(t => t.status === 'generating');
      const hasGeneratingVideoTasks = videoTasksRef.current.some(t => t.status === 'generating');
      if (hasGeneratingImageTasks || hasGeneratingVideoTasks) {
        console.log('[初始化项目] 检测到生成中的任务，触发轮询');
        setPollingTrigger(prev => prev + 1);
      }
    };

    initProject();
    
    return () => {
      isMounted = false;
      isMountedRef.current = false;
    };
  }, [searchParams]);

  // 清理
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, []);

  // 任务队列状态监听 - 同步图片任务状态
  // 使用 ref 获取最新状态，避免 imageTasks 变化导致 useEffect 重复执行
  useEffect(() => {
    // 只有在步骤3时才监听
    if (currentStep !== 3) return;
    
    // 检查是否有图片任务且有正在生成中的任务
    const currentImageTasks = imageTasksRef.current;
    console.log('[任务队列监听] 检查图片任务状态, currentStep:', currentStep, 'imageTasks数量:', currentImageTasks.length, 'pollingTrigger:', pollingTrigger);
    if (currentImageTasks.length === 0) return;
    
    const hasGeneratingTasks = currentImageTasks.some(t => t.status === 'generating');
    console.log('[任务队列监听] hasGeneratingTasks:', hasGeneratingTasks);
    if (!hasGeneratingTasks) return;
    
    console.log('[任务队列监听] 开始监听图片任务状态');
    
    // 触发队列处理（只触发一次）
    processQueue();
    
    // 定时轮询任务队列状态
    const pollInterval = setInterval(async () => {
      try {
        const queueResult = await getTaskQueue();
        const queueTasks = queueResult.tasks;
        
        // 遍历当前的图片任务，检查对应的队列任务状态
        setImageTasks(prevTasks => {
          // 检查是否还有生成中的任务
          const stillGenerating = prevTasks.some(t => t.status === 'generating');
          if (!stillGenerating) {
            return prevTasks; // 没有生成中的任务，不做更新
          }
          
          let hasChanges = false;
          const updatedTasks = prevTasks.map(iTask => {
            // 只处理生成中的任务
            if (iTask.status !== 'generating') return iTask;
            
            // 从映射中获取队列任务ID
            const queueTaskId = imageTaskMappingRef.current.get(iTask.id);
            if (!queueTaskId) return iTask;
            
            // 查找对应的队列任务
            const queueTask = queueTasks.find(t => t.id === queueTaskId);
            if (!queueTask) return iTask;
            
            // 检查状态变化
            if (queueTask.status === 'success' && queueTask.result) {
              hasChanges = true;
              const imageResult = queueTask.result as { url?: string };
              const newImage: GeneratedImage = {
                id: generateId('img'),
                url: imageResult.url || '',
                createdAt: Date.now(),
              };
              
              // 追加新图片，最多保留10次生成结果
              const allImages = [...iTask.generatedImages, newImage];
              const limitedImages = allImages.length > 10 ? allImages.slice(-10) : allImages;
              
              // 检查之前选中的图片是否被删除了，如果被删除则更新为最新图片
              const isPreviousSelectionStillValid = limitedImages.some(img => img.id === iTask.selectedImageId);
              const finalSelectedImageId = isPreviousSelectionStillValid ? iTask.selectedImageId : newImage.id;
              
              console.log(`[任务队列监听] 图片 ${iTask.order} 生成完成，总数: ${limitedImages.length}, 选中图片有效: ${isPreviousSelectionStillValid}`);
              
              // 清除映射关系，允许重新生成
              imageTaskMappingRef.current.delete(iTask.id);
              
              return {
                ...iTask,
                status: 'completed' as const,
                generatedImages: limitedImages,
                selectedImageId: finalSelectedImageId,
              };
            } else if (queueTask.status === 'failed') {
              hasChanges = true;
              console.log(`[任务队列监听] 图片 ${iTask.order} 生成失败:`, queueTask.error);
              
              // 清除映射关系，允许重新生成
              imageTaskMappingRef.current.delete(iTask.id);
              
              return {
                ...iTask,
                status: 'failed' as const,
                error: queueTask.lastError || queueTask.error,
              };
            }
            
            return iTask;
          });
          
          // 如果有变化，保存到项目
          if (hasChanges) {
            // 更新 ref
            imageTasksRef.current = updatedTasks;
            setTimeout(() => {
              updateProject({ imageTasks: updatedTasks }, true);
            }, 0);
          }
          
          return updatedTasks;
        });
      } catch (error) {
        console.error('[任务队列监听] 图片轮询失败:', error);
      }
    }, 3000); // 每3秒轮询一次
    
    return () => {
      clearInterval(pollInterval);
    };
    // 依赖 currentStep 和 pollingTrigger，使用 ref 获取最新的 imageTasks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, pollingTrigger]);

  // 任务队列状态监听 - 同步视频任务状态
  // 使用 ref 获取最新状态，避免 videoTasks 变化导致 useEffect 重复执行
  useEffect(() => {
    // 只有在步骤4时才监听
    if (currentStep !== 4) return;
    
    // 检查是否有视频任务且有正在生成中的任务
    const currentVideoTasks = videoTasksRef.current;
    console.log('[任务队列监听-视频] 检查视频任务状态, currentStep:', currentStep, 'videoTasks数量:', currentVideoTasks.length, 'pollingTrigger:', pollingTrigger);
    if (currentVideoTasks.length === 0) return;
    
    const hasGeneratingTasks = currentVideoTasks.some(t => t.status === 'generating');
    console.log('[任务队列监听-视频] hasGeneratingTasks:', hasGeneratingTasks);
    if (!hasGeneratingTasks) return;
    
    console.log('[任务队列监听] 开始监听视频任务状态');
    
    // 触发队列处理（只触发一次）
    processQueue();
    
    // 定时轮询任务队列状态
    const pollInterval = setInterval(async () => {
      try {
        const queueResult = await getTaskQueue();
        const queueTasks = queueResult.tasks;
        
        // 遍历当前的视频任务，检查对应的队列任务状态
        setVideoTasks(prevTasks => {
          // 检查是否还有生成中的任务
          const stillGenerating = prevTasks.some(t => t.status === 'generating');
          if (!stillGenerating) {
            return prevTasks; // 没有生成中的任务，不做更新
          }
          
          let hasChanges = false;
          const updatedTasks = prevTasks.map(vTask => {
            // 只处理生成中的任务
            if (vTask.status !== 'generating') return vTask;
            
            // 从映射中获取队列任务ID
            const queueTaskId = videoTaskMappingRef.current.get(vTask.id);
            if (!queueTaskId) return vTask;
            
            // 查找对应的队列任务
            const queueTask = queueTasks.find(t => t.id === queueTaskId);
            if (!queueTask) return vTask;
            
            // 检查状态变化
            if (queueTask.status === 'success' && queueTask.result) {
              hasChanges = true;
              const videoResult = queueTask.result as { videoUrl?: string; thumbnailUrl?: string; taskId?: string };
              const newVideo: GeneratedVideo = {
                id: generateId('vid'),
                url: videoResult.videoUrl || '',
                taskId: videoResult.taskId || '',
                createdAt: Date.now(),
              };
              
              // 追加新视频，最多保留10次生成结果
              const allVideos = [...vTask.generatedVideos, newVideo];
              const limitedVideos = allVideos.length > 10 ? allVideos.slice(-10) : allVideos;
              
              // 检查之前选中的视频是否被删除了，如果被删除则更新为最新视频
              const isPreviousSelectionStillValid = limitedVideos.some(vid => vid.id === vTask.selectedVideoId);
              const finalSelectedVideoId = isPreviousSelectionStillValid ? vTask.selectedVideoId : newVideo.id;
              
              console.log(`[任务队列监听] 视频 ${vTask.order} 生成完成，总数: ${limitedVideos.length}, 选中视频有效: ${isPreviousSelectionStillValid}`);
              
              // 清除映射关系，允许重新生成
              videoTaskMappingRef.current.delete(vTask.id);
              
              return {
                ...vTask,
                status: 'completed' as const,
                generatedVideos: limitedVideos,
                selectedVideoId: finalSelectedVideoId,
              };
            } else if (queueTask.status === 'failed') {
              hasChanges = true;
              console.log(`[任务队列监听] 视频 ${vTask.order} 生成失败:`, queueTask.error);
              
              // 清除映射关系，允许重新生成
              videoTaskMappingRef.current.delete(vTask.id);
              
              return {
                ...vTask,
                status: 'failed' as const,
                error: queueTask.lastError || queueTask.error,
              };
            }
            
            return vTask;
          });
          
          // 如果有变化，保存到项目
          if (hasChanges) {
            // 更新 ref 以保持同步
            videoTasksRef.current = updatedTasks;
            setTimeout(() => {
              updateProject({ videoTasks: updatedTasks }, true);
            }, 0);
          }
          
          return updatedTasks;
        });
      } catch (error) {
        console.error('[任务队列监听] 轮询失败:', error);
      }
    }, 3000); // 每3秒轮询一次
    
    return () => {
      clearInterval(pollInterval);
    };
    // 依赖 currentStep 和 pollingTrigger，使用 ref 获取最新的 videoTasks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, pollingTrigger]);

  // 页面离开时保存数据（同步保存）
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 如果有待保存的数据，立即保存
      if (projectRef.current && isProjectInitializedRef.current) {
        // 使用同步保存
        const saveData = async () => {
          try {
            const currentProject = projectRef.current;
            if (currentProject) {
              // 构建当前步骤的数据
              let updates: Partial<ShortFilmProject> = {};
              switch (currentStep) {
                case 1:
                  updates = {
                    productImages: productImagesRef.current,
                    productDescription,
                    scriptPrompt,
                    totalDuration: duration,
                  };
                  break;
                case 2:
                  updates = { scriptSegments };
                  break;
                case 3:
                  updates = {
                    imageTasks: imageTasksRef.current,
                    scriptSegments,
                    selectedCharacters: selectedCharacters.map(c => ({
                      id: c.id,
                      name: c.name,
                      url: c.url,
                    })),
                  };
                  break;
                case 4:
                  updates = {
                    videoTasks,
                    imageTasks: imageTasksRef.current,
                  };
                  break;
              }
              
              // 合并更新
              const updatedProject = {
                ...currentProject,
                ...updates,
                updatedAt: Date.now(),
              };
              
              // 使用 fetch 发送同步请求
              await authFetch('/api/shortfilm/projects/' + currentProject.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProject),
                keepalive: true, // 允许请求在页面关闭后继续
              });
            }
          } catch {
            // 页面卸载时网络请求被中止是预期行为，静默处理
            // 不打印错误日志，避免用户困惑
          }
        };
        saveData();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentStep, productDescription, scriptPrompt, duration, scriptSegments, selectedCharacters]);

  // 自动保存当前步骤内容（防抖保存）
  // 注意：imageTasks 和 videoTasks 的保存已在各自的操作函数中处理，这里不再重复保存
  useEffect(() => {
    // 只有在项目已初始化后，且不在保存新项目过程中才执行自动保存
    if (!project || !isProjectInitializedRef.current || isSavingNewProjectRef.current) return;
    
    // 根据当前步骤保存对应内容
    const saveCurrentStepData = () => {
      switch (currentStep) {
        case 1:
          updateProject({
            productImages,
            productDescription,
            scriptPrompt,
            totalDuration: duration,
          });
          break;
        case 2:
          updateProject({
            scriptSegments,
          });
          break;
        case 3:
          // imageTasks 的保存在 executeImageGeneration 中处理
          // 这里只保存 selectedCharacters 和 scriptSegments
          updateProject({
            scriptSegments,
            selectedCharacters: selectedCharacters.map(c => ({
              id: c.id,
              name: c.name,
              url: c.url,
            })),
          });
          break;
        case 4:
          // videoTasks 的保存在视频生成函数中处理
          // 这里不需要额外保存
          break;
      }
    };

    // 防抖保存
    const timer = setTimeout(() => {
      saveCurrentStepData();
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentStep, productImages, productDescription, scriptPrompt, duration, scriptSegments, selectedCharacters]);

  // 加载产品列表（用于参考图选择）
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const result = await getProducts();
        const products = Array.isArray(result) ? result : result.data;
        setProductList(products);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    loadProducts();
  }, []);
  
  // 检查未完成的脚本任务并恢复状态（等待 SSE 事件通知）
  useEffect(() => {
    const checkPendingScriptTask = async () => {
      if (!project?.id || !isProjectInitializedRef.current) return;
      
      try {
        // 查询项目中未完成的脚本任务
        const response = await authFetch(`/api/shortfilm/script-tasks?projectId=${project.id}&status=pending,processing,running`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          const pendingTask = data.data[0];
          console.log('[脚本任务] 发现未完成任务，恢复状态:', pendingTask.id, '状态:', pendingTask.status);
          
          // 设置任务ID和生成中状态，等待 SSE 事件通知完成
          setScriptTaskId(pendingTask.id);
          setIsGeneratingScript(true);
        }
      } catch (error) {
        console.error('[脚本任务] 检查未完成任务失败:', error);
      }
    };
    
    checkPendingScriptTask();
  }, [project?.id]);
  
  // 脚本任务轮询（SSE 备用方案）
  useEffect(() => {
    if (!scriptTaskId || !isGeneratingScript) return;
    
    const pollScriptTask = async () => {
      try {
        const response = await authFetch(`/api/tasks/${scriptTaskId}`);
        const data = await response.json();
        
        if (data.data) {
          const task = data.data as QueueTask;
          console.log('[脚本任务轮询] 任务状态:', task.status);
          
          if (task.status === 'success' && task.result) {
            // 脚本生成成功
            const result = task.result as { segments?: Array<{
              order: number;
              duration: number;
              imagePrompt: string;
              videoPrompt: string;
              description: string;
              hookType?: string;
              sellingPoint?: string;
            }>; rawResponse?: string };
            
            if (result.segments) {
              const segments: ScriptSegment[] = result.segments.map((seg, idx) => ({
                id: `seg-${idx + 1}`,
                order: seg.order || idx + 1,
                duration: seg.duration || 4,
                imagePrompt: seg.imagePrompt || '',
                videoPrompt: seg.videoPrompt || '',
                description: seg.description || '',
                hookType: seg.hookType,
                sellingPoint: seg.sellingPoint,
              }));
              
              setScriptSegments(segments);
              setScriptRawResponse(result.rawResponse || null);
              setCurrentStep(2);
              updateMaxCompletedStep(1);
              setIsGeneratingScript(false);
              setScriptTaskId(null);
              setShowScriptConfirm(false);
              
              // 保存到项目
              updateProject({ 
                scriptSegments: segments, 
                productImages: productImagesRef.current,
                productDescription: productDescriptionRef.current,
                scriptPrompt: scriptPromptRef.current,
                totalDuration: durationRef.current,
                currentStep: 2,
                productId: projectRef.current?.productId,
                productName: projectRef.current?.productName,
              }, true);
              
              console.log('[脚本任务轮询] 脚本任务完成');
            }
          } else if (task.status === 'failed') {
            // 脚本生成失败
            setIsGeneratingScript(false);
            setScriptTaskId(null);
            setShowScriptConfirm(false);
            setScriptTaskError(task.error || '脚本生成失败');
            console.error('[脚本任务轮询] 脚本任务失败:', task.error);
          }
          // 其他状态（pending, running）继续轮询
        }
      } catch (error) {
        console.error('[脚本任务轮询] 查询失败:', error);
      }
    };
    
    // 立即检查一次
    pollScriptTask();
    
    // 每3秒轮询一次
    const interval = setInterval(pollScriptTask, 3000);
    
    return () => clearInterval(interval);
  }, [scriptTaskId, isGeneratingScript, updateProject]);
  
  // 当 productList 加载完成后，检查是否需要恢复产品选择状态
  // （用于从模板进入时，确保产品选择器能正确显示）
  useEffect(() => {
    if (productList.length > 0 && selectedProductId && !productList.find(p => p.id === selectedProductId)) {
      // 产品不存在于列表中，但 selectedProductId 有值，说明产品可能已被删除
      // 保持当前状态，显示"产品已删除"提示
      console.log('[产品选择器] 产品已删除或不存在:', selectedProductId);
    }
  }, [productList, selectedProductId]);

  const updateMaxCompletedStep = (step: number) => {
    if (step > maxCompletedStep) {
      setMaxCompletedStep(step);
    }
  };

  const handleStepClick = (step: number) => {
    const isCompleted = step <= maxCompletedStep;
    const isCurrent = step === currentStep;
    if (isCompleted || isCurrent) {
      setCurrentStep(step as 1 | 2 | 3 | 4 | 5);
      updateProject({ currentStep: step as 1 | 2 | 3 | 4 | 5 }, true);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/shortfilm')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <h1 className="text-lg font-semibold">{project?.name || '新建短片'}</h1>
              {project && (
                <Badge variant="outline" className="text-xs">
                  步骤 {currentStep}/5
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAITemplateSelector(true)}
              >
                <Bookmark className="w-4 h-4 mr-1" />
                选择模板
              </Button>
            </div>
          </div>
        </header>

        {/* 步骤指示器 */}
        <StepIndicator
          currentStep={currentStep}
          maxCompletedStep={maxCompletedStep}
          hasMergedVideos={!!project?.mergedVideos && project.mergedVideos.length > 0}
          onStepClick={handleStepClick}
        />

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-4xl mx-auto">
            {/* 步骤1：脚本生成 */}
            {currentStep === 1 && (
              <Step1ScriptGeneration
                remakeMode={remakeMode}
                isAdmin={isAdmin}
                scriptGenerationMode={scriptGenerationMode}
                onScriptGenerationModeChange={setScriptGenerationMode}
                productImages={productImages}
                productDescription={productDescription}
                selectedProductId={selectedProductId}
                selectedProductName={selectedProductName}
                scriptPrompt={scriptPrompt}
                duration={duration}
                isGeneratingScript={isGeneratingScript}
                scriptTaskError={scriptTaskError}
                scriptRequestBody={scriptRequestBody}
                selectedAITemplate={selectedAITemplate}
                onSelectedAITemplateChange={setSelectedAITemplate}
                productList={productList}
                selectedTextModelId={selectedTextModelId}
                onSelectedTextModelIdChange={setSelectedTextModelId}
                selectedTextModelConfig={selectedTextModelConfig}
                onSelectedTextModelConfigChange={(config) => setSelectedTextModelConfig(config as TextApiConfig)}
                onProductSelect={async (productId) => {
                  if (!productId) {
                    setSelectedProductId(null);
                    setSelectedProductName(null);
                    setProductImages([]);
                    setProductDescription('');
                    updateProject({
                      productId: undefined,
                      productName: undefined,
                      productImages: [],
                      productDescription: '',
                    }, true);
                    return;
                  }
                  const selected = productList.find(p => p.id === productId);
                  if (selected) {
                    setSelectedProductId(selected.id);
                    setSelectedProductName(selected.name);
                    const images = selected.images.map(img => ({ key: img.key, url: img.url }));
                    setProductImages(images);
                    productImagesRef.current = images;
                    const desc = [
                      selected.description,
                      selected.sellingPoints.length > 0 ? `卖点：${selected.sellingPoints.join('、')}` : '',
                      selected.targetAudience ? `目标受众：${selected.targetAudience}` : '',
                    ].filter(Boolean).join('\n');
                    setProductDescription(desc);
                    updateProject({
                      productId: selected.id,
                      productName: selected.name,
                      productImages: images,
                      productDescription: desc,
                    }, true);
                  }
                }}
                onProductImagesChange={(images) => {
                  productImagesRef.current = images;
                  setProductImages(images);
                  updateProject({ productImages: images }, true);
                }}
                onProductDescriptionChange={setProductDescription}
                onScriptPromptChange={setScriptPrompt}
                onDurationChange={setDuration}
                onGenerateScript={() => {
                  const requestBody: Record<string, unknown> = {
                    productImages,
                    productDescription,
                    scriptPrompt,
                    duration,
                    isFullPrompt: !!(selectedAITemplate?.finalPrompt),
                  };
                  if (selectedTextModelConfig) {
                    requestBody.apiKey = selectedTextModelConfig.apiKey;
                    requestBody.baseUrl = selectedTextModelConfig.baseUrl;
                    requestBody.model = selectedTextModelConfig.model;
                  }
                  setScriptRequestBody(requestBody);
                  setShowScriptConfirm(true);
                }}
                onRetryScript={() => {
                  if (scriptRequestBody) {
                    executeGenerateScript(scriptRequestBody);
                  }
                }}
                onManualNext={(segments) => {
                  setScriptSegments(segments);
                  setCurrentStep(2);
                  setMaxCompletedStep(1);
                  updateProject({
                    scriptGenerationMode: 'manual',
                    scriptSegments: segments,
                    productImages: [],
                    productDescription: '',
                    totalDuration: duration,
                  }, true);
                }}
                onShowAITemplateSelector={() => setShowAITemplateSelector(true)}
                remakeVideoUrl={remakeVideoUrl}
                remakeSelectedFile={remakeSelectedFile}
                remakeUploading={remakeUploading}
                remakeUploadProgress={remakeUploadProgress}
                remakeVideoUrlInput={remakeVideoUrlInput}
                isRemakeParsing={isRemakeParsing}
                remakeParseError={remakeParseError}
                remakeVideoDuration={remakeVideoDuration}
                onRemakeVideoUrlInputChange={setRemakeVideoUrlInput}
                onRemakeFileSelect={handleRemakeFileSelect}
                onRemakeUpload={handleRemakeUpload}
                onRemakeLinkSubmit={handleRemakeLinkSubmit}
                onRemakeParse={handleRemakeParse}
                onRemakeVideoClear={() => {
                  setRemakeVideoKey(null);
                  setRemakeVideoUrl(null);
                  setRemakeVideoDuration(0);
                  updateProject({
                    sourceVideoKey: undefined,
                    sourceVideoUrl: undefined,
                    videoDuration: undefined,
                  }, true);
                }}
                onProductImageUpload={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  const uploadingCount = files.length;
                  console.log(`[产品图片] 开始上传 ${uploadingCount} 张图片...`);
                  const startTime = Date.now();
                  const uploadPromises = Array.from(files).map(async (file) => {
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('folder', 'shortfilm/products');
                      formData.append('fileName', `shortfilm/products/${Date.now()}_${file.name}`);
                      const response = await authFetch('/api/upload-image', {
                        method: 'POST',
                        body: formData,
                      });
                      const result = await response.json();
                      if (result.success && result.url) {
                        console.log(`[产品图片] 上传成功: ${file.name}`);
                        return { key: result.key, url: result.url };
                      } else {
                        console.error(`[产品图片] 上传失败: ${result.error}`);
                      }
                    } catch (error) {
                      console.error(`[产品图片] 上传异常:`, error);
                    }
                    return null;
                  });
                  const results = await Promise.all(uploadPromises);
                  const newImages = results.filter((img): img is { key: string; url: string } => img !== null);
                  const elapsed = Date.now() - startTime;
                  console.log(`[产品图片] 完成: ${newImages.length}/${uploadingCount} 张，耗时 ${elapsed}ms`);
                  if (newImages.length > 0) {
                    const updatedImages = [...productImagesRef.current, ...newImages];
                    productImagesRef.current = updatedImages;
                    setProductImages(prev => {
                      const newPrev = [...prev, ...newImages];
                      updateProject({ productImages: newPrev }, true);
                      return newPrev;
                    });
                  }
                }}
              />
            )}

            {/* 步骤2：确认脚本 */}
            {currentStep === 2 && (
              <Step2ScriptConfirm
                scriptGenerationMode={scriptGenerationMode}
                scriptRawResponse={scriptRawResponse}
                scriptSegments={scriptSegments}
                onScriptSegmentsChange={setScriptSegments}
                remakeMode={remakeMode}
                productImages={productImages}
                productDescription={productDescription}
                scriptPrompt={scriptPrompt}
                duration={duration}
                imageTasks={imageTasks}
                onGoBack={() => {
                  updateProject({
                    productImages,
                    productDescription,
                    scriptPrompt,
                    totalDuration: duration,
                    scriptSegments,
                    currentStep: 1,
                  }, true);
                  setCurrentStep(1);
                }}
                onConfirm={(tasks) => {
                  setImageTasks(tasks);
                  setCurrentStep(3);
                  updateMaxCompletedStep(2);
                  updateProject({
                    imageTasks: tasks,
                    scriptSegments,
                    currentStep: 3,
                  }, true);
                }}
              />
            )}

            {/* 步骤3：图片生成 */}
            {currentStep === 3 && (
              <Step3ImageGeneration
                selectedImageModelId={selectedImageModelId}
                onSelectedImageModelIdChange={setSelectedImageModelId}
                selectedImageModelConfig={selectedImageModelConfig}
                onSelectedImageModelConfigChange={(config) => setSelectedImageModelConfig(config as ImageApiConfig)}
                productImages={productImages}
                productDescription={productDescription}
                selectedCharacters={selectedCharacters}
                onSelectedCharactersChange={setSelectedCharacters}
                onShowCharacterLibrary={() => setShowCharacterLibrary(true)}
                imageTasks={imageTasks}
                onImageTasksChange={setImageTasks}
                failedImageUrls={failedImageUrls}
                onFailedImageUrlsChange={setFailedImageUrls}
                onShowReferenceDialog={(taskId, references) => {
                  setCurrentEditingTaskId(taskId);
                  setCurrentEditingReferences(references);
                  setShowReferenceDialog(true);
                }}
                onPreviewImages={(images, index) => {
                  setPreviewImages(images);
                  setPreviewImageIndex(index);
                }}
                onImageGenerate={(taskId, prompt, referenceImages, model, baseUrl) => {
                  if (!selectedImageModelConfig?.apiKeyMasked) {
                    setStorageWarning('请先选择图片生成模型');
                    return;
                  }
                  setPendingImageTask({
                    taskId,
                    prompt,
                    images: referenceImages,
                    model,
                    baseUrl,
                    referenceImages,
                  });
                  setShowImageConfirm(true);
                }}
                storageWarning={storageWarning}
                scriptSegments={scriptSegments}
                videoTasks={videoTasks}
                onVideoTasksChange={setVideoTasks}
                videoTasksRef={videoTasksRef}
                selectedVideoModelConfig={selectedVideoModelConfig}
                onGoBack={() => {
                  updateProject({
                    imageTasks,
                    scriptSegments,
                    currentStep: 2,
                  }, true);
                  setCurrentStep(2);
                }}
                onConfirm={() => {
                  const vTasks: VideoTask[] = imageTasks.slice(0, -1).map((task, idx) => {
                    const endFrameTask = imageTasks[idx + 1];
                    const segment = scriptSegments.find(s => s.id === endFrameTask?.segmentId) ||
                                    scriptSegments.find(s => s.order === endFrameTask?.order) ||
                                    scriptSegments[idx + 1];
                    const existingVTask = videoTasks.find(vt =>
                      vt.order === task.order ||
                      vt.startFrameImageId === task.selectedImageId
                    );
                    if (existingVTask && (existingVTask.status === 'completed' || existingVTask.status === 'generating')) {
                      return {
                        ...existingVTask,
                        startFrameUrl: task.generatedImages.find(i => i.id === task.selectedImageId)?.url || existingVTask.startFrameUrl,
                        endFrameUrl: endFrameTask?.generatedImages.find(i => i.id === endFrameTask.selectedImageId)?.url || existingVTask.endFrameUrl,
                        prompt: segment?.videoPrompt || existingVTask.prompt,
                      };
                    }
                    return {
                      id: existingVTask?.id || generateId('vid'),
                      segmentId: task.segmentId,
                      order: task.order,
                      prompt: segment?.videoPrompt || '',
                      status: 'pending' as const,
                      startFrameUrl: task.generatedImages.find(i => i.id === task.selectedImageId)?.url || '',
                      endFrameUrl: endFrameTask?.generatedImages.find(i => i.id === endFrameTask.selectedImageId)?.url || '',
                      startFrameImageId: task.selectedImageId || '',
                      endFrameImageId: endFrameTask?.selectedImageId || '',
                      model: selectedVideoModelConfig?.model || '',
                      aspectRatio: selectedVideoModelConfig?.defaultAspectRatio || '9:16',
                      duration: 4,
                      generatedVideos: existingVTask?.generatedVideos || [],
                      selectedVideoId: existingVTask?.selectedVideoId || '',
                    };
                  });
                  setVideoTasks(vTasks);
                  videoTasksRef.current = vTasks;
                  setCurrentStep(4);
                  updateMaxCompletedStep(3);
                  updateProject({
                    videoTasks: vTasks,
                    imageTasks,
                    currentStep: 4,
                  }, true);
                }}
              />
            )}

            {/* 步骤4：视频生成 */}
            {currentStep === 4 && (
              <Step4VideoGeneration
                selectedVideoModelId={selectedVideoModelId}
                onSelectedVideoModelIdChange={setSelectedVideoModelId}
                selectedVideoModelConfig={selectedVideoModelConfig}
                onSelectedVideoModelConfigChange={(config) => setSelectedVideoModelConfig(config as VideoApiConfig)}
                videoTasks={videoTasks}
                onVideoTasksChange={setVideoTasks}
                videoTasksRef={videoTasksRef}
                imageTasks={imageTasks}
                onVideoGenerate={(taskId, prompt, startFrameUrl, endFrameUrl, model, baseUrl, seedanceP) => {
                  if (!selectedVideoModelConfig?.apiKeyMasked) {
                    setStorageWarning('请先选择视频生成模型');
                    return;
                  }
                  setPendingVideoTask({
                    taskId,
                    prompt,
                    startFrameUrl,
                    endFrameUrl,
                    model,
                    baseUrl,
                    seedanceParams: seedanceP,
                  });
                  setShowVideoConfirm(true);
                }}
                onPreviewVideo={(url) => setPreviewVideoUrl(url)}
                onGoBack={() => {
                  updateProject({
                    videoTasks,
                    imageTasks,
                    currentStep: 3,
                  }, true);
                  setCurrentStep(3);
                }}
                onMergeVideos={() => setShowVideoMerger(true)}
                seedanceParams={seedanceParams}
                onSeedanceParamsChange={setSeedanceParams}
              />
            )}

            {/* 步骤5：预览成果 */}
            {currentStep === 5 && (
              <Step5Preview
                project={project}
                imageTasks={imageTasks}
                videoTasks={videoTasks}
                onGoBack={() => {
                  updateProject({ currentStep: 4 }, true);
                  setCurrentStep(4);
                }}
                onGoToList={() => router.push('/shortfilm')}
                onPreviewImages={(images, index) => {
                  setPreviewImages(images);
                  setPreviewImageIndex(index);
                }}
              />
            )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <ScriptConfirmDialog
        open={showScriptConfirm}
        onOpenChange={setShowScriptConfirm}
        isAdmin={isAdmin}
        scriptRequestBody={scriptRequestBody}
        isGeneratingScript={isGeneratingScript}
        onConfirm={executeGenerateScript}
      />

      <ImageConfirmDialog
        open={showImageConfirm}
        onOpenChange={setShowImageConfirm}
        isAdmin={isAdmin}
        pendingImageTask={pendingImageTask}
        onConfirm={executeImageGeneration}
      />

      <VideoConfirmDialog
        open={showVideoConfirm}
        onOpenChange={setShowVideoConfirm}
        isAdmin={isAdmin}
        pendingVideoTask={pendingVideoTask}
        onConfirm={executeVideoGeneration}
      />

      {/* 模板选择器 */}
      <TemplateSelector
        open={showAITemplateSelector}
        onOpenChange={setShowAITemplateSelector}
        onSelect={(template) => {
          setSelectedAITemplate(template);
          // 设置脚本要求，如果超过字数限制则截断
          const promptContent = template.finalPrompt || template.description || '';
          if (promptContent.length > SCRIPT_PROMPT_MAX_LENGTH) {
            console.warn(`[脚本要求] 模板内容超过字数限制，已截断`);
            setScriptPrompt(promptContent.substring(0, SCRIPT_PROMPT_MAX_LENGTH));
          } else {
            setScriptPrompt(promptContent);
          }
          setShowAITemplateSelector(false);
        }}
      />

      {/* 角色图库对话框 */}
      <CharacterLibraryDialog
        open={showCharacterLibrary}
        onOpenChange={setShowCharacterLibrary}
        selectedIds={selectedCharacters.map(c => c.id)}
        onSelect={(characters) => setSelectedCharacters(characters)}
      />

      {/* 参考图选择对话框 */}
      <ReferenceImageDialog
        open={showReferenceDialog}
        onOpenChange={setShowReferenceDialog}
        currentReferences={currentEditingReferences}
        productImages={productList}
        generatedImages={imageTasks
          .filter(t => t.status === 'completed' && t.selectedImageId)
          .map(t => ({
            taskId: t.id,
            taskOrder: t.order,
            url: t.generatedImages.find(img => img.id === t.selectedImageId)?.url || '',
          }))}
        onSelect={(urls) => {
          if (currentEditingTaskId) {
            setImageTasks(prev =>
              prev.map(t => t.id === currentEditingTaskId ? { 
                ...t, 
                referenceImages: urls,
                isReferenceManuallySet: true, // 标记为用户手动设置
              } : t)
            );
          }
        }}
      />

      {/* 视频合成对话框 */}
      <VideoMergerDialog
        open={showVideoMerger}
        onOpenChange={setShowVideoMerger}
        videoUrls={videoTasks.filter(t => t.selectedVideoId).map(t => t.generatedVideos.find(v => v.id === t.selectedVideoId)?.url || '').filter(Boolean)}
        projectName={project?.name}
        mergedVideos={project?.mergedVideos || []}
        onVideosUpdate={(videos) => updateProject({ mergedVideos: videos }, true)} // immediate=true 立即保存
        onComplete={(video) => {
          // 合成完成后进入第5步，标记项目为已完成
          console.log('[视频合成] 完成，切换到第5步，标记项目为已完成');
          setCurrentStep(5);
          setMaxCompletedStep(5); // 步骤5已完成
          
          // 使用 updateProject 立即保存，确保状态正确
          // 注意：不在这里更新 mergedVideos，因为 onVideosUpdate 已经处理了
          updateProject({ 
            currentStep: 5, 
            status: 'completed' 
          }, true); // immediate=true 立即保存
        }}
      />

      {/* 图片预览 */}
      <ImagePreviewOverlay
        images={previewImages}
        currentIndex={previewImageIndex}
        onIndexChange={setPreviewImageIndex}
        onClose={() => {
          setPreviewImages([]);
          setPreviewImageIndex(0);
        }}
      />

      {/* 视频预览对话框 */}
      <VideoPreviewDialog
        open={!!previewVideoUrl}
        onOpenChange={(open) => !open && setPreviewVideoUrl(null)}
        videoUrl={previewVideoUrl}
      />
    </AppLayout>
  );
}

export default function ShortFilmNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ShortFilmNewContent />
    </Suspense>
  );
}

// Card 组件内联定义
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}
