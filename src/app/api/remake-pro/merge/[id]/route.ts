/**
 * 视频复刻大师 - 视频拼接 API（异步模式）
 * 多段视频 → FFmpeg 拼接 → 完整长视频
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { logApiError } from '@/lib/logger';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// POST: 启动视频拼接（异步）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;

  const supabase = getSupabaseClient();

  try {
    const { data: project, error } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    // 更新状态
    await supabase.from('remake_pro_projects').update({
      status: 'merging',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // 异步执行
    mergeAsync(id, userId, project).catch(err => {
      console.error('[Merge] 异步拼接失败:', err);
    });

    return NextResponse.json({ success: true, message: '视频拼接已启动' });
  } catch (error) {
    logApiError('remake-pro/merge', 'POST', error, { projectId: id }, userId);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

async function mergeAsync(projectId: string, userId: string, project: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const s3 = new S3Storage();

  try {
    // 获取所有已完成的场景视频
    const { data: scenes } = await supabase
      .from('remake_pro_scenes')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('scene_index', { ascending: true });

    if (!scenes || scenes.length === 0) {
      throw new Error('没有已完成的场景视频');
    }

    // 创建临时目录
    const tmpDir = `/tmp/remake-pro-merge-${projectId}`;
    await fs.mkdir(tmpDir, { recursive: true });

    // 下载所有视频
    const videoFiles: string[] = [];
    for (const scene of scenes) {
      const videoKey = scene.video_key as string;
      if (!videoKey) continue;

      const videoUrl = await s3.generatePresignedUrl({ key: videoKey, expireTime: 3600 });
      const resp = await fetch(videoUrl);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const filePath = path.join(tmpDir, `scene_${scene.scene_index}.mp4`);
      await fs.writeFile(filePath, buffer);
      videoFiles.push(filePath);
    }

    if (videoFiles.length === 0) {
      throw new Error('没有可用的视频文件');
    }

    // 如果只有一个视频，直接使用
    if (videoFiles.length === 1) {
      const buffer = await fs.readFile(videoFiles[0]);
      const outputKey = await s3.uploadFile({
        fileContent: buffer,
        fileName: `remake-pro/${userId}/${projectId}/output_video.mp4`,
        contentType: 'video/mp4',
      });
      const outputUrl = await s3.generatePresignedUrl({ key: outputKey, expireTime: 7 * 24 * 3600 });

      await supabase.from('remake_pro_projects').update({
        status: 'completed',
        output_video_key: outputKey,
        output_video_url: outputUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);

      // 清理临时文件
      await fs.rm(tmpDir, { recursive: true }).catch(() => {});
      return;
    }

    // 创建 FFmpeg concat 文件
    const concatFilePath = path.join(tmpDir, 'concat.txt');
    const concatContent = videoFiles.map(f => `file '${f}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);

    // FFmpeg 拼接
    const outputPath = path.join(tmpDir, 'output.mp4');
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c', 'copy',
      '-y',
      outputPath,
    ], { timeout: 300000 });

    // 上传拼接后的视频
    const outputBuffer = await fs.readFile(outputPath);
    const outputKey = await s3.uploadFile({
      fileContent: outputBuffer,
      fileName: `remake-pro/${userId}/${projectId}/output_video.mp4`,
      contentType: 'video/mp4',
    });
    const outputUrl = await s3.generatePresignedUrl({ key: outputKey, expireTime: 7 * 24 * 3600 });

    // 更新项目
    await supabase.from('remake_pro_projects').update({
      status: 'completed',
      output_video_key: outputKey,
      output_video_url: outputUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);

    // 清理临时文件
    await fs.rm(tmpDir, { recursive: true }).catch(() => {});

    console.log(`[Merge] 项目 ${projectId} 拼接完成`);
  } catch (error) {
    console.error(`[Merge] 项目 ${projectId} 拼接失败:`, error);
    await supabase.from('remake_pro_projects').update({
      status: 'animated',
      updated_at: new Date().toISOString(),
    }).eq('id', projectId);
  }
}
