import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { broadcastTaskUpdate } from '@/lib/task-events';
import { longRunningAgent } from '@/lib/fetch-agent';
import { consumeCredits, consumeFixedCredits } from '@/lib/credits';
import { authenticateRequest, unauthorizedResponse, INTERNAL_AUTH_HEADER, INTERNAL_AUTH_USER_ID } from '@/lib/auth-middleware';
import { isAdmin } from '@/lib/task-security';
import { getServerDefaultTextApi, getServerDefaultImageApi, getServerDefaultVideoApi, getServerImageApiByBaseUrlOrModel, getServerVideoApiByBaseUrlOrModel, getServerTextApiByModel } from '@/lib/server-config';
import { s3Storage } from '@/lib/s3-client';
import { logTaskError, logInfo, logError } from '@/lib/logger';
import {
  ANALYSIS_MASTER_ACTION_TYPE,
  analyzeVideoBufferWithGemini,
} from '@/lib/analysis-master';
import { executeAnalysisBatchImportTask } from '@/lib/analysis-master-batch-processor';
import {
  ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE,
  generateScriptRemake,
  normalizeScriptRemakeResult,
  type ScriptRemakeTaskParams,
} from '@/lib/analysis-master-script-remake';

// 任务执行状态（内存中跟踪正在处理的任务）
const processingTasks = new Set<string>();
const ANALYSIS_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// 心跳间隔（30秒）
const HEARTBEAT_INTERVAL = 30 * 1000;

// 心跳定时器
const heartbeatTimers = new Map<string, NodeJS.Timeout>();

/**
 * 更新任务心跳（带重试机制）
 */
