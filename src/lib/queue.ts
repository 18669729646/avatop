// 任务队列管理工具 - 前端状态管理版本
// 任务执行逻辑已移至服务器端 /api/tasks/process
import { 
  withCache, 
  CacheKeys,
} from './cache';
import { getAuthToken } from './api';

export type TaskType = 'image' | 'video' | 'script' | 'analysis' | 'analysis_batch_import';
export type TaskStatus = 'pending' | 'running' | 'retrying' | 'success' | 'failed' | 'started' | 'progress';

// 图片生成任务参数
export interface ImageTaskParams {
  prompt: string;
  consistencyPrompt?: string;
  aspectRatio: string;
  resolution: string;
  images: string[]; // base64 images or URLs
  model: string;
  apiKey?: string;
  baseUrl?: string;
  shortfilmTaskId?: string; // 短片图片任务ID，用于恢复任务状态
}

// 视频生成任务参数
export interface VideoTaskParams {
  prompt: string;
  aspectRatio?: string;
  images: string[]; // base64 images or URLs
  model: string;
  enhancePrompt: boolean;
  enableUpsample: boolean;
  apiKey?: string;
  baseUrl?: string;
  shortfilmTaskId?: string;
  generateAudio?: boolean;
  // Seedance 2.0 专用参数
  seedanceResolution?: string;     // 480p / 720p / 1080p
  seedanceDuration?: number;       // 4-15 秒
  seedanceWatermark?: boolean;     // 是否添加水印
  seedanceRealPersonMode?: boolean; // 真人模式
  seedanceImageTail?: string;      // 尾帧图片 URL
  seedanceImages?: string[];       // 多张参考图 URL（最多9张）
  seedanceVideo?: string;          // 参考视频 URL
  seedanceAudio?: string[];        // 参考音频 URL
}

// 脚本生成任务参数
export interface ScriptTaskParams {
  productImages?: string[];
  productDescription?: string;
  scriptPrompt: string;
  duration: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isFullPrompt?: boolean;
}

export interface AnalysisTaskParams {
  projectId: string;
  videoKey?: string;
  videoUrl?: string;
}

export interface AnalysisBatchImportTaskParams {
  batchId: string;
  sourceFileName: string;
  totalRows: number;
  imports: Array<{
    sourceUrl: string;
    metadata: Record<string, string>;
  }>;
}

// 任务结果
export interface ImageTaskResult {
  url: string;
  fileSize?: number; // 文件大小（字节）
}

export interface VideoTaskResult {
  taskId: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number; // 文件大小（字节）
}

export interface ScriptTaskResult {
  segments: Array<{
    order: number;
    duration: number;
    imagePrompt: string;
    videoPrompt: string;
    description: string;
  }>;
  rawResponse?: string;
}

export interface AnalysisTaskResult {
  projectId: string;
  scenesCount?: number;
}

export interface AnalysisBatchImportTaskResult {
  batchId: string;
  sourceFileName?: string;
  totalRows: number;
  createdRows: number;
  failedRows: number;
  failedItems?: Array<{
    sourceUrl: string;
    error: string;
  }>;
}

// 任务项
export interface QueueTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  params: ImageTaskParams | VideoTaskParams | ScriptTaskParams | AnalysisTaskParams | AnalysisBatchImportTaskParams;
  result?: ImageTaskResult | VideoTaskResult | ScriptTaskResult | AnalysisTaskResult | AnalysisBatchImportTaskResult;
  results?: (ImageTaskResult | VideoTaskResult | ScriptTaskResult | AnalysisTaskResult | AnalysisBatchImportTaskResult)[]; // 存储所有生成结果（包括重试产生的）
  error?: string; // 错误信息（包含重试状态）
  lastError?: string; // 最近一次 API 返回的原始错误信息
  projectId?: string; // 所属短片项目ID
  createdAt: string | number;
  startedAt?: string | number;
  completedAt?: string | number;
  retryCount: number;
  maxRetry: number;
  // 用户信息（管理员视图时显示）
  userId?: string;
  userPhone?: string;
  userNickname?: string;
}

// 队列配置
export interface QueueConfig {
  maxConcurrent: number; // 最大并发数
  autoStart: boolean; // 自动开始执行
  maxRetry: number; // 最大重试次数
  retryDelay?: number; // 重试延迟
  taskTimeout?: number; // 任务超时
}

