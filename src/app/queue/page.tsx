'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageViewer } from '@/components/image-viewer';
import { VideoViewer } from '@/components/video-viewer';
import { VideoThumbnail } from '@/components/video-thumbnail';
import { useAuth } from '@/lib/auth-context';
import {
  ListOrdered,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  MoreVertical,
  Image as ImageIcon,
  Video,
  AlertCircle,
  Play,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Film,
  Users,
  User,
} from 'lucide-react';
import {
  QueueTask,
  removeTaskFromQueue,
  retryTask,
  retryAllFailedTasks,
  clearCompletedTasks,
  clearFailedTasks,
  clearTaskQueue,
  getTaskDuration,
  formatDuration,
  ImageTaskResult,
  VideoTaskResult,
  ScriptTaskResult,
  AnalysisTaskResult,
  processQueue,
} from '@/lib/queue';
import { useTaskEvents, TaskEventData, ConnectionStatus } from '@/hooks/use-task-events';
import { useTaskQueue, useTaskStats } from '@/lib/swr';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';
import { getProjectSync } from '@/lib/shortfilm';
import { getSystemConfig } from '@/lib/system-config';

// 根据 model 字段获取配置名称
function getConfigNameByModel(model: string, type: QueueTask['type']): string {
  const config = getSystemConfig();
  const apis = type === 'image' ? config.imageApis : type === 'video' ? config.videoApis : [];
  const api = apis.find(a => a.model === model);
  return api?.name || model;
}

function getTaskTypeName(type: QueueTask['type']): string {
  if (type === 'image') return '图片生成';
  if (type === 'video') return '视频生成';
  if (type === 'script') return '脚本生成';
  if (type === 'analysis') return '分析大师';
  return type;
}

