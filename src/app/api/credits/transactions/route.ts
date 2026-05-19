/**
 * 积分交易记录 API
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

    const client = getSupabaseClient();

    // 获取积分交易记录
    const { data, error } = await client
      .from('credit_transactions')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Credits] Get transactions error:', error);
      return NextResponse.json({ success: true, data: [] });
    }

    const transactions = (data || []).map(item => ({
      id: item.id,
      amount: item.amount,
      type: item.type,
      description: item.description,
      createdAt: item.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: transactions,
    });

  } catch (error) {
    console.error('[Credits] Get transactions error:', error);
    return NextResponse.json(
      { success: false, error: '获取交易记录失败' },
      { status: 500 }
    );
  }
}