// 队列统计
export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  retrying: number;
  success: number;
  failed: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  autoStart: true,
  maxRetry: 5,
  retryDelay: 5000,
  taskTimeout: 600000, // 10分钟
};

// 内部 API 请求辅助函数（带超时和重试）
async function authFetch(url: string, options?: RequestInit, retries = 2): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // 只有当 body 存在且不是 FormData 时才设置 Content-Type
  // FormData 需要浏览器自动设置 multipart/form-data 边界
  if (!headers.has('Content-Type') && options?.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  
  try {
    const response = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // 如果是超时或网络错误，且还有重试次数，则重试
    if (retries > 0 && (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch')))) {
      console.log(`[队列] 请求失败，正在重试... (${retries} 次剩余)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
      return authFetch(url, options, retries - 1);
    }
    
    throw error;
  }
}

// 获取队列配置（从服务器）
export async function getQueueConfig(): Promise<QueueConfig> {
  try {
    return await withCache(
      CacheKeys.queueConfig(),
      async () => {
        const response = await authFetch('/api/queue-config');
        const data = await response.json();
        return { ...DEFAULT_CONFIG, ...data };
      },
      { ttl: 60000 } // 缓存 1 分钟
    );
  } catch {
    return DEFAULT_CONFIG;
  }
}

// 生成任务 ID
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}_${random}`;
}

// 获取任务队列（从服务器）
// viewMode: 'all' = 管理员查看所有任务, 'mine' = 查看自己的任务
export async function getTaskQueue(viewMode: 'all' | 'mine' = 'mine'): Promise<{ tasks: QueueTask[]; isAdmin: boolean }> {
  try {
    const params = new URLSearchParams();
    if (viewMode === 'all') {
      params.set('viewAll', 'true');
    }
    
    const response = await authFetch(`/api/tasks?${params.toString()}`);
    const data = await response.json();
    
    // 401 未授权是预期行为（用户登出时），不记录为错误
    if (response.status === 401) {
      return { tasks: [], isAdmin: false };
    }
    
    if (!response.ok) {
      console.error('[队列] 获取任务列表失败:', data.error);
      return { tasks: [], isAdmin: false };
    }
    
    const tasks = (data.data || []).map((task: Record<string, unknown>) => ({
      id: task.id as string,
      type: task.type as TaskType,
      status: task.status as TaskStatus,
      params: task.params as ImageTaskParams | VideoTaskParams | ScriptTaskParams | AnalysisTaskParams | AnalysisBatchImportTaskParams,
      result: task.result as ImageTaskResult | VideoTaskResult | ScriptTaskResult | AnalysisTaskResult | AnalysisBatchImportTaskResult | undefined,
      results: task.results as (ImageTaskResult | VideoTaskResult | ScriptTaskResult | AnalysisTaskResult | AnalysisBatchImportTaskResult)[] | undefined,
      error: task.error as string | undefined,
      lastError: task.last_error as string | undefined, // API 返回的原始错误
      projectId: task.project_id as string | undefined, // 短片项目ID
      createdAt: task.created_at as string,
      startedAt: task.started_at as string | undefined,
      completedAt: task.completed_at as string | undefined,
      retryCount: (task.retry_count as number) || 0,
      maxRetry: (task.max_retry as number) ?? 5,
      // 用户信息（管理员视图时显示）
      userId: task.user_id as string | undefined,
      userPhone: task.user_phone as string | undefined,
      userNickname: task.user_nickname as string | undefined,
    }));
    
    return { tasks, isAdmin: data.isAdmin || false };
  } catch (error) {
    console.error('[队列] 获取任务列表异常:', error);
    return { tasks: [], isAdmin: false };
  }
}

// 同步版本（用于兼容旧代码，实际返回空数组）
export function getTaskQueueSync(): QueueTask[] {
  return [];
}

// 获取队列统计
// viewMode: 'all' = 管理员查看所有任务统计, 'mine' = 查看自己的任务统计
export async function getQueueStats(viewMode: 'all' | 'mine' = 'mine'): Promise<{ stats: QueueStats; isAdmin: boolean }> {
  try {
    const params = new URLSearchParams();
    if (viewMode === 'all') {
      params.set('viewAll', 'true');
    }
    
    const response = await authFetch(`/api/tasks/batch?${params.toString()}`);
    const data = await response.json();
    
    if (!response.ok) {
      return { stats: { total: 0, pending: 0, running: 0, retrying: 0, success: 0, failed: 0 }, isAdmin: false };
    }
    
    return { 
      stats: data.data || { total: 0, pending: 0, running: 0, retrying: 0, success: 0, failed: 0 },
      isAdmin: data.isAdmin || false,
    };
  } catch {
    return { stats: { total: 0, pending: 0, running: 0, retrying: 0, success: 0, failed: 0 }, isAdmin: false };
  }
}

// 添加任务到队列
export async function addTaskToQueue(
  type: TaskType,
  params: ImageTaskParams | VideoTaskParams | ScriptTaskParams | AnalysisTaskParams | AnalysisBatchImportTaskParams,
  projectId?: string // 所属短片项目ID
): Promise<{ task: QueueTask | null; error?: string }> {
  const config = await getQueueConfig();
  
  const taskId = generateTaskId();
  
  try {
    const response = await authFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: taskId,
        type,
        params,
        projectId,
        maxRetry: config.maxRetry,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { task: null, error: data.error || '创建任务失败' };
    }
    
    const task: QueueTask = {
      id: data.data.id,
      type: data.data.type,
      status: data.data.status,
      params: data.data.params,
      projectId: data.data.project_id,
      createdAt: data.data.created_at,
      retryCount: data.data.retry_count || 0,
      maxRetry: data.data.max_retry ?? 5,
    };
    
    // 触发服务器端任务执行
    if (config.autoStart) {
      setTimeout(() => triggerTaskProcessing(), 100);
    }
    
    return { task };
  } catch (error) {
    console.error('[队列] 创建任务异常:', error);
    return { task: null, error: '创建任务失败，请检查网络连接' };
  }
}

// 更新任务状态
export async function updateTaskStatus(
  taskId: string,
  updates: Partial<QueueTask>
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.result !== undefined) updateData.result = updates.result;
    if (updates.results !== undefined) updateData.results = updates.results;
    if (updates.error !== undefined) updateData.error = updates.error;
    if (updates.startedAt !== undefined) updateData.startedAt = updates.startedAt;
    if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;
    
    // 如果是成功状态且有结果，将结果添加到 results 数组中
    if (updates.status === 'success' && updates.result) {
      const taskResponse = await authFetch(`/api/tasks/${taskId}`);
      const taskData = await taskResponse.json();
      
      if (taskData.data) {
        const existingResults = taskData.data.results || [];
        
        const newUrl = (updates.result as ImageTaskResult).url || (updates.result as VideoTaskResult).videoUrl;
        const isDuplicate = existingResults.some((r: unknown) => {
          const result = r as ImageTaskResult | VideoTaskResult;
          const existingUrl = (result as ImageTaskResult).url || (result as VideoTaskResult).videoUrl;
          return existingUrl === newUrl;
        });
        
        if (!isDuplicate) {
          updateData.results = [...existingResults, updates.result];
        }
      }
    }
    
    await authFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
  } catch (error) {
    console.error('[队列] 更新任务状态失败:', error);
  }
}

// 删除任务
export async function removeTaskFromQueue(taskId: string): Promise<void> {
  try {
    await authFetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('[队列] 删除任务失败:', error);
  }
}

// 批量删除任务
export async function removeTasksFromQueue(taskIds: string[]): Promise<void> {
  try {
    await authFetch('/api/tasks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteMany', taskIds }),
    });
  } catch (error) {
    console.error('[队列] 批量删除任务失败:', error);
  }
}

