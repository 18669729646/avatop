import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

// 日志级别中文名
const levelNames: Record<string, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
};

// 日志分类中文名
const categoryNames: Record<string, string> = {
  api: 'API请求',
  auth: '认证',
  payment: '支付',
  video: '视频处理',
  image: '图片处理',
  task: '任务队列',
  storage: '存储',
  credits: '积分',
  system: '系统',
};

/**
 * GET /api/admin/system-logs
 * 获取系统日志列表
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
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 构建查询条件
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (level && level !== 'all') {
      conditions.push(`level = $${paramIndex++}`);
      params.push(level);
    }

    if (category && category !== 'all') {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (search) {
      conditions.push(`message ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM system_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total) || 0;

    // 查询日志列表
    const offset = (page - 1) * pageSize;
    const logsResult = await pool.query(
      `SELECT * FROM system_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    const logs = logsResult.rows.map(row => ({
      id: row.id,
      level: row.level,
      levelName: levelNames[row.level] || row.level,
      category: row.category,
      categoryName: categoryNames[row.category] || row.category,
      message: row.message,
      detail: row.detail,
      userId: row.user_id,
      requestId: row.request_id,
      stackTrace: row.stack_trace,
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
    console.error('获取系统日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取系统日志失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/system-logs
 * 清理旧日志
 */
export async function DELETE(request: NextRequest) {
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
    const daysToKeep = parseInt(searchParams.get('daysToKeep') || '30', 10);

    const result = await pool.query(
      'DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL \'1 day\' * $1',
      [daysToKeep]
    );

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.rowCount || 0,
      },
    });
  } catch (error) {
    console.error('清理系统日志失败:', error);
    return NextResponse.json(
      { success: false, error: '清理系统日志失败' },
      { status: 500 }
    );
  }
}
