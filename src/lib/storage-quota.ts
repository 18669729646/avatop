/**
 * 存储配额检查服务
 */

import { pool } from '@/lib/db-pool';

// 默认配额（MB）
const DEFAULT_QUOTA_MB = 500;

// 存储检查结果
export interface StorageCheckResult {
  allowed: boolean;
  usedBytes: number;
  quotaBytes: number;
  usedMB: number;
  quotaMB: number;
  percentUsed: number;
  error?: string;
}

/**
 * 获取用户存储配额（MB）
 * 从系统配置中读取，管理员可调整
 */
export async function getUserStorageQuota(): Promise<number> {
  try {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'user_storage_quota_mb'"
    );
    if (result.rows.length > 0) {
      const quota = parseInt(result.rows[0].value, 10);
      if (!isNaN(quota) && quota > 0) {
        return quota;
      }
    }
  } catch (error) {
    console.error('[StorageQuota] 获取配额配置失败:', error);
  }
  return DEFAULT_QUOTA_MB;
}

/**
 * 计算用户已使用的存储空间（字节）
 */
export async function getUserStorageUsed(userId: string): Promise<number> {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(file_size), 0) as total FROM (
        SELECT COALESCE(file_size, 0) as file_size FROM image_history WHERE user_id = $1
        UNION ALL
        SELECT COALESCE(file_size, 0) as file_size FROM video_history WHERE user_id = $1
        UNION ALL
        SELECT COALESCE(file_size, 0) as file_size FROM character_library WHERE user_id = $1
        UNION ALL
        SELECT COALESCE(file_size, 0) as file_size FROM analysis_master_projects WHERE user_id = $1
      ) combined
    `, [userId]);

    return parseInt(result.rows[0].total) || 0;
  } catch (error) {
    console.error('[StorageQuota] 计算存储使用量失败:', error);
    return 0;
  }
}

/**
 * 检查用户存储空间是否足够
 * @param userId 用户ID
 * @param additionalBytes 预计新增的存储量（可选，用于预检查）
 */
export async function checkStorageQuota(
  userId: string,
  additionalBytes: number = 0
): Promise<StorageCheckResult> {
  const quotaMB = await getUserStorageQuota();
  const quotaBytes = quotaMB * 1024 * 1024;
  const usedBytes = await getUserStorageUsed(userId);
  const totalNeeded = usedBytes + additionalBytes;

  const usedMB = usedBytes / (1024 * 1024);
  const percentUsed = (usedBytes / quotaBytes) * 100;

  if (totalNeeded > quotaBytes) {
    return {
      allowed: false,
      usedBytes,
      quotaBytes,
      usedMB: Math.round(usedMB * 100) / 100,
      quotaMB,
      percentUsed: Math.round(percentUsed * 100) / 100,
      error: formatQuotaExceededMessage(usedMB, quotaMB, percentUsed),
    };
  }

  return {
    allowed: true,
    usedBytes,
    quotaBytes,
    usedMB: Math.round(usedMB * 100) / 100,
    quotaMB,
    percentUsed: Math.round(percentUsed * 100) / 100,
  };
}

/**
 * 格式化存储超限提示信息
 */
function formatQuotaExceededMessage(usedMB: number, quotaMB: number, percentUsed: number): string {
  const remainingMB = Math.max(0, quotaMB - usedMB);

  // 根据使用情况给出不同提示
  if (percentUsed >= 100) {
    return `您的存储空间已用完，无法继续生成新内容。\n\n当前使用：${usedMB.toFixed(1)}MB / ${quotaMB}MB（${percentUsed.toFixed(0)}%）\n\n建议操作：\n1. 前往「短片管理」页面，删除不需要的短片项目\n2. 前往「任务队列」页面，清理已完成的任务\n3. 前往「我的数据」页面，清理历史记录\n\n清理完成后即可继续生成内容。`;
  } else if (percentUsed >= 95) {
    return `存储空间即将用尽，建议先清理部分数据。\n\n当前使用：${usedMB.toFixed(1)}MB / ${quotaMB}MB（${percentUsed.toFixed(0)}%）\n剩余空间：${remainingMB.toFixed(1)}MB\n\n建议操作：\n1. 前往「短片管理」删除不需要的短片\n2. 前往「任务队列」清理已完成的任务\n\n清理完成后即可继续生成内容。`;
  } else {
    return `存储空间不足，无法生成新内容。\n\n当前使用：${usedMB.toFixed(1)}MB / ${quotaMB}MB（${percentUsed.toFixed(0)}%）\n剩余空间：${remainingMB.toFixed(1)}MB\n\n建议操作：\n前往「短片管理」或「任务队列」页面，清理部分历史数据后再试。`;
  }
}

/**
 * 格式化存储使用信息（用于显示）
 */
export function formatStorageInfo(result: StorageCheckResult): string {
  return `已用 ${result.usedMB.toFixed(1)}MB / ${result.quotaMB}MB（${result.percentUsed.toFixed(0)}%）`;
}

/**
 * 获取存储状态（用于前端显示）
 */
export async function getStorageStatus(userId: string): Promise<{
  usedMB: number;
  quotaMB: number;
  percentUsed: number;
  isNearLimit: boolean; // 接近限制（>80%）
  isFull: boolean;      // 已满（>=100%）
}> {
  const result = await checkStorageQuota(userId);
  return {
    usedMB: result.usedMB,
    quotaMB: result.quotaMB,
    percentUsed: result.percentUsed,
    isNearLimit: result.percentUsed >= 80,
    isFull: result.percentUsed >= 100,
  };
}
