/**
 * 单个套餐管理 API
 * DELETE: 删除套餐
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';

/**
 * DELETE /api/admin/credit-packages/[id]
 * 删除套餐
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { id: packageId } = await params;

    // 检查是否有订单使用该套餐
    const ordersResult = await pool.query(
      'SELECT COUNT(*) as count FROM credit_orders WHERE package_id = $1',
      [packageId]
    );

    const orderCount = parseInt(ordersResult.rows[0]?.count || '0');

    if (orderCount > 0) {
      // 有订单使用，只禁用不删除
      await pool.query(
        'UPDATE credit_packages SET is_active = false, updated_at = NOW() WHERE id = $1',
        [packageId]
      );

      await logAdminAction({
        adminId: authResult.userId,
        actionType: 'system_config',
        actionName: 'deactivate_credit_package',
        targetId: packageId,
        detail: { reason: 'has_orders', orderCount },
        request,
      });

      return NextResponse.json({
        success: true,
        message: `该套餐有 ${orderCount} 个关联订单，已禁用而非删除`,
        action: 'deactivated',
      });
    }

    // 无订单使用，直接删除
    await pool.query('DELETE FROM credit_packages WHERE id = $1', [packageId]);

    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_config',
      actionName: 'delete_credit_package',
      targetId: packageId,
      request,
    });

    return NextResponse.json({
      success: true,
      message: '套餐已删除',
      action: 'deleted',
    });
  } catch (error) {
    console.error('[Admin] 删除套餐失败:', error);
    return NextResponse.json(
      { success: false, error: '删除套餐失败' },
      { status: 500 }
    );
  }
}
