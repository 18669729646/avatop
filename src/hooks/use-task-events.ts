'use client';

import { useEffect, useCallback, useRef } from 'react';
import { TaskEventData } from '@/lib/task-events';

// 重新导出 TaskEventData 以便其他文件使用
export type { TaskEventData };

// SSE 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// 事件回调类型
type TaskEventCallback = (data: TaskEventData) => void;

// 开发环境日志
const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

// 全局 SSE 连接（单例模式）
let globalEventSource: EventSource | null = null;
let globalConnectionStatus: ConnectionStatus = 'disconnected';
let connectionEstablished = false; // 标记连接是否曾经成功建立
let mountCount = 0; // 跟踪挂载的组件数量
let closeTimer: NodeJS.Timeout | null = null; // 延迟关闭连接的定时器
const listeners = new Set<TaskEventCallback>();
const statusListeners = new Set<(status: ConnectionStatus) => void>();
let reconnectTimer: NodeJS.Timeout | null = null;

// 重连配置
const RECONNECT_CONFIG = {
  maxAttempts: 10,          // 最大重连次数
  baseDelay: 1000,          // 基础延迟（毫秒）
  maxDelay: 30000,          // 最大延迟（毫秒）
  backoffFactor: 2,         // 退避因子
};
let reconnectAttempts = 0;  // 当前重连次数

/**
 * 计算重连延迟（指数退避）
 */
function calculateReconnectDelay(): number {
  const delay = Math.min(
    RECONNECT_CONFIG.baseDelay * Math.pow(RECONNECT_CONFIG.backoffFactor, reconnectAttempts),
    RECONNECT_CONFIG.maxDelay
  );
  // 添加随机抖动（±10%）避免多个客户端同时重连
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * 获取或创建全局 SSE 连接
 */
function getOrCreateEventSource(): EventSource | null {
  if (typeof window === 'undefined') return null;
  
  if (globalEventSource) {
    devLog('[SSE] 复用现有连接, readyState:', globalEventSource.readyState);
    return globalEventSource;
  }

  // 重置连接状态
  connectionEstablished = false;
  devLog('[SSE] 创建新的 EventSource 连接...');

  try {
    globalConnectionStatus = 'connecting';
    notifyStatusListeners();

    const eventSource = new EventSource('/api/tasks/events');
    
    eventSource.onopen = () => {
      devLog('[SSE] 连接成功建立');
      globalConnectionStatus = 'connected';
      connectionEstablished = true; // 标记连接成功建立
      resetReconnectAttempts();     // 重置重连计数
      notifyStatusListeners();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TaskEventData;
        devLog('[SSE] 收到消息:', data.type || 'event', data.taskId || '');
        
        // 忽略心跳和连接消息
        if (data.type === 'connected' as unknown) {
          devLog('[SSE] 连接确认消息已收到');
          return;
        }
        
        // 通知所有监听器
        devLog('[SSE] 通知监听器, 当前监听器数量:', listeners.size);
        listeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error('[SSE] 监听器执行错误:', error);
          }
        });
      } catch (error) {
        console.error('[SSE] 解析消息失败:', error);
      }
    };

    eventSource.onerror = () => {
      const readyState = eventSource.readyState;
      devLog('[SSE] onerror 触发, readyState:', readyState, 'connectionEstablished:', connectionEstablished);
      
      // readyState === 2 (CLOSED) 表示连接已彻底关闭，EventSource 不会自动重连
      if (readyState === EventSource.CLOSED) {
        console.warn('[SSE] 连接已关闭，准备重连');
        globalConnectionStatus = 'error';
        connectionEstablished = false;
        notifyStatusListeners();
        
        // 关闭旧连接
        eventSource.close();
        globalEventSource = null;
        
        // 指数退避重连
        scheduleReconnect();
        return;
      }
      
      // readyState === 0 (CONNECTING) 且之前已建立过连接
      // 说明连接被异常关闭后 EventSource 在自动重连
      // 关闭自动重连，改用我们的指数退避重连逻辑，避免无限快速重连
      if (readyState === EventSource.CONNECTING && connectionEstablished) {
        devLog('[SSE] 连接异常中断，关闭自动重连，改用指数退避');
        eventSource.close();
        globalEventSource = null;
        connectionEstablished = false;
        globalConnectionStatus = 'error';
        notifyStatusListeners();
        scheduleReconnect();
        return;
      }
      
      // readyState === 0 (CONNECTING) 且从未建立过连接
      // 说明是首次连接失败，让 EventSource 自动重连
      devLog('[SSE] 首次连接失败，等待 EventSource 自动重连');
    };

    globalEventSource = eventSource;
    return eventSource;
  } catch (error) {
    console.error('[SSE] 创建连接失败:', error);
    globalConnectionStatus = 'error';
    notifyStatusListeners();
    return null;
  }
}

/**
 * 调度重连（指数退避）
 */
function scheduleReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  // 检查是否超过最大重连次数
  if (reconnectAttempts >= RECONNECT_CONFIG.maxAttempts) {
    console.error(`[SSE] 已达到最大重连次数 (${RECONNECT_CONFIG.maxAttempts})，停止重连`);
    globalConnectionStatus = 'error';
    notifyStatusListeners();
    return;
  }

  const delay = calculateReconnectDelay();
  reconnectAttempts++;
  
  console.log(`[SSE] 将在 ${delay}ms 后进行第 ${reconnectAttempts} 次重连`);

  reconnectTimer = setTimeout(() => {
    closeEventSource();
    getOrCreateEventSource();
  }, delay);
}

/**
 * 重置重连计数（连接成功后调用）
 */
function resetReconnectAttempts(): void {
  reconnectAttempts = 0;
}

/**
 * 关闭 SSE 连接
 */
function closeEventSource(): void {
  if (globalEventSource) {
    globalEventSource.close();
    globalEventSource = null;
  }
  globalConnectionStatus = 'disconnected';
  connectionEstablished = false;
  notifyStatusListeners();
}

/**
 * 通知状态监听器
 */
function notifyStatusListeners(): void {
  statusListeners.forEach(listener => {
    try {
      listener(globalConnectionStatus);
    } catch (error) {
      console.error('[SSE] 状态监听器执行错误:', error);
    }
  });
}

/**
 * 订阅任务事件
 */
export function useTaskEvents(
  onTaskUpdate: TaskEventCallback,
  options?: {
    enabled?: boolean;
    onConnectionStatusChange?: (status: ConnectionStatus) => void;
  }
): {
  connectionStatus: ConnectionStatus;
  reconnect: () => void;
  disconnect: () => void;
} {
  const { enabled = true, onConnectionStatusChange } = options || {};
  const onTaskUpdateRef = useRef(onTaskUpdate);
  const onStatusChangeRef = useRef(onConnectionStatusChange);

  // 更新回调引用
  useEffect(() => {
    onTaskUpdateRef.current = onTaskUpdate;
    onStatusChangeRef.current = onConnectionStatusChange;
  }, [onTaskUpdate, onConnectionStatusChange]);

  // 包装回调以确保使用最新引用
  const wrappedCallback = useCallback((data: TaskEventData) => {
    onTaskUpdateRef.current?.(data);
  }, []);

  const wrappedStatusCallback = useCallback((status: ConnectionStatus) => {
    onStatusChangeRef.current?.(status);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 取消任何待处理的关闭操作
    if (closeTimer) {
      devLog('[SSE] 取消待处理的关闭定时器');
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    // 增加挂载计数
    mountCount++;
    devLog('[SSE] useEffect 执行, mountCount:', mountCount, 'enabled:', enabled);

    // 添加监听器
    listeners.add(wrappedCallback);
    if (onConnectionStatusChange) {
      statusListeners.add(wrappedStatusCallback);
    }
    devLog('[SSE] 添加监听器, 当前监听器数量:', listeners.size);

    // 延迟创建连接，避免干扰页面导航和 RSC payload 获取
    const initTimer = setTimeout(() => {
      // 创建连接（如果还没有连接）
      getOrCreateEventSource();
    }, 500); // 延迟 500ms

    // 清理函数：只在组件真正卸载时执行
    return () => {
      clearTimeout(initTimer);
      devLog('[SSE] useEffect 清理函数执行');
      // 减少挂载计数
      mountCount--;

      // 移除监听器
      listeners.delete(wrappedCallback);
      statusListeners.delete(wrappedStatusCallback);
      devLog('[SSE] 移除监听器, 剩余监听器数量:', listeners.size, 'mountCount:', mountCount);

      // 延迟关闭连接，避免页面导航和 React 严格模式导致频繁断开重连
      // 使用较长的延迟（5秒），确保新页面有足够时间挂载并注册监听器
      if (mountCount === 0 && globalEventSource) {
        devLog('[SSE] 设置延迟关闭定时器 (5s)');
        closeTimer = setTimeout(() => {
          devLog('[SSE] 延迟关闭定时器触发, mountCount:', mountCount);
          if (mountCount === 0 && globalEventSource) {
            if (reconnectTimer) {
              clearTimeout(reconnectTimer);
              reconnectTimer = null;
            }
            closeEventSource();
          }
          closeTimer = null;
        }, 5000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // 只在 enabled 变化时重新执行

  // 手动重连
  const reconnect = useCallback(() => {
    closeEventSource();
    getOrCreateEventSource();
  }, []);

  // 手动断开
  const disconnect = useCallback(() => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    closeEventSource();
  }, []);

  return {
    connectionStatus: globalConnectionStatus,
    reconnect,
    disconnect,
  };
}

/**
 * 订阅特定任务的状态更新
 */
export function useTaskStatus(
  taskId: string | null,
  onStatusChange: (data: TaskEventData) => void,
  options?: { enabled?: boolean }
): ConnectionStatus {
  const filteredCallback = useCallback(
    (data: TaskEventData) => {
      if (taskId && data.taskId === taskId) {
        onStatusChange(data);
      }
    },
    [taskId, onStatusChange]
  );

  const { connectionStatus } = useTaskEvents(filteredCallback, options);

  return connectionStatus;
}
