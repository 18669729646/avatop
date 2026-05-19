/**
 * 积分购买 API
 * 创建待支付订单，跳转到支付页面
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCreditPackages } from '@/lib/credits';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { success: false, error: '请选择套餐' },
        { status: 400 }
      );
    }

    // 获取套餐信息
    const packages = await getCreditPackages();
    const pkg = packages.find(p => p.id === packageId);

    if (!pkg) {
      return NextResponse.json(
        { success: false, error: '套餐不存在' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const totalCredits = pkg.credits + pkg.bonusCredits;

    // 创建订单记录（待支付状态）
    const orderId = `order_${Date.now()}_${randomUUID().slice(0, 8)}`;
    
    const { error: orderError } = await client
      .from('credit_orders')
      .insert({
        id: orderId,
        user_id: auth.userId,
        package_id: pkg.id,
        credits: totalCredits,
        amount: pkg.price,
        payment_method: 'wechat', // 微信支付
        payment_status: 'pending', // 待支付
      });

    if (orderError) {
      console.error('[Credits] Create order error:', orderError);
      return NextResponse.json(
        { success: false, error: '创建订单失败' },
        { status: 500 }
      );
    }

    console.log(`[Credits] 用户 ${auth.userId} 创建订单 ${orderId}，套餐 ${pkg.name}，金额 ${pkg.price} 元`);

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        packageId: pkg.id,
        packageName: pkg.name,
        credits: totalCredits,
        amount: pkg.price,
      },
    });

  } catch (error) {
    console.error('[Credits] Purchase error:', error);
    return NextResponse.json(
      { success: false, error: '创建订单失败，请稍后重试' },
      { status: 500 }
    );
  }
}
