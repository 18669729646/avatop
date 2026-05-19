/**
 * 支付状态查询 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '订单号不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单状态
    const { data: order, error } = await client
      .from('credit_orders')
      .select('id, payment_status, user_id')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 验证订单归属
    if (order.user_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: '无权查看此订单' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      status: order.payment_status,
    });

  } catch (error) {
    console.error('[Payment] Status check error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
