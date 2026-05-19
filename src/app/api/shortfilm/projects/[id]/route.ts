import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { logStorageError, errorResponse } from '@/lib/logger';

function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

async function deleteS3File(key: string, userId?: string): Promise<boolean> {
  if (!key) return false;

  try {
    const success = await s3Storage.deleteFile(key);
    if (success) {
      console.log(`[Shortfilm Project] 成功删除 S3 文件: ${key}`);
    } else {
      console.error(`[Shortfilm Project] 删除 S3 文件失败: ${key}`);
      logStorageError('删除项目文件', new Error('deleteFile returned false'), {
        key,
      }, userId);
    }
    return success;
  } catch (error) {
    console.error(`[Shortfilm Project] 删除 S3 文件失败: ${key}`, error);
    logStorageError('删除项目文件', error, {
      key,
    }, userId);
    return false;
  }
}

// 批量删除 S3 文件
async function deleteS3Files(items: Array<{ key?: string; url?: string }>, userId?: string): Promise<void> {
  const deletePromises = items.map(item => {
    const key = item.key || extractKeyFromUrl(item.url || '');
    return key ? deleteS3File(key, userId) : Promise.resolve();
  });
  await Promise.all(deletePromises);
}

// 获取单个短片项目（用户数据隔离）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    
    const client = getSupabaseClient();
    
    // 只能查看自己的项目
    const { data, error } = await client
      .from('shortfilm_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .maybeSingle();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    
    console.log(`[Shortfilm Project API] 获取项目 ${id}, script_segments:`, data.script_segments?.length || 0);
    
    let sourceVideoUrl = data.source_video_url;
    if (data.source_video_key) {
      try {
        sourceVideoUrl = await s3Storage.generatePresignedUrl({
          key: data.source_video_key,
          expireTime: URL_EXPIRE_TIME,
        });
      } catch (e) {
        console.warn('[Shortfilm Project API] 刷新视频URL失败:', (e as Error).message);
      }
    }
    
    return NextResponse.json({ 
      data: {
        id: data.id,
        name: data.name,
        sourceType: data.source_type || 'original',
        sourceVideoKey: data.source_video_key,
        sourceVideoUrl,
        videoDuration: data.video_duration,
        productId: data.product_id,
        productName: data.product_name,
        productImages: data.product_images || [],
        productDescription: data.product_description,
        scriptPrompt: data.script_prompt,
        totalDuration: data.total_duration,
        scriptSegments: data.script_segments || [],
        imageTasks: data.image_tasks || [],
        videoTasks: data.video_tasks || [],
        mergedVideos: data.merged_videos || [],
        selectedCharacters: data.selected_characters || [],
        currentStep: data.current_step,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    });
  } catch (error) {
    return errorResponse('shortfilm/projects/[id]', 'GET', error, auth?.success ? auth.userId : undefined, { projectId: id });
  }
}

