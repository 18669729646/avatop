import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

// 操作类型中文名映射
const actionTypeNames: Record<string, string> = {
  'image_generate': '生成图片',
  'video_generate': '生成视频',
  'video_trim': '截取视频',
  'video_concat': '合并视频',
  'storage_upload': '上传存储',
  'script_generate': '生成脚本',
  'shortfilm_image': '短片图片生成',
  'admin_add': '管理员增加积分',
  'admin_deduct': '管理员扣减积分',
  'admin_add_credits': '管理员增加积分',
  'admin_deduct_credits': '管理员扣减积分',
  'create_product': '创建产品',
  'create_character': '创建人物',
  'retry_task': '重试任务',
  'refund_duplicate': '重复扣积分退款',
};

// 资源类型中文名映射
const resourceTypeNames: Record<string, string> = {
  'image': '图片',
  'video': '视频',
  'product': '产品',
  'character': '人物',
  'script': '脚本',
  'task': '任务',
};

/**
 * GET /api/admin/users/[id]/activity
 * 获取用户操作记录（管理员专用）
 * 只查看：登录记录、使用记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 验证管理员权限
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // 检查用户是否存在，并获取最后登录时间
    const userResult = await pool.query(
      'SELECT id, phone, nickname, last_login_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 获取使用记录总数
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM usage_records WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10) + (user.last_login_at ? 1 : 0);

    // 计算分页
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const activities: unknown[] = [];

    // 获取使用记录（分页）
    const usageResult = await pool.query(
      `SELECT 
        id,
        action_type,
        credits_used,
        resource_type,
        resource_id,
        balance_before,
        balance_after,
        created_at
      FROM usage_records
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, pageSize + 1, offset] // +1 是为了处理登录记录可能占一个位置
    );

    // 添加使用记录
    for (const row of usageResult.rows) {
      const actionName = actionTypeNames[row.action_type] || row.action_type || '未知操作';
      const resourceName = resourceTypeNames[row.resource_type] || row.resource_type || '';
      
      activities.push({
        type: 'usage',
        id: row.id,
        actionType: row.action_type,
        actionName,
        resourceType: row.resource_type,
        resourceName,
        resourceId: row.resource_id,
        creditsUsed: row.credits_used,
        balanceBefore: row.balance_before,
        balanceAfter: row.balance_after,
        description: `${actionName}${resourceName ? ` (${resourceName})` : ''}`,
        createdAt: row.created_at,
      });
    }

    // 如果是第一页，添加最后登录记录
    if (page === 1 && user.last_login_at) {
      activities.push({
        type: 'login',
        id: `login_${user.last_login_at}`,
        description: '用户登录',
        createdAt: user.last_login_at,
      });
    }

    // 按时间排序
    activities.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 限制返回数量
    const limitedActivities = activities.slice(0, pageSize);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
        },
        activities: limitedActivities,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('获取用户操作记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户操作记录失败' },
      { status: 500 }
    );
  }
}
