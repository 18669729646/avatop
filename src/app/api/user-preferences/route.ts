import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const DEFAULT_PREFERENCES = {
  favoriteTemplates: [],
  recentTemplates: [],
  templateUsageStats: {},
};

// 获取用户偏好
export async function GET() {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('user_preferences')
      .select('*')
      .eq('id', 'default')
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[User Preferences API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      // 返回默认值
      return NextResponse.json({ data: { id: 'default', ...DEFAULT_PREFERENCES } });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        favoriteTemplates: data.favorite_templates || [],
        recentTemplates: data.recent_templates || [],
        templateUsageStats: data.template_usage_stats || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    console.error('[User Preferences API] 获取失败:', error);
    return NextResponse.json({ error: '获取用户偏好失败' }, { status: 500 });
  }
}

// 更新用户偏好
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { favoriteTemplates, recentTemplates, templateUsageStats } = body;
    
    const client = getSupabaseClient();
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (favoriteTemplates !== undefined) updateData.favorite_templates = favoriteTemplates;
    if (recentTemplates !== undefined) updateData.recent_templates = recentTemplates;
    if (templateUsageStats !== undefined) updateData.template_usage_stats = templateUsageStats;
    
    // 使用 upsert，如果不存在则创建
    const { data, error } = await client
      .from('user_preferences')
      .upsert({
        id: 'default',
        ...updateData,
      }, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      console.error('[User Preferences API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      data: {
        id: data.id,
        favoriteTemplates: data.favorite_templates || [],
        recentTemplates: data.recent_templates || [],
        templateUsageStats: data.template_usage_stats || {},
      }
    });
  } catch (error) {
    console.error('[User Preferences API] 更新失败:', error);
    return NextResponse.json({ error: '更新用户偏好失败' }, { status: 500 });
  }
}
