import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';

const actionTypeNames: Record<string, string> = {
  image_generate: '鐢熸垚鍥剧墖',
  video_generate: '鐢熸垚瑙嗛',
  video_trim: '鎴彇瑙嗛',
  video_concat: '鍚堝苟瑙嗛',
  storage_upload: '涓婁紶瀛樺偍',
  script_generate: '鐢熸垚鐭墖鑴氭湰',
  shortfilm_image: '鐭墖鍥剧墖鐢熸垚',
  video_analysis_master: '视频分析大师',
  video_seedance2_480p: 'Seedance 2.0 480p（每秒）',
  video_seedance2_720p: 'Seedance 2.0 720p（每秒）',
  video_seedance2_1080p: 'Seedance 2.0 1080p（每秒）',
  video_seedance2_fast_480p: 'Seedance 2.0 Fast 480p（每秒）',
  video_seedance2_fast_720p: 'Seedance 2.0 Fast 720p（每秒）',
};

/**
 * GET /api/admin/credit-prices
 * 鑾峰彇鎵€鏈夌Н鍒嗕环鏍奸厤缃? */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const result = await pool.query(
      'SELECT * FROM system_credit_prices ORDER BY action_type'
    );

    const prices = result.rows.map(row => ({
      id: row.id,
      actionType: row.action_type,
      actionTypeName: actionTypeNames[row.action_type] || row.action_type,
      creditsRequired: row.credits_required,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: { prices },
    });
  } catch (error) {
    console.error('鑾峰彇绉垎閰嶇疆澶辫触:', error);
    return NextResponse.json(
      { success: false, error: '鑾峰彇绉垎閰嶇疆澶辫触' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/credit-prices
 * 鎵归噺鏇存柊绉垎浠锋牸閰嶇疆
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { prices } = body;

    if (!Array.isArray(prices)) {
      return NextResponse.json(
        { success: false, error: '鍙傛暟鏍煎紡閿欒' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const item of prices) {
        const { actionType, creditsRequired } = item;
        
        // 楠岃瘉鍙傛暟
        if (!actionType || typeof creditsRequired !== 'number' || creditsRequired < 0) {
          continue;
        }

        await client.query(
          `UPDATE system_credit_prices 
           SET credits_required = $1, updated_at = NOW()
           WHERE action_type = $2`,
          [creditsRequired, actionType]
        );
      }

      await client.query('COMMIT');

      // 璁板綍鎿嶄綔鏃ュ織
      await logAdminAction({
        adminId: authResult.userId,
        actionType: 'system_config',
        actionName: 'update_credit_prices',
        detail: {
          updatedCount: prices.length,
          prices: prices.map(p => ({
            actionType: p.actionType,
            creditsRequired: p.creditsRequired,
          })),
        },
        request,
      });

      return NextResponse.json({
        success: true,
        message: '配置已更新',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('鏇存柊绉垎閰嶇疆澶辫触:', error);
    return NextResponse.json(
      { success: false, error: '鏇存柊绉垎閰嶇疆澶辫触' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credit-prices
 * 娣诲姞鏂扮殑绉垎浠锋牸閰嶇疆
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { actionType, creditsRequired, description } = body;

    if (!actionType || typeof creditsRequired !== 'number' || creditsRequired < 0) {
      return NextResponse.json(
        { success: false, error: '鍙傛暟鏍煎紡閿欒' },
        { status: 400 }
      );
    }

    const id = `price_${Date.now()}`;
    
    await pool.query(
      `INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (action_type) DO UPDATE SET credits_required = $3, updated_at = NOW()`,
      [id, actionType, creditsRequired, description || '']
    );

    // 璁板綍鎿嶄綔鏃ュ織
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_config',
      actionName: 'create_credit_price',
      detail: {
        actionType,
        creditsRequired,
        description,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: '配置已添加',
    });
  } catch (error) {
    console.error('娣诲姞绉垎閰嶇疆澶辫触:', error);
    return NextResponse.json(
      { success: false, error: '娣诲姞绉垎閰嶇疆澶辫触' },
      { status: 500 }
    );
  }
}
