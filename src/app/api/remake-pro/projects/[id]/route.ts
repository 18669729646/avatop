/**
 * 视频复刻大师 - 单个项目操作 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import { s3Storage } from '@/lib/s3-client';

// 获取单个项目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = auth.userId;
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    // 刷新预签名 URL
    if (data.source_video_key) {
      data.source_video_url = await s3Storage.generatePresignedUrl({
        key: data.source_video_key,
        expireTime: 3600,
      });
    }
    if (data.key_frame_grid_key) {
      data.key_frame_grid_url = await s3Storage.generatePresignedUrl({
        key: data.key_frame_grid_key,
        expireTime: 3600,
      });
    }
    if (data.storyboard_grid_key) {
      data.storyboard_grid_url = await s3Storage.generatePresignedUrl({
        key: data.storyboard_grid_key,
        expireTime: 3600,
      });
    }
    if (data.output_video_key) {
      data.output_video_url = await s3Storage.generatePresignedUrl({
        key: data.output_video_key,
        expireTime: 3600,
      });
    }

    // 刷新产品图片的预签名 URL
    if (Array.isArray(data.product_images)) {
      data.product_images = await Promise.all(
        data.product_images.map(async (img: { key?: string; url?: string; name?: string }) => {
          if (img.key) {
            img.url = await s3Storage.generatePresignedUrl({
              key: img.key,
              expireTime: 3600,
            });
          }
          return img;
        })
      );
    }

    // 刷新角色图的预签名 URL
    if (data.character_image?.key) {
      data.character_image.url = await s3Storage.generatePresignedUrl({
        key: data.character_image.key,
        expireTime: 3600,
      });
    }

    // 获取场景数据
    const { data: scenes, error: scenesError } = await supabase
      .from('remake_pro_scenes')
      .select('*')
      .eq('project_id', id)
      .order('scene_index', { ascending: true });

    if (!scenesError && scenes) {
      // 刷新场景预签名 URL
      for (const scene of scenes) {
        if (scene.key_frame_key) {
          scene.key_frame_url = await s3Storage.generatePresignedUrl({
            key: scene.key_frame_key,
            expireTime: 3600,
          });
        }
        if (scene.storyboard_key) {
          scene.storyboard_url = await s3Storage.generatePresignedUrl({
            key: scene.storyboard_key,
            expireTime: 3600,
          });
        }
        if (scene.video_key) {
          scene.video_url = await s3Storage.generatePresignedUrl({
            key: scene.video_key,
            expireTime: 3600,
          });
        }
      }
      data.scenes = scenes;
    }

    // 获取段落数据
    const { data: segments, error: segmentsError } = await supabase
      .from('remake_pro_segments')
      .select('*')
      .eq('project_id', id)
      .order('segment_index', { ascending: true });

    if (!segmentsError && segments) {
      for (const seg of segments) {
        if (seg.key_frame_grid_key) {
          seg.key_frame_grid_url = await s3Storage.generatePresignedUrl({
            key: seg.key_frame_grid_key,
            expireTime: 3600,
          });
        }
        if (seg.storyboard_grid_key) {
          seg.storyboard_grid_url = await s3Storage.generatePresignedUrl({
            key: seg.storyboard_grid_key,
            expireTime: 3600,
          });
        }
        if (seg.video_key) {
          seg.video_url = await s3Storage.generatePresignedUrl({
            key: seg.video_key,
            expireTime: 3600,
          });
        }
      }
      data.segments = segments;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logApiError('remake-pro/projects/[id]', 'GET', error, undefined, userId);
    return NextResponse.json({ success: false, error: '获取项目失败' }, { status: 500 });
  }
}

// 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = auth.userId;
  const body = await request.json();
  const supabase = getSupabaseClient();

  try {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // 允许更新的字段
    const allowedFields = [
      'name', 'product_images', 'character_image', 'status',
      'analysis_result', 'key_frame_grid_key', 'storyboard_grid_key',
      'output_video_key', 'analysis_report', 'segment_count',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('remake_pro_projects')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[RemakePro] 更新项目失败:', error);
      return NextResponse.json({ success: false, error: '更新项目失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logApiError('remake-pro/projects/[id]', 'PUT', error, undefined, userId);
    return NextResponse.json({ success: false, error: '更新项目失败' }, { status: 500 });
  }
}

// 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const userId = auth.userId;
  const supabase = getSupabaseClient();

  try {
    // 获取项目信息（用于删除 S3 文件）
    const { data: project } = await supabase
      .from('remake_pro_projects')
      .select('source_video_key, key_frame_grid_key, storyboard_grid_key, output_video_key')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    // 获取场景的 S3 文件
    const { data: scenes } = await supabase
      .from('remake_pro_scenes')
      .select('key_frame_key, storyboard_key, video_key')
      .eq('project_id', id);

    const { data: segments } = await supabase
      .from('remake_pro_segments')
      .select('key_frame_grid_key, storyboard_grid_key, video_key')
      .eq('project_id', id);

    // 删除项目（级联删除 scenes 和 segments）
    const { error } = await supabase
      .from('remake_pro_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[RemakePro] 删除项目失败:', error);
      return NextResponse.json({ success: false, error: '删除项目失败' }, { status: 500 });
    }

    // 异步清理 S3 文件
    const filesToDelete: string[] = [];
    if (project) {
      for (const key of ['source_video_key', 'key_frame_grid_key', 'storyboard_grid_key', 'output_video_key'] as const) {
        if (project[key as keyof typeof project]) filesToDelete.push(project[key as keyof typeof project] as string);
      }
    }
    if (scenes) {
      for (const scene of scenes) {
        for (const key of ['key_frame_key', 'storyboard_key', 'video_key'] as const) {
          if (scene[key]) filesToDelete.push(scene[key]);
        }
      }
    }
    if (segments) {
      for (const seg of segments) {
        for (const key of ['key_frame_grid_key', 'storyboard_grid_key', 'video_key'] as const) {
          if (seg[key]) filesToDelete.push(seg[key]);
        }
      }
    }

    // 异步删除 S3 文件
    Promise.all(filesToDelete.map(key => s3Storage.deleteFile(key))).catch(err => {
      console.error('[RemakePro] 清理S3文件失败:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('remake-pro/projects/[id]', 'DELETE', error, undefined, userId);
    return NextResponse.json({ success: false, error: '删除项目失败' }, { status: 500 });
  }
}
