import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';

const actionTypeNames: Record<string, string> = {
  image_generate: '生成图片',
  video_generate: '生成视频',
  video_trim: '剪辑视频',
  video_concat: '合并视频',
  storage_upload: '上传存储',
  script_generate: '生成短片剧本',
  shortfilm_image: '短片图片生成',
  video_analysis_master: '视频分析大师',
  video_seedance2_480p: 'Seedance 2.0 480p（每秒）',
  video_seedance2_720p: 'Seedance 2.0 720p（每秒）',
  video_seedance2_1080p: 'Seedance 2.0 1080p（每秒）',
  video_seedance2_fast_480p: 'Seedance 2.0 Fast 480p（每秒）',
  video_seedance2_fast_720p: 'Seedance 2.0 Fast 720p（每秒）',
  analysis_master_script_remake: '分析大师脚本复刻',
};

/**
 * GET /api/admin/credit-prices
 * 获取所有积分价格配置 */
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
    console.error('获取积分配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取积分配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/credit-prices
 * 批量更新积分价格配置
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
        { success: false, error: '参数格式错误' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const item of prices) {
        const { actionType, creditsRequired } = item;
        
        // 验证参数
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

      // 记录操作日志
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
    console.error('更新积分配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新积分配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credit-prices
 * 添加新的积分价格配置
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
        { success: false, error: '参数格式错误' },
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

    // 记录操作日志
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
    console.error('添加积分配置失败:', error);
    return NextResponse.json(
      { success: false, error: '添加积分配置失败' },
      { status: 500 }
    );
  }
}
