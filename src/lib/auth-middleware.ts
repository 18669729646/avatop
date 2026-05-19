/**
 * 认证中间件 - 用于保护需要登录的 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getTokenFromHeader, 
  verifyToken, 
  getUserInfo,
  JwtPayload 
} from '@/lib/auth';

// 内部服务器调用的 header 名称
export const INTERNAL_AUTH_HEADER = 'x-internal-auth';
export const INTERNAL_AUTH_USER_ID = 'x-internal-user-id';

// 认证结果类型
export interface AuthResult {
  success: true;
  userId: string;
  payload: JwtPayload;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

/**
 * 验证请求中的 Token，返回用户信息
 * 用于 API 路由中验证用户身份
 * 
 * 支持两种认证方式：
 * 1. Bearer Token（前端调用）
 * 2. 内部服务器调用（通过 x-internal-auth header）
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  // 检查是否是内部服务器调用
  const internalAuth = request.headers.get(INTERNAL_AUTH_HEADER);
  const internalUserId = request.headers.get(INTERNAL_AUTH_USER_ID);
  
  if (internalAuth === 'true' && internalUserId) {
    // 内部服务器调用，验证用户状态
    const userInfo = await getUserInfo(internalUserId);
    if (!userInfo) {
      return {
        success: false,
        error: '用户不存在',
        status: 404,
      };
    }

    if (userInfo.status !== 'active') {
      return {
        success: false,
        error: '账号已被停用',
        status: 403,
      };
    }

    // 返回一个简化的 payload
    return {
      success: true,
      userId: internalUserId,
      payload: {
        userId: internalUserId,
        phone: userInfo.phone,
        role: userInfo.role,
      },
    };
  }
  
  // 获取 Token
  const authHeader = request.headers.get('authorization');
  const token = getTokenFromHeader(authHeader);

  if (!token) {
    return {
      success: false,
      error: '未登录',
      status: 401,
    };
  }

  // 验证 Token
  const payload = verifyToken(token);
  if (!payload) {
    return {
      success: false,
      error: '登录已过期，请重新登录',
      status: 401,
    };
  }

  // 验证用户状态
  const userInfo = await getUserInfo(payload.userId);
  if (!userInfo) {
    return {
      success: false,
      error: '用户不存在',
      status: 404,
    };
  }

  if (userInfo.status !== 'active') {
    return {
      success: false,
      error: '账号已被停用',
      status: 403,
    };
  }

  return {
    success: true,
    userId: payload.userId,
    payload,
  };
}

/**
 * 验证认证（authenticateRequest 的别名）
 */
export const verifyAuth = authenticateRequest;

/**
 * 认证失败响应
 */
export function unauthorizedResponse(error: string, status: number = 401): NextResponse {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

/**
 * 检查是否为管理员
 */
export async function checkAdmin(request: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return false;
  return auth.payload.role === 'admin';
}

/**
 * 管理员权限检查
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return auth;
  
  if (auth.payload.role !== 'admin') {
    return {
      success: false,
      error: '需要管理员权限',
      status: 403,
    };
  }
  
  return auth;
}
