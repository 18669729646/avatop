import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';
import { errorResponse } from '@/lib/logger';

// 获取产品列表（用户数据隔离，管理员可查看所有）
export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // 判断用户是否为管理员
    const isUserAdmin = auth.payload.role === 'admin';
    
    // 使用 PostgreSQL 直接查询，支持 JOIN 获取用户信息
    let sqlQuery = `
      SELECT 
        p.*,
        u.phone as user_phone,
        u.nickname as user_nickname
      FROM products p
      LEFT JOIN users u ON p.user_id = u.id
    `;
    
    // 构建总数查询
    let countQuery = `
      SELECT COUNT(*) as total
      FROM products p
    `;
    
    const params: (string | number)[] = [];
    let paramIndex = 1;
    
    // 普通用户只能查看自己的产品
    if (!isUserAdmin) {
      sqlQuery += ` WHERE p.user_id = $${paramIndex}`;
      countQuery += ` WHERE p.user_id = $${paramIndex}`;
      params.push(auth.userId);
      paramIndex++;
    }
    
    // 先查询总数
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    
    // 添加排序和分页
    sqlQuery += ` ORDER BY p.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);
    
    const queryResult = await pool.query(sqlQuery, params);
    const data = queryResult.rows;
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      sellingPoints: item.selling_points || [],
      targetAudience: item.target_audience,
      usageScenarios: item.usage_scenarios,
      brandInfo: item.brand_info,
      priceRange: item.price_range,
      keywords: item.keywords || [],
      images: item.images || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      // 用户信息（管理员视图时显示）
      userId: item.user_id,
      userPhone: item.user_phone,
      userNickname: item.user_nickname,
    }));
    
    return NextResponse.json({ 
      data: result,
      isAdmin: isUserAdmin,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return errorResponse('products/manage', 'GET', error, auth?.success ? auth.userId : undefined);
  }
}

// 创建产品（关联用户）
export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let productId: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { id, name, description, sellingPoints, targetAudience, usageScenarios, brandInfo, priceRange, keywords, images } = body;
    
    if (!name) {
      return NextResponse.json({ error: '产品名称不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const productId = id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 插入时关联用户
    const { data, error } = await client
      .from('products')
      .insert({
        id: productId,
        user_id: auth.userId,
        name,
        description: description || '',
        selling_points: sellingPoints || [],
        target_audience: targetAudience,
        usage_scenarios: usageScenarios,
        brand_info: brandInfo,
        price_range: priceRange,
        keywords: keywords || [],
        images: images || [],
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Products API] 创建失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        sellingPoints: data.selling_points,
        targetAudience: data.target_audience,
        usageScenarios: data.usage_scenarios,
        brandInfo: data.brand_info,
        priceRange: data.price_range,
        keywords: data.keywords,
        images: data.images,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    return errorResponse('products/manage', 'POST', error, auth?.success ? auth.userId : undefined, { productId });
  }
}

// 删除产品（只能删除自己的）
export async function DELETE(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少产品ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 只能删除自己的产品
    const { error } = await client
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('products/manage', 'DELETE', error, auth?.success ? auth.userId : undefined, { productId: id });
  }
}