async function updateHeartbeat(taskId: string, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase
        .from('task_queue')
        .update({ heartbeat_at: new Date().toISOString() })
        .eq('id', taskId)
        .in('status', ['running', 'retrying']); // 允许 running 和 retrying 状态更新心跳
      
      if (!error) {
        return; // 成功则返回
      }
      
      console.error(`[任务 ${taskId}] 心跳更新失败 (尝试 ${attempt}/${maxRetries}):`, error);
      
      // 达到最大重试次数，记录错误日志
      if (attempt === maxRetries) {
        logTaskError(taskId, '心跳更新', error, { attempt });
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒后重试
      }
    } catch (error) {
      console.error(`[任务 ${taskId}] 心跳更新异常 (尝试 ${attempt}/${maxRetries}):`, error);
      
      // 达到最大重试次数，记录错误日志
      if (attempt === maxRetries) {
        logTaskError(taskId, '心跳更新异常', error, { attempt });
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

/**
 * 启动心跳（使用 ref 保持定时器活跃）
 */
function startHeartbeat(taskId: string, supabase: ReturnType<typeof getSupabaseClient>): void {
  // 立即更新一次
  updateHeartbeat(taskId, supabase);
  
  // 定期更新
  const timer = setInterval(() => {
    updateHeartbeat(taskId, supabase);
  }, HEARTBEAT_INTERVAL);
  
  // 确保定时器不会阻止进程退出，但保持活跃
  timer.ref();
  
  heartbeatTimers.set(taskId, timer);
  console.log(`[任务 ${taskId}] 心跳定时器已启动，间隔 ${HEARTBEAT_INTERVAL / 1000} 秒`);
}

/**
 * 停止心跳
 */
function stopHeartbeat(taskId: string): void {
  const timer = heartbeatTimers.get(taskId);
  if (timer) {
    clearInterval(timer);
    heartbeatTimers.delete(taskId);
  }
}

/**
 * 带重试的任务状态更新（乐观锁）
 * 解决并发情况下多个进程同时处理同一任务的问题
 */
async function updateTaskStatusWithRetry(
  supabase: ReturnType<typeof getSupabaseClient>,
  taskId: string,
  updates: Record<string, unknown>,
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 先获取当前任务状态
    const { data: task, error: fetchError } = await supabase
      .from('task_queue')
      .select('status')
      .eq('id', taskId)
      .single();
    
    if (fetchError || !task) {
      return { success: false, error: '任务不存在' };
    }
    
    // 检查状态是否符合预期（乐观锁）
    // 允许 pending 和 retrying 状态更新为 running（重试场景）
    if (updates.status === 'running' && task.status !== 'pending' && task.status !== 'retrying') {
      return { success: false, error: `任务状态已变更: ${task.status}` };
    }
    
    // 尝试更新
    const { error: updateError } = await supabase
      .from('task_queue')
      .update(updates)
      .eq('id', taskId)
      .eq('status', task.status); // 乐观锁
    
    if (!updateError) {
      return { success: true };
    }
    
    // 如果是并发冲突，等待后重试
    if (attempt < maxRetries) {
      console.log(`[任务 ${taskId}] 状态更新冲突，第 ${attempt} 次重试...`);
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    } else {
      return { success: false, error: '状态更新失败（并发冲突）' };
    }
  }
  
  return { success: false, error: '状态更新失败' };
}

// 图片生成任务参数
interface ImageTaskParams {
  prompt: string;
  consistencyPrompt?: string;
  aspectRatio: string;
  resolution: string;
  images: string[];
  model: string;
  apiKey?: string;
  baseUrl?: string;
  shortfilmTaskId?: string;
  projectType?: 'video_remake' | 'video_remake_keyframe';
  sceneId?: string;
  sceneIds?: string[];
  sceneIndex?: number;
  projectId?: string;
  [key: string]: unknown;
}

// 视频生成任务参数
interface VideoTaskParams {
  prompt: string;
  aspectRatio?: string;
  images: string[];
  model: string;
  enhancePrompt: boolean;
  enableUpsample: boolean;
  apiKey?: string;
  baseUrl?: string;
  shortfilmTaskId?: string;
  projectType?: 'video_remake' | 'video_remake_keyframe';
  sceneId?: string;
  sceneIds?: string[];
  sceneIndex?: number;
  projectId?: string;
  imageUrl?: string;
  endFrameUrl?: string;
  duration?: number;
  generateAudio?: boolean;
  // --- Seedance 2.0 专用参数 ---
  resolution?: '480p' | '720p' | '1080p'; // 视频分辨率
  imageTail?: string;                        // 尾帧图片 URL
  video?: string;                           // 参考视频 URL
  audio?: string[];                          // 参考音频 URL 列表
  realPersonMode?: boolean;                  // 真人模式
  extraBody?: Record<string, unknown>;        // 其他额外参数
  [key: string]: unknown;
}

// 脚本生成任务参数
interface ScriptTaskParams {
  productImages?: string[];
  productDescription?: string;
  scriptPrompt: string;
  duration: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isFullPrompt?: boolean;
}

interface AnalysisTaskParams {
  projectId: string;
  videoKey?: string;
  videoUrl?: string;
  actionType?: string;
  creditsRequired?: number;
}

interface AnalysisBatchImportTaskParams {
  batchId: string;
  sourceFileName: string;
  totalRows: number;
  imports: Array<{
    sourceUrl: string;
    metadata: Record<string, string>;
  }>;
}

// 任务项（数据库格式）
interface QueueTask {
  id: string;
  type: 'image' | 'video' | 'script' | 'analysis' | 'analysis_batch_import' | 'script_remake';
  status: 'pending' | 'running' | 'retrying' | 'success' | 'failed';
  params: ImageTaskParams | VideoTaskParams | ScriptTaskParams | AnalysisTaskParams | AnalysisBatchImportTaskParams | ScriptRemakeTaskParams;
  result?: { 
    url?: string; 
    taskId?: string; 
    videoUrl?: string; 
    thumbnailUrl?: string; 
    fileSize?: number; 
    segments?: unknown[]; 
    rawResponse?: string;
    status?: string;
    sceneId?: string;
    scenesCount?: number;
  };
  results?: Array<{ url?: string; taskId?: string; videoUrl?: string; thumbnailUrl?: string; fileSize?: number }>;
  project_id?: string; // 所属短片项目ID
  user_id?: string; // 所属用户ID
  created_at: string;
  started_at?: string;
  retry_count?: number; // 当前重试次数
  max_retry?: number; // 最大重试次数
  error?: string; // 错误信息
}

/**
 * 处理队列中的待执行任务
 * 从数据库获取 pending 任务并执行
 */
export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('authorization')) {
      return unauthorizedResponse('未登录', 401);
    }
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    const canProcessAllTasks = isAdmin(auth.payload.role);
    const body = await request.json().catch(() => ({}));
    const { taskId, maxTasks = 3 } = body;

    const supabase = getSupabaseClient();
    
    // 检查并处理卡住的 running 任务（超过 10 分钟没有心跳更新）
    const heartbeatThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckTasks } = await supabase
      .from('task_queue')
      .update({
        status: 'failed',
        error: '任务执行超时（心跳丢失）',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .eq(canProcessAllTasks ? 'status' : 'user_id', canProcessAllTasks ? 'running' : auth.userId)
      .or(`heartbeat_at.is.null,heartbeat_at.lt.${heartbeatThreshold}`)
      .select('id');
    
    if (stuckTasks && stuckTasks.length > 0) {
      console.log(`[任务处理] 发现 ${stuckTasks.length} 个心跳丢失的任务，已标记为失败:`, stuckTasks.map(t => t.id).join(', '));
    }

    let tasks: QueueTask[] = [];

    if (taskId) {
      // 处理指定任务
      const { data, error } = await supabase
        .from('task_queue')
        .select('*')
        .eq('id', taskId)
        .eq(canProcessAllTasks ? 'id' : 'user_id', canProcessAllTasks ? taskId : auth.userId)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: '任务不存在或已完成' }, { status: 404 });
      }
      tasks = [data as QueueTask];
    } else {
      // 获取待处理任务（排除已在处理的）
      const { data, error } = await supabase
        .from('task_queue')
        .select('*')
        .eq('status', 'pending')
        .eq(canProcessAllTasks ? 'status' : 'user_id', canProcessAllTasks ? 'pending' : auth.userId)
        .order('created_at', { ascending: true })
        .limit(maxTasks);

      if (error) {
        console.error('[任务处理] 获取任务失败:', error);
        return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
      }
      tasks = (data || []) as QueueTask[];
    }

    // 过滤掉已在处理的任务
    tasks = tasks.filter(t => !processingTasks.has(t.id));

    if (tasks.length === 0) {
      return NextResponse.json({ message: '没有待处理的任务', processed: 0 });
    }

    console.log(`[任务处理] 开始处理 ${tasks.length} 个任务`);

    // 异步执行任务（不等待完成）
    const processPromises = tasks.map(task => processTask(task));
    
    // 立即返回，任务在后台执行
    Promise.allSettled(processPromises).catch(err => {
      console.error('[任务处理] 后台任务执行异常:', err);
    });

    return NextResponse.json({ 
      message: `已启动 ${tasks.length} 个任务`, 
      processed: tasks.length,
      taskIds: tasks.map(t => t.id)
    });

  } catch (error) {
    console.error('[任务处理] 处理失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 处理单个任务
 */
async function processTask(task: QueueTask): Promise<void> {
  processingTasks.add(task.id);
  const supabase = getSupabaseClient();

  try {
    // 更新任务状态为 running（带重试机制）
    const now = new Date().toISOString();
    const { success, error } = await updateTaskStatusWithRetry(
      supabase,
      task.id,
      { 
        status: 'running', 
        started_at: now,
        heartbeat_at: now  // 初始心跳
      }
    );

    if (!success) {
      if (error?.includes('任务状态已变更')) {
        console.log(`[任务 ${task.id}] 已被其他进程处理，跳过`);
        processingTasks.delete(task.id);
        return;
      }
      console.error(`[任务 ${task.id}] 状态更新失败:`, error);
      throw new Error(error || '状态更新失败');
    }

    // 启动心跳
    startHeartbeat(task.id, supabase);

    // 广播任务开始执行
    broadcastTaskUpdate({
      taskId: task.id,
      type: task.type,
      status: 'running',
      projectId: task.project_id || undefined,
      startedAt: Date.now(),
    });

    console.log(`[任务 ${task.id}] 开始执行，类型: ${task.type}, project_id: ${task.project_id || '无'}`);

    if (task.type === 'image') {
      await executeImageTask(task, supabase);
    } else if (task.type === 'video') {
      await executeVideoTask(task, supabase);
    } else if (task.type === 'script') {
      await executeScriptTask(task, supabase);
    } else if (task.type === 'analysis') {
      await executeAnalysisTask(task, supabase);
    } else if (task.type === 'analysis_batch_import') {
      await executeAnalysisBatchImportTask(task, supabase);
    } else if (task.type === 'script_remake') {
      await executeScriptRemakeTask(task, supabase);
    }

  } catch (error) {
    console.error(`[任务 ${task.id}] 执行失败:`, error);
    
    // 记录任务执行失败
    logTaskError(task.id, '执行任务', error, {
      userId: task.user_id,
      type: task.type,
      projectId: task.project_id,
      retryCount: task.retry_count,
      maxRetry: task.max_retry,
    }, task.user_id);
    
    const errorMessage = error instanceof Error ? error.message : '执行失败';
    
    // 首先检查数据库中的最新任务状态，避免对已成功的任务进行重试
    const { data: latestTask } = await supabase
      .from('task_queue')
      .select('status, results, result')
      .eq('id', task.id)
      .single();
    
    if (latestTask?.status === 'success') {
      console.log(`[任务 ${task.id}] 数据库中已是成功状态，跳过重试`);
      processingTasks.delete(task.id);
      stopHeartbeat(task.id);
      return;
    }
    
    // 检查任务是否已经有成功的结果（可能是后续非关键操作失败）
    // 优先使用数据库中的最新结果，因为 task 参数可能是旧值
    const resultsToCheck = (latestTask?.results as Array<{ url?: string; videoUrl?: string; thumbnailUrl?: string; fileSize?: number; segments?: Array<{ order: number; duration: number; imagePrompt: string; videoPrompt: string; description: string }> }>) || task.results;
    if (resultsToCheck && resultsToCheck.length > 0) {
      const lastResult = resultsToCheck[resultsToCheck.length - 1];
      // 检查不同类型任务的有效结果：
      // - 图片任务: url
      // - 视频任务: videoUrl
      // - 脚本任务: segments
      const hasValidResult = lastResult?.url || lastResult?.videoUrl || (lastResult?.segments && Array.isArray(lastResult.segments) && lastResult.segments.length > 0);
      
      if (hasValidResult) {
        console.log(`[任务 ${task.id}] 已有成功结果，跳过重试，恢复为成功状态`);
        const now = new Date().toISOString();
        await supabase
          .from('task_queue')
          .update({
            status: 'success',
            result: lastResult,
            error: null,
            last_error: errorMessage, // 记录后续操作失败的错误
            completed_at: now
          })
          .eq('id', task.id);
        
        // 广播任务成功
        broadcastTaskUpdate({
          taskId: task.id,
          type: task.type,
          status: 'success',
          projectId: task.project_id || undefined,
          result: lastResult,
        });
        
        processingTasks.delete(task.id);
        stopHeartbeat(task.id);
        return;
      }
    }
    
    // 检查是否可以自动重试
    const currentRetryCount = task.retry_count || 0;
    const maxRetry = task.max_retry ?? 5;
    
    if (currentRetryCount < maxRetry) {
      // 自动重试
      const newRetryCount = currentRetryCount + 1;
      console.log(`[任务 ${task.id}] 自动重试 (${newRetryCount}/${maxRetry})`);
      
      // 更新任务状态为 retrying
      // last_error 存储 API 返回的原始错误，error 存储用户友好的状态信息
      const now = new Date().toISOString();
      await supabase
        .from('task_queue')
        .update({
          status: 'retrying',
          retry_count: newRetryCount,
          error: `第${newRetryCount}次重试中`,
          last_error: errorMessage, // 存储 API 原始错误
          heartbeat_at: now,
        })
        .eq('id', task.id);
      
      // 广播任务重试状态
      broadcastTaskUpdate({
        taskId: task.id,
        type: task.type,
        status: 'retrying',
        projectId: task.project_id || undefined,
        error: errorMessage,
      });
      
      // 立即重新加入处理队列
      // 使用 setImmediate 确保当前处理完全结束
      setImmediate(() => {
        processTask({
          ...task,
          retry_count: newRetryCount,
        });
      });
    } else {
      // 达到最大重试次数，最终标记为失败
      console.log(`[任务 ${task.id}] 已达到最大重试次数 (${maxRetry})，最终失败`);
      if (task.type === 'analysis' && task.project_id && task.user_id) {
        await supabase
          .from('analysis_master_projects')
          .update({
            status: 'failed',
            error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.project_id)
          .eq('user_id', task.user_id);
      }

      // script_remake 任务失败时同步更新 script_remakes 记录状态
      if (task.type === 'script_remake' && task.user_id) {
        const scriptRemakeId = (task.params as Record<string, unknown>)?.scriptRemakeId as string | undefined;
        if (scriptRemakeId) {
          await supabase
            .from('analysis_master_script_remakes')
            .update({
              status: 'failed',
              error: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', scriptRemakeId)
            .eq('user_id', task.user_id);
        }
      }
      
      // 更新任务状态为失败
      // last_error 存储 API 返回的原始错误，error 存储重试信息
      const now = new Date().toISOString();
      await supabase
        .from('task_queue')
        .update({
          status: 'failed',
          error: `已重试${maxRetry}次`,
          last_error: errorMessage, // 存储 API 原始错误
          completed_at: now
        })
        .eq('id', task.id);
      
      // 广播任务失败
      broadcastTaskUpdate({
        taskId: task.id,
        type: task.type,
        status: 'failed',
        projectId: task.project_id || undefined,
        error: errorMessage,
      });
    }
  } finally {
    // 停止心跳
    stopHeartbeat(task.id);
    processingTasks.delete(task.id);
  }
}

/**
 * 执行图片生成任务
 */
async function executeImageTask(task: QueueTask, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const params = task.params as ImageTaskParams;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';

  console.log(`[任务 ${task.id}] 开始执行图片生成任务`);
  console.log(`[任务 ${task.id}] 原始参数:`, {
    baseUrl: params.baseUrl,
    model: params.model,
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
    hasImages: !!params.images && params.images.length > 0,
    imagesCount: params.images?.length || 0,
    promptLength: params.prompt?.length || 0,
  });

  // 从数据库获取 API 配置（优先匹配 baseUrl/model，其次使用默认配置）
  const imageApi = await getServerImageApiByBaseUrlOrModel(params.baseUrl, params.model);
  const apiKey = imageApi?.apiKey || '';
  const apiBaseUrl = imageApi?.baseUrl || params.baseUrl;
  // 用户明确选择的模型优先于 DB 配置的默认模型（DB 配置的 baseUrl/apiKey 仍用于路由）
  const model = params.model || imageApi?.model || '';

  // 记录 API 配置信息（脱敏 apiKey）
  console.log(`[任务 ${task.id}] API 配置获取完成:`, {
    hasImageApi: !!imageApi,
    apiKey: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : '空',
    apiBaseUrl,
    model,
    userSelectedModel: params.model, // 用户选择的模型（优先）
    dbConfigModel: imageApi?.model,  // DB配置的模型（备选）
    imageApiId: imageApi?.id || 'null',
  });

  try {
    // 调用图片生成 API（服务器端直接调用，使用长超时 Agent）
    // 使用内部认证 header 传递用户信息
    const generateUrl = `${baseUrl}/api/generate`;
    console.log(`[任务 ${task.id}] 准备调用 generate API: ${generateUrl}`);

    let response;
    try {
      response = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [INTERNAL_AUTH_HEADER]: 'true',
          [INTERNAL_AUTH_USER_ID]: task.user_id || '',
        },
        body: JSON.stringify({
          apiKey,
          baseUrl: apiBaseUrl,
          model,
          prompt: params.prompt,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          images: params.images,
        }),
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      console.log(`[任务 ${task.id}] generate API 响应状态: ${response.status} ${response.statusText}`);
    } catch (fetchError) {
      console.error(`[任务 ${task.id}] Fetch 请求失败:`, fetchError);
      throw new Error(`API 请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`);
    }

    let data;
    try {
      data = await response.json();
      console.log(`[任务 ${task.id}] generate API 响应数据:`, {
        hasError: !!data.error,
        errorMessage: data.error,
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
      });
    } catch (parseError) {
      console.error(`[任务 ${task.id}] 解析 JSON 响应失败:`, parseError);
      throw new Error(`解析响应失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
    }

    if (!response.ok || data.error) {
      const errorMsg = data.error || `请求失败: ${response.status}`;
      console.error(`[任务 ${task.id}] generate API 返回错误:`, {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        fullResponse: JSON.stringify(data).substring(0, 500),
      });
      throw new Error(errorMsg);
    }

    if (!data.data?.[0]) {
      console.error(`[任务 ${task.id}] generate API 未返回有效的图片数据:`, data);
      throw new Error('未返回生成的图片');
    }

    let imageUrl: string;
    let fileSize = 0;

    if (data.data[0].url) {
      if (data.data[0].saved) {
        // 已经在 generate API 中保存
        imageUrl = data.data[0].url;
        fileSize = data.data[0].fileSize || 0;
        console.log(`[任务 ${task.id}] 图片已在服务器端保存`);
      } else {
        // 需要下载并保存
        imageUrl = await downloadAndSaveImage(data.data[0].url, task.id);
        fileSize = data.data[0].fileSize || 0;
      }
    } else if (data.data[0].b64_json) {
      // base64 格式，上传到对象存储
      imageUrl = await uploadBase64Image(data.data[0].b64_json, task.id, data.data[0].mimeType);
      fileSize = Buffer.byteLength(data.data[0].b64_json, 'base64');
    } else {
      throw new Error('未返回生成的图片（无 URL 或 base64 数据）');
    }

    // 更新任务状态
    const now = new Date().toISOString();
    const result = { url: imageUrl, fileSize };
    
    // 获取现有结果数组，将新结果添加到 results 中（保留历史结果）
    const existingResults = (task.results as Array<{ url: string; fileSize?: number }>) || [];
    const isDuplicate = existingResults.some(r => r.url === imageUrl);
    const updatedResults = isDuplicate ? existingResults : [...existingResults, result];
    
    await supabase
      .from('task_queue')
      .update({
        status: 'success',
        result,
        results: updatedResults,
        completed_at: now
      })
      .eq('id', task.id);

    // 广播任务成功
    broadcastTaskUpdate({
      taskId: task.id,
      type: 'image',
      status: 'success',
      projectId: task.project_id || undefined,
      result,
    });

    // 扣除积分（图片生成成功）
    if (task.user_id) {
      const creditResult = await consumeCredits(task.user_id, 'image_generate', task.id, 'image');
      if (!creditResult.success) {
        console.error(`[任务 ${task.id}] 扣除积分失败:`, creditResult.error);
      } else if (creditResult.skipped) {
        console.log(`[任务 ${task.id}] 积分已扣除过，跳过重复扣除`);
      } else {
        console.log(`[任务 ${task.id}] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
      }
    }

    // 保存到图片历史记录
    await supabase.from('image_history').upsert({
      id: task.id,
      user_id: task.user_id,
      url: imageUrl,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      resolution: params.resolution,
      file_size: fileSize,
      created_at: now
    });

    // 视频复刻场景：更新分镜状态
    if (params.projectType === 'video_remake' && (params.segmentId || params.sceneId) && imageUrl) {
      await handleVideoRemakeImageComplete(supabase, params, imageUrl, task.user_id);
    }

    if (params.projectType === 'video_remake_keyframe' && (params.segmentIds || params.sceneIds) && imageUrl) {
      await handleVideoRemakeKeyframeComplete(supabase, params, imageUrl, task.user_id);
    }

    console.log(`[任务 ${task.id}] 图片生成完成: ${imageUrl.substring(0, 60)}...`);

  } catch (error) {
    console.error(`[任务 ${task.id}] 图片生成失败:`, {
      error,
      errorMessage: error instanceof Error ? error.message : '未知错误',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorCause: error instanceof Error ? error.cause : undefined,
      taskParams: {
        userId: task.user_id,
        prompt: params.prompt?.substring(0, 100),
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
      },
      apiConfig: {
        hasApiKey: !!apiKey,
        hasApiBaseUrl: !!apiBaseUrl,
        hasModel: !!model,
      },
    });

    // 记录图片生成失败
    logTaskError(task.id, '图片生成', error, {
      userId: task.user_id,
      params: {
        prompt: params.prompt?.substring(0, 100),
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
      },
    }, task.user_id);

    throw error;
  }
}

/**
 * 执行视频生成任务
 */
async function executeVideoTask(task: QueueTask, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const params = task.params as VideoTaskParams;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';

  // 从数据库获取 API 配置（优先匹配 baseUrl/model，其次使用默认配置）
  const videoApi = await getServerVideoApiByBaseUrlOrModel(params.baseUrl, params.model);
  const apiKey = videoApi?.apiKey || '';
  const apiBaseUrl = videoApi?.baseUrl || params.baseUrl || '';
  // 用户明确选择的模型优先于 DB 配置的默认模型（DB 配置的 baseUrl/apiKey 仍用于路由）
  const model = params.model || videoApi?.model || '';

  // 判断是否使用 OpenAI 格式：模型值带下划线（Veo等）或 Seedance 系列都使用 OpenAI 格式
  const isSeedanceModel = model.startsWith('doubao-seedance') || model.startsWith('seedance');
  const isOpenAIFormat = model.includes('_') || isSeedanceModel;
  
  console.log(`[任务 ${task.id}] 视频生成，模型: ${model}, OpenAI格式: ${isOpenAIFormat}`);

  try {
    // 处理参考图片：上传 base64 图片到对象存储
    const processedImages: string[] = [];
    if (params.images?.length > 0) {
      for (const img of params.images) {
        if (!img) continue;
        if (img.startsWith('data:')) {
          const url = await uploadBase64DataUrl(img, `video-ref/${task.id}`);
          if (url) processedImages.push(url);
        } else {
          processedImages.push(img);
        }
      }
    }

    // V3: 视频复刻首帧图片（从 imageUrl 字段）
    if (params.projectType === 'video_remake' && params.imageUrl && !processedImages.includes(params.imageUrl)) {
      processedImages.push(params.imageUrl);
    }

    // V3: 视频复刻尾帧图片
    const endFrameUrl = (params as Record<string, unknown>).endFrameUrl as string | undefined;

    // Seedance 2.0 专用参数提取
    const isSeedance = model.startsWith('doubao-seedance') || model.startsWith('seedance');
    // 尾帧图片：优先 seedanceImageTail，其次 imageTail（兼容旧字段）
    const imageTailUrl = (params.seedanceImageTail || (params as Record<string, unknown>).imageTail) as string | undefined;
    // 参考视频
    const videoRefUrl = (params.seedanceVideo || (params as Record<string, unknown>).video) as string | undefined;
    // 参考音频
    const audioRefUrls = (params.seedanceAudio || (params as Record<string, unknown>).audio) as string[] | undefined;
    // 多张参考图（Seedance 最多9张）
    const seedanceImages = (params as Record<string, unknown>).seedanceImages as string[] | undefined;
    // 分辨率、时长、水印、真人模式
    const seedanceResolution = (params as Record<string, unknown>).seedanceResolution as string | undefined;
    const seedanceDuration = (params as Record<string, unknown>).seedanceDuration as number | undefined;
    const seedanceWatermark = (params as Record<string, unknown>).seedanceWatermark as boolean | undefined;
    const seedanceRealPersonMode = (params as Record<string, unknown>).seedanceRealPersonMode as boolean | undefined;
    // Seedance 扩展参数
    const seedanceMovementAmplitude = (params as Record<string, unknown>).seedanceMovementAmplitude as string | undefined;
    const seedanceCameraControl = (params as Record<string, unknown>).seedanceCameraControl as string | undefined;
    // 合并到 extraBody
    const extraBody = { ...(params.extraBody || {}) };
    if (seedanceMovementAmplitude) (extraBody as Record<string, unknown>).movement_amplitude = seedanceMovementAmplitude;
    if (seedanceCameraControl) (extraBody as Record<string, unknown>).camera_control = seedanceCameraControl;

    // 如果有 seedanceImages，替换 processedImages
    if (isSeedance && seedanceImages && Array.isArray(seedanceImages) && seedanceImages.length > 0) {
      // Seedance 多图参考模式：首帧放 images[0]，其余放 seedanceImages
      console.log(`[任务 ${task.id}] Seedance 多图参考模式: ${seedanceImages.length} 张参考图`);
    }

    if (endFrameUrl || imageTailUrl) {
      console.log(`[任务 ${task.id}] 尾帧模式: endFrameUrl=${!!endFrameUrl}, imageTailUrl=${!!imageTailUrl}`);
    }

    // 验证图片 URL 是否可访问
    if (processedImages.length > 0) {
      console.log(`[任务 ${task.id}] 参考图片 URL:`, processedImages.map(img => img.substring(0, 80) + '...'));
      
      for (let i = 0; i < processedImages.length; i++) {
        const imgUrl = processedImages[i];
        try {
          const imgResponse = await fetch(imgUrl, { method: 'HEAD' });
          if (!imgResponse.ok) {
            console.error(`[任务 ${task.id}] 图片 ${i + 1} 无法访问: ${imgResponse.status} ${imgResponse.statusText}`);
            console.error(`[任务 ${task.id}] 图片 URL: ${imgUrl}`);
          } else {
            console.log(`[任务 ${task.id}] 图片 ${i + 1} 可访问, Content-Type: ${imgResponse.headers.get('content-type')}`);
          }
        } catch (imgError) {
          console.error(`[任务 ${task.id}] 图片 ${i + 1} 访问失败:`, imgError);
        }
      }
    }

    let videoTaskId: string;

    if (isOpenAIFormat) {
      // 使用 OpenAI 格式创建视频（支持 Veo/Seedance 等）
      videoTaskId = await createOpenAIVideo(
        task.id, params, processedImages, baseUrl, apiKey || '', apiBaseUrl || '', model || '',
        endFrameUrl, imageTailUrl, videoRefUrl, audioRefUrls,
        seedanceImages, seedanceResolution, seedanceDuration, seedanceWatermark, seedanceRealPersonMode, extraBody
      );
    } else {
      // 使用云雾格式创建视频
      videoTaskId = await createYunwuVideo(task.id, params, processedImages, baseUrl, apiKey || '', apiBaseUrl || '', model || '');
    }

    console.log(`[任务 ${task.id}] 视频任务已提交: ${videoTaskId}`);

    // 轮询视频状态 - 通过独立 API route 确保每次都用最新代码
    let videoUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(5000);

      const pollParams = new URLSearchParams({
        videoId: videoTaskId,
        baseUrl: apiBaseUrl,
        model: model || '',
        isOpenAI: String(isOpenAIFormat),
        apiKey,
      });

      const localBaseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || `http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}`;
      const pollResponse = await fetch(
        `${localBaseUrl}/api/tasks/poll-video?${pollParams.toString()}`,
        {
          headers: { 'X-Internal-Api-Key': apiKey },
          // @ts-expect-error - Node.js undici Agent
          dispatcher: longRunningAgent,
        }
      );
      const pollData = await pollResponse.json();

      const status = pollData.status?.toUpperCase();

      if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'SUCCEEDED' || status === 'SUCCEED') {
        videoUrl = pollData.video_url;
        thumbnailUrl = pollData.cover_image_url;
        console.log(`[任务 ${task.id}] SUCCEED, videoUrl: ${videoUrl?.substring(0, 80) || '空'}`);
        if (videoUrl) {
          break;
        } else {
          // 状态成功但 URL 提取为空，记录原始响应用于排查
          console.error(`[任务 ${task.id}] SUCCEED 但 video_url 为空! pollData:`, JSON.stringify(pollData).substring(0, 1000));
          throw new Error(`视频生成成功但无法获取视频URL`);
        }
      } else if (status === 'FAILED' || status === 'ERROR') {
        throw new Error(pollData.error || '视频生成失败');
      }

      console.log(`[任务 ${task.id}] 视频轮询 ${i + 1}/${maxAttempts}, status: ${status}`);
    }

    if (!videoUrl) {
      throw new Error('视频生成超时');
    }

    // 下载视频并保存到对象存储
    let videoFileSize = 0;
    try {
      console.log(`[任务 ${task.id}] 开始下载视频: ${videoUrl.substring(0, 100)}...`);
      const videoDownloadResponse = await fetch(videoUrl);
      console.log(`[任务 ${task.id}] 视频下载响应: status=${videoDownloadResponse.status}, content-type=${videoDownloadResponse.headers.get('content-type')}, content-length=${videoDownloadResponse.headers.get('content-length')}`);
      
      if (videoDownloadResponse.ok) {
        const arrayBuffer = await videoDownloadResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 检查视频文件大小
        if (buffer.length === 0) {
          throw new Error(`下载的视频文件为空（0字节），URL: ${videoUrl.substring(0, 100)}`);
        }

        const uploadedKey = await s3Storage.uploadFile({
          fileContent: buffer,
          fileName: `video/${task.id}.mp4`,
          contentType: 'video/mp4',
        });

        videoUrl = await s3Storage.generatePresignedUrl({
          key: uploadedKey,
          expireTime: URL_EXPIRE_TIME,
        });
        videoFileSize = buffer.length;

        console.log(`[任务 ${task.id}] 视频已保存，大小: ${(videoFileSize / 1024 / 1024).toFixed(2)}MB`);
      } else {
        throw new Error(`视频下载失败: HTTP ${videoDownloadResponse.status}`);
      }
    } catch (downloadError) {
      console.error(`[任务 ${task.id}] 视频下载保存失败:`, downloadError);
      throw downloadError; // 重新抛出错误，让任务失败而不是保存空文件
    }

    // 处理缩略图
    if (thumbnailUrl?.startsWith('http')) {
      try {
        const thumbResponse = await fetch(thumbnailUrl);
        if (thumbResponse.ok) {
          const arrayBuffer = await thumbResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const uploadedKey = await s3Storage.uploadFile({
            fileContent: buffer,
            fileName: `video/${task.id}_thumb.jpg`,
            contentType: 'image/jpeg',
          });

          thumbnailUrl = await s3Storage.generatePresignedUrl({
            key: uploadedKey,
            expireTime: URL_EXPIRE_TIME,
          });
        }
      } catch (thumbError) {
        console.error(`[任务 ${task.id}] 缩略图保存失败:`, thumbError);
      }
    }

    // 更新任务状态
    const now = new Date().toISOString();
    const result = { taskId: videoTaskId, videoUrl, thumbnailUrl, fileSize: videoFileSize };
    
    // 获取现有结果数组，将新结果添加到 results 中（保留历史结果）
    const existingResults = (task.results as Array<{ taskId: string; videoUrl?: string; thumbnailUrl?: string; fileSize?: number }>) || [];
    const isDuplicate = existingResults.some(r => r.videoUrl === videoUrl);
    const updatedResults = isDuplicate ? existingResults : [...existingResults, result];
    
    await supabase
      .from('task_queue')
      .update({
        status: 'success',
        result,
        results: updatedResults,
        completed_at: now
      })
      .eq('id', task.id);

    // 广播任务成功
    broadcastTaskUpdate({
      taskId: task.id,
      type: 'video',
      status: 'success',
      projectId: task.project_id || undefined,
      result: { videoUrl, thumbnailUrl, fileSize: videoFileSize },
    });

    // 扣除积分（视频生成成功）
    if (task.user_id) {
      const seedanceActionType = typeof params.action_type === 'string' && params.action_type.startsWith('video_seedance2_')
        ? params.action_type
        : null;
      const seedanceCreditsRequired = typeof params.credits_required === 'number' ? params.credits_required : null;
      const creditResult = seedanceActionType && seedanceCreditsRequired
        ? await consumeFixedCredits(task.user_id, seedanceActionType, seedanceCreditsRequired, task.id, 'video')
        : await consumeCredits(task.user_id, 'video_generate', task.id, 'video');
      if (!creditResult.success) {
        console.error(`[任务 ${task.id}] 扣除积分失败:`, creditResult.error);
      } else if (creditResult.skipped) {
        console.log(`[任务 ${task.id}] 积分已扣除过，跳过重复扣除`);
      } else {
        console.log(`[任务 ${task.id}] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
      }
    }

    // 保存到视频历史记录
    await supabase.from('video_history').upsert({
      id: task.id,
      user_id: task.user_id,
      url: videoUrl,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      file_size: videoFileSize,
      created_at: now
    });

    // 视频复刻场景：更新分镜状态
    if (params.projectType === 'video_remake' && (params.segmentId || params.sceneId) && videoUrl) {
      await handleVideoRemakeVideoComplete(supabase, params, videoUrl, videoFileSize, task.user_id);
    }

    console.log(`[任务 ${task.id}] 视频生成完成`);

  } catch (error) {
    console.error(`[任务 ${task.id}] 视频生成失败:`, {
      error,
      errorMessage: error instanceof Error ? error.message : '未知错误',
      errorStack: error instanceof Error ? error.stack : undefined,
      errorCause: error instanceof Error ? error.cause : undefined,
      taskParams: {
        userId: task.user_id,
        prompt: params.prompt?.substring(0, 100),
        aspectRatio: params.aspectRatio,
        model: params.model,
        isOpenAIFormat,
      },
      apiConfig: {
        hasApiKey: !!apiKey,
        hasApiBaseUrl: !!apiBaseUrl,
        hasModel: !!model,
      },
    });

    // 记录视频生成失败
    logTaskError(task.id, '视频生成', error, {
      userId: task.user_id,
      params: {
        prompt: params.prompt?.substring(0, 100),
        aspectRatio: params.aspectRatio,
        model: params.model,
      },
    }, task.user_id);

    throw error;
  }
}

/**
 * 使用 OpenAI 格式创建视频（支持 Veo/Seedance 等）
 * 支持完整的 Seedance 2.0 参数
 */
async function createOpenAIVideo(
  taskId: string,
  params: VideoTaskParams,
  images: string[],
  baseUrl: string,
  apiKey: string,
  apiBaseUrl: string,
  model: string,
  endFrameUrl?: string,
  imageTailUrl?: string,
  videoRefUrl?: string,
  audioRefUrls?: string[],
  seedanceImages?: string[],
  seedanceResolution?: string,
  seedanceDuration?: number,
  seedanceWatermark?: boolean,
  seedanceRealPersonMode?: boolean,
  extraBody?: Record<string, unknown>,
): Promise<string> {
  // Seedance 2.0 使用 duration，默认 5 秒（Seedance 最短 4 秒）
  const isSeedance = model.startsWith('doubao-seedance') || model.startsWith('seedance');
  const duration = seedanceDuration ?? params.duration ?? (isSeedance ? 5 : 8);
  const resolution = seedanceResolution || params.resolution;
  const watermark = seedanceWatermark ?? false;
  const realPersonMode = seedanceRealPersonMode ?? params.realPersonMode;

  console.log(`[任务 ${taskId}] 使用 OpenAI 格式创建视频，模型: ${model}`);
  console.log(`[任务 ${taskId}] OpenAI 视频参数:`, {
    apiBaseUrl,
    model,
    duration,
    aspectRatio: params.aspectRatio,
    resolution,
    hasImages: images.length > 0,
    hasSeedanceImages: !!seedanceImages?.length,
    hasEndFrame: !!endFrameUrl,
    hasImageTail: !!imageTailUrl,
    hasVideoRef: !!videoRefUrl,
    hasAudioRef: !!audioRefUrls?.length,
    watermark,
    realPersonMode,
    promptLength: params.prompt?.length || 0,
  });

  let createResponse;
  try {
    createResponse = await fetch(`${baseUrl}/api/video/openai-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        baseUrl: apiBaseUrl,
        model,
        prompt: params.prompt,
        // Seedance 专用参数（需与 openai-create POST handler 解构的字段名一致）
        seedanceDuration: duration,
        seedanceImages,
        endFrameUrl,
        imageTailUrl,
        videoRefUrl,
        audioRefUrls,
        seedanceAspectRatio: params.aspectRatio,
        seedanceResolution: resolution,
        seedanceWatermark: watermark,
        seedanceRealPersonMode: realPersonMode,
        extraBody,
        // 非 Seedance 模型参数（openai-create 也解构了这些）
        aspectRatio: params.aspectRatio,
        watermark,
      }),
    });
    console.log(`[任务 ${taskId}] OpenAI 创建视频 API 响应: ${createResponse.status}`);
  } catch (fetchError) {
    console.error(`[任务 ${taskId}] OpenAI 创建视频 Fetch 失败:`, fetchError);
    throw new Error(`OpenAI 创建视频请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`);
  }

  let createData;
  try {
    createData = await createResponse.json();
    console.log(`[任务 ${taskId}] OpenAI 创建视频响应数据:`, {
      hasError: !!createData.error,
      errorMessage: createData.error,
      hasId: !!(createData.id || createData.task_id),
      taskId: createData.id || createData.task_id,
    });
  } catch (parseError) {
    console.error(`[任务 ${taskId}] 解析 OpenAI 创建视频响应失败:`, parseError);
    throw new Error(`解析 OpenAI 创建视频响应失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
  }

  if (!createData.ok || createData.error) {
    console.error(`[任务 ${taskId}] OpenAI 创建视频 API 返回错误:`, {
      status: createResponse.status,
      error: createData.error,
      fullResponse: JSON.stringify(createData).substring(0, 500),
    });
    throw new Error(createData.error || 'OpenAI 视频创建请求失败');
  }

  // 兼容不同 API 的 ID 字段名：Seedance 用 task_id，其他用 id
  const videoTaskId = (createData as any).task_id || createData.id;
  if (!videoTaskId) {
    console.error(`[任务 ${taskId}] 视频 API 未返回任务 ID (id=${createData.id}, task_id=${(createData as any).task_id})`, createData);
    throw new Error('OpenAI 视频 API 未返回任务 ID');
  }

  console.log(`[任务 ${taskId}] OpenAI 视频创建成功, taskId: ${videoTaskId}`);
  return videoTaskId;
}

/**
 * 使用云雾格式创建视频
 */
async function createYunwuVideo(
  taskId: string,
  params: VideoTaskParams,
  images: string[],
  baseUrl: string,
  apiKey: string,
  apiBaseUrl: string,
  model: string
): Promise<string> {
  console.log(`[任务 ${taskId}] 使用云雾格式创建视频`);
  console.log(`[任务 ${taskId}] 云雾视频参数:`, {
    apiBaseUrl,
    model,
    aspectRatio: params.aspectRatio,
    hasImages: images.length > 0,
    enhancePrompt: params.enhancePrompt,
    enableUpsample: params.enableUpsample,
    promptLength: params.prompt?.length || 0,
  });

  let createResponse;
  try {
    createResponse = await fetch(`${baseUrl}/api/video/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        baseUrl: apiBaseUrl,
        model,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        images: images.length > 0 ? images : undefined,
        enhancePrompt: params.enhancePrompt,
        enableUpsample: params.enableUpsample,
        generateAudio: params.generateAudio,
      }),
    });
    console.log(`[任务 ${taskId}] 云雾创建视频 API 响应: ${createResponse.status}`);
  } catch (fetchError) {
    console.error(`[任务 ${taskId}] 云雾创建视频 Fetch 失败:`, fetchError);
    throw new Error(`云雾创建视频请求失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`);
  }

  let createData;
  try {
    createData = await createResponse.json();
    console.log(`[任务 ${taskId}] 云雾创建视频响应数据:`, {
      hasError: !!createData.error,
      errorMessage: createData.error,
      hasId: !!(createData.id || createData.taskId || createData.task_id),
      idFields: {
        id: createData.id,
        taskId: createData.taskId,
        task_id: createData.task_id,
      },
    });
  } catch (parseError) {
    console.error(`[任务 ${taskId}] 解析云雾创建视频响应失败:`, parseError);
    throw new Error(`解析云雾创建视频响应失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
  }

  if (!createResponse.ok || createData.error) {
    console.error(`[任务 ${taskId}] 云雾创建视频 API 返回错误:`, {
      status: createResponse.status,
      error: createData.error,
      fullResponse: JSON.stringify(createData).substring(0, 500),
    });
    throw new Error(createData.error || '视频创建请求失败');
  }

  const videoTaskId = createData.id || createData.taskId || createData.task_id;
  if (!videoTaskId) {
    console.error(`[任务 ${taskId}] 云雾视频 API 未返回任务 ID`, createData);
    throw new Error('视频 API 未返回任务 ID');
  }

  console.log(`[任务 ${taskId}] 云雾视频创建成功, taskId: ${videoTaskId}`);
  return videoTaskId;
}

/**
 * 下载图片并保存到对象存储
 */
async function downloadAndSaveImage(url: string, taskId: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/png';
  const extension = contentType.split('/')[1] || 'png';

  const uploadedKey = await s3Storage.uploadFile({
    fileContent: buffer,
    fileName: `generated/${taskId}.${extension}`,
    contentType,
  });

  return s3Storage.generatePresignedUrl({
    key: uploadedKey,
    expireTime: URL_EXPIRE_TIME,
  });
}

/**
 * 上传 base64 图片到对象存储
 */
async function uploadBase64Image(base64Data: string, taskId: string, mimeType?: string): Promise<string> {
  const buffer = Buffer.from(base64Data, 'base64');
  const contentType = mimeType || 'image/png';
  const extension = contentType.split('/')[1] || 'png';

  const uploadedKey = await s3Storage.uploadFile({
    fileContent: buffer,
    fileName: `generated/${taskId}.${extension}`,
    contentType,
  });

  return s3Storage.generatePresignedUrl({
    key: uploadedKey,
    expireTime: URL_EXPIRE_TIME,
  });
}

/**
 * 上传 data URL 格式的图片
 */
async function uploadBase64DataUrl(dataUrl: string, prefix: string): Promise<string | null> {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'png';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);

  const buffer = Buffer.from(base64Data, 'base64');

  const uploadedKey = await s3Storage.uploadFile({
    fileContent: buffer,
    fileName: `${prefix}/${timestamp}_${randomStr}.${extension}`,
    contentType: mimeType,
  });

  return s3Storage.generatePresignedUrl({
    key: uploadedKey,
    expireTime: URL_EXPIRE_TIME,
  });
}

/**
 * 辅助函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET: 获取队列状态和处理建议
 */
export async function GET(request: NextRequest) {
  if (!request.headers.get('authorization')) {
    return unauthorizedResponse('未登录', 401);
  }
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return unauthorizedResponse(auth.error, auth.status);
  }
  const canViewAllTasks = isAdmin(auth.payload.role);
  const supabase = getSupabaseClient();

  let pendingQuery = supabase
    .from('task_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (!canViewAllTasks) {
    pendingQuery = pendingQuery.eq('user_id', auth.userId);
  }
  const { count: pending } = await pendingQuery;

  let runningQuery = supabase
    .from('task_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'running');
  if (!canViewAllTasks) {
    runningQuery = runningQuery.eq('user_id', auth.userId);
  }
  const { count: running } = await runningQuery;

  return NextResponse.json({
    pending: pending || 0,
    running: running || 0,
    processing: processingTasks.size,
    message: processingTasks.size > 0 ? '有任务正在处理中' : '无任务处理中'
  });
}

/**
 * 执行脚本生成任务
 */
async function executeScriptTask(task: QueueTask, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const params = task.params as ScriptTaskParams;

  // 从数据库获取 API 配置（根据前端传递的 model 匹配配置）
  const textApi = await getServerTextApiByModel(params.model);
  const finalApiKey = textApi?.apiKey || process.env.YUNWU_API_KEY || '';
  const finalBaseUrl = textApi?.baseUrl || params.baseUrl || 'https://yunwu.ai/v1beta';
  const finalModel = textApi?.model || params.model || 'gemini-3.1-pro-preview';

  console.log(`[任务 ${task.id}] 脚本生成开始，模型: ${finalModel}`);

  // 计算片段数量
  const imageSegmentCount = Math.floor(params.duration / 8) + 1;
  const videoSegmentCount = imageSegmentCount - 1;

  try {
    // 产品一致性要求
    const productConsistencyRule = `
## 产品外观一致性要求（必须严格遵守）

**核心原则**：生成的所有图片和视频提示词中，关于产品的描述必须严格基于产品参考图，不得有任何改动或臆造。

### 具体要求：
1. **外观一致性**：产品的形状、尺寸、颜色、材质、按键位置、接口布局等物理特征必须与参考图完全一致
2. **品牌标识**：产品上的品牌Logo、文字、图案位置和样式必须与参考图一致
3. **细节保持**：产品的纹理、光泽、边角处理等细节必须与参考图一致
4. **例外情况**：如果产品带有显示屏，显示屏上显示的内容可以根据产品功能和使用场景进行调整

## 场景一致性要求

所有段落的场景必须保持一致，确保视频的连贯性和沉浸感。
`;

    const isGeminiApi = finalBaseUrl.includes('/v1beta') || finalBaseUrl.includes('generativelanguage.googleapis.com');
    let content = '';

    // 构建提示词
    let fullMessage = params.scriptPrompt;
    
    if (params.productImages && params.productImages.length > 0) {
      fullMessage += `

============================================
## 产品参考图（必须严格遵守外观一致性）
============================================

以下是产品的真实图片，共 ${params.productImages.length} 张：

${params.productImages.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

**重要提醒**：产品的外观、颜色、形状、材质、Logo等必须与参考图保持一致`;
    }
    
    fullMessage += `

============================================
## 输出格式要求（必须严格遵守）
============================================

请直接返回一个JSON数组，不要包含任何其他文字说明。
每个元素包含以下字段：
- order: 段落序号（数字）
- duration: 时长（秒）
- imagePrompt: 图片生成提示词（英文）
- videoPrompt: 视频生成提示词（英文）
- description: 段落描述（中文）

请生成 ${imageSegmentCount} 个图片段落，直接返回JSON数组：`;

    // 调用 LLM API
    if (isGeminiApi) {
      const endpoint = `${finalBaseUrl}/models/${finalModel}:generateContent?key=${finalApiKey}`;
      
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: productConsistencyRule + '\n\n' + fullMessage }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 16384 },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'API请求失败');
      }
      
      const candidates = data.candidates;
      if (candidates?.length > 0) {
        const parts = candidates[0].content?.parts;
        const textPart = parts?.find((p: Record<string, unknown>) => p.text);
        content = textPart?.text || '';
      }
    } else {
      let endpoint = finalBaseUrl;
      if (!endpoint.includes('/v1') && !endpoint.includes('/v1beta')) {
        endpoint = `${endpoint}/v1`;
      }
      endpoint = `${endpoint}/chat/completions`;
      
      const messages = [
        { role: 'system', content: productConsistencyRule },
        { role: 'user', content: fullMessage }
      ];

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${finalApiKey}` },
        body: JSON.stringify({ model: finalModel, messages, temperature: 0.85, max_tokens: 16384 }),
        // @ts-expect-error - Node.js undici Agent
        dispatcher: longRunningAgent,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'API请求失败');
      }
      
      if (data.choices?.length > 0) {
        content = data.choices[0].message?.content || '';
      }
    }

    // 解析 JSON
    let segments: Array<{
      order: number;
      duration: number;
      imagePrompt: string;
      videoPrompt: string;
      description: string;
    }> = [];
    
    // 清理 markdown 代码块标记
    const cleanedContent = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0].trim();
      if (!jsonStr.endsWith(']')) {
        throw new Error('生成的内容不完整，可能是因为内容太长被截断');
      }
      segments = JSON.parse(jsonStr);
    } else {
      throw new Error('未找到有效的JSON数组');
    }

    // 验证并规范化段落数据
    if (segments.length !== imageSegmentCount) {
      console.warn(`[任务 ${task.id}] Expected ${imageSegmentCount} segments, got ${segments.length}`);
      if (segments.length < imageSegmentCount) {
        while (segments.length < imageSegmentCount) {
          segments.push({
            order: segments.length + 1,
            duration: 8,
            imagePrompt: '产品展示场景',
            videoPrompt: '产品展示动画',
            description: `段落${segments.length + 1}`,
          });
        }
      } else {
        segments = segments.slice(0, imageSegmentCount);
      }
    }

    segments = segments.map((seg, index) => ({
      order: index + 1,
      duration: seg.duration || 8,
      imagePrompt: seg.imagePrompt || '',
      videoPrompt: seg.videoPrompt || '',
      description: seg.description || '',
    }));

    console.log(`[任务 ${task.id}] 脚本生成完成: ${segments.length} 个段落`);

    // 更新任务状态
    const now = new Date().toISOString();
    const result = { segments, rawResponse: content };
    
    await supabase
      .from('task_queue')
      .update({
        status: 'success',
        result,
        completed_at: now
      })
      .eq('id', task.id);

    // 更新短片项目状态到步骤2
    if (task.project_id) {
      console.log(`[任务 ${task.id}] 更新短片项目状态到步骤2: ${task.project_id}`);
      
      // 将 segments 转换为短片项目的格式
      const projectSegments = segments.map((seg, idx) => ({
        id: `seg-${idx + 1}`,
        order: seg.order || idx + 1,
        duration: seg.duration || 8,
        imagePrompt: seg.imagePrompt || '',
        videoPrompt: seg.videoPrompt || '',
        description: seg.description || '',
      }));
      
      console.log(`[任务 ${task.id}] 脚本分段数据:`, JSON.stringify(projectSegments).substring(0, 500));
      
      const { data: updateResult, error: projectUpdateError } = await supabase
        .from('shortfilm_projects')
        .update({
          script_segments: projectSegments,
          current_step: 2,
          updated_at: now
        })
        .eq('id', task.project_id)
        .select();
      
      if (projectUpdateError) {
        console.error(`[任务 ${task.id}] 更新短片项目失败:`, projectUpdateError);
      } else {
        console.log(`[任务 ${task.id}] 短片项目已更新到步骤2, 更新结果:`, updateResult ? '成功' : '未找到项目');
      }
    } else {
      console.log(`[任务 ${task.id}] 没有 project_id，跳过更新短片项目`);
    }

    // 广播任务成功
    broadcastTaskUpdate({
      taskId: task.id,
      type: 'script',
      status: 'success',
      projectId: task.project_id || undefined,
      result,
    });

    // 扣除积分（脚本生成成功）
    if (task.user_id) {
      const creditResult = await consumeCredits(task.user_id, 'script_generate', task.id, 'script');
      if (!creditResult.success) {
        console.error(`[任务 ${task.id}] 扣除积分失败:`, creditResult.error);
      } else if (creditResult.skipped) {
        console.log(`[任务 ${task.id}] 积分已扣除过，跳过重复扣除`);
      } else {
        console.log(`[任务 ${task.id}] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
      }
    }

  } catch (error) {
    console.error(`[任务 ${task.id}] 脚本生成失败:`, error);
    
    // 记录脚本生成失败
    logTaskError(task.id, '脚本生成', error, {
      userId: task.user_id,
      projectId: task.project_id,
      params: {
        scriptPrompt: params.scriptPrompt?.substring(0, 100),
        duration: params.duration,
      },
    }, task.user_id);
    
    throw error;
  }
}

async function executeAnalysisTask(task: QueueTask, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const params = task.params as AnalysisTaskParams;
  const projectId = params.projectId || task.project_id;

  if (!projectId) {
    throw new Error('分析任务缺少项目ID');
  }

  if (!task.user_id) {
    throw new Error('分析任务缺少用户ID');
  }

  const { data: project, error: projectError } = await supabase
    .from('analysis_master_projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', task.user_id)
    .single();

  if (projectError || !project) {
    throw new Error('分析项目不存在');
  }

  let videoUrl = project.video_url as string | null;
  if (project.video_key) {
    videoUrl = await s3Storage.generatePresignedUrl({
      key: project.video_key,
      expireTime: 3600,
    });
  }

  if (!videoUrl) {
    throw new Error('无法生成视频访问地址');
  }

  // 推送 started 事件，前端立即感知分析开始
  broadcastTaskUpdate({
    taskId: task.id,
    type: 'analysis',
    status: 'started',
    projectId,
  });

  const videoResponse = await fetch(videoUrl, {
    signal: AbortSignal.timeout(120 * 1000),
    // @ts-expect-error - Node.js undici Agent
    dispatcher: longRunningAgent,
  });

  if (!videoResponse.ok) {
    throw new Error(`下载待分析视频失败: ${videoResponse.status}`);
  }

  const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
  const contentLength = Number(videoResponse.headers.get('content-length') || 0);
  if (contentLength > ANALYSIS_MAX_VIDEO_BYTES) {
    throw new Error('视频文件超过 100MB，无法分析');
  }

  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  if (buffer.length > ANALYSIS_MAX_VIDEO_BYTES) {
    throw new Error('视频文件超过 100MB，无法分析');
  }

  const result = await analyzeVideoBufferWithGemini(buffer, contentType.split(';')[0], {
    videoUrl,
    projectName: String(project.name || ''),
    sourceType: String(project.source_type || ''),
    videoDuration: project.video_duration || '未知',
  });
  const now = new Date().toISOString();
  const analysisActionType = params.actionType === ANALYSIS_MASTER_ACTION_TYPE
    ? params.actionType
    : ANALYSIS_MASTER_ACTION_TYPE;
  const analysisCreditsRequired = typeof params.creditsRequired === 'number' && params.creditsRequired >= 0
    ? params.creditsRequired
    : null;
  const chargeResult = analysisCreditsRequired === 0
    ? { success: true, error: undefined as string | undefined }
    : analysisCreditsRequired !== null
      ? await consumeFixedCredits(
        task.user_id,
        analysisActionType,
        analysisCreditsRequired,
        task.id,
        'analysis_master'
      )
      : await consumeCredits(task.user_id, analysisActionType, task.id, 'analysis_master');
  if (!chargeResult.success) {
    await supabase
      .from('analysis_master_projects')
      .update({
        status: 'failed',
        error: chargeResult.error || '扣除积分失败',
        updated_at: now,
      })
      .eq('id', projectId)
      .eq('user_id', task.user_id);
    throw new Error(chargeResult.error || '扣除积分失败');
  }


  await supabase
    .from('analysis_master_projects')
    .update({
      name: result.summary || project.name,
      status: 'completed',
      result,
      error: null,
      updated_at: now,
    })
    .eq('id', projectId)
    .eq('user_id', task.user_id);

  await supabase
    .from('task_queue')
    .update({
      status: 'success',
      result: {
        projectId,
        scenesCount: result.scenes.length,
      },
      error: null,
      completed_at: now,
    })
    .eq('id', task.id);

  broadcastTaskUpdate({
    taskId: task.id,
    type: 'analysis',
    status: 'success',
    projectId,
    result: {
      summary: result.summary,
      imagePrompt: result.imagePrompt,
      videoPrompt: result.videoPrompt,
      dialogue_vo_original: result.dialogue_vo_original,
      dialogue_vo_zh: result.dialogue_vo_zh,
      cta_a: result.cta_a,
      cta_b: result.cta_b,
      cta_c: result.cta_c,
      cta_d: result.cta_d,
      scenesCount: result.scenes.length,
    },
  });

  logInfo('task', '分析大师视频分析完成', { taskId: task.id, projectId, sceneCount: result.scenes.length }, task.user_id);
}

// ============ 视频复刻场景处理函数 ============

/**
 * 处理视频复刻图片生成完成
 */
async function handleVideoRemakeImageComplete(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  imageUrl: string,
  userId?: string
) {
  try {
    const segmentId = params.segmentId as string;
    const projectId = params.projectId as string;

    console.log(`[视频复刻V3] 图片生成完成，segmentId: ${segmentId}`);

    const { s3Storage } = await import('@/lib/s3-client');
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const s3Key = `video-remake/images/${timestamp}-${randomStr}.png`;

    const imageKey = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: s3Key,
      contentType: 'image/png',
    });

    const { data: project } = await supabase
      .from('shortfilm_projects')
      .select('image_tasks')
      .eq('id', projectId)
      .single();

    if (project?.image_tasks && Array.isArray(project.image_tasks)) {
      const imageTasks = project.image_tasks as Array<Record<string, unknown>>;
      const taskIndex = imageTasks.findIndex((t: Record<string, unknown>) => t.segmentId === segmentId);

      if (taskIndex !== -1) {
        const task = imageTasks[taskIndex] as Record<string, unknown>;
        const generatedImages = (task.generatedImages as Array<Record<string, unknown>>) || [];
        generatedImages.push({
          id: `img-${timestamp}-${randomStr}`,
          url: imageUrl,
          createdAt: Date.now(),
        });

        imageTasks[taskIndex] = {
          ...task,
          status: 'completed',
          generatedImages,
          selectedImageId: generatedImages[generatedImages.length - 1].id,
        };

        await supabase
          .from('shortfilm_projects')
          .update({ image_tasks: imageTasks, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      }
    }

    broadcastTaskUpdate({
      taskId: projectId,
      type: 'image',
      status: 'progress',
      projectId,
      result: {
        segmentId,
        status: 'completed',
        imageUrl,
        imageKey,
      },
    });

  } catch (error) {
    console.error(`[视频复刻V3] 图片生成完成处理失败:`, error);
  }
}

async function handleVideoRemakeKeyframeComplete(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  imageUrl: string,
  userId?: string
) {
  try {
    const segmentIds = params.segmentIds as string[];
    const projectId = params.projectId as string;
    const keyframeIndex = params.keyframeIndex as number;

    console.log(`[视频复刻V3] 关键帧图片生成完成，keyframeIndex: ${keyframeIndex}, segmentIds: ${segmentIds.join(',')}`);

    const { s3Storage } = await import('@/lib/s3-client');
    const imageResponse = await fetch(imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const s3Key = `video-remake/keyframe-gen/${timestamp}-${randomStr}.png`;

    const imageKey = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: s3Key,
      contentType: 'image/png',
    });

    const { data: project } = await supabase
      .from('shortfilm_projects')
      .select('image_tasks')
      .eq('id', projectId)
      .single();

    if (project?.image_tasks && Array.isArray(project.image_tasks)) {
      const imageTasks = project.image_tasks as Array<Record<string, unknown>>;
      let updated = false;

      for (const segId of segmentIds) {
        const taskIndex = imageTasks.findIndex((t: Record<string, unknown>) => t.segmentId === segId);
        if (taskIndex !== -1) {
          const task = imageTasks[taskIndex] as Record<string, unknown>;
          const generatedImages = (task.generatedImages as Array<Record<string, unknown>>) || [];
          generatedImages.push({
            id: `img-${timestamp}-${randomStr}-${segId.substring(0, 6)}`,
            url: imageUrl,
            createdAt: Date.now(),
          });

          imageTasks[taskIndex] = {
            ...task,
            status: 'completed',
            generatedImages,
            selectedImageId: generatedImages[generatedImages.length - 1].id,
          };
          updated = true;
        }
      }

      if (updated) {
        await supabase
          .from('shortfilm_projects')
          .update({ image_tasks: imageTasks, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      }
    }

    broadcastTaskUpdate({
      taskId: projectId,
      type: 'image',
      status: 'progress',
      projectId,
      result: {
        keyframeIndex,
        segmentIds,
        status: 'completed',
        imageUrl,
        imageKey,
      },
    });

  } catch (error) {
    console.error(`[视频复刻V3] 关键帧图片生成完成处理失败:`, error);
  }
}

/**
 * 处理视频复刻视频生成完成
 */
async function handleVideoRemakeVideoComplete(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  videoUrl: string,
  fileSize: number,
  userId?: string
) {
  try {
    const segmentId = params.segmentId as string | undefined;
    const segmentIds = params.segmentIds as string[] | undefined;
    const projectId = params.projectId as string;

    const targetSegmentIds = segmentIds && segmentIds.length > 0 ? segmentIds : (segmentId ? [segmentId] : []);
    console.log(`[视频复刻V3] 视频生成完成，segmentIds: ${targetSegmentIds.join(',')}`);

    const { s3Storage } = await import('@/lib/s3-client');
    const videoResponse = await fetch(videoUrl);
    const buffer = Buffer.from(await videoResponse.arrayBuffer());

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const s3Key = `video-remake/videos/${timestamp}-${randomStr}.mp4`;

    const videoKey = await s3Storage.uploadFile({
      fileContent: buffer,
      fileName: s3Key,
      contentType: 'video/mp4',
    });

    const { data: project } = await supabase
      .from('shortfilm_projects')
      .select('video_tasks')
      .eq('id', projectId)
      .single();

    if (project?.video_tasks && Array.isArray(project.video_tasks)) {
      const videoTasks = project.video_tasks as Array<Record<string, unknown>>;
      let updated = false;

      for (const segId of targetSegmentIds) {
        const taskIndex = videoTasks.findIndex((t: Record<string, unknown>) => t.segmentId === segId);
        if (taskIndex !== -1) {
          const task = videoTasks[taskIndex] as Record<string, unknown>;
          const generatedVideos = (task.generatedVideos as Array<Record<string, unknown>>) || [];
          generatedVideos.push({
            id: `vid-${timestamp}-${randomStr}`,
            url: videoUrl,
            taskId: projectId,
            createdAt: Date.now(),
          });

          videoTasks[taskIndex] = {
            ...task,
            status: 'completed',
            generatedVideos,
            selectedVideoId: generatedVideos[generatedVideos.length - 1].id,
          };
          updated = true;
        }
      }

      if (updated) {
        const allDone = videoTasks.every((t: Record<string, unknown>) =>
          ['completed', 'failed'].includes(t.status as string)
        );

        const statusUpdate: Record<string, unknown> = {
          video_tasks: videoTasks,
          updated_at: new Date().toISOString(),
        };
        if (allDone) {
          statusUpdate.status = 'generating_videos';
        }

        await supabase
          .from('shortfilm_projects')
          .update(statusUpdate)
          .eq('id', projectId);

        if (allDone) {
          console.log(`[视频复刻V3] 项目 ${projectId} 视频生成全部完成`);
        }
      }
    }

    broadcastTaskUpdate({
      taskId: projectId,
      type: 'video',
      status: 'progress',
      projectId,
      result: {
        segmentIds: targetSegmentIds,
        status: 'completed',
        videoUrl,
        videoKey,
      },
    });

  } catch (error) {
    console.error(`[视频复刻V3] 视频生成完成处理失败:`, error);
  }
}

async function executeScriptRemakeTask(task: QueueTask, supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  const params = task.params as ScriptRemakeTaskParams;
  const scriptRemakeId = params.scriptRemakeId;
  const projectId = params.projectId;
  const language = params.language || 'en-US';
  const includeChinese = params.includeChinese !== false;

  if (!scriptRemakeId) {
    throw new Error('脚本复刻任务缺少ID');
  }

  if (!task.user_id) {
    throw new Error('脚本复刻任务缺少用户ID');
  }

  const { data: scriptRemake, error: fetchError } = await supabase
    .from('analysis_master_script_remakes')
    .select('*')
    .eq('id', scriptRemakeId)
    .eq('user_id', task.user_id)
    .single();

  if (fetchError || !scriptRemake) {
    throw new Error('脚本复刻记录不存在');
  }

  broadcastTaskUpdate({
    taskId: task.id,
    type: 'script_remake',
    status: 'started',
    projectId,
  });

  console.log(`[Script Remake] 开始执行任务: ${task.id}, language=${language}, includeChinese=${includeChinese}`);

  const analysisResultRaw = params.analysisResult;
  const productSnapshot = params.productSnapshot as Record<string, unknown>;

  const analysisResult = normalizeAnalysisMasterResult(analysisResultRaw);
  const productImages = Array.isArray(productSnapshot.images) ? productSnapshot.images : [];
  const productAllImages = Array.isArray(productSnapshot.allImages) ? productSnapshot.allImages : [];

  const product: Parameters<typeof generateScriptRemake>[0]['product'] = {
    id: String(productSnapshot.id || ''),
    name: String(productSnapshot.name || ''),
    description: String(productSnapshot.description || ''),
    sellingPoints: Array.isArray(productSnapshot.sellingPoints) ? productSnapshot.sellingPoints as string[] : [],
    targetAudience: String(productSnapshot.target_audience || productSnapshot.targetAudience || ''),
    usageScenarios: String(productSnapshot.usage_scenarios || productSnapshot.usageScenarios || ''),
    brandInfo: String(productSnapshot.brand_info || productSnapshot.brandInfo || ''),
    priceRange: String(productSnapshot.price_range || productSnapshot.priceRange || ''),
    keywords: Array.isArray(productSnapshot.keywords) ? productSnapshot.keywords as string[] : [],
    primaryImage: productImages[0]?.url || productAllImages[0]?.url || '',
    allImages: productAllImages.map(img => {
      if (typeof img === 'string') return { key: '', url: img };
      return { key: img.key || '', url: img.url || '' };
    }),
  };

  const result = await generateScriptRemake({ analysisResult, product, language, includeChinese }, {}, params.scriptRemakeId);
  const now = new Date().toISOString();

  const scriptActionType = params.actionType === ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE
    ? params.actionType
    : ANALYSIS_MASTER_SCRIPT_REMAKE_ACTION_TYPE;
  const creditsRequired = typeof params.creditsRequired === 'number' && params.creditsRequired >= 0
    ? params.creditsRequired
    : null;

  const chargeResult = creditsRequired === 0
    ? { success: true, error: undefined as string | undefined }
    : creditsRequired !== null
      ? await consumeFixedCredits(
        task.user_id,
        scriptActionType,
        creditsRequired,
        task.id,
        'script_remake'
      )
      : await consumeCredits(task.user_id, scriptActionType, task.id, 'script_remake');

  if (!chargeResult.success) {
    await supabase
      .from('analysis_master_script_remakes')
      .update({
        status: 'failed',
        error: chargeResult.error || '扣除积分失败',
        updated_at: now,
      })
      .eq('id', scriptRemakeId)
      .eq('user_id', task.user_id);
    throw new Error(chargeResult.error || '扣除积分失败');
  }

  await supabase
    .from('analysis_master_script_remakes')
    .update({
      status: 'completed',
      language,
      title: result.title,
      hook: result.hook,
      pain_point: result.painPoint,
      selling_point_script: result.sellingPointScript,
      cta: result.cta,
      full_script: result.fullScript,
      full_script_cn: result.fullScriptCn,
      segments: result.segments,
      shooting_notes: result.shootingNotes,
      visual_notes: result.visualNotes,
      compliance_notes: result.complianceNotes,
      error: null,
      updated_at: now,
    })
    .eq('id', scriptRemakeId)
    .eq('user_id', task.user_id);

  await supabase
    .from('task_queue')
    .update({
      status: 'success',
      result: {
        scriptRemakeId,
        title: result.title,
      },
      error: null,
      completed_at: now,
    })
    .eq('id', task.id);

  broadcastTaskUpdate({
    taskId: task.id,
    type: 'script_remake',
    status: 'success',
    projectId,
    result: {
      scriptRemakeId,
      title: result.title,
    },
  });

  logInfo('task', '脚本复刻任务完成', { taskId: task.id, scriptRemakeId, title: result.title }, task.user_id);
}

function normalizeAnalysisMasterResult(raw: Record<string, unknown>): Parameters<typeof generateScriptRemake>[0]['analysisResult'] {
  return {
    summary: String(raw.summary || ''),
    videoType: String(raw.videoType || ''),
    targetAudience: String(raw.targetAudience || ''),
    sellingPoints: Array.isArray(raw.sellingPoints) ? raw.sellingPoints as string[] : [],
    scenes: Array.isArray(raw.scenes) ? raw.scenes as Parameters<typeof generateScriptRemake>[0]['analysisResult']['scenes'] : [],
    imagePrompt: String(raw.imagePrompt || ''),
    videoPrompt: String(raw.videoPrompt || ''),
    dialogue_vo_original: String(raw.dialogue_vo_original || ''),
    dialogue_vo_zh: String(raw.dialogue_vo_zh || ''),
    cta_a: String(raw.cta_a || ''),
    cta_b: String(raw.cta_b || ''),
    cta_c: String(raw.cta_c || ''),
    cta_d: String(raw.cta_d || ''),
    raw: (raw.raw || {}) as Record<string, unknown>,
  };
}
