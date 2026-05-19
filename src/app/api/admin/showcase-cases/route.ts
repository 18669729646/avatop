import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/db-pool';
import { ShowcaseCase, GetShowcaseCasesParams } from '@/types/showcase';

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key-change-in-production';

// 验证管理员权限
async function verifyAdmin(request: NextRequest): Promise<{ success: boolean; userId?: string; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: '未登录' };
  }

  const token = authHeader.slice(7);
  let decoded: { userId: string; phone: string; role: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as unknown as typeof decoded;
  } catch {
    return { success: false, error: 'Token 无效或已过期' };
  }

  if (decoded.role !== 'admin') {
    return { success: false, error: '权限不足' };
  }

  return { success: true, userId: decoded.userId };
}

// 获取案例列表（管理员）
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'published';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const isFeatured = searchParams.get('isFeatured');

    let query = `
      SELECT id, title, description, type, category, 
             thumbnail_url, media_url, media_type,
             prompt, model, duration, is_featured, 
             display_order, created_by, created_at, 
             updated_at, status
      FROM showcase_cases
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (isFeatured !== null) {
      query += ` AND is_featured = $${paramIndex}`;
      params.push(isFeatured === 'true');
      paramIndex++;
    }

    query += ` ORDER BY display_order ASC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const cases: ShowcaseCase[] = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      thumbnailUrl: row.thumbnail_url,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      prompt: row.prompt,
      model: row.model,
      duration: row.duration,
      isFeatured: row.is_featured,
      displayOrder: row.display_order,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    }));

    return NextResponse.json({ success: true, data: cases });
  } catch (error) {
    console.error('[Admin Showcase Cases GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取案例列表失败' },
      { status: 500 }
    );
  }
}

// 创建案例
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      type = 'shortfilm',
      category,
      thumbnailUrl,
      mediaUrl,
      mediaType = 'video',
      prompt,
      model,
      duration,
      isFeatured = false,
      displayOrder = 0,
    } = body;

    if (!title || !mediaUrl) {
      return NextResponse.json(
        { success: false, error: '标题和媒体文件不能为空' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO showcase_cases 
        (id, title, description, type, category, thumbnail_url, media_url, media_type, 
         prompt, model, duration, is_featured, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, title, description, type, category, thumbnailUrl, mediaUrl, mediaType,
       prompt, model, duration, isFeatured, displayOrder, auth.userId]
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('[Admin Showcase Cases POST] Error:', error);
    return NextResponse.json(
      { success: false, error: '创建案例失败' },
      { status: 500 }
    );
  }
}

// 更新案例
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '案例 ID 不能为空' },
        { status: 400 }
      );
    }

    // 构建动态更新语句
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: Array<keyof typeof body> = [
      'title', 'description', 'type', 'category', 'thumbnailUrl', 
      'mediaUrl', 'mediaType', 'prompt', 'model', 'duration', 
      'isFeatured', 'displayOrder', 'status'
    ];

    for (const field of fields) {
      if (field in updateData && updateData[field] !== undefined) {
        const dbField = field === 'thumbnailUrl' ? 'thumbnail_url' :
                        field === 'mediaUrl' ? 'media_url' :
                        field === 'mediaType' ? 'media_type' :
                        field === 'isFeatured' ? 'is_featured' :
                        field === 'displayOrder' ? 'display_order' :
                        field as string;
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(updateData[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE showcase_cases SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '案例不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Showcase Cases PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: '更新案例失败' },
      { status: 500 }
    );
  }
}

// 删除案例
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '案例 ID 不能为空' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM showcase_cases WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '案例不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Showcase Cases DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: '删除案例失败' },
      { status: 500 }
    );
  }
}
