import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';

/**
 * PUT /api/admin/users/[id]/status
 * 冻结或解冻用户（管理员专用）
 */
export async function PUT(
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
    const body = await request.json();
    const { status, reason } = body;

    // 验证状态值
    if (!['active', 'frozen'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '状态值无效，只能是 active 或 frozen' },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const userResult = await pool.query(
      'SELECT id, phone, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 不能冻结自己
    if (user.id === authResult.userId) {
      return NextResponse.json(
        { success: false, error: '不能冻结自己的账户' },
        { status: 400 }
      );
    }

    // 不能冻结其他管理员（可选，根据业务需求）
    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, error: '不能冻结管理员账户' },
        { status: 400 }
      );
    }

    // 更新用户状态
    await pool.query(
      `UPDATE users 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, userId]
    );

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'user_manage',
      actionName: status === 'frozen' ? 'freeze' : 'unfreeze',
      targetId: userId,
      targetInfo: `${user.nickname || ''} (${user.phone})`,
      detail: {
        before: { status: status === 'frozen' ? 'active' : 'frozen' },
        after: { status },
        reason: reason || undefined,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: status === 'frozen' ? '用户已冻结' : '用户已解冻',
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    return NextResponse.json(
      { success: false, error: '更新用户状态失败' },
      { status: 500 }
    );
  }
}