// 更新短片项目（只能更新自己的）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    const body = await request.json();
    
    const client = getSupabaseClient();
    
    // 构建更新对象
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.sourceType !== undefined) updates.source_type = body.sourceType;
    if (body.sourceVideoKey !== undefined) updates.source_video_key = body.sourceVideoKey;
    if (body.sourceVideoUrl !== undefined) updates.source_video_url = body.sourceVideoUrl;
    if (body.videoDuration !== undefined) updates.video_duration = body.videoDuration;
    if (body.productId !== undefined) updates.product_id = body.productId;
    if (body.productName !== undefined) updates.product_name = body.productName;
    if (body.productImages !== undefined) updates.product_images = body.productImages;
    if (body.productDescription !== undefined) updates.product_description = body.productDescription;
    if (body.scriptPrompt !== undefined) updates.script_prompt = body.scriptPrompt;
    if (body.totalDuration !== undefined) updates.total_duration = body.totalDuration;
    if (body.scriptSegments !== undefined) updates.script_segments = body.scriptSegments;
    if (body.imageTasks !== undefined) updates.image_tasks = body.imageTasks;
    if (body.videoTasks !== undefined) updates.video_tasks = body.videoTasks;
    if (body.mergedVideos !== undefined) updates.merged_videos = body.mergedVideos;
    if (body.currentStep !== undefined) updates.current_step = body.currentStep;
    if (body.selectedCharacters !== undefined) updates.selected_characters = body.selectedCharacters;
    if (body.status !== undefined) updates.status = body.status;
    
    // 只能更新自己的项目
    const { data, error } = await client
      .from('shortfilm_projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();
    
    if (error) {
      console.error('[Shortfilm Project API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '项目不存在或无权限' }, { status: 404 });
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
    return errorResponse('shortfilm/projects/[id]', 'PUT', error, auth?.success ? auth.userId : undefined, { projectId: id });
  }
}

// 删除短片项目（只能删除自己的）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
  let id: string | undefined;
  
  try {
    // 验证用户身份
    auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    id = (await params).id;
    
    const client = getSupabaseClient();
    
    // 先获取项目信息，删除 S3 文件，再删除数据库记录
    const { data: project } = await client
      .from('shortfilm_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (project) {
      console.log(`[Shortfilm Project] 删除项目 ${id}，开始清理关联数据`);

      // 1. 获取关联的任务ID列表（用于删除历史记录）
      const { data: tasks } = await client
        .from('task_queue')
        .select('id')
        .eq('project_id', id)
        .eq('user_id', auth.userId);

      const taskIds = tasks?.map(t => t.id) || [];
      console.log(`[Shortfilm Project] 找到 ${taskIds.length} 个关联任务`);

      // 2. 删除关联的任务队列
      const { error: taskQueueError } = await client
        .from('task_queue')
        .delete()
        .eq('project_id', id)
        .eq('user_id', auth.userId);

      if (taskQueueError) {
        console.error('[Shortfilm Project API] 删除任务队列失败:', taskQueueError);
      } else {
        console.log(`[Shortfilm Project] 关联任务队列已清理`);
      }

      // 3. 删除历史记录表中的对应记录
      if (taskIds.length > 0) {
        await client.from('image_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        await client.from('video_history').delete().in('id', taskIds).eq('user_id', auth.userId);
        console.log(`[Shortfilm Project] 历史记录已清理`);
      }

      console.log(`[Shortfilm Project] 开始清理 S3 文件`);
      
      // 收集所有需要删除的 S3 文件
      const filesToDelete: Array<{ key?: string; url?: string }> = [];
      
      // 1. 产品图片
      if (project.product_images && Array.isArray(project.product_images)) {
        project.product_images.forEach((img: unknown) => {
          const item = img as { key?: string; url?: string };
          if (item.key || item.url) {
            filesToDelete.push(item);
          }
        });
      }
      
      // 2. 图片任务 - 参考图和生成的图片
      if (project.image_tasks && Array.isArray(project.image_tasks)) {
        project.image_tasks.forEach((task: unknown) => {
          const imageTask = task as { 
            referenceImages?: string[];
            generatedImages?: Array<{ key?: string; url?: string }> 
          };
          
          // 删除参考图
          if (imageTask.referenceImages && Array.isArray(imageTask.referenceImages)) {
            imageTask.referenceImages.forEach(refUrl => {
              if (refUrl) {
                filesToDelete.push({ url: refUrl });
              }
            });
          }
          
          // 删除生成的图片
          if (imageTask.generatedImages && Array.isArray(imageTask.generatedImages)) {
            imageTask.generatedImages.forEach(img => {
              if (img.key || img.url) {
                filesToDelete.push(img);
              }
            });
          }
        });
      }
      
      // 3. 视频任务生成的视频
      if (project.video_tasks && Array.isArray(project.video_tasks)) {
        project.video_tasks.forEach((task: unknown) => {
          const videoTask = task as { generatedVideos?: Array<{ key?: string; url?: string }> };
          if (videoTask.generatedVideos && Array.isArray(videoTask.generatedVideos)) {
            videoTask.generatedVideos.forEach(vid => {
              if (vid.key || vid.url) {
                filesToDelete.push(vid);
              }
            });
          }
        });
      }
      
      // 4. 复刻项目原始视频
      if (project.source_video_key) {
        filesToDelete.push({ key: project.source_video_key });
      }
      
      console.log(`[Shortfilm Project] 找到 ${filesToDelete.length} 个文件需要删除`);
      
      // 删除所有 S3 文件
      await deleteS3Files(filesToDelete, auth.userId);
      console.log(`[Shortfilm Project] S3 文件清理完成`);
    }
    
    // 只能删除自己的项目
    const { error } = await client
      .from('shortfilm_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);
    
    if (error) {
      console.error('[Shortfilm Project API] 删除失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log(`[Shortfilm Project] 项目 ${id} 删除成功`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse('shortfilm/projects/[id]', 'DELETE', error, auth?.success ? auth.userId : undefined, { projectId: id });
  }
}
