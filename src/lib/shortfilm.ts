// 短片创作相关类型定义 - 服务器端存储版本
import { 
  cache, 
  withCache, 
  invalidateCache, 
  invalidateCacheByPrefix,
  CacheKeys,
  CACHE_TTL 
} from './cache';
import { getAuthToken, apiRequest } from './api';

// 脚本段落
export interface ScriptSegment {
  id: string;
  order: number;
  duration: number;
  imagePrompt: string;
  videoPrompt: string;
  description: string;
  hookType?: string;
  sellingPoint?: string;
  shotType?: string;
  cameraMovement?: string;
  speechText?: string;
  audioPrompt?: string;
  backgroundMusic?: string;
  startTime?: number;
  endTime?: number;
}

// 脚本模板
export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'product' | 'story' | 'tutorial' | 'promo' | 'custom';
  duration: number; // 总时长
  promptTemplate: string; // AI生成脚本的提示词模板
  tags?: string[];
  isSystem?: boolean;
  createdAt: string | number;
}

// 图片生成任务
export interface ImageTask {
  id: string;
  segmentId: string;
  order: number;
  prompt: string;
  referenceImages?: string[]; // 参考图URL列表（支持多张）
  isReferenceManuallySet?: boolean; // 参考图是否是用户手动设置的
  characterImages?: CharacterImage[]; // 角色图片列表（用于保持角色一致性）
  generatedImages: GeneratedImage[]; // 生成的图片列表
  status: 'pending' | 'generating' | 'completed' | 'failed';
  selectedImageId?: string; // 用户选择的图片ID
  error?: string; // 错误信息
}

// 角色图片
export interface CharacterImage {
  id: string;
  url: string;
  name?: string;
}

// 生成的图片
export interface GeneratedImage {
  id: string;
  url: string;
  createdAt: number;
}

// 视频生成任务
export interface VideoTask {
  id: string;
  segmentId: string;
  order: number;
  prompt: string;
  startFrameImageId: string; // 首帧图片ID
  endFrameImageId: string; // 尾帧图片ID
  startFrameUrl?: string;
  endFrameUrl?: string;
  model: string; // 视频模型
  aspectRatio: string;
  duration: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  apiTaskId?: string; // API返回的任务ID，用于恢复轮询
  generatedVideos: GeneratedVideo[]; // 改为数组，支持多个视频
  selectedVideoId?: string; // 用户选择的视频ID
  error?: string; // 错误信息
}

// 生成的视频
export interface GeneratedVideo {
  id: string;
  url: string;
  thumbnailUrl?: string; // 缩略图 URL
  taskId: string; // 云雾API任务ID
  createdAt: number;
}

// 合成的视频记录
export interface MergedVideo {
  id: string;
  url: string; // 对象存储 URL
  projectName: string;
  videoCount: number; // 合成的视频片段数量
  duration: number; // 总时长（秒）
  size: number; // 文件大小（字节）
  createdAt: number;
}

// 短片项目
export interface ShortFilmProject {
  id: string;
  name: string;
  createdAt: string | number;
  updatedAt: string | number;
  
  productId?: string;
  productName?: string;
  productImages: Array<{ key: string; url: string }>;
  productDescription: string;
  scriptPrompt: string;
  scriptGenerationMode?: 'ai' | 'manual';
  totalDuration: number;
  
  scriptSegments: ScriptSegment[];
  
  imageTasks: ImageTask[];
  selectedCharacters?: SelectedCharacter[];
  
  videoTasks: VideoTask[];
  
  mergedVideos: MergedVideo[];
  
  currentStep: 1 | 2 | 3 | 4 | 5;
  
  status: 'draft' | 'scripting' | 'generating_images' | 'generating_videos' | 'completed';

  sourceType?: 'original' | 'remake';
  sourceVideoKey?: string;
  sourceVideoUrl?: string;
  videoDuration?: number;
}

// 选中的达人角色（简化版，用于持久化）
export interface SelectedCharacter {
  id: string;
  name: string;
  url: string;
}

const MAX_IMAGES_PER_TASK = 5;

