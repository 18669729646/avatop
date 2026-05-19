import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/data/stats
 * 获取数据统计
 * - 普通用户：返回自己的数据统计
 * - 管理员：返回全站数据统计
 */
export async function GET(request: NextRequest) {
  // 验证用户身份
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  const userId = authResult.userId;
  const isAdmin = authResult.payload.role === 'admin';

  try {
    if (isAdmin) {
      // 管理员：返回全站统计
      const stats = await getGlobalStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    } else {
      // 普通用户：返回个人统计
      const stats = await getUserStats(userId);
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }
  } catch (error) {
    console.error('获取数据统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据统计失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取单个用户的数据统计
 */
async function getUserStats(userId: string) {
  const client = await pool.connect();
  
  try {
    // 统计图片历史
    const imageResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM image_history WHERE user_id = $1',
      [userId]
    );

    // 统计视频历史
    const videoResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM video_history WHERE user_id = $1',
      [userId]
    );

    // 统计角色图库
    const characterResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM character_library WHERE user_id = $1',
      [userId]
    );

    // 统计产品图库
    const productResult = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE user_id = $1',
      [userId]
    );

    // 产品图片大小需要从 images JSON 中计算
    const productImagesResult = await client.query(
      'SELECT images FROM products WHERE user_id = $1 AND images IS NOT NULL',
      [userId]
    );

    let productImagesSize = 0;
    productImagesResult.rows.forEach(row => {
      const images = row.images;
      if (Array.isArray(images)) {
        images.forEach((img: { fileSize?: number }) => {
          productImagesSize += img.fileSize || 0;
        });
      }
    });

    const imageCount = parseInt(imageResult.rows[0]?.count || '0', 10);
    const videoCount = parseInt(videoResult.rows[0]?.count || '0', 10);
    const characterCount = parseInt(characterResult.rows[0]?.count || '0', 10);
    const productCount = parseInt(productResult.rows[0]?.count || '0', 10);

    const totalSize =
      parseInt(imageResult.rows[0]?.size || '0', 10) +
      parseInt(videoResult.rows[0]?.size || '0', 10) +
      parseInt(characterResult.rows[0]?.size || '0', 10) +
      productImagesSize;

    return {
      imageHistory: imageCount,
      videoHistory: videoCount,
      characterLibrary: characterCount,
      productLibrary: productCount,
      totalSize,
    };
  } finally {
    client.release();
  }
}

/**
 * 获取全站数据统计（管理员专用）
 */
async function getGlobalStats() {
  const client = await pool.connect();
  
  try {
    // 统计图片历史
    const imageResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM image_history'
    );

    // 统计视频历史
    const videoResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM video_history'
    );

    // 统计角色图库
    const characterResult = await client.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM character_library'
    );

    // 统计产品图库
    const productResult = await client.query(
      'SELECT COUNT(*) as count FROM products'
    );

    // 产品图片大小
    const productImagesResult = await client.query(
      'SELECT images FROM products WHERE images IS NOT NULL'
    );

    let productImagesSize = 0;
    productImagesResult.rows.forEach(row => {
      const images = row.images;
      if (Array.isArray(images)) {
        images.forEach((img: { fileSize?: number }) => {
          productImagesSize += img.fileSize || 0;
        });
      }
    });

    // 统计用户数
    const usersResult = await client.query(
      'SELECT COUNT(*) as count FROM users'
    );

    // 统计使用记录
    const usageResult = await client.query(
      'SELECT COUNT(*) as count FROM usage_records'
    );

    const imageCount = parseInt(imageResult.rows[0]?.count || '0', 10);
    const videoCount = parseInt(videoResult.rows[0]?.count || '0', 10);
    const characterCount = parseInt(characterResult.rows[0]?.count || '0', 10);
    const productCount = parseInt(productResult.rows[0]?.count || '0', 10);

    const totalSize =
      parseInt(imageResult.rows[0]?.size || '0', 10) +
      parseInt(videoResult.rows[0]?.size || '0', 10) +
      parseInt(characterResult.rows[0]?.size || '0', 10) +
      productImagesSize;

    return {
      imageHistory: imageCount,
      videoHistory: videoCount,
      characterLibrary: characterCount,
      productLibrary: productCount,
      totalSize,
      totalUsers: parseInt(usersResult.rows[0]?.count || '0', 10),
      totalUsageRecords: parseInt(usageResult.rows[0]?.count || '0', 10),
    };
  } finally {
    client.release();
  }
}
