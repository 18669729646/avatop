import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/logs
 * 获取管理员操作日志（管理员专用）
 */
export async function GET(request: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const actionType = searchParams.get('actionType') || '';
    const adminId = searchParams.get('adminId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    // 构建查询条件
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (actionType) {
      conditions.push(`al.action_type = $${paramIndex}`);
      params.push(actionType);
      paramIndex++;
    }

    if (adminId) {
      conditions.push(`al.admin_id = $${paramIndex}`);
      params.push(adminId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`al.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`al.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM admin_logs al ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // 查询日志列表
    const offset = (page - 1) * pageSize;
    const logsResult = await pool.query(
      `SELECT 
        al.id,
        al.admin_id,
        al.action_type,
        al.action_name,
        al.target_id,
        al.target_info,
        al.detail,
        al.ip_address,
        al.created_at,
        u.nickname as admin_nickname,
        u.phone as admin_phone
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    // 格式化日志数据
    const logs = logsResult.rows.map(row => ({
      id: row.id,
      adminId: row.admin_id,
      adminNickname: row.admin_nickname,
      adminPhone: row.admin_phone,
      actionType: row.action_type,
      actionName: row.action_name,
      targetId: row.target_id,
      targetInfo: row.target_info,
      detail: row.detail,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取操作日志失败' },
      { status: 500 }
    );
  }
}
