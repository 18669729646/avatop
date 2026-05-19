import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { errorResponse } from '@/lib/logger';

// 获取产品图库
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('product_library')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[Product Library API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      url: item.url,
      description: item.description,
      tags: item.tags,
      createdAt: item.created_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse('products', 'GET', error);
  }
}

// 添加产品到图库
export async function POST(request: NextRequest) {
  let productId: string | undefined;
  
  try {
    const body = await request.json();
    const { id, name, url, description, tags } = body;
    
    if (!url || !name) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    productId = id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await client
      .from('product_library')
      .insert({
        id: productId,
        name,
        url,
        description,
        tags: tags || [],
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Product Library API] 添加失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        url: data.url,
        description: data.description,
        tags: data.tags,
        createdAt: data.created_at,
      }
    });
  } catch (error) {
    return errorResponse('products', 'POST', error, undefined, { productId });
  }
}

// 删除产品
export async function DELETE(request: NextRequest) {
  let id: string | undefined;
  
  try {
    const { searchParams } = new URL(request.url);
    id = searchParams.get('id') || undefined;
    
    if (!id) {
      return NextResponse.json({ error: '缺少产品ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('product_library')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('products', 'DELETE', error, undefined, { productId: id });
  }
}