export default function QueuePage() {
  const router = useRouter();
  // 获取用户信息用于权限判断
  const { user } = useAuth();
  const isAdminUser = user?.role === 'admin';
  
  // 管理员视图模式：'mine' = 我的任务, 'all' = 全部任务
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
  
  // 使用 SWR Hook 管理数据（支持窗口聚焦刷新）
  // 只有管理员才能切换视图，普通用户始终使用 'mine'
  const effectiveViewMode = isAdminUser ? viewMode : 'mine';
  const { tasks: swrTasks, isAdmin: isAdminFromApi, isLoading: isTasksLoading, mutate: mutateTasks } = useTaskQueue(effectiveViewMode, user?.id);
  const { stats: swrStats, mutate: mutateStats } = useTaskStats(effectiveViewMode, user?.id);
  
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, running: 0, retrying: 0, success: 0, failed: 0 });
  const [selectedTask, setSelectedTask] = useState<QueueTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [sseStatus, setSseStatus] = useState<ConnectionStatus>('disconnected');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  
  // 任务详情对话框状态
  const [showTaskInfoDialog, setShowTaskInfoDialog] = useState(false);
  const [taskInfoDetail, setTaskInfoDetail] = useState<QueueTask | null>(null);
  
  // 重试确认对话框状态
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retryTaskInfo, setRetryTaskInfo] = useState<QueueTask | null>(null);
  const [retryPreviewData, setRetryPreviewData] = useState<{
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
  const [isLoadingRetryPreview, setIsLoadingRetryPreview] = useState(false);
  
  // 清空已完成确认对话框状态
  const [showClearCompletedDialog, setShowClearCompletedDialog] = useState(false);
  // 清空失败确认对话框状态
  const [showClearFailedDialog, setShowClearFailedDialog] = useState(false);
  
  // 实时计时状态（用于执行中任务的已执行时间）
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  
  // 使用 ref 跟踪上一次的数据，避免不必要的更新
  const prevTasksRef = useRef<QueueTask[] | null>(null);
  const prevStatsRef = useRef<{ total: number; pending: number; running: number; success: number; failed: number } | null>(null);
  
  // 同步 SWR 数据到本地状态（只有数据真正变化时才更新）
  useEffect(() => {
    if (swrTasks && swrTasks !== prevTasksRef.current) {
      // 比较：检查长度和关键任务的状态
      const prev = prevTasksRef.current;
      
      // 更精细的比较：检查任务状态变化
      const hasChanges = !prev || 
        prev.length !== swrTasks.length ||
        prev.some((prevTask, index) => {
          const newTask = swrTasks[index];
          return !newTask || 
            prevTask.id !== newTask.id ||
            prevTask.status !== newTask.status;
        });
      
      if (hasChanges) {
        setTasks(swrTasks);
        prevTasksRef.current = swrTasks;
      }
    }
  }, [swrTasks]);
  
  useEffect(() => {
    if (swrStats && swrStats !== prevStatsRef.current) {
      // 比较统计数据的各个字段
      const prev = prevStatsRef.current;
      const isSame = prev && 
        prev.total === swrStats.total &&
        prev.pending === swrStats.pending &&
        prev.running === swrStats.running &&
        prev.success === swrStats.success &&
        prev.failed === swrStats.failed;
      
      if (!isSame) {
        setStats(swrStats);
        prevStatsRef.current = swrStats;
      }
    }
  }, [swrStats]);
  
  useEffect(() => {
    // 每秒更新一次当前时间，用于执行中任务的实时计时
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTasks = useCallback(async () => {
    await Promise.all([mutateTasks(), mutateStats()]);
  }, [mutateTasks, mutateStats]);

  // 标记需要重新加载任务列表（用于 SSE 事件中找不到任务时）
  const needsReloadRef = useRef(false);
  
  // 处理重新加载逻辑
  useEffect(() => {
    if (needsReloadRef.current) {
      needsReloadRef.current = false;
      loadTasks();
    }
  }, [tasks, loadTasks]); // 依赖 tasks，当 tasks 变化后检查是否需要重新加载

  // 处理 SSE 任务更新事件
  const handleTaskUpdate = useCallback((data: TaskEventData) => {
    console.log('[Queue] 收到任务更新:', data);
    
    // 用于跟踪旧状态的变量
    let oldStatus: string | undefined;
    
    // 更新任务列表中的对应任务
    setTasks(prevTasks => {
      const taskIndex = prevTasks.findIndex(t => t.id === data.taskId);
      if (taskIndex === -1) {
        // 新任务，标记需要重新加载整个列表
        needsReloadRef.current = true;
        return prevTasks;
      }
      
      // 记录旧状态
      oldStatus = prevTasks[taskIndex].status;
      
      const updatedTasks = [...prevTasks];
      const task = updatedTasks[taskIndex];
      
      // 根据任务类型构建正确的结果对象
      let taskResult: ImageTaskResult | VideoTaskResult | ScriptTaskResult | AnalysisTaskResult | undefined;
      if (data.result) {
        if (data.type === 'image') {
          taskResult = {
            url: data.result.url || '',
            fileSize: data.result.fileSize,
          };
        } else if (data.type === 'script') {
          // 脚本任务结果
          taskResult = data.result as ScriptTaskResult;
        } else if (data.type === 'analysis') {
          taskResult = data.result as AnalysisTaskResult;
        } else {
          taskResult = {
            taskId: data.taskId,
            videoUrl: data.result.videoUrl,
            thumbnailUrl: data.result.thumbnailUrl,
            fileSize: data.result.fileSize,
          };
        }
      }
      
      // 计算更新后的 results 数组
      let updatedResults = task.results || [];
      if (data.status === 'success' && taskResult) {
        // 任务成功时，将新结果添加到 results 数组中（保留历史结果）
        // 对于脚本任务，不进行 URL 去重检查
        if (data.type === 'script' || data.type === 'analysis') {
          updatedResults = [taskResult];
        } else {
          const newUrl = (taskResult as ImageTaskResult).url || (taskResult as VideoTaskResult).videoUrl;
          const isDuplicate = updatedResults.some(r => {
            const existingUrl = (r as ImageTaskResult).url || (r as VideoTaskResult).videoUrl;
            return existingUrl === newUrl;
          });
          if (!isDuplicate) {
            updatedResults = [...updatedResults, taskResult];
          }
        }
      }
      
      updatedTasks[taskIndex] = {
        ...task,
        status: data.status,
        result: taskResult,
        results: updatedResults,
        error: data.error,
        // SSE 传递的 error 是原始 API 错误，同时更新 lastError
        lastError: data.error,
        // 当状态变为 running 时，设置 startedAt（使用 SSE 传递的时间或当前时间）
        startedAt: data.status === 'running' 
          ? (data.startedAt || Date.now()) 
          : task.startedAt,
        // 当状态变为 success 或 failed 时，设置 completedAt
        completedAt: data.status === 'success' || data.status === 'failed' 
          ? Date.now() 
          : task.completedAt,
      };
      
      return updatedTasks;
    });
    
    // 更新统计信息
    setStats(prevStats => {
      const newStats = { ...prevStats };
      
      // 根据新状态和旧任务状态计算变化
      if (data.status === 'success') {
        if (oldStatus === 'running') newStats.running = Math.max(0, newStats.running - 1);
        else if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
        else if (oldStatus === 'failed') newStats.failed = Math.max(0, newStats.failed - 1);
        else if (oldStatus === 'retrying') newStats.retrying = Math.max(0, (newStats.retrying || 0) - 1);
        newStats.success += 1;
      } else if (data.status === 'failed') {
        if (oldStatus === 'running') newStats.running = Math.max(0, newStats.running - 1);
        else if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
        else if (oldStatus === 'retrying') newStats.retrying = Math.max(0, (newStats.retrying || 0) - 1);
        newStats.failed += 1;
      } else if (data.status === 'running') {
        if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
        else if (oldStatus === 'failed') newStats.failed = Math.max(0, newStats.failed - 1);
        else if (oldStatus === 'retrying') newStats.retrying = Math.max(0, (newStats.retrying || 0) - 1);
        newStats.running += 1;
      } else if (data.status === 'pending') {
        // 重试任务时从 failed 变为 pending
        if (oldStatus === 'failed') newStats.failed = Math.max(0, newStats.failed - 1);
        else if (oldStatus === 'running') newStats.running = Math.max(0, newStats.running - 1);
        else if (oldStatus === 'retrying') newStats.retrying = Math.max(0, (newStats.retrying || 0) - 1);
        newStats.pending += 1;
      } else if (data.status === 'retrying') {
        // 任务进入重试状态
        if (oldStatus === 'running') newStats.running = Math.max(0, newStats.running - 1);
        else if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
        newStats.retrying = (newStats.retrying || 0) + 1;
      }
      return newStats;
    });
  }, [loadTasks]);

  // 订阅 SSE 事件
  const { connectionStatus } = useTaskEvents(handleTaskUpdate, {
    enabled: true,
    onConnectionStatusChange: setSseStatus,
  });

  // 初始化：触发队列处理
  useEffect(() => {
    processQueue();
  }, []);

  // 兜底轮询：当有 running/pending 任务时，每 30 秒刷新一次列表
  // 防止 SSE 推送遗漏导致前端状态不同步
  useEffect(() => {
    const hasActiveTasks = tasks.some(t => t.status === 'running' || t.status === 'pending' || t.status === 'retrying');
    if (!hasActiveTasks) return;

    const pollInterval = setInterval(() => {
      loadTasks();
    }, 30000); // 30 秒

    return () => clearInterval(pollInterval);
  }, [tasks, loadTasks]);

  const handleDeleteTask = async (taskId: string) => {
    await removeTaskFromQueue(taskId);
    loadTasks();
  };

  // 准备重试任务 - 显示确认对话框
  const prepareRetryTask = async (task: QueueTask) => {
    setRetryTaskInfo(task);
    setRetryPreviewData(null);
    setShowRetryDialog(true);
  };

  // 预览重试请求体
  const handlePreviewRetryRequest = async () => {
    if (!retryTaskInfo) return;
    
    setIsLoadingRetryPreview(true);
    setRetryPreviewData(null);
    
    try {
      const params = retryTaskInfo.params;
      const isImage = retryTaskInfo.type === 'image';
      const isVideo = retryTaskInfo.type === 'video';

      if (!isImage && !isVideo) {
        setRetryPreviewData({ error: '该任务类型暂无预览请求体' });
        return;
      }
      
      // 获取认证 token
      const token = localStorage.getItem('auth_token');
      
      // 调用对应的预览 API
      const endpoint = isImage ? '/api/generate/preview' : '/api/video/preview';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: 'model' in params ? params.model : undefined,
          prompt: 'prompt' in params ? params.prompt : undefined,
          aspectRatio: 'aspectRatio' in params ? params.aspectRatio : undefined,
          resolution: 'resolution' in params ? params.resolution : undefined,
          images: 'images' in params ? params.images : undefined,
          enhancePrompt: 'enhancePrompt' in params ? params.enhancePrompt : undefined,
          enableUpsample: 'enableUpsample' in params ? params.enableUpsample : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setRetryPreviewData(data);
      } else {
        setRetryPreviewData({ error: data.error || '预览失败' });
      }
    } catch (err) {
      setRetryPreviewData({ error: err instanceof Error ? err.message : '预览失败' });
    } finally {
      setIsLoadingRetryPreview(false);
    }
  };

  // 确认重试
  const confirmRetryTask = async () => {
    if (!retryTaskInfo) return;
    
    const result = await retryTask(retryTaskInfo.id);
    
    if (result.success) {
      // 重试成功，更新本地状态（立即反馈）
      setTasks(prevTasks => prevTasks.map(t => 
        t.id === retryTaskInfo.id 
          ? { ...t, status: 'pending' as const, error: undefined, startedAt: undefined, completedAt: undefined, retryCount: t.retryCount + 1 }
          : t
      ));
      // 更新统计
      setStats(prevStats => ({
        ...prevStats,
        failed: Math.max(0, prevStats.failed - 1),
        pending: prevStats.pending + 1,
      }));
    }
    
    setShowRetryDialog(false);
    setRetryTaskInfo(null);
    setRetryPreviewData(null);
    
    // 刷新数据以确保同步
    loadTasks();
  };

  // 取消重试
  const cancelRetryTask = () => {
    setShowRetryDialog(false);
    setRetryTaskInfo(null);
    setRetryPreviewData(null);
  };

  const handleRetryAllFailed = async () => {
    // 获取当前失败的任务数量
    const failedCount = stats.failed;
    if (failedCount === 0) return;
    
    // 先更新本地状态（立即反馈）
    setTasks(prevTasks => prevTasks.map(t => 
      t.status === 'failed' 
        ? { ...t, status: 'pending' as const, error: undefined, startedAt: undefined, completedAt: undefined, retryCount: t.retryCount + 1 }
        : t
    ));
    // 更新统计
    setStats(prevStats => ({
      ...prevStats,
      failed: 0,
      pending: prevStats.pending + failedCount,
    }));
    
    // 调用 API
    await retryAllFailedTasks();
    
    // 刷新数据以确保同步
    loadTasks();
  };

  const handleClearCompleted = () => {
    setShowClearCompletedDialog(true);
  };

  const confirmClearCompleted = async () => {
    await clearCompletedTasks();
    setShowClearCompletedDialog(false);
    loadTasks();
  };

  const handleClearFailed = () => {
    setShowClearFailedDialog(true);
  };

  const confirmClearFailed = async () => {
    await clearFailedTasks();
    setShowClearFailedDialog(false);
    loadTasks();
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有任务吗？')) {
      await clearTaskQueue();
      loadTasks();
    }
  };

  const handleViewTask = (task: QueueTask) => {
    setSelectedTask(task);
    setSelectedResultIndex(0); // 重置为第一个结果
    setShowTaskDetail(true);
  };

  // 显示任务详情（参考图和提示词）
  const handleShowTaskInfo = (task: QueueTask) => {
    setTaskInfoDetail(task);
    setShowTaskInfoDialog(true);
  };
  
  // 分页计算
  const totalPages = Math.ceil(tasks.length / pageSize);
  const paginatedTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
    pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: '排队中' },
    running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: '执行中' },
    retrying: { icon: RefreshCw, color: 'text-orange-500', bg: 'bg-orange-500/10', label: '重试中' },
    success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: '已完成' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: '失败' },
    started: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-500/10', label: '已启动' },
    progress: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: '进行中' },
  };

  const formatTime = (timestamp: string | number) => {
    const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">任务队列</h1>
              <Badge variant="secondary" className="text-xs">{stats.total} 个任务</Badge>
            </div>
            <div className="flex items-center gap-2">
              {/* 管理员视图切换 */}
              {isAdminUser && (
                <div className="flex items-center border rounded-md p-0.5 mr-2">
                  <Button
                    variant={viewMode === 'mine' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setViewMode('mine')}
                  >
                    <User className="w-3.5 h-3.5 mr-1" />
                    我的任务
                  </Button>
                  <Button
                    variant={viewMode === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setViewMode('all')}
                  >
                    <Users className="w-3.5 h-3.5 mr-1" />
                    全部任务
                  </Button>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {sseStatus === 'connected' ? '实时更新中' : '自动刷新中'}
              </Badge>
              {stats.total > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  清空全部
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 统计卡片 - 横向布局 */}
          <div className="shrink-0 border-b bg-muted/30 px-4 py-2 overflow-x-auto">
            <div className="flex items-center gap-3 whitespace-nowrap">
              {/* 执行中 */}
              <div className="flex items-center gap-1.5">
                <Loader2 className={cn("w-4 h-4 text-blue-500", stats.running > 0 && "animate-spin")} />
                <span className="text-sm"><b>{stats.running}</b> 执行中</span>
              </div>
              
              {/* 重试中 */}
              <div className="flex items-center gap-1.5">
                <RefreshCw className={cn("w-4 h-4 text-orange-500", stats.retrying > 0 && "animate-spin")} />
                <span className="text-sm"><b>{stats.retrying || 0}</b> 重试中</span>
              </div>
              
              {/* 排队中 */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm"><b>{stats.pending}</b> 排队中</span>
              </div>
              
              {/* 已完成 */}
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm"><b>{stats.success}</b> 已完成</span>
              </div>
              
              {/* 失败 */}
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm"><b>{stats.failed}</b> 失败</span>
              </div>
              
              {/* 分隔线 */}
              <div className="w-px h-4 bg-border" />
              
              {/* 批量操作按钮 */}
              {stats.failed > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleRetryAllFailed}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重试失败
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs px-2" 
                onClick={handleClearCompleted}
                disabled={stats.success === 0}
              >
                清空已完成
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs px-2" 
                onClick={handleClearFailed}
                disabled={stats.failed === 0}
              >
                清空失败
              </Button>
            </div>
          </div>

          {/* 任务列表 */}
          <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {isTasksLoading ? (
                  // 加载骨架屏
                  Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden py-0">
                      <CardContent className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-20 rounded-lg bg-muted animate-pulse shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-full bg-muted animate-pulse rounded" />
                            <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                          </div>
                          <div className="w-16 h-7 bg-muted animate-pulse rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : tasks.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <ListOrdered className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>任务队列为空</p>
                      <p className="text-sm mt-1">生成任务将自动加入队列</p>
                    </CardContent>
                  </Card>
                ) : (
                  paginatedTasks.map((task) => {
                    const config = statusConfig[task.status];
                    const StatusIcon = config.icon;
                    const duration = getTaskDuration(task);
                    
                    // 计算执行中任务的实时已执行时间（单位：秒）
                    const runningDuration = task.status === 'running' && task.startedAt
                      ? Math.floor((currentTime - (typeof task.startedAt === 'string' ? new Date(task.startedAt).getTime() : task.startedAt)) / 1000)
                      : null;
                    
                    return (
                      <Card key={task.id} className={cn(
                        "overflow-hidden py-0 transition-all",
                        task.status === 'failed' && "border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/20",
                        task.status === 'retrying' && "border-orange-200 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-950/20"
                      )}>
                        <CardContent className="py-2 px-3">
                          <div className="flex items-center gap-3">
                            {/* 预览图/类型图标 */}
                            <div 
                              className={cn(
                                "w-20 h-20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden cursor-pointer ring-1 ring-border/50",
                                ((task.results && task.results.length > 0) || task.result)
                                  ? "bg-muted hover:ring-2 hover:ring-primary/50 transition-all" 
                                  : task.type === 'image' ? "bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30" 
                                  : task.type === 'script' ? "bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30"
                                  : "bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/30 dark:to-pink-800/30"
                              )}
                              onClick={() => {
                                if ((task.results && task.results.length > 0) || task.result) {
                                  handleViewTask(task);
                                }
                              }}
                            >
                              {((task.results && task.results.length > 0) || task.result) ? (
                                task.type === 'image' ? (
                                  <img 
                                    src={(task.result as ImageTaskResult).url || (task.results?.[0] as ImageTaskResult)?.url} 
                                    alt="预览" 
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                ) : task.type === 'script' ? (
                                  <div className="w-full h-full bg-amber-500/20 flex items-center justify-center p-2">
                                    <FileText className="w-8 h-8 text-amber-600" />
                                  </div>
                                ) : (
                                  <div className="relative w-full h-full">
                                    {(task.result as VideoTaskResult)?.thumbnailUrl || (task.results?.[0] as VideoTaskResult)?.thumbnailUrl ? (
                                      <img 
                                        src={(task.result as VideoTaskResult)?.thumbnailUrl || (task.results?.[0] as VideoTaskResult)?.thumbnailUrl} 
                                        alt="预览" 
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (task.result as VideoTaskResult)?.videoUrl || (task.results?.[0] as VideoTaskResult)?.videoUrl ? (
                                      <VideoThumbnail 
                                        videoUrl={((task.result as VideoTaskResult)?.videoUrl || (task.results?.[0] as VideoTaskResult)?.videoUrl)!}
                                        className="w-full h-full"
                                        onRefresh={() => mutateTasks()}
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-pink-500/20 flex items-center justify-center">
                                        <Video className="w-6 h-6 text-pink-500" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Play className="w-5 h-5 text-white" />
                                    </div>
                                  </div>
                                )
                              ) : task.type === 'image' ? (
                                <ImageIcon className="w-8 h-8 text-purple-500/60" />
                              ) : task.type === 'script' ? (
                                <FileText className="w-8 h-8 text-amber-500/60" />
                              ) : (
                                <Video className="w-8 h-8 text-pink-500/60" />
                              )}
                            </div>

                            {/* 任务信息 - 优化层级 */}
                            <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center gap-1.5">
                              {/* 第一行：类型 + 状态（主信息，加大） */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">
                                  {getTaskTypeName(task.type)}
                                </span>
                                {/* 用户信息（管理员视图时显示） */}
                                {isAdminUser && viewMode === 'all' && task.userPhone && (
                                  <Badge variant="outline" className="text-xs h-5 px-2 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                                    <User className="w-3 h-3 mr-1" />
                                    {task.userPhone}
                                  </Badge>
                                )}
                                {/* 短片任务标识 - 显示所属短片名称 */}
                                {task.projectId && (() => {
                                  const project = getProjectSync(task.projectId);
                                  // 根据任务类型决定跳转的步骤
                                  // 脚本任务跳转到步骤2，图片任务跳转到步骤3，视频任务跳转到步骤4
                                  const targetStep = task.type === 'script' ? 2 
                                    : task.type === 'image' ? 3 
                                    : 4;
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs h-5 px-2 text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900"
                                      onClick={() => {
                                        // 点击跳转到短片编辑页面的对应步骤
                                        router.push(`/shortfilm/new?id=${task.projectId}&step=${targetStep}`);
                                      }}
                                    >
                                      <Film className="w-3 h-3 mr-1" />
                                      {project?.name || '未知短片'}
                                    </Badge>
                                  );
                                })()}
                                <Badge className={cn("text-xs h-5 px-2 font-medium", config.bg, config.color)}>
                                  <StatusIcon className={cn("w-3 h-3 mr-1", (task.status === 'running' || task.status === 'retrying') && "animate-spin")} />
                                  {task.status === 'retrying' ? `第${task.retryCount}次重试中` : config.label}
                                </Badge>
                                {task.retryCount > 0 && task.status !== 'retrying' && (
                                  <Badge variant="outline" className="text-xs h-5 px-2 text-orange-600 border-orange-200">
                                    已重试 {task.retryCount} 次
                                  </Badge>
                                )}
                              </div>
                              
                              {/* 第二行：提示词（次要信息） */}
                              <p className="text-sm text-muted-foreground line-clamp-2 break-all">
                                {(task.params as { prompt?: string }).prompt || '无提示词'}
                              </p>
                              
                              {/* 第三行：时间信息（辅助信息） */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>创建: {formatTime(task.createdAt)}</span>
                                {/* 执行时间显示 */}
                                {task.status === 'running' && runningDuration !== null && (
                                  <span className="text-blue-500 font-medium flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" />
                                    已执行 {formatDuration(runningDuration)}
                                  </span>
                                )}
                                {(task.status === 'success' || task.status === 'failed') && duration !== null && (
                                  <span>耗时 {formatDuration(duration)}</span>
                                )}
                              </div>
                              
                              {/* 失败原因/重试原因（如果有） */}
                              {(task.status === 'failed' || task.status === 'retrying') && (task.lastError || task.error) && (
                                <p 
                                  className={cn(
                                    "text-xs line-clamp-1 break-all flex items-center gap-1 mt-0.5 cursor-help",
                                    task.status === 'retrying' ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                                  )}
                                  title={task.lastError || task.error}
                                >
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>{task.lastError || task.error}</span>
                                </p>
                              )}
                            </div>

                            {/* 操作按钮组 - 简化 */}
                            <div className="flex flex-col gap-1 shrink-0">
                              {/* 预览按钮（有结果时显示，包括执行中可查看之前的结果） */}
                              {((task.results && task.results.length > 0) || task.result) && (
                                <Button size="sm" variant="outline" className="h-7 px-3 text-xs hover:bg-primary hover:text-primary-foreground" onClick={() => handleViewTask(task)}>
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  查看结果
                                </Button>
                              )}
                              {/* 重试按钮 */}
                              {task.status === 'failed' && (
                                <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" onClick={() => prepareRetryTask(task)}>
                                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                  重试
                                </Button>
                              )}
                              {/* 重新生成按钮（仅非短片任务且成功时显示） */}
                              {task.status === 'success' && !task.projectId && (
                                <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => prepareRetryTask(task)}>
                                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                  重新生成
                                </Button>
                              )}
                              {/* 执行中显示加载动画 */}
                              {task.status === 'running' && (
                                <div className="flex items-center gap-1.5 text-xs text-blue-500 px-3 py-1.5">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  执行中...
                                </div>
                              )}
                              {/* 更多操作菜单 */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-xs text-muted-foreground">
                                    <MoreVertical className="w-3.5 h-3.5 mr-1" />
                                    更多
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleShowTaskInfo(task)}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    删除任务
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
              
              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    上一页
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    共 {tasks.length} 条
                  </span>
                </div>
              )}
            </ScrollArea>
          </main>
        </div>
      </div>

      {/* 任务详情对话框 */}
      <Dialog open={showTaskDetail} onOpenChange={setShowTaskDetail}>
        <DialogContent className="max-w-2xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* 为屏幕阅读器添加隐藏的标题 */}
          <DialogTitle className="sr-only">预览</DialogTitle>
          {selectedTask && (() => {
            // 脚本任务单独处理
            if (selectedTask.type === 'script') {
              const scriptResult = selectedTask.result as ScriptTaskResult | undefined;
              
              // 任务执行中
              if (selectedTask.status === 'running') {
                return (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 flex items-center justify-center p-4">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-muted-foreground">脚本生成中...</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                      <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                        关闭
                      </Button>
                    </div>
                  </div>
                );
              }
              
              // 执行失败
              if (selectedTask.status === 'failed' && selectedTask.error) {
                return (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 flex items-center justify-center p-4">
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">错误信息</span>
                        </div>
                        <p>{selectedTask.error}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                      <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                        关闭
                      </Button>
                    </div>
                  </div>
                );
              }
              
              // 显示脚本结果
              return (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-auto p-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <FileText className="w-4 h-4" />
                        <span>生成的脚本分段</span>
                        {scriptResult?.segments && (
                          <Badge variant="outline" className="ml-2">
                            共 {scriptResult.segments.length} 段
                          </Badge>
                        )}
                      </div>
                      {scriptResult?.segments ? (
                        scriptResult.segments.map((segment, idx) => (
                          <div key={idx} className="p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                分段 {segment.order}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                时长: {segment.duration}s
                              </span>
                            </div>
                            <p className="text-sm mb-2">{segment.description}</p>
                            {segment.imagePrompt && (
                              <div className="text-xs text-muted-foreground mb-1 line-clamp-3">
                                <span className="font-medium">图片提示词:</span> {segment.imagePrompt}
                              </div>
                            )}
                            {segment.videoPrompt && (
                              <div className="text-xs text-muted-foreground line-clamp-3">
                                <span className="font-medium">视频提示词:</span> {segment.videoPrompt}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          暂无脚本结果
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                    <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                      关闭
                    </Button>
                  </div>
                </div>
              );
            }
            
            // 图片和视频任务处理
            // 获取所有结果（包括最新的 result 和历史 results）
            if (selectedTask.type === 'analysis') {
              const result = selectedTask.result as AnalysisTaskResult | undefined;
              return (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-blue-500" />
                      <div className="font-medium">分析大师任务</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedTask.status === 'success'
                          ? `已生成 ${result?.scenesCount ?? 0} 个分镜，前往分析大师页面查看结果`
                          : selectedTask.error || '任务仍在队列中处理'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                    <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                      关闭
                    </Button>
                    {selectedTask.projectId && (
                      <Button size="sm" onClick={() => router.push('/analysis-master')}>
                        查看分析大师
                      </Button>
                    )}
                  </div>
                </div>
              );
            }

            const allResults: (ImageTaskResult | VideoTaskResult)[] = [];
            if (selectedTask.results && selectedTask.results.length > 0) {
              // 过滤掉脚本结果，只保留图片和视频结果
              const filteredResults = selectedTask.results.filter(
                (r): r is ImageTaskResult | VideoTaskResult => 'url' in r || 'videoUrl' in r
              );
              allResults.push(...filteredResults);
            }
            
            // 通过 URL 比较检查 result 是否已经在 results 中（避免引用比较的问题）
            if (selectedTask.result) {
              const resultUrl = (selectedTask.result as ImageTaskResult).url || (selectedTask.result as VideoTaskResult).videoUrl;
              const isDuplicate = allResults.some(r => {
                const existingUrl = (r as ImageTaskResult).url || (r as VideoTaskResult).videoUrl;
                return existingUrl === resultUrl;
              });
              if (!isDuplicate && resultUrl) {
                // 只添加图片和视频结果
                allResults.push(selectedTask.result as ImageTaskResult | VideoTaskResult);
              }
            }
            
            // 如果没有结果
            if (allResults.length === 0) {
              // 如果任务正在执行中
              if (selectedTask.status === 'running') {
                return (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 flex items-center justify-center p-4">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-muted-foreground">任务执行中...</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                      <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                        关闭
                      </Button>
                    </div>
                  </div>
                );
              }
              
              // 如果有错误
              return selectedTask.error ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">错误信息</span>
                      </div>
                      <p>{selectedTask.error}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/30">
                    <Button variant="outline" size="sm" onClick={() => setShowTaskDetail(false)}>
                      关闭
                    </Button>
                  </div>
                </div>
              ) : null;
            }
            
            // 获取当前选中的结果
            const currentResult = allResults[selectedResultIndex] || allResults[0];
            
            return (
              <div className="flex-1 flex flex-col min-h-0">
                {/* 失败状态提示（显示错误原因） */}
                {selectedTask.status === 'failed' && (selectedTask.lastError || selectedTask.error) && (
                  <div className="p-3 bg-destructive/10 border-b border-destructive/20 shrink-0">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-destructive">任务执行失败</span>
                        <p className="text-xs text-destructive/80 mt-1 break-all">{selectedTask.lastError || selectedTask.error}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 执行中状态提示 */}
                {selectedTask.status === 'running' && (
                  <div className="flex items-center justify-center gap-2 p-2 bg-blue-500/10 border-b border-blue-500/20 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-600">正在生成新结果...</span>
                  </div>
                )}
                
                {/* 结果切换栏（多个结果时显示） */}
                {allResults.length > 1 && (
                  <div className="flex items-center gap-1 p-2 bg-muted/50 border-b overflow-x-auto shrink-0">
                    <span className="text-xs text-muted-foreground mr-2 shrink-0">选择结果:</span>
                    {allResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedResultIndex(idx)}
                        className={cn(
                          "shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all",
                          idx === selectedResultIndex 
                            ? "border-primary ring-1 ring-primary/50" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {selectedTask.type === 'image' ? (
                          <img 
                            src={(result as ImageTaskResult).url} 
                            alt={`结果 ${idx + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-pink-500/20 flex items-center justify-center overflow-hidden">
                            {(result as VideoTaskResult).thumbnailUrl ? (
                              <img 
                                src={(result as VideoTaskResult).thumbnailUrl!} 
                                alt={`结果 ${idx + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (result as VideoTaskResult).videoUrl ? (
                              <VideoThumbnail 
                                videoUrl={(result as VideoTaskResult).videoUrl!}
                                className="w-full h-full"
                                onRefresh={() => mutateTasks()}
                              />
                            ) : (
                              <Video className="w-4 h-4 text-pink-500" />
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      ({selectedResultIndex + 1}/{allResults.length})
                    </span>
                  </div>
                )}
                
                {/* 当前结果预览 */}
                {selectedTask.type === 'image' && (currentResult as ImageTaskResult).url && (
                  <ImageViewer
                    src={(currentResult as ImageTaskResult).url}
                    alt={`生成结果 ${selectedResultIndex + 1}`}
                    fileName={`generated-${selectedTask.id}-${selectedResultIndex + 1}.png`}
                    onClose={() => setShowTaskDetail(false)}
                  />
                )}
                {selectedTask.type === 'video' && (currentResult as VideoTaskResult).videoUrl && (
                  <VideoViewer
                    src={(currentResult as VideoTaskResult).videoUrl!}
                    poster={(currentResult as VideoTaskResult).thumbnailUrl ?? undefined}
                    fileName={`generated-${selectedTask.id}-${selectedResultIndex + 1}.mp4`}
                    onClose={() => setShowTaskDetail(false)}
                  />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 重试确认对话框 */}
      <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>确认重试任务</DialogTitle>
            <DialogDescription>
              查看发送给 API 的请求体内容，确认后重新执行
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            {/* 任务信息 */}
            {retryTaskInfo && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">任务信息</h4>
                <div className="p-3 bg-slate-100 rounded-lg text-sm space-y-1">
                  <div className="flex gap-2">
                    <span className="text-slate-500">类型:</span>
                    <span className="font-medium">{getTaskTypeName(retryTaskInfo.type)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500">提示词:</span>
                    <span className="font-medium line-clamp-2">{'prompt' in retryTaskInfo.params ? retryTaskInfo.params.prompt : '无'}</span>
                  </div>
                  {'images' in retryTaskInfo.params && Array.isArray(retryTaskInfo.params.images) && retryTaskInfo.params.images.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-slate-500">参考图:</span>
                      <span className="font-medium">{retryTaskInfo.params.images.length} 张</span>
                    </div>
                  )}
                  {retryTaskInfo.error && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-red-600 text-xs">
                      <span className="font-medium">上次失败原因: </span>
                      {retryTaskInfo.error}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 前端请求体 */}
            {retryTaskInfo && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">前端请求体</h4>
                <pre className="p-3 bg-slate-100 text-slate-800 rounded-lg text-xs overflow-auto font-mono whitespace-pre-wrap break-all max-h-40">
                  {JSON.stringify({
                    ...retryTaskInfo.params,
                    apiKey: 'apiKey' in retryTaskInfo.params && retryTaskInfo.params.apiKey 
                      ? `***${retryTaskInfo.params.apiKey.substring(retryTaskInfo.params.apiKey.length - 4)}` 
                      : undefined,
                    images: 'images' in retryTaskInfo.params && Array.isArray(retryTaskInfo.params.images)
                      ? retryTaskInfo.params.images.map((img: string) => 
                          img.startsWith('data:') 
                            ? `${img.substring(0, 50)}...(base64 ${Math.round(img.length/1024)}KB)`
                            : img
                        )
                      : undefined,
                  }, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 预览按钮 - 仅管理员可见 */}
            {isAdminUser && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePreviewRetryRequest}
                  disabled={isLoadingRetryPreview}
                >
                  {isLoadingRetryPreview ? (
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
            
            {/* 预览结果 - 仅管理员可见 */}
            {isAdminUser && retryPreviewData && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-slate-600">API 处理后的请求体</h4>
                {retryPreviewData.error ? (
                  <div className="p-3 bg-red-100 text-red-600 rounded-lg text-sm">
                    {retryPreviewData.error}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 请求体大小 */}
                    {retryPreviewData.requestSize && (
                      <div className="text-xs text-slate-500">
                        请求体大小: <span className="font-medium">{retryPreviewData.requestSize}</span>
                      </div>
                    )}
                    
                    {/* 图片处理信息 */}
                    {retryPreviewData.parts && retryPreviewData.parts.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-medium text-slate-500">图片处理详情</h5>
                        {retryPreviewData.parts.map((part, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded text-xs">
                            {part.type === 'text' && (
                              <span className="text-slate-600">文本内容</span>
                            )}
                            {part.type === 'image' && part.imageInfo && (
                              <div className="space-y-0.5">
                                <div className="text-slate-600">图片 {idx}</div>
                                <div className="text-slate-500">
                                  格式: {part.imageInfo.mimeType || part.imageInfo.originalFormat}
                                  {part.imageInfo.originalSizeKB && (
                                    <span className="ml-2">原始: {part.imageInfo.originalSizeKB}KB</span>
                                  )}
                                  {part.imageInfo.compressedSizeKB && (
                                    <span className="ml-2">处理后: {part.imageInfo.compressedSizeKB}KB</span>
                                  )}
                                </div>
                                {part.imageInfo.url && (
                                  <div className="text-slate-400 truncate">URL: {part.imageInfo.url}</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 原始请求体 */}
                    {retryPreviewData.rawRequestBody && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                          查看完整请求体 JSON
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-100 text-slate-800 rounded-lg text-xs overflow-auto font-mono whitespace-pre-wrap break-all max-h-60">
                          {JSON.stringify(retryPreviewData.rawRequestBody, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={cancelRetryTask} className="w-full sm:w-auto">
              取消
            </Button>
            <Button onClick={confirmRetryTask} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Sparkles className="w-4 h-4 mr-2" />
              确认重试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务详情对话框（参考图和提示词） */}
      <Dialog open={showTaskInfoDialog} onOpenChange={setShowTaskInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              查看任务的参考图和提示词信息
            </DialogDescription>
          </DialogHeader>
          
          {taskInfoDetail && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* 基本信息 */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">类型:</span>
                  <Badge variant="secondary">
                    {getTaskTypeName(taskInfoDetail.type)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">状态:</span>
                  <Badge variant="secondary" className={cn(
                    statusConfig[taskInfoDetail.status].bg,
                    statusConfig[taskInfoDetail.status].color
                  )}>
                    {statusConfig[taskInfoDetail.status].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">创建时间:</span>
                  <span className="text-sm">{formatTime(taskInfoDetail.createdAt)}</span>
                </div>
                {getTaskDuration(taskInfoDetail) !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">耗时:</span>
                    <span className="text-sm">{formatDuration(getTaskDuration(taskInfoDetail)!)}</span>
                  </div>
                )}
              </div>
              
              {/* 提示词 */}
              <div>
                <h4 className="text-sm font-medium mb-2">提示词</h4>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap break-all">
                    {(taskInfoDetail.params as { prompt?: string }).prompt || '无提示词'}
                  </p>
                </div>
              </div>
              
              {/* 参考图 */}
              {'images' in taskInfoDetail.params && Array.isArray(taskInfoDetail.params.images) && taskInfoDetail.params.images.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">参考图 ({taskInfoDetail.params.images.length} 张)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {taskInfoDetail.params.images.map((img: string, idx: number) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={img} 
                          alt={`参考图 ${idx + 1}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 其他参数 */}
              <div>
                <h4 className="text-sm font-medium mb-2">其他参数</h4>
                <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                  {'model' in taskInfoDetail.params && taskInfoDetail.params.model && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">模型:</span>
                      <span>{getConfigNameByModel(taskInfoDetail.params.model, taskInfoDetail.type)}</span>
                    </div>
                  )}
                  {'aspectRatio' in taskInfoDetail.params && taskInfoDetail.params.aspectRatio && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">宽高比:</span>
                      <span>{taskInfoDetail.params.aspectRatio}</span>
                    </div>
                  )}
                  {'resolution' in taskInfoDetail.params && taskInfoDetail.params.resolution && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">分辨率:</span>
                      <span>{taskInfoDetail.params.resolution}</span>
                    </div>
                  )}
                  {'enhancePrompt' in taskInfoDetail.params && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">提示词增强:</span>
                      <span>{taskInfoDetail.params.enhancePrompt ? '是' : '否'}</span>
                    </div>
                  )}
                  {'enableUpsample' in taskInfoDetail.params && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">高清放大:</span>
                      <span>{taskInfoDetail.params.enableUpsample ? '是' : '否'}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 错误信息 */}
              {taskInfoDetail.status === 'failed' && taskInfoDetail.error && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-destructive">错误信息</h4>
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    {taskInfoDetail.error}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskInfoDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空已完成确认对话框 */}
      <AlertDialog open={showClearCompletedDialog} onOpenChange={setShowClearCompletedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空已完成任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空所有已完成的任务吗？共 {stats.success} 个任务将被删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearCompleted}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 清空失败确认对话框 */}
      <AlertDialog open={showClearFailedDialog} onOpenChange={setShowClearFailedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空失败任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空所有失败的任务吗？共 {stats.failed} 个任务将被删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearFailed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
