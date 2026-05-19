import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/stats
 * 获取管理后台统计数据
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
    // 用户统计
    const usersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'frozen') as frozen,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_new
      FROM users
    `);
    const users = usersResult.rows[0];

    // 管理员操作日志统计
    const adminLogsResult = await pool.query(`
      SELECT COUNT(*) as count FROM admin_logs
    `);

    // 系统错误日志统计（需要检查表是否存在）
    let systemErrors = 0;
    let todayErrors = 0;
    try {
      const systemLogsResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today
        FROM system_logs
        WHERE level = 'error'
      `);
      if (systemLogsResult.rows.length > 0) {
        systemErrors = parseInt(systemLogsResult.rows[0].total) || 0;
        todayErrors = parseInt(systemLogsResult.rows[0].today) || 0;
      }
    } catch {
      // 表不存在，返回 0
    }

    // 数据统计
    let imagesResult = { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };
    let videosResult = { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };
    try {
      imagesResult = await pool.query(`
        SELECT COUNT(*) as count FROM image_history
      `) as typeof imagesResult;
    } catch {
      // 保持 0
    }
    try {
      videosResult = await pool.query(`
        SELECT COUNT(*) as count FROM video_history
      `) as typeof videosResult;
    } catch {
      // 保持 0
    }

    // 短片项目统计（兼容不同版本字段）
    let shortfilmResult = { rows: [{ total: '0', has_images: '0', has_videos: '0' }] } as {
      rows: Array<{ total: string; has_images: string; has_videos: string }>;
    };
    try {
      shortfilmResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE generated_images IS NOT NULL AND jsonb_array_length(generated_images) > 0) as has_images,
          COUNT(*) FILTER (WHERE generated_videos IS NOT NULL AND jsonb_array_length(generated_videos) > 0) as has_videos
        FROM shortfilm_projects
      `) as typeof shortfilmResult;
    } catch {
      try {
        shortfilmResult = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE scenes IS NOT NULL AND jsonb_array_length(scenes) > 0) as has_images,
            COUNT(*) FILTER (WHERE merged_videos IS NOT NULL AND jsonb_array_length(merged_videos) > 0) as has_videos
          FROM shortfilm_projects
        `) as typeof shortfilmResult;
      } catch {
        // 保持 0
      }
    }

    // 图库统计
    let characterLibraryResult = { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };
    let productsResult = { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };
    try {
      characterLibraryResult = await pool.query(`
        SELECT COUNT(*) as count FROM character_library
      `) as typeof characterLibraryResult;
    } catch {
      // 保持 0
    }
    try {
      productsResult = await pool.query(`
        SELECT COUNT(*) as count FROM products
      `) as typeof productsResult;
    } catch {
      // 保持 0
    }

    // 任务队列统计
    let taskQueueResult = { rows: [{ total: '0', pending: '0', running: '0', retrying: '0', success: '0', failed: '0' }] } as {
      rows: Array<{ total: string; pending: string; running: string; retrying: string; success: string; failed: string }>;
    };
    try {
      taskQueueResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'running') as running,
          COUNT(*) FILTER (WHERE status = 'retrying') as retrying,
          COUNT(*) FILTER (WHERE status = 'success') as success,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM task_queue
      `) as typeof taskQueueResult;
    } catch {
      try {
        taskQueueResult = await pool.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'processing') as running,
            COUNT(*) FILTER (WHERE status = 'retrying') as retrying,
            COUNT(*) FILTER (WHERE status = 'completed') as success,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM task_queue
        `) as typeof taskQueueResult;
      } catch {
        // 保持 0
      }
    }

    // 积分统计
    let creditsResult = { rows: [{ total_balance: '0', total_purchased: '0', total_used: '0' }] } as {
      rows: Array<{ total_balance: string; total_purchased: string; total_used: string }>;
    };
    try {
      creditsResult = await pool.query(`
        SELECT 
          SUM(balance) as total_balance,
          SUM(total_purchased) as total_purchased,
          SUM(total_used) as total_used
        FROM user_credits
      `) as typeof creditsResult;
    } catch {
      // 保持 0
    }

    // 套餐销售统计
    let packagesResult = { rows: [{ total_sold: '0' }] } as { rows: Array<{ total_sold: string }> };
    try {
      packagesResult = await pool.query(`
        SELECT COUNT(*) as total_sold
        FROM credit_orders
        WHERE payment_status = 'paid'
      `) as typeof packagesResult;
    } catch {
      // 保持 0
    }

    // 模板统计
    let templatesResult = { rows: [{ count: '0' }] } as { rows: Array<{ count: string }> };
    try {
      templatesResult = await pool.query(`
        SELECT COUNT(*) as count FROM shortfilm_templates
      `) as typeof templatesResult;
    } catch {
      // 保持 0
    }

    // 存储使用量（估算）
    let storageUsed = '0 GB';
    try {
      const storageResult = await pool.query(`
        SELECT COALESCE(SUM(size), 0) as total_size 
        FROM (
          SELECT COALESCE(file_size, 0) as size FROM image_history
          UNION ALL
          SELECT COALESCE(file_size, 0) as size FROM video_history
        ) combined
      `);
      const totalBytes = parseInt(storageResult.rows[0]?.total_size) || 0;
      const totalGB = totalBytes / (1024 * 1024 * 1024);
      if (totalGB >= 1) {
        storageUsed = `${totalGB.toFixed(2)} GB`;
      } else if (totalGB > 0) {
        storageUsed = `${(totalGB * 1024).toFixed(0)} MB`;
      }
    } catch {
      // 忽略错误
    }

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: parseInt(users.total) || 0,
          active: parseInt(users.active) || 0,
          frozen: parseInt(users.frozen) || 0,
          todayNew: parseInt(users.today_new) || 0,
        },
        logs: {
          adminActions: parseInt(adminLogsResult.rows[0]?.count) || 0,
          systemErrors,
          todayErrors,
        },
        system: {
          totalImages: parseInt(imagesResult.rows[0]?.count) || 0,
          totalVideos: parseInt(videosResult.rows[0]?.count) || 0,
          storageUsed,
        },
        // 新增统计
        projects: {
          total: parseInt(shortfilmResult.rows[0]?.total) || 0,
          hasImages: parseInt(shortfilmResult.rows[0]?.has_images) || 0,
          hasVideos: parseInt(shortfilmResult.rows[0]?.has_videos) || 0,
        },
        library: {
          characters: parseInt(characterLibraryResult.rows[0]?.count) || 0,
          products: parseInt(productsResult.rows[0]?.count) || 0,
          templates: parseInt(templatesResult.rows[0]?.count) || 0,
        },
        tasks: {
          total: parseInt(taskQueueResult.rows[0]?.total) || 0,
          pending: parseInt(taskQueueResult.rows[0]?.pending) || 0,
          running: parseInt(taskQueueResult.rows[0]?.running) || 0,
          retrying: parseInt(taskQueueResult.rows[0]?.retrying) || 0,
          success: parseInt(taskQueueResult.rows[0]?.success) || 0,
          failed: parseInt(taskQueueResult.rows[0]?.failed) || 0,
        },
        credits: {
          totalBalance: parseInt(creditsResult.rows[0]?.total_balance) || 0,
          totalPurchased: parseInt(creditsResult.rows[0]?.total_purchased) || 0,
          totalUsed: parseInt(creditsResult.rows[0]?.total_used) || 0,
          packagesSold: parseInt(packagesResult.rows[0]?.total_sold) || 0,
        },
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