// 清空已完成任务
export async function clearCompletedTasks(): Promise<void> {
  try {
    await authFetch('/api/tasks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearCompleted' }),
    });
  } catch (error) {
    console.error('[队列] 清空已完成任务失败:', error);
  }
}

// 重试失败的任务
export async function retryTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'pending',
        error: null,
        completedAt: null,
        startedAt: null,
        retryCount: { increment: true }
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || '重试失败' };
    }
    
    // 触发服务器端任务执行（不等待）
    triggerTaskProcessing();
    
    return { success: true };
  } catch (error) {
    console.error('[队列] 重试任务失败:', error);
    return { success: false, error: '重试任务失败，请检查网络连接' };
  }
}

// 批量重试失败任务
export async function retryFailedTasks(): Promise<void> {
  try {
    await authFetch('/api/tasks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retryFailed' }),
    });
    
    // 触发服务器端任务执行
    triggerTaskProcessing();
  } catch (error) {
    console.error('[队列] 批量重试失败任务失败:', error);
  }
}

// 别名：批量重试所有失败任务
export const retryAllFailedTasks = retryFailedTasks;

// 清空失败任务
export async function clearFailedTasks(): Promise<void> {
  try {
    await authFetch('/api/tasks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearFailed' }),
    });
  } catch (error) {
    console.error('[队列] 清空失败任务失败:', error);
  }
}

