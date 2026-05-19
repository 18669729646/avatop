/**
 * 积分套餐 API - 获取套餐列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCreditPackages, getAllCreditPrices } from '@/lib/credits';

export async function GET(request: NextRequest) {
  try {
    // 获取积分套餐列表
    const packages = await getCreditPackages();
    
    // 获取积分价格配置
    const prices = await getAllCreditPrices();

    return NextResponse.json({
      success: true,
      data: {
        packages,
        prices,
      },
    });

  } catch (error) {
    console.error('[Credits] Get packages error:', error);
    return NextResponse.json(
      { success: false, error: '获取套餐列表失败' },
      { status: 500 }
    );
  }
}
