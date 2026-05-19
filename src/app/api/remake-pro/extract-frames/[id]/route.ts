/**
 * 视频复刻大师 - 关键帧提取 + 九宫格拼图 API
 * 使用 FFmpeg 按时间戳抽取关键帧，用 sharp 拼成 3x3 九宫格
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { logApiError } from '@/lib/logger';
import { s3Storage } from '@/lib/s3-client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

export async function POST(
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
    // 获取项目
    const { data: project } = await supabase
      .from('remake_pro_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project?.source_video_key) {
      return NextResponse.json({ success: false, error: '请先上传视频' }, { status: 400 });
    }

    // 获取场景
    const { data: scenes } = await supabase
      .from('remake_pro_scenes')
      .select('*')
      .eq('project_id', id)
      .order('scene_index', { ascending: true });

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ success: false, error: '请先进行视频理解' }, { status: 400 });
    }

    // 更新状态
    await supabase
      .from('remake_pro_projects')
      .update({ status: 'extracting', updated_at: new Date().toISOString() })
      .eq('id', id);

    // 下载视频到临时文件
    const videoUrl = await s3Storage.generatePresignedUrl({
      key: project.source_video_key,
      expireTime: 3600,
    });

    const tmpDir = path.join(os.tmpdir(), `remake-pro-${id}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const videoPath = path.join(tmpDir, 'source.mp4');

    // 下载视频
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error('下载视频失败');
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);

    // 逐场景提取关键帧
    const frameSize = 512; // 每帧缩放到 512x512
    const frameBuffers: Buffer[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const timestamp = Number(scene.start_time) || (i * (project.video_duration / scenes.length));
      const framePath = path.join(tmpDir, `frame_${i}.jpg`);

      try {
        await execFileAsync('ffmpeg', [
          '-ss', String(timestamp),
          '-i', videoPath,
          '-frames:v', '1',
          '-q:v', '2',
          '-y',
          framePath,
        ], { timeout: 30000 });

        // 读取并缩放帧
        const frameBuffer = await sharp(framePath)
          .resize(frameSize, frameSize, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();

        frameBuffers.push(frameBuffer);

        // 上传关键帧到 S3（uploadFile 返回实际存储的 key，可能带随机后缀）
        const frameKey = `remake-pro/${userId}/${id}/frames/scene_${i}.jpg`;
        const actualFrameKey = await s3Storage.uploadFile({
          fileContent: frameBuffer,
          fileName: frameKey,
          contentType: 'image/jpeg',
        });

        // 用实际存储的 key 生成预签名 URL
        const frameUrl = await s3Storage.generatePresignedUrl({
          key: actualFrameKey,
          expireTime: 7 * 24 * 3600,
        });
        await supabase
          .from('remake_pro_scenes')
          .update({
            key_frame_key: actualFrameKey,
            key_frame_url: frameUrl,
            status: 'frame_extracted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);

      } catch (frameError) {
        console.error(`[RemakePro] 提取第${i}帧失败:`, frameError);
        // 创建空白占位帧
        const placeholder = await sharp({
          create: {
            width: frameSize,
            height: frameSize,
            channels: 3,
            background: { r: 30, g: 30, b: 30 },
          }
        })
          .jpeg({ quality: 90 })
          .toBuffer();
        frameBuffers.push(placeholder);
      }
    }

    // 拼九宫格 (3x3)
    const gridSize = 3;
    const totalScenes = Math.min(scenes.length, 9);
    const gridImageSize = frameSize * gridSize;
    const padding = 4;

    const composites: sharp.OverlayOptions[] = [];
    for (let i = 0; i < totalScenes; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      composites.push({
        input: frameBuffers[i],
        left: col * (frameSize + padding),
        top: row * (frameSize + padding),
      });
    }

    const gridBuffer = await sharp({
      create: {
        width: gridImageSize + padding * (gridSize - 1),
        height: gridImageSize + padding * (gridSize - 1),
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      }
    })
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();

    // 上传九宫格图到 S3（uploadFile 返回实际存储的 key）
    const gridKey = `remake-pro/${userId}/${id}/key_frame_grid.jpg`;
    const actualGridKey = await s3Storage.uploadFile({
      fileContent: gridBuffer,
      fileName: gridKey,
      contentType: 'image/jpeg',
    });

    // 用实际存储的 key 生成预签名 URL
    const gridUrl = await s3Storage.generatePresignedUrl({
      key: actualGridKey,
      expireTime: 7 * 24 * 3600,
    });

    // 更新项目
    await supabase
      .from('remake_pro_projects')
      .update({
        key_frame_grid_key: actualGridKey,
        key_frame_grid_url: gridUrl,
        status: 'frames_extracted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 清理临时文件
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        sceneCount: scenes.length,
        gridKey,
      }
    });
  } catch (error) {
    await supabase
      .from('remake_pro_projects')
      .update({ status: 'extract_failed', updated_at: new Date().toISOString() })
      .eq('id', id);

    logApiError('remake-pro/extract-frames', 'POST', error, undefined, userId);
    const message = error instanceof Error ? error.message : '关键帧提取失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
