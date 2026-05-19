import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * GET /api/admin/system-logs/stats
 * 获取日志统计数据
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
    const range = searchParams.get('range') || '7d'; // 1d, 7d, 30d

    // 计算时间范围
    const intervals: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
    };
    const days = intervals[range] || 7;

    // 1. 按级别统计（总数）
    const levelStatsResult = await pool.query(`
      SELECT 
        level,
        COUNT(*) as count
      FROM system_logs
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY level
      ORDER BY level
    `, [days]);

    const levelStats = {
      info: 0,
      warn: 0,
      error: 0,
    };
    levelStatsResult.rows.forEach(row => {
      const level = row.level as 'info' | 'warn' | 'error';
      levelStats[level] = parseInt(row.count) || 0;
    });

    // 2. 按分类统计（错误日志）
    const categoryStatsResult = await pool.query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM system_logs
      WHERE level = 'error'
        AND created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY category
      ORDER BY count DESC
    `, [days]);

    const categoryStats = categoryStatsResult.rows.map(row => ({
      category: row.category,
      count: parseInt(row.count) || 0,
    }));

    // 3. 按时间统计（趋势数据）
    const timeStatsResult = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        level,
        COUNT(*) as count
      FROM system_logs
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY DATE_TRUNC('hour', created_at), level
      ORDER BY hour ASC, level
    `, [days]);

    // 整理趋势数据
    const trendData = new Map<string, Record<string, number>>();
    timeStatsResult.rows.forEach(row => {
      const hour = new Date(row.hour).toISOString().slice(0, 13) + ':00';
      if (!trendData.has(hour)) {
        trendData.set(hour, { info: 0, warn: 0, error: 0 });
      }
      const data = trendData.get(hour)!;
      data[row.level] = (data[row.level] || 0) + parseInt(row.count);
    });

    // 补充缺失的小时数据
    const trendArray = [];
    const now = new Date();
    for (let i = Math.min(days * 24, 24) - 1; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - i);
      hour.setMinutes(0);
      hour.setSeconds(0);
      hour.setMilliseconds(0);
      const hourKey = hour.toISOString().slice(0, 13) + ':00';
      trendArray.push({
        time: hourKey,
        ...trendData.get(hourKey) || { info: 0, warn: 0, error: 0 },
      });
    }

    // 4. 热门错误（按消息统计）
    const topErrorsResult = await pool.query(`
      SELECT 
        message,
        COUNT(*) as count,
        MAX(created_at) as last_seen
      FROM system_logs
      WHERE level = 'error'
        AND created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY message
      ORDER BY count DESC
      LIMIT 10
    `, [days]);

    const topErrors = topErrorsResult.rows.map(row => ({
      message: row.message,
      count: parseInt(row.count) || 0,
      lastSeen: row.last_seen,
    }));

    // 5. 用户错误统计
    const userErrorsResult = await pool.query(`
      SELECT 
        user_id,
        COUNT(*) as count
      FROM system_logs
      WHERE level = 'error'
        AND user_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `, [days]);

    const userErrors = userErrorsResult.rows.map(row => ({
      userId: row.user_id,
      count: parseInt(row.count) || 0,
    }));

    // 6. 总体统计
    const totalResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE level = 'error') as errors,
        COUNT(*) FILTER (WHERE level = 'warn') as warnings,
        COUNT(*) FILTER (WHERE level = 'info') as infos,
        COUNT(DISTINCT user_id) as unique_users
      FROM system_logs
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
    `, [days]);

    const total = totalResult.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        range,
        days,
        levelStats,
        categoryStats,
        trendData: trendArray,
        topErrors,
        userErrors,
        total: {
          totalLogs: parseInt(total.total) || 0,
          errorCount: parseInt(total.errors) || 0,
          warnCount: parseInt(total.warnings) || 0,
          infoCount: parseInt(total.infos) || 0,
          uniqueUsers: parseInt(total.unique_users) || 0,
        },
      },
    });
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取日志统计失败' },
      { status: 500 }
    );
  }
}
