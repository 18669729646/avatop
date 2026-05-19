/**
 * 视频复刻大师 - 项目 CRUD API
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';

// 获取项目列表
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const userId = auth.userId;
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: '获取项目列表失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logApiError('remake-pro/projects', 'GET', error, undefined, userId);
    return NextResponse.json({ success: false, error: '获取项目列表失败' }, { status: 500 });
  }
}

// 创建项目
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const userId = auth.userId;
  const body = await request.json();
  const { name, sourceType, sourceUrl, sourceVideoKey, videoDuration, fileSize, fileName } = body;

  if (!sourceType) {
    return NextResponse.json({ success: false, error: '请选择视频来源' }, { status: 400 });
  }

  const projectId = `rp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const segmentCount = videoDuration ? Math.ceil(videoDuration / 15) : 1;

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('remake_pro_projects')
      .insert({
        id: projectId,
        user_id: userId,
        name: name || '未命名项目',
        source_type: sourceType,
        source_url: sourceUrl || null,
        source_video_key: sourceVideoKey || null,
        video_duration: videoDuration || 0,
        file_size: fileSize || null,
        file_name: fileName || null,
        segment_count: segmentCount,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) {
      console.error('[RemakePro] 创建项目失败:', error);
      return NextResponse.json({ success: false, error: '创建项目失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logApiError('remake-pro/projects', 'POST', error, undefined, userId);
    return NextResponse.json({ success: false, error: '创建项目失败' }, { status: 500 });
  }
}
