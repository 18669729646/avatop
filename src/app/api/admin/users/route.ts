import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/users
 * 获取用户列表（管理员专用）
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
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 1), 100);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // active, frozen, all

    // 构建查询条件
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.phone LIKE $${paramIndex} OR u.nickname LIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      conditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // 查询用户列表（包含详细数据统计和存储使用量）
    const offset = (page - 1) * pageSize;
    const usersResult = await pool.query(
      `SELECT 
        u.id,
        u.phone,
        u.nickname,
        u.avatar_url,
        u.role,
        u.status,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        uc.balance,
        uc.total_purchased,
        uc.total_used,
        (SELECT COUNT(*) FROM usage_records ur WHERE ur.user_id = u.id) as usage_count,
        (SELECT COUNT(*) FROM image_history ih WHERE ih.user_id = u.id) as image_count,
        (SELECT COUNT(*) FROM video_history vh WHERE vh.user_id = u.id) as video_count,
        (SELECT COUNT(*) FROM character_library cl WHERE cl.user_id = u.id) as character_count,
        (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id) as product_count,
        (SELECT COUNT(*) FROM task_queue tq WHERE tq.user_id = u.id) as task_count,
        (
          SELECT COALESCE(SUM(total_size), 0) FROM (
            SELECT COALESCE(file_size, 0) as total_size FROM image_history WHERE user_id = u.id
            UNION ALL
            SELECT COALESCE(file_size, 0) as total_size FROM video_history WHERE user_id = u.id
            UNION ALL
            SELECT COALESCE(file_size, 0) as total_size FROM character_library WHERE user_id = u.id
          ) combined
        ) as storage_bytes
      FROM users u
      LEFT JOIN user_credits uc ON u.id = uc.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    // 格式化用户数据
    const users = usersResult.rows.map(row => {
      const storageBytes = parseInt(row.storage_bytes) || 0;
      const storageMB = storageBytes / (1024 * 1024);
      return {
        id: row.id,
        phone: row.phone,
        nickname: row.nickname,
        avatarUrl: row.avatar_url,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
        passwordChangedAt: row.password_changed_at,
        credits: {
          balance: row.balance || 0,
          totalPurchased: row.total_purchased || 0,
          totalUsed: row.total_used || 0,
        },
        usageCount: parseInt(row.usage_count, 10) || 0,
        dataStats: {
          images: parseInt(row.image_count, 10) || 0,
          videos: parseInt(row.video_count, 10) || 0,
          characters: parseInt(row.character_count, 10) || 0,
          products: parseInt(row.product_count, 10) || 0,
          tasks: parseInt(row.task_count, 10) || 0,
        },
        storage: {
          bytes: storageBytes,
          mb: Math.round(storageMB * 100) / 100,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}
