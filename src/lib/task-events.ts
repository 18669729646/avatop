/**
 * 任务事件广播模块
 * 用于在任务状态变化时通知所有连接的客户端
 */

// 监听器类型
type TaskEventListener = (data: TaskEventData) => void;

// 任务事件数据
export interface TaskEventData {
  taskId: string;
  type: 'image' | 'video' | 'script' | 'analysis' | 'analysis_batch_import';
  status: 'pending' | 'running' | 'retrying' | 'success' | 'failed' | 'started' | 'progress';
  projectId?: string; // 所属短片项目ID（短片相关任务会有此字段）
  startedAt?: number; // 任务开始执行时间（状态为 running 时提供）
  retryCount?: number; // 当前重试次数（状态为 retrying 时提供）
  result?: {
    url?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    fileSize?: number;
    batchId?: string;
    sourceFileName?: string;
    totalRows?: number;
    createdRows?: number;
    failedRows?: number;
    failedItems?: Array<{
      sourceUrl: string;
      error: string;
    }>;
    taskCount?: number;
    scenesCount?: number;
    sceneId?: string;
    sceneIds?: string[];
    segmentId?: string;
    segmentIds?: string[];
    imageKey?: string;
    videoKey?: string;
    keyframeIndex?: number;
    imageUrl?: string;
    status?: string;
    segments?: Array<{
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
    }>;
    rawResponse?: string;
    // 分析大师结果字段
    summary?: string;
    imagePrompt?: string;
    videoPrompt?: string;
    dialogue_vo_original?: string;
    dialogue_vo_zh?: string;
    cta_a?: string;
    cta_b?: string;
    cta_c?: string;
    cta_d?: string;
  };
  error?: string;
  progress?: number;
  timestamp: number;
}

// 全局监听器列表
const listeners = new Set<TaskEventListener>();

/**
 * 订阅任务事件
 */
export function subscribeToTaskEvents(listener: TaskEventListener): () => void {
  listeners.add(listener);
  
  // 返回取消订阅函数
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 广播任务状态更新
 */
export function broadcastTaskUpdate(data: Omit<TaskEventData, 'timestamp'>): void {
  const eventData: TaskEventData = {
    ...data,
    timestamp: Date.now(),
  };
  
  console.log(`[EventBus] 广播任务更新: ${data.taskId} -> ${data.status}`);
  
  listeners.forEach(listener => {
    try {
      listener(eventData);
    } catch (error) {
      console.error('[EventBus] 监听器执行错误:', error);
    }
  });
}

/**
 * 获取当前监听器数量
 */
export function getListenerCount(): number {
  return listeners.size;
}