function cleanupProjectData(project: ShortFilmProject): ShortFilmProject {
  // 限制每个任务保留的图片数量
  const cleanedImageTasks = project.imageTasks.map(task => ({
    ...task,
    generatedImages: task.generatedImages.slice(-MAX_IMAGES_PER_TASK),
  }));

  return {
    ...project,
    imageTasks: cleanedImageTasks,
  };
}

// ========== 项目管理 API ==========

export async function getProjects(forceRefresh = false): Promise<ShortFilmProject[]> {
  try {
    const projects = await withCache(
      CacheKeys.projects(),
      async () => {
        const result = await apiRequest<{ data: ShortFilmProject[] }>('/api/shortfilm/projects');
        return result.data || [];
      },
      { ttl: CACHE_TTL.PROJECTS, forceRefresh }
    );
    // 同时更新内存缓存（重要！确保 getProjectsSync 能获取最新数据）
    projectCache = projects;
    return projects;
  } catch (error) {
    console.error('Failed to get projects:', error);
    return [];
  }
}

export async function getProject(id: string, forceRefresh = false): Promise<ShortFilmProject | null> {
  try {
    return await withCache(
      CacheKeys.project(id),
      async () => {
        try {
          const result = await apiRequest<{ data: ShortFilmProject }>(`/api/shortfilm/projects/${id}`);
          return result.data;
        } catch (error) {
          // 项目不存在是正常情况，不打印错误日志
          if (error instanceof Error && error.message === '项目不存在') {
            return null;
          }
          throw error;
        }
      },
      { ttl: CACHE_TTL.PROJECTS, forceRefresh }
    );
  } catch (error) {
    // 只有非"项目不存在"的错误才打印日志
    if (error instanceof Error && error.message !== '项目不存在') {
      console.error('Failed to get project:', error);
    }
    return null;
  }
}

export async function saveProject(project: ShortFilmProject, forceUpdate = false): Promise<boolean> {
  try {
    const cleanedProject = cleanupProjectData(project);
    
    // 如果强制更新或已经知道项目存在，直接调用 PUT
    if (forceUpdate) {
      await apiRequest<{ data: ShortFilmProject }>(`/api/shortfilm/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify(cleanedProject),
      });
    } else {
      // 检查项目是否存在（强制刷新缓存）
      const existing = await getProject(project.id, true);
      
      if (existing) {
        // 更新项目
        await apiRequest<{ data: ShortFilmProject }>(`/api/shortfilm/projects/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify(cleanedProject),
        });
      } else {
        // 创建新项目
        await apiRequest<{ data: ShortFilmProject }>('/api/shortfilm/projects', {
          method: 'POST',
          body: JSON.stringify(cleanedProject),
        });
      }
    }
    
    // 使缓存失效
    invalidateCache(CacheKeys.project(project.id));
    invalidateCache(CacheKeys.projects());
    
    // 同时更新内存缓存（重要！确保 getProjectsSync 能获取最新数据）
    if (projectCache) {
      const index = projectCache.findIndex(p => p.id === cleanedProject.id);
      if (index >= 0) {
        projectCache[index] = cleanedProject;
      } else {
        projectCache.push(cleanedProject);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to save project:', error);
    return false;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/shortfilm/projects/${id}`, { method: 'DELETE' });

    // 使缓存失效
    invalidateCache(CacheKeys.project(id));
    invalidateCache(CacheKeys.projects());

    // 使任务队列缓存失效（删除短片会删除关联的任务）
    invalidateCacheByPrefix('task-queue:');
    invalidateCacheByPrefix('task-stats:');

    return true;
  } catch (error) {
    console.error('Failed to delete project:', error);
    return false;
  }
}

// 创建新项目
export function createNewProject(
  name: string = '未命名短片',
  options?: { productId?: string; productName?: string; sourceType?: 'original' | 'remake' }
): ShortFilmProject {
  return {
    id: `sf-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    productId: options?.productId,
    productName: options?.productName,
    productImages: [],
    productDescription: '',
    scriptPrompt: '',
    totalDuration: 30,
    scriptSegments: [],
    imageTasks: [],
    videoTasks: [],
    mergedVideos: [],
    currentStep: 1,
    status: 'draft',
    sourceType: options?.sourceType,
  };
}

