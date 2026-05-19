import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/users/[id]/storage
 * 获取用户存储使用详情
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

    // 获取配额配置
    const quotaResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'user_storage_quota_mb'"
    );
    const quotaMB = quotaResult.rows.length > 0 
      ? parseInt(quotaResult.rows[0].value, 10) || 500 
      : 500;

    // 获取图片存储
    const imageResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(file_size), 0) as total_size
      FROM image_history WHERE user_id = $1
    `, [userId]);

    // 获取视频存储
    const videoResult = await pool.query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(file_size), 0) as total_size
      FROM video_history WHERE user_id = $1
    `, [userId]);

    // 获取角色图库存储（当前表没有 file_size 字段，按 0 统计）
    const characterResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM character_library WHERE user_id = $1
    `, [userId]);

    const imageData = imageResult.rows[0];
    const videoData = videoResult.rows[0];
    const characterData = characterResult.rows[0];

    const imageBytes = parseInt(imageData?.total_size) || 0;
    const videoBytes = parseInt(videoData?.total_size) || 0;
    const characterBytes = 0;
    const totalBytes = imageBytes + videoBytes + characterBytes;
    const totalMB = totalBytes / (1024 * 1024);
    const quotaBytes = quotaMB * 1024 * 1024;

    return NextResponse.json({
      success: true,
      data: {
        quotaMB,
        quotaBytes,
        totalBytes,
        totalMB: Math.round(totalMB * 100) / 100,
        percentUsed: quotaBytes > 0 ? Math.round((totalBytes / quotaBytes) * 10000) / 100 : 0,
        isOverLimit: totalBytes > quotaBytes,
        breakdown: {
          images: {
            count: parseInt(imageData?.count) || 0,
            bytes: imageBytes,
            mb: Math.round((imageBytes / (1024 * 1024)) * 100) / 100,
            percent: totalBytes > 0 ? Math.round((imageBytes / totalBytes) * 100) : 0,
          },
          videos: {
            count: parseInt(videoData?.count) || 0,
            bytes: videoBytes,
            mb: Math.round((videoBytes / (1024 * 1024)) * 100) / 100,
            percent: totalBytes > 0 ? Math.round((videoBytes / totalBytes) * 100) : 0,
          },
          characters: {
            count: parseInt(characterData?.count) || 0,
            bytes: characterBytes,
            mb: Math.round((characterBytes / (1024 * 1024)) * 100) / 100,
            percent: totalBytes > 0 ? Math.round((characterBytes / totalBytes) * 100) : 0,
          },
        },
      },
    });
  } catch (error) {
    console.error('获取用户存储详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户存储详情失败' },
      { status: 500 }
    );
  }
}
