import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取提示词模板列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const isSystem = searchParams.get('isSystem');
    
    const client = getSupabaseClient();
    
    let query = client
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (category) {
      query = query.eq('category', category);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (isSystem !== null) {
      query = query.eq('is_system', isSystem === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Prompt Templates API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      type: item.type,
      prompt: item.prompt,
      defaultParams: item.default_params,
      variables: item.variables,
      tags: item.tags || [],
      isSystem: item.is_system,
      isHot: item.is_hot,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Prompt Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取提示词模板失败' },
      { status: 500 }
    );
  }
}

// 创建提示词模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, category, type, prompt, defaultParams, variables, tags, isSystem, isHot } = body;
    
    if (!name || !prompt) {
      return NextResponse.json({ error: '名称和提示词不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const templateId = id || `pt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await client
      .from('prompt_templates')
      .insert({
        id: templateId,
        name,
        description,
        category: category || 'custom',
        type: type || 'image',
        prompt,
        default_params: defaultParams,
        variables: variables,
        tags: tags || [],
        is_system: isSystem || false,
        is_hot: isHot || false,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Prompt Templates API] 创建失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        type: data.type,
        prompt: data.prompt,
        defaultParams: data.default_params,
        variables: data.variables,
        tags: data.tags,
        isSystem: data.is_system,
        isHot: data.is_hot,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    console.error('[Prompt Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建提示词模板失败' },
      { status: 500 }
    );
  }
}

// 删除提示词模板
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('prompt_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Prompt Templates API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
