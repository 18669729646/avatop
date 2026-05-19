/**
 * 短信验证码服务
 * 
 * 注意：这是一个简化的实现，生产环境请接入真实的短信服务商
 * 如：阿里云短信、腾讯云短信、云片等
 */

import { randomInt } from 'crypto';

// 验证码存储（生产环境应使用 Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 验证码有效期（5分钟）
const CODE_EXPIRES_MS = 5 * 60 * 1000;

/**
 * 生成验证码
 */
function generateCode(): string {
  return String(randomInt(100000, 999999));
}

/**
 * 发送验证码
 * 
 * 注意：当前为模拟发送，生产环境请接入真实短信服务
 */
export async function sendVerificationCode(phone: string): Promise<{ success: boolean; message: string }> {
  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, message: '手机号格式不正确' };
  }

  // 检查发送频率（1分钟内只能发送一次）
  const existing = verificationCodes.get(phone);
  if (existing && existing.expiresAt > Date.now() + CODE_EXPIRES_MS - 60000) {
    return { success: false, message: '验证码发送过于频繁，请稍后再试' };
  }

  // 生成验证码
  const code = generateCode();
  const expiresAt = Date.now() + CODE_EXPIRES_MS;

  // 存储验证码
  verificationCodes.set(phone, { code, expiresAt });

  // 生产环境：调用短信服务商 API 发送验证码
  // 目前：模拟发送，直接打印到控制台
  console.log(`[SMS] 发送验证码到 ${phone}: ${code}`);

  // 开发环境：返回验证码（方便测试）
  if (process.env.NODE_ENV === 'development') {
    return { 
      success: true, 
      message: `验证码已发送（开发模式：${code}）`,
      // @ts-expect-error 开发模式下返回调试码
      _debugCode: code 
    };
  }

  return { success: true, message: '验证码已发送，请查收短信' };
}

/**
 * 验证验证码
 */
export async function verifyCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  const stored = verificationCodes.get(phone);

  if (!stored) {
    return { success: false, message: '验证码不存在或已过期' };
  }

  if (stored.expiresAt < Date.now()) {
    verificationCodes.delete(phone);
    return { success: false, message: '验证码已过期' };
  }

  if (stored.code !== code) {
    return { success: false, message: '验证码错误' };
  }

  // 验证成功，删除验证码
  verificationCodes.delete(phone);
  return { success: true, message: '验证成功' };
}

/**
 * 清理过期验证码
 */
export function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [phone, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(phone);
    }
  }
}

// 定时清理过期验证码（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredCodes, 5 * 60 * 1000);
}
