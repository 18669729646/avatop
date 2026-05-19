/**
 * 登录安全工具
 * 实现登录失败次数限制，防止暴力破解
 */

// 登录失败记录
interface LoginFailRecord {
  count: number;
  firstFailAt: number;
  lockUntil: number | null;
}

// 内存存储（单实例部署适用）
// 如果是多实例部署，应该使用 Redis
const loginFailCache = new Map<string, LoginFailRecord>();

// 配置
const MAX_FAIL_COUNT = 5; // 最大失败次数
const LOCK_DURATION = 15 * 60 * 1000; // 锁定时长：15分钟
const FAIL_WINDOW = 15 * 60 * 1000; // 失败计数窗口：15分钟

// 定期清理过期记录（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginFailCache.entries()) {
      // 清理已解锁且超过窗口期的记录
      if (record.lockUntil && record.lockUntil < now) {
        loginFailCache.delete(key);
      } else if (record.firstFailAt + FAIL_WINDOW < now) {
        loginFailCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * 获取登录失败记录
 */
export function getLoginFailRecord(identifier: string): LoginFailRecord | null {
  const record = loginFailCache.get(identifier);
  if (!record) return null;
  
  // 检查是否已过期
  const now = Date.now();
  if (record.lockUntil && record.lockUntil < now) {
    // 锁定已过期，清除记录
    loginFailCache.delete(identifier);
    return null;
  }
  
  if (record.firstFailAt + FAIL_WINDOW < now) {
    // 失败窗口已过，清除记录
    loginFailCache.delete(identifier);
    return null;
  }
  
  return record;
}

/**
 * 检查账号是否被锁定
 */
export function isAccountLocked(identifier: string): { locked: boolean; remainingTime?: number } {
  const record = getLoginFailRecord(identifier);
  if (!record || !record.lockUntil) {
    return { locked: false };
  }
  
  const now = Date.now();
  if (record.lockUntil > now) {
    const remainingTime = Math.ceil((record.lockUntil - now) / 1000); // 秒
    return { locked: true, remainingTime };
  }
  
  return { locked: false };
}

/**
 * 记录登录失败
 */
export function recordLoginFail(identifier: string): { 
  count: number; 
  locked: boolean;
  remainingTime?: number;
} {
  const now = Date.now();
  let record = loginFailCache.get(identifier);
  
  if (!record || record.firstFailAt + FAIL_WINDOW < now) {
    // 新的失败记录
    record = {
      count: 1,
      firstFailAt: now,
      lockUntil: null,
    };
  } else {
    // 增加失败次数
    record.count += 1;
    
    // 检查是否需要锁定
    if (record.count >= MAX_FAIL_COUNT && !record.lockUntil) {
      record.lockUntil = now + LOCK_DURATION;
    }
  }
  
  loginFailCache.set(identifier, record);
  
  return {
    count: record.count,
    locked: !!record.lockUntil,
    remainingTime: record.lockUntil ? Math.ceil((record.lockUntil - now) / 1000) : undefined,
  };
}

/**
 * 清除登录失败记录（登录成功时调用）
 */
export function clearLoginFailRecord(identifier: string): void {
  loginFailCache.delete(identifier);
}

/**
 * 获取剩余尝试次数
 */
export function getRemainingAttempts(identifier: string): number {
  const record = getLoginFailRecord(identifier);
  if (!record) return MAX_FAIL_COUNT;
  return Math.max(0, MAX_FAIL_COUNT - record.count);
}

/**
 * 获取锁定状态的友好提示信息
 */
export function getLockMessage(identifier: string): string | null {
  const { locked, remainingTime } = isAccountLocked(identifier);
  if (!locked) return null;
  
  if (remainingTime) {
    const minutes = Math.ceil(remainingTime / 60);
    return `账号已被锁定，请 ${minutes} 分钟后重试`;
  }
  
  return '账号已被锁定，请稍后重试';
}
