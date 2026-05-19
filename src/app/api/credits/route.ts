/**
 * 积分 API - 获取当前用户积分
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getUserCredits, getUserUsageRecords } from '@/lib/credits';
import { errorResponse } from '@/lib/logger';

export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    // 获取积分信息
    const credits = await getUserCredits(auth.userId);
    
    // 获取最近使用记录
    const usageRecords = await getUserUsageRecords(auth.userId, 20);

    return NextResponse.json({
      success: true,
      data: {
        credits,
        usageRecords,
      },
    });

  } catch (error) {
    return errorResponse('credits', 'GET', error, auth?.success ? auth.userId : undefined);
  }
}
