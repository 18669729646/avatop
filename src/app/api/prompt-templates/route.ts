import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if ('error' in authResult || !authResult.userId) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const userId = authResult.userId;
    const { searchParams } = new URL(request.url);
    const isSystemParam = searchParams.get('isSystem');

    const supabase = getSupabaseClient();

    // 根据 isSystem 参数过滤
    if (isSystemParam === 'true') {
      // 仅系统模板（is_system = true）
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_system', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data: transformTemplates(data || []) });
    } else if (isSystemParam === 'false') {
      // 仅用户自定义模板（is_system = false 且属于当前用户）
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_system', false)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data: transformTemplates(data || []) });
    } else {
      // 返回系统模板 + 当前用户自定义模板
      const { data: systemData, error: systemError } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_system', true);

      if (systemError) throw systemError;

      const { data: userData, error: userError } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('is_system', false)
        .eq('user_id', userId);

      if (userError) throw userError;

      const allData = [...(systemData || []), ...(userData || [])];
      return NextResponse.json({ data: transformTemplates(allData) });
    }
  } catch (error) {
    console.error('Failed to get templates:', error);
    return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 });
  }
}

// 数据库字段 -> API 响应字段转换
function transformTemplates(templates: Record<string, unknown>[]) {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    type: t.type,
    prompt: t.prompt,
    defaultParams: t.default_params,
    variables: t.variables,
    isSystem: t.is_system,
    isHot: t.is_hot,
    tags: t.tags,
    createdAt: t.created_at ? new Date(t.created_at as string).getTime() : Date.now(),
    updatedAt: t.updated_at ? new Date(t.updated_at as string).getTime() : Date.now(),
  }));
}
