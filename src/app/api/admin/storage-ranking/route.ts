import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/storage-ranking
 * 获取存储使用排行
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
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 查询每个用户的存储使用量
    const result = await pool.query(`
      WITH user_storage AS (
        SELECT 
          user_id,
          COALESCE(SUM(file_size), 0) as total_size
        FROM (
          SELECT user_id, COALESCE(file_size, 0) as file_size FROM image_history
          UNION ALL
          SELECT user_id, COALESCE(file_size, 0) as file_size FROM video_history
          UNION ALL
          SELECT user_id, 0 as file_size FROM character_library
        ) combined
        GROUP BY user_id
      )
      SELECT 
        u.id,
        u.phone,
        u.nickname,
        u.status,
        COALESCE(us.total_size, 0) as storage_bytes,
        COALESCE(us.total_size, 0) / 1024.0 / 1024.0 as storage_mb
      FROM users u
      LEFT JOIN user_storage us ON u.id = us.user_id
      ORDER BY us.total_size DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    // 计算总存储
    const totalResult = await pool.query(`
      SELECT COALESCE(SUM(total_size), 0) as total FROM (
        SELECT COALESCE(SUM(file_size), 0) as total_size FROM image_history
        UNION ALL
        SELECT COALESCE(SUM(file_size), 0) as total_size FROM video_history
        UNION ALL
        SELECT 0 as total_size FROM character_library LIMIT 1
      ) combined
    `);
    const totalBytes = parseInt(totalResult.rows[0]?.total) || 0;

    const users = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      phone: row.phone,
      nickname: row.nickname,
      status: row.status,
      storageBytes: parseInt(row.storage_bytes) || 0,
      storageMB: Math.round((parseFloat(row.storage_mb) || 0) * 100) / 100,
      percentOfTotal: totalBytes > 0 
        ? Math.round((parseInt(row.storage_bytes) / totalBytes) * 10000) / 100 
        : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        users,
        totalBytes,
        totalMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
        totalGB: Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('获取存储排行失败:', error);
    return NextResponse.json(
      { success: false, error: '获取存储排行失败' },
      { status: 500 }
    );
  }
}
