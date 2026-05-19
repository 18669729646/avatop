import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { logAdminAction } from '@/lib/admin-log';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/storage-config
 * 获取存储配置
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
    // 获取用户存储配额
    const quotaResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'user_storage_quota_mb'"
    );
    const userQuotaMB = quotaResult.rows.length > 0 
      ? parseInt(quotaResult.rows[0].value, 10) || 500 
      : 500;

    // 计算全站存储使用量
    const storageResult = await pool.query(`
      SELECT COALESCE(SUM(total_size), 0) as total_size FROM (
        SELECT COALESCE(SUM(file_size), 0) as total_size FROM image_history
        UNION ALL
        SELECT COALESCE(SUM(file_size), 0) as total_size FROM video_history
        UNION ALL
        SELECT COALESCE(SUM(file_size), 0) as total_size FROM character_library
      ) combined
    `);
    const totalStorageBytes = parseInt(storageResult.rows[0]?.total_size) || 0;
    const totalStorageMB = totalStorageBytes / (1024 * 1024);
    const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

    // 统计用户数量
    const usersResult = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users
      FROM users
    `);

    return NextResponse.json({
      success: true,
      data: {
        userQuotaMB,
        totalStorage: {
          bytes: totalStorageBytes,
          mb: Math.round(totalStorageMB * 100) / 100,
          gb: Math.round(totalStorageGB * 100) / 100,
        },
        users: {
          total: parseInt(usersResult.rows[0]?.total_users) || 0,
          active: parseInt(usersResult.rows[0]?.active_users) || 0,
        },
      },
    });
  } catch (error) {
    console.error('获取存储配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取存储配置失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/storage-config
 * 更新存储配置
 */
export async function PUT(request: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { userQuotaMB } = body;

    // 验证参数
    if (!userQuotaMB || typeof userQuotaMB !== 'number' || userQuotaMB < 10 || userQuotaMB > 10240) {
      return NextResponse.json(
        { success: false, error: '配额必须在 10MB - 10240MB 之间' },
        { status: 400 }
      );
    }

    // 更新配置
    await pool.query(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ('user_storage_quota_mb', $1, '用户存储空间配额（MB）', NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [userQuotaMB.toString()]
    );

    // 记录操作日志
    await logAdminAction({
      adminId: authResult.userId,
      actionType: 'system_settings',
      actionName: 'update_storage_config',
      detail: {
        userQuotaMB,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      data: { userQuotaMB },
    });
  } catch (error) {
    console.error('更新存储配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新存储配置失败' },
      { status: 500 }
    );
  }
}
