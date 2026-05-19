/**
 * 系统日志服务
 */

import { randomUUID } from 'crypto';
import { pool } from '@/lib/db-pool';

// 日志级别
export type LogLevel = 'info' | 'warn' | 'error';

// 日志分类
export type LogCategory = 
  | 'api'       // API 请求
  | 'auth'      // 认证相关
  | 'payment'   // 支付相关
  | 'video'     // 视频处理
  | 'image'     // 图片处理
  | 'task'      // 任务队列
  | 'storage'   // 存储操作
  | 'credits'   // 积分操作
  | 'system';   // 系统操作

// 日志详情类型
export interface LogDetail {
  [key: string]: unknown;
}

// 日志记录选项
export interface LogOptions {
  level?: LogLevel;
  category: LogCategory;
  message: string;
  detail?: LogDetail;
  userId?: string;
  requestId?: string;
  stackTrace?: string;
}

/**
 * 写入系统日志
 */
export async function writeSystemLog(options: LogOptions): Promise<void> {
  const {
    level = 'info',
    category,
    message,
    detail,
    userId,
    requestId,
    stackTrace,
  } = options;

  const id = `log_${randomUUID()}`;

  try {
    await pool.query(
      `INSERT INTO system_logs (id, level, category, message, detail, user_id, request_id, stack_trace, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        id,
        level,
        category,
        message,
        detail ? JSON.stringify(detail) : null,
        userId || null,
        requestId || null,
        stackTrace || null,
      ]
    );
  } catch (error) {
    // 日志写入失败不应影响主流程，只打印到控制台
    console.error('[SystemLog] 写入日志失败:', error);
  }
}

/**
 * 快捷方法：记录信息日志
 */
export function logInfo(category: LogCategory, message: string, detail?: LogDetail, userId?: string): Promise<void> {
  return writeSystemLog({ level: 'info', category, message, detail, userId });
}

/**
 * 快捷方法：记录警告日志
 */
export function logWarn(category: LogCategory, message: string, detail?: LogDetail, userId?: string): Promise<void> {
  return writeSystemLog({ level: 'warn', category, message, detail, userId });
}

/**
 * 快捷方法：记录错误日志
 */
export function logError(
  category: LogCategory,
  message: string,
  error?: Error | unknown,
  detail?: LogDetail,
  userId?: string
): Promise<void> {
  let stackTrace: string | undefined;
  let errorDetail = detail || {};

  if (error instanceof Error) {
    stackTrace = error.stack;
    errorDetail = {
      ...errorDetail,
      errorMessage: error.message,
      errorName: error.name,
    };
  } else if (error) {
    errorDetail = {
      ...errorDetail,
      error: String(error),
    };
  }

  return writeSystemLog({
    level: 'error',
    category,
    message,
    detail: errorDetail,
    stackTrace,
    userId,
  });
}

/**
 * 清理旧日志（保留最近N天）
 */
export async function cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
  try {
    const result = await pool.query(
      'DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL \'1 day\' * $1',
      [daysToKeep]
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('[SystemLog] 清理日志失败:', error);
    return 0;
  }
}