// 生成唯一ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ========== 同步版本（兼容旧代码）==========
// 使用内存缓存 + 后台同步的方式

let projectCache: ShortFilmProject[] | null = null;
const saveQueue: Array<{ project: ShortFilmProject; resolve: (value: boolean) => void; forceUpdate?: boolean }> = [];
let isSaving = false;

// 后台处理保存队列
async function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) return;
  isSaving = true;

  while (saveQueue.length > 0) {
    const item = saveQueue.shift();
    if (item) {
      const success = await saveProject(item.project, item.forceUpdate);
      item.resolve(success);
      
      // 更新缓存
      if (success && projectCache) {
        const index = projectCache.findIndex(p => p.id === item.project.id);
        if (index >= 0) {
          projectCache[index] = item.project;
        } else {
          projectCache.push(item.project);
        }
      }
    }
  }

  isSaving = false;
}

export function getProjectsSync(): ShortFilmProject[] {
  if (projectCache) {
    return [...projectCache].sort((a, b) => {
      const aTime = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt;
      const bTime = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt;
      return bTime - aTime;
    });
  }

  // 触发异步加载
  getProjects().then(projects => {
    projectCache = projects;
  });

  return [];
}

export function getProjectSync(id: string): ShortFilmProject | null {
  const projects = getProjectsSync();
  return projects.find(p => p.id === id) || null;
}

export function saveProjectSync(project: ShortFilmProject, forceUpdate = false): Promise<boolean> {
  const cleanedProject = cleanupProjectData(project);
  
  if (projectCache) {
    const index = projectCache.findIndex(p => p.id === cleanedProject.id);
    if (index >= 0) {
      projectCache[index] = cleanedProject;
    } else {
      projectCache.push(cleanedProject);
    }
  } else {
    projectCache = [cleanedProject];
  }

  return new Promise<boolean>((resolve) => {
    saveQueue.push({ project: cleanedProject, resolve, forceUpdate });
    processSaveQueue();
  });
}

export function deleteProjectSync(id: string): void {
  // 更新缓存
  if (projectCache) {
    projectCache = projectCache.filter(p => p.id !== id);
  }

  // 后台删除
  deleteProject(id);
}

// 刷新缓存
export async function refreshProjectCache(): Promise<void> {
  await getProjects(true);
}

// ========== 脚本模板 API ==========

export async function getScriptTemplates(forceRefresh = false): Promise<ScriptTemplate[]> {
  try {
    return await withCache(
      CacheKeys.templates(),
      async () => {
        const result = await apiRequest<{ data: ScriptTemplate[] }>('/api/shortfilm/templates');
        return result.data || [];
      },
      { ttl: CACHE_TTL.TEMPLATES, forceRefresh }
    );
  } catch (error) {
    console.error('Failed to get script templates:', error);
    return [];
  }
}

export async function addScriptTemplate(template: Omit<ScriptTemplate, 'id' | 'createdAt'>): Promise<ScriptTemplate | null> {
  try {
    const result = await apiRequest<{ data: ScriptTemplate }>('/api/shortfilm/templates', {
      method: 'POST',
      body: JSON.stringify({
        ...template,
        isSystem: false,
      }),
    });
    
    // 使模板缓存失效
    invalidateCache(CacheKeys.templates());
    
    return result.data;
  } catch (error) {
    console.error('Failed to add script template:', error);
    return null;
  }
}

export async function updateScriptTemplate(id: string, updates: Partial<ScriptTemplate>): Promise<boolean> {
  try {
    await apiRequest(`/api/shortfilm/templates`, {
      method: 'POST',
      body: JSON.stringify({ id, ...updates }),
    });
    
    // 使模板缓存失效
    invalidateCache(CacheKeys.templates());
    invalidateCache(CacheKeys.template(id));
    
    return true;
  } catch (error) {
    console.error('Failed to update script template:', error);
    return false;
  }
}

export async function deleteScriptTemplate(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/shortfilm/templates?id=${id}`, { method: 'DELETE' });
    
    // 使模板缓存失效
    invalidateCache(CacheKeys.templates());
    invalidateCache(CacheKeys.template(id));
    
    return true;
  } catch (error) {
    console.error('Failed to delete script template:', error);
    return false;
  }
}
