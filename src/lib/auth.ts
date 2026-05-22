/**
 * 认证工具函数
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { randomUUID } from 'crypto';

// JWT 配置
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key-change-in-production';
const JWT_EXPIRES_DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);

// JWT payload 类型
export interface JwtPayload {
  userId: string;
  phone: string;
  role: string;
}

// 用户信息类型（用于返回给前端）
export interface UserInfo {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  credits: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
  createdAt: string;
  lastLoginAt: string | null;
}

// 数据库用户类型
interface DbUser {
  id: string;
  phone: string;
  password_hash: string;
  nickname: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
}

// 数据库积分类型
interface DbUserCredits {
  id: string;
  user_id: string;
  balance: number;
  total_purchased: number;
  total_used: number;
  created_at: string;
  updated_at: string;
}

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JwtPayload): string {
  const expiresIn = JWT_EXPIRES_DAYS * 24 * 60 * 60; // 转换为秒
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 从请求头获取 Token
 */
export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * 创建用户
 */
export async function createUser(phone: string, password: string, nickname?: string) {
  const client = getSupabaseClient();
  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  const bonusCredits = await getNewUserBonusCredits();

  const { error: userError } = await client
    .from('users')
    .insert({
      id: userId,
      phone,
      password_hash: passwordHash,
      nickname: nickname || null,
      role: 'user',
      status: 'active',
    });

  if (userError) {
    throw new Error(`创建用户失败: ${userError.message}`);
  }

  const { error: creditsError } = await client
    .from('user_credits')
    .insert({
      id: `credits_${userId}`,
      user_id: userId,
      balance: bonusCredits,
      total_purchased: bonusCredits,
      total_used: 0,
    });

  if (creditsError) {
    console.error('[Auth] Create credits error:', creditsError);
    await client.from('users').delete().eq('id', userId);
    throw new Error(`创建用户积分账户失败: ${creditsError.message}`);
  }

  const { error: settingsError } = await client
    .from('user_settings')
    .insert({
      user_id: userId,
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
    });

  if (settingsError) {
    console.error('[Auth] Create settings error:', settingsError);
    await client.from('user_credits').delete().eq('user_id', userId);
    await client.from('users').delete().eq('id', userId);
    throw new Error(`创建用户设置失败: ${settingsError.message}`);
  }

  return userId;
}

/**
 * 获取新用户赠送积分
 */
async function getNewUserBonusCredits(): Promise<number> {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('system_settings')
      .select('value')
      .eq('key', 'new_user_bonus_credits')
      .single();
    
    if (error || !data) return 0;
    return parseInt(data.value || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * 根据手机号查找用户
 */
export async function findUserByPhone(phone: string): Promise<DbUser | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('phone', phone)
    .limit(1)
    .single();
  
  if (error || !data) return null;
  return data as DbUser;
}

/**
 * 根据用户ID查找用户
 */
export async function findUserById(userId: string): Promise<DbUser | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .limit(1)
    .single();
  
  if (error || !data) return null;
  return data as DbUser;
}

/**
 * 获取用户完整信息（含积分）
 */
export async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const client = getSupabaseClient();
  
  // 获取用户信息
  const user = await findUserById(userId);
  if (!user) return null;

  // 获取积分信息
  const { data: creditsData, error } = await client
    .from('user_credits')
    .select('balance,total_purchased,total_used')
    .eq('user_id', userId)
    .limit(1)
    .single();

  const credits = creditsData ?? {
    balance: 0,
    total_purchased: 0,
    total_used: 0,
  };

  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[Auth] getUserInfo credits lookup failed:', error);
  }

  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    role: user.role,
    status: user.status,
    credits: {
      balance: credits.balance || 0,
      totalPurchased: credits.total_purchased || 0,
      totalUsed: credits.total_used || 0,
    },
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

/**
 * 更新最后登录时间
 */
export async function updateLastLogin(userId: string) {
  const client = getSupabaseClient();
  
  await client
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * 记录登录日志
 */
export async function logAuthEvent(
  userId: string | null,
  action: 'login' | 'logout' | 'register',
  ipAddress: string | null,
  userAgent: string | null,
  success: boolean,
  failReason?: string
) {
  try {
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('auth_logs')
      .insert({
        id: `log_${randomUUID()}`,
        user_id: userId,
        action,
        ip_address: ipAddress,
        user_agent: userAgent,
        success,
        fail_reason: failReason || null,
      });

    if (error) {
      console.error('[Auth] 记录登录日志失败:', error.message);
    }
  } catch (error) {
    console.error('[Auth] 记录登录日志异常:', error instanceof Error ? error.message : String(error));
  }
}
