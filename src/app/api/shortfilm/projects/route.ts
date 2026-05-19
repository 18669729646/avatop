import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';

// 获取短片项目列表（用户数据隔离）
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const sourceType = searchParams.get('sourceType');
    
    const client = getSupabaseClient();
    
    let query = client
      .from('shortfilm_projects')
      .select('*')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Shortfilm Projects API] 查询失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      sourceType: item.source_type || 'original',
      sourceVideoKey: item.source_video_key,
      sourceVideoUrl: item.source_video_key ? null : item.source_video_url,
      videoDuration: item.video_duration,
      productId: item.product_id,
      productName: item.product_name,
      productImages: item.product_images || [],
      productDescription: item.product_description,
      scriptPrompt: item.script_prompt,
      totalDuration: item.total_duration,
      scriptSegments: item.script_segments || [],
      imageTasks: item.image_tasks || [],
      videoTasks: item.video_tasks || [],
      mergedVideos: item.merged_videos || [],
      selectedCharacters: item.selected_characters || [],
      currentStep: item.current_step,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Shortfilm Projects API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取短片项目失败' },
      { status: 500 }
    );
  }
}

// 创建短片项目（关联用户）
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { id, name, productId, productName, productImages, productDescription, scriptPrompt, totalDuration, sourceType, sourceVideoKey, sourceVideoUrl, videoDuration } = body;
    
    if (!name) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const projectId = id || `sf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const insertData: Record<string, unknown> = {
      id: projectId,
      user_id: auth.userId,
      name,
      source_type: sourceType || 'original',
      product_id: productId,
      product_name: productName,
      product_images: productImages || [],
      product_description: productDescription,
      script_prompt: scriptPrompt,
      total_duration: totalDuration || 0,
      script_segments: [],
      image_tasks: [],
      video_tasks: [],
      merged_videos: [],
      current_step: 1,
      status: 'draft',
    };

    if (sourceVideoKey) insertData.source_video_key = sourceVideoKey;
    if (sourceVideoUrl) insertData.source_video_url = sourceVideoUrl;
    if (videoDuration) insertData.video_duration = videoDuration;

    const { data, error } = await client
      .from('shortfilm_projects')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('[Shortfilm Projects API] 创建失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        sourceType: data.source_type || 'original',
        sourceVideoKey: data.source_video_key,
        sourceVideoUrl: data.source_video_url,
        videoDuration: data.video_duration,
        productId: data.product_id,
        productName: data.product_name,
        productImages: data.product_images,
        productDescription: data.product_description,
        scriptPrompt: data.script_prompt,
        totalDuration: data.total_duration,
        scriptSegments: data.script_segments,
        imageTasks: data.image_tasks,
        videoTasks: data.video_tasks,
        mergedVideos: data.merged_videos,
        selectedCharacters: data.selected_characters || [],
        currentStep: data.current_step,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    console.error('[Shortfilm Projects API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建短片项目失败' },
      { status: 500 }
    );
  }
}

// 删除项目（只能删除自己的）
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const cleanup = searchParams.get('cleanup'); // 清理空项目
    
    const client = getSupabaseClient();
    
    if (cleanup === 'empty') {
      // 删除当前用户的所有空的未命名短片
      const { error } = await client
        .from('shortfilm_projects')
        .delete()
        .eq('user_id', auth.userId)
        .eq('name', '未命名短片')
        .eq('product_description', '')
        .eq('script_prompt', '')
        .eq('status', 'draft');
      
      if (error) {
        console.error('[Shortfilm Projects API] 清理空项目失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: '已清理空项目' });
    }
    
    if (id) {
      // 删除单个项目（只能删除自己的）
      const { error } = await client
        .from('shortfilm_projects')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // 清空当前用户的所有项目
      const { error } = await client
        .from('shortfilm_projects')
        .delete()
        .eq('user_id', auth.userId);
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Shortfilm Projects API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
