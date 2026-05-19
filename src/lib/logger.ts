/**
 * 判断错误是否是由模型问题引起的
 * 模型问题包括：API 限流、模型不可用、参数错误等
 * 
 * @param error 错误对象
 * @returns 是否是模型问题
 */
export function isModelError(error: Error | unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // 模型问题关键词
  const modelErrorKeywords = [
    'model not found',
    'model unavailable',
    'model error',
    '模型不可用',
    '模型错误',
    'rate limit',
    'quota',
    'limit exceeded',
    'api rate limit',
    'api quota',
    '429',
    'invalid parameter',
    '无效参数',
    '参数错误',
    'service unavailable',
    'content policy',
    '内容政策',
    'safety',
    'filtered',
    'moderation',
  ];
  
  return modelErrorKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * 统一日志记录工具
 * 非侵入式日志记录，不影响主流程
 */

import { NextResponse } from 'next/server';
import { logError as logSystemError, logInfo as logSystemInfo, logWarn as logSystemWarn, type LogDetail } from './system-log';

/**
 * 非阻塞记录错误日志
 * 不会影响主流程，日志记录失败也不会抛出异常
 */
export function logError(
  category: 'api' | 'auth' | 'payment' | 'video' | 'image' | 'task' | 'storage' | 'credits' | 'system',
  message: string,
  error?: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  // 保持 console.error 不变，作为备选方案
  console.error(`[${category.toUpperCase()}] ${message}`, error || '', detail || '');

  // 异步记录到数据库，不阻塞主流程
  Promise.resolve().then(async () => {
    try {
      await logSystemError(category, message, error, detail, userId);
    } catch (logError) {
      // 日志记录失败不应影响主流程，静默处理
      console.error('[Logger] 记录错误日志失败:', logError);
    }
  }).catch(() => {
    // 忽略所有错误
  });
}

/**
 * 非阻塞记录信息日志
 */
export function logInfo(
  category: 'api' | 'auth' | 'payment' | 'video' | 'image' | 'task' | 'storage' | 'credits' | 'system',
  message: string,
  detail?: LogDetail,
  userId?: string
): void {
  // 保持 console.log 不变
  console.log(`[${category.toUpperCase()}] ${message}`, detail || '');

  // 异步记录到数据库
  Promise.resolve().then(async () => {
    try {
      await logSystemInfo(category, message, detail, userId);
    } catch (logError) {
      console.error('[Logger] 记录信息日志失败:', logError);
    }
  }).catch(() => {});
}

/**
 * 非阻塞记录警告日志
 */
export function logWarn(
  category: 'api' | 'auth' | 'payment' | 'video' | 'image' | 'task' | 'storage' | 'credits' | 'system',
  message: string,
  detail?: LogDetail,
  userId?: string
): void {
  // 保持 console.warn 不变
  console.warn(`[${category.toUpperCase()}] ${message}`, detail || '');

  // 异步记录到数据库
  Promise.resolve().then(async () => {
    try {
      await logSystemWarn(category, message, detail, userId);
    } catch (logError) {
      console.error('[Logger] 记录警告日志失败:', logError);
    }
  }).catch(() => {});
}

/**
 * 记录 API 请求错误（便捷方法）
 */
export function logApiError(
  apiName: string,
  operation: string,
  error: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  logError(
    'api',
    `${apiName} - ${operation}失败`,
    error,
    {
      apiName,
      operation,
      ...detail,
    },
    userId
  );
}

/**
 * 记录支付错误（便捷方法）
 */
export function logPaymentError(
  operation: string,
  error: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  logError(
    'payment',
    `支付${operation}失败`,
    error,
    {
      operation,
      ...detail,
    },
    userId
  );
}

/**
 * 记录任务错误（便捷方法）
 * 如果是模型问题，记录为信息日志而不是错误日志
 */
export function logTaskError(
  taskId: string,
  operation: string,
  error: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  // 判断是否是模型问题
  if (isModelError(error)) {
    // 模型问题记录为信息日志
    logInfo(
      'task',
      `任务 ${taskId} - ${operation}失败（模型问题）`,
      {
        taskId,
        operation,
        error: error instanceof Error ? error.message : String(error),
        ...detail,
      },
      userId
    );
  } else {
    // 其他问题记录为错误日志
    logError(
      'task',
      `任务 ${taskId} - ${operation}失败`,
      error,
      {
        taskId,
        operation,
        ...detail,
      },
      userId
    );
  }
}

/**
 * 记录认证错误（便捷方法）
 */
export function logAuthError(
  operation: string,
  error: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  logError(
    'auth',
    `认证${operation}失败`,
    error,
    {
      operation,
      ...detail,
    },
    userId
  );
}

/**
 * 记录存储错误（便捷方法）
 */
export function logStorageError(
  operation: string,
  error: Error | unknown,
  detail?: LogDetail,
  userId?: string
): void {
  logError(
    'storage',
    `存储${operation}失败`,
    error,
    {
      operation,
      ...detail,
    },
    userId
  );
}

/**
 * 处理 API 异常并记录日志（通用方法）
 * 用于简化 catch 块中的错误处理
 * 
 * @param apiName API 名称
 * @param operation 操作名称（如 GET、POST、DELETE 等）
 * @param error 错误对象
 * @param userId 用户 ID（可选）
 * @param extra 额外信息（可选）
 * @returns 包含 success: false 的错误响应
 */
export function handleApiException(
  apiName: string,
  operation: string,
  error: Error | unknown,
  userId?: string,
  extra?: LogDetail
): {
  success: false;
  error: string;
} {
  // 记录到系统日志和控制台
  logApiError(apiName, operation, error, extra, userId);
  
  // 返回错误对象
  return {
    success: false,
    error: error instanceof Error ? error.message : '操作失败',
  };
}

/**
 * 生成 NextResponse 错误响应（便捷方法）
 * 
 * @param apiName API 名称
 * @param operation 操作名称
 * @param error 错误对象
 * @param userId 用户 ID（可选）
 * @param extra 额外信息（可选）
 * @param httpStatus HTTP 状态码（默认 500）
 * @returns NextResponse 错误响应
 */
export function errorResponse(
  apiName: string,
  operation: string,
  error: Error | unknown,
  userId?: string,
  extra?: LogDetail,
  httpStatus: number = 500
): NextResponse {
  // 记录日志
  handleApiException(apiName, operation, error, userId, extra);
  
  // 返回响应
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : '操作失败',
    },
    { status: httpStatus }
  );
}
