import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';

// 获取短片模板列表（用户数据隔离 + 系统模板）
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isSystem = searchParams.get('isSystem');
    
    const client = getSupabaseClient();
    
    // 查询用户的模板 + 系统模板
    let query = client
      .from('shortfilm_templates')
      .select('*')
      .or(`user_id.eq.${auth.userId},is_system.eq.true`)
      .order('created_at', { ascending: false });
    
    if (category) {
      query = query.eq('category', category);
    }
    if (isSystem !== null) {
      query = query.eq('is_system', isSystem === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Shortfilm Templates API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      duration: item.duration,
      promptTemplate: item.prompt_template,
      tags: item.tags || [],
      isSystem: item.is_system,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Shortfilm Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取短片模板失败' },
      { status: 500 }
    );
  }
}

// 创建短片模板（关联用户）
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { id, name, description, category, duration, promptTemplate, tags, isSystem } = body;
    
    if (!name || !promptTemplate) {
      return NextResponse.json({ error: '名称和模板内容不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const templateId = id || `sft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 插入时关联用户（普通用户创建的都是非系统模板）
    const { data, error } = await client
      .from('shortfilm_templates')
      .insert({
        id: templateId,
        user_id: auth.userId,
        name,
        description,
        category: category || 'custom',
        duration: duration || 0,
        prompt_template: promptTemplate,
        tags: tags || [],
        is_system: false, // 用户创建的模板不是系统模板
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Shortfilm Templates API] 创建失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        duration: data.duration,
        promptTemplate: data.prompt_template,
        tags: data.tags,
        isSystem: data.is_system,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    console.error('[Shortfilm Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建短片模板失败' },
      { status: 500 }
    );
  }
}

// 删除短片模板（只能删除自己的非系统模板）
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 只能删除自己的非系统模板
    const { error } = await client
      .from('shortfilm_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId)
      .eq('is_system', false);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Shortfilm Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
