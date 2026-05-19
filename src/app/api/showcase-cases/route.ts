import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db-pool';
import { ShowcaseCase } from '@/types/showcase';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// 获取公开案例列表（首页用）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'shortfilm';
    const rawLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    // 只返回已发布的案例
    const query = `
      SELECT id, title, description, type, category,
             thumbnail_url, media_url, media_type,
             model, duration, is_featured, display_order, created_at
      FROM showcase_cases
      WHERE status = 'published' AND type = $1
      ORDER BY display_order ASC, created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [type, limit]);

    const cases: ShowcaseCase[] = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      thumbnailUrl: row.thumbnail_url,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      prompt: null, // 不返回提示词
      model: row.model,
      duration: row.duration,
      isFeatured: row.is_featured,
      displayOrder: row.display_order,
      createdBy: null,
      createdAt: row.created_at,
      updatedAt: row.created_at,
      status: 'published',
    }));

    return NextResponse.json({ success: true, data: cases });
  } catch (error) {
    console.error('[Showcase Cases GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取案例列表失败' },
      { status: 500 }
    );
  }
}
