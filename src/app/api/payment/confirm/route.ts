/**
 * 支付确认 API（演示模式）
 * 实际项目中应该由支付平台回调触发
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getCreditPackages } from '@/lib/credits';
import { randomUUID } from 'crypto';
import { logPaymentError, logInfo } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '订单号不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error: orderError } = await client
      .from('credit_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 验证订单归属
    if (order.user_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: '无权操作此订单' },
        { status: 403 }
      );
    }

    // 检查订单状态
    if (order.payment_status === 'completed') {
      return NextResponse.json({
        success: true,
        message: '订单已完成',
      });
    }

    if (order.payment_status === 'cancelled' || order.payment_status === 'expired') {
      return NextResponse.json(
        { success: false, error: '订单已失效' },
        { status: 400 }
      );
    }

    // 获取套餐信息
    const packages = await getCreditPackages();
    const pkg = packages.find(p => p.id === order.package_id);

    if (!pkg) {
      return NextResponse.json(
        { success: false, error: '套餐不存在' },
        { status: 400 }
      );
    }

    const totalCredits = pkg.credits + pkg.bonusCredits;

    // 获取当前积分
    const { data: currentCredits } = await client
      .from('user_credits')
      .select('*')
      .eq('user_id', auth.userId)
      .single();

    const balanceBefore = currentCredits?.balance || 0;
    const balanceAfter = balanceBefore + totalCredits;

    // 更新订单状态
    const { error: updateOrderError } = await client
      .from('credit_orders')
      .update({
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateOrderError) {
      console.error('[Payment] Update order error:', updateOrderError);
      logPaymentError('更新订单状态', updateOrderError, { orderId, userId: auth.userId });
      return NextResponse.json(
        { success: false, error: '更新订单失败' },
        { status: 500 }
      );
    }

    // 更新用户积分
    const { error: updateCreditsError } = await client
      .from('user_credits')
      .upsert({
        id: currentCredits?.id || `credits_${auth.userId}`,
        user_id: auth.userId,
        balance: balanceAfter,
        total_purchased: (currentCredits?.total_purchased || 0) + totalCredits,
        total_used: currentCredits?.total_used || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateCreditsError) {
      console.error('[Payment] Update credits error:', updateCreditsError);
      logPaymentError('更新用户积分', updateCreditsError, { orderId, userId: auth.userId });
      return NextResponse.json(
        { success: false, error: '更新积分失败' },
        { status: 500 }
      );
    }

    // 记录交易
    await client
      .from('credit_transactions')
      .insert({
        id: `txn_${randomUUID()}`,
        user_id: auth.userId,
        amount: totalCredits,
        type: 'recharge',
        description: `购买${pkg.name}（${pkg.credits}+${pkg.bonusCredits}赠送）`,
      });

    console.log(`[Payment] 用户 ${auth.userId} 订单 ${orderId} 支付完成，获得 ${totalCredits} 积分`);
    
    // 记录支付成功
    logInfo('payment', '支付确认成功', {
      orderId,
      userId: auth.userId,
      packageId: pkg.id,
      packageName: pkg.name,
      credits: totalCredits,
      balanceBefore,
      balanceAfter,
    }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        credits: totalCredits,
        balanceBefore,
        balanceAfter,
      },
    });

  } catch (error) {
    console.error('[Payment] Confirm error:', error);
    logPaymentError('支付确认', error);
    return NextResponse.json(
      { success: false, error: '确认失败' },
      { status: 500 }
    );
  }
}