// 清空整个任务队列
export async function clearTaskQueue(): Promise<void> {
  try {
    await authFetch('/api/tasks/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearAll' }),
    });
  } catch (error) {
    console.error('[队列] 清空任务队列失败:', error);
  }
}

// 获取任务执行时长（秒）
export function getTaskDuration(task: QueueTask): number | null {
  if (!task.startedAt) return null;
  
  const startTime = typeof task.startedAt === 'string' 
    ? new Date(task.startedAt).getTime() 
    : task.startedAt;
  
  const endTime = task.completedAt 
    ? (typeof task.completedAt === 'string' ? new Date(task.completedAt).getTime() : task.completedAt)
    : Date.now();
  
  return Math.floor((endTime - startTime) / 1000);
}

// 格式化时长
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}秒`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分` : `${hours}小时`;
}

// 获取单个任务
export async function getTask(taskId: string): Promise<QueueTask | null> {
  try {
    const response = await authFetch(`/api/tasks/${taskId}`);
    const data = await response.json();
    
    if (!response.ok || !data.data) {
      return null;
    }
    
    const task = data.data;
    return {
      id: task.id,
      type: task.type,
      status: task.status,
      params: task.params,
      result: task.result,
      results: task.results,
      error: task.error,
      createdAt: task.created_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      retryCount: task.retry_count || 0,
      maxRetry: task.max_retry ?? 5,
    };
  } catch (error) {
    console.error('[队列] 获取任务失败:', error);
    return null;
  }
}

/**
 * 触发服务器端任务处理
 * 调用 /api/tasks/process 接口执行 pending 任务
 */
export async function triggerTaskProcessing(options?: { taskId?: string; maxTasks?: number }): Promise<{
  processed: number;
  taskIds?: string[];
  message?: string;
  error?: string;
}> {
  try {
    const response = await authFetch('/api/tasks/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: options?.taskId,
        maxTasks: options?.maxTasks || 3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { processed: 0, error: data.error || '触发任务处理失败' };
    }

    return {
      processed: data.processed || 0,
      taskIds: data.taskIds,
      message: data.message,
    };
  } catch (error) {
    console.error('[队列] 触发任务处理异常:', error);
    return { processed: 0, error: '触发任务处理异常' };
  }
}

/**
 * 获取队列处理状态
 */
export async function getQueueProcessingStatus(): Promise<{
  pending: number;
  running: number;
  processing: number;
  message: string;
}> {
  try {
    const response = await authFetch('/api/tasks/process');
    return await response.json();
  } catch {
    return { pending: 0, running: 0, processing: 0, message: '获取状态失败' };
  }
}

/**
 * 处理队列（前端触发服务端执行）
 * 只触发一次处理，不自动轮询
 * 轮询应该由调用方通过 useEffect + setInterval 控制
 */
export async function processQueue(): Promise<{ triggered: boolean; pending: number; running: number }> {
  if (typeof window === 'undefined') return { triggered: false, pending: 0, running: 0 };
  
  try {
    // 获取当前队列状态
    const status = await getQueueProcessingStatus();
    
    // 如果有待处理任务且没有正在处理的，触发服务端执行
    if (status.pending > 0 && status.processing === 0) {
      const result = await triggerTaskProcessing();
      console.log(`[队列] 触发结果:`, result.message || result.error);
      return { triggered: true, pending: status.pending, running: status.running };
    }
    
    return { triggered: false, pending: status.pending, running: status.running };
  } catch (error) {
    console.error('[队列] 处理异常:', error);
    return { triggered: false, pending: 0, running: 0 };
  }
}

// 启动队列处理（供外部调用）
let isQueueRunning = false;

export function startQueueProcessing(): void {
  if (typeof window === 'undefined') return;
  if (isQueueRunning) return;
  
  isQueueRunning = true;
  console.log('[队列] 启动队列处理');
  processQueue();
}

export function stopQueueProcessing(): void {
  isQueueRunning = false;
  console.log('[队列] 停止队列处理');
}
