import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { s3Storage } from '@/lib/s3-client';

const execAsync = promisify(exec);

// 临时目录
const TMP_DIR = '/tmp/video-trim';

/**
 * 使用 FFmpeg 截取视频
 * 支持无损截取（-c copy）和精确截取（重新编码）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      videoUrl, 
      startTime = 0, 
      endTime, 
      lossless = true,
      crf = 18,
      projectId,
    } = body;
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: '请提供视频 URL' },
        { status: 400 }
      );
    }

    console.log(`[FFmpeg Trim] 开始截取视频: ${startTime}s - ${endTime}s, 无损模式: ${lossless}`);

    // 确保临时目录存在
    if (!existsSync(TMP_DIR)) {
      await mkdir(TMP_DIR, { recursive: true });
    }

    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const sessionDir = `${TMP_DIR}/${sessionId}`;
    await mkdir(sessionDir, { recursive: true });

    // 1. 下载视频到本地
    const inputPath = `${sessionDir}/input.mp4`;
    console.log(`[FFmpeg Trim] 下载视频...`);
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(inputPath, buffer);
    
    console.log(`[FFmpeg Trim] 视频下载完成，大小: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

    // 2. 获取视频信息（使用 ffprobe）
    const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`;
    const probeResult = await execAsync(probeCmd);
    const videoInfo = JSON.parse(probeResult.stdout);
    
    const videoStream = videoInfo.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    const audioStream = videoInfo.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
    const format = videoInfo.format;
    
    const duration = parseFloat(format.duration) || 0;
    const width = videoStream?.width || 0;
    const height = videoStream?.height || 0;
    const resolution = `${width}x${height}`;
    
    console.log(`[FFmpeg Trim] 视频信息: 时长=${duration}s, 分辨率=${resolution}`);

    // 如果没有指定结束时间，使用视频总时长
    const actualEndTime = endTime !== undefined ? Math.min(endTime, duration) : duration;
    const actualStartTime = Math.min(startTime, actualEndTime);

    // 如果截取的是整个视频，直接返回
    if (actualStartTime === 0 && actualEndTime >= duration) {
      console.log(`[FFmpeg Trim] 无需截取，返回原视频信息`);
      
      // 上传到对象存储（保持一致性）
      const fileName = `video/trimmed/${projectId || 'video'}_${Date.now()}.mp4`;
      const s3StorageKey = await s3Storage.uploadFile({
        fileContent: buffer,
        fileName: fileName,
        contentType: 'video/mp4',
      });
      const signedUrl = await s3Storage.generatePresignedUrl({
        key: s3StorageKey,
        expireTime: URL_EXPIRE_TIME, // 1年
      });

      // 清理临时文件
      await cleanup(sessionDir);

      return NextResponse.json({
        success: true,
        url: signedUrl,
        video_meta: {
          duration,
          resolution,
          type: format.format_name,
        },
        method: 'original',
      });
    }

    // 3. 执行 FFmpeg 截取
    const outputPath = `${sessionDir}/output.mp4`;
    
    let ffmpegCmd: string;
    
    if (lossless) {
      // 无损截取：直接复制流
      // -ss 放在 -i 前面可以快速定位（关键帧定位）
      ffmpegCmd = `ffmpeg -y -ss ${actualStartTime} -i "${inputPath}" -to ${actualEndTime - actualStartTime} -c copy "${outputPath}"`;
      console.log(`[FFmpeg Trim] 无损截取模式`);
    } else {
      // 精确截取：重新编码
      // -ss 放在 -i 后面可以精确定位
      ffmpegCmd = `ffmpeg -y -i "${inputPath}" -ss ${actualStartTime} -to ${actualEndTime} -c:v libx264 -crf ${crf} -preset fast -c:a aac -b:a 192k "${outputPath}"`;
      console.log(`[FFmpeg Trim] 精确截取模式, CRF=${crf}`);
    }
    
    console.log(`[FFmpeg Trim] 执行命令: ${ffmpegCmd}`);
    
    try {
      const ffmpegResult = await execAsync(ffmpegCmd, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000, // 5 分钟超时
      });
      console.log(`[FFmpeg Trim] FFmpeg 执行完成`);
      if (ffmpegResult.stderr) {
        console.log(`[FFmpeg Trim] FFmpeg stderr:`, ffmpegResult.stderr.slice(-500));
      }
    } catch (ffmpegError) {
      const err = ffmpegError as Error;
      console.error(`[FFmpeg Trim] FFmpeg 执行失败:`, err.message);
      throw new Error(`视频截取失败: ${err.message}`);
    }

    // 4. 检查输出文件
    if (!existsSync(outputPath)) {
      throw new Error('截取后的视频文件不存在');
    }

    const outputBuffer = await readFile(outputPath);
    const outputSize = outputBuffer.length;
    
    // 获取输出视频信息
    const outputProbeCmd = `ffprobe -v quiet -print_format json -show_format "${outputPath}"`;
    const outputProbeResult = await execAsync(outputProbeCmd);
    const outputInfo = JSON.parse(outputProbeResult.stdout);
    const outputDuration = parseFloat(outputInfo.format?.duration) || 0;
    
    console.log(`[FFmpeg Trim] 截取完成，输出大小: ${(outputSize / 1024 / 1024).toFixed(2)}MB, 时长: ${outputDuration}s`);

    // 5. 上传到对象存储
    const fileName = `video/trimmed/${projectId || 'video'}_${Date.now()}.mp4`;
    
    const s3StorageKey = await s3Storage.uploadFile({
      fileContent: outputBuffer,
      fileName: fileName,
      contentType: 'video/mp4',
    });

    const signedUrl = await s3Storage.generatePresignedUrl({
      key: s3StorageKey,
      expireTime: URL_EXPIRE_TIME, // 1年
    });

    console.log(`[FFmpeg Trim] 上传完成，key: ${s3StorageKey}`);

    // 6. 清理临时文件
    await cleanup(sessionDir);

    // 7. 返回结果
    return NextResponse.json({
      success: true,
      url: signedUrl,
      s3StorageKey: s3StorageKey,
      video_meta: {
        duration: outputDuration,
        resolution,
        type: 'mp4',
      },
      trimRange: {
        startTime: actualStartTime,
        endTime: actualEndTime,
      },
      method: lossless ? 'ffmpeg-lossless' : 'ffmpeg-encoded',
    });
    
  } catch (error) {
    console.error('[FFmpeg Trim] 错误:', error);
    
    let errorMessage = '视频截取失败';
    
    if (error instanceof Error) {
      // 检查是否是 FFmpeg 不可用的错误
      if (error.message.includes('ffprobe: not found') || 
          error.message.includes('ffmpeg: not found') ||
          error.message.includes('Command failed')) {
        errorMessage = '服务器未安装 FFmpeg，无法处理视频。请联系管理员安装 FFmpeg。';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET: 获取视频信息
 * 优先尝试 Range 请求，失败后回退到下载完整文件
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: '请提供视频 URL' },
        { status: 400 }
      );
    }

    const tmpFile = `/tmp/video_info_${Date.now()}.mp4`;
    let buffer: Buffer;
    
    // 策略1：尝试 Range 请求（只下载前 5MB，对大多数视频足够）
    try {
      const rangeResponse = await fetch(videoUrl, {
        headers: { Range: 'bytes=0-5242880' }, // 前 5MB
      });
      
      if (rangeResponse.ok) {
        buffer = Buffer.from(await rangeResponse.arrayBuffer());
        
        // 写入临时文件并用 ffprobe 分析
        await writeFile(tmpFile, buffer);
        
        const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${tmpFile}"`;
        const probeResult = await execAsync(probeCmd);
        const videoInfo = JSON.parse(probeResult.stdout);
        
        // 检查是否成功获取到时长（关键指标）
        const duration = parseFloat(videoInfo.format?.duration) || 0;
        
        if (duration > 0) {
          // Range 请求成功且能解析出时长
          await unlink(tmpFile).catch(() => {});
          return buildVideoInfoResponse(videoInfo);
        }
        
        // 时长为0，可能是 moov atom 在文件末尾，需要下载完整文件
        console.log('[FFmpeg Trim] Range 请求无法获取时长，回退到完整下载');
      }
    } catch (rangeError) {
      console.log('[FFmpeg Trim] Range 请求失败，回退到完整下载:', rangeError);
    }
    
    // 策略2：下载完整文件（回退方案，最可靠）
    const fullResponse = await fetch(videoUrl);
    
    if (!fullResponse.ok) {
      throw new Error(`获取视频失败: ${fullResponse.status}`);
    }
    
    buffer = Buffer.from(await fullResponse.arrayBuffer());
    await writeFile(tmpFile, buffer);
    
    // 获取视频信息
    const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${tmpFile}"`;
    const probeResult = await execAsync(probeCmd);
    const videoInfo = JSON.parse(probeResult.stdout);
    
    // 清理临时文件
    await unlink(tmpFile).catch(() => {});
    
    return buildVideoInfoResponse(videoInfo);
    
  } catch (error) {
    console.error('[FFmpeg Trim] 获取视频信息失败:', error);
    
    let errorMessage = '获取视频信息失败';
    
    if (error instanceof Error) {
      // 检查是否是 FFmpeg 不可用的错误
      if (error.message.includes('ffprobe: not found') || 
          error.message.includes('ffmpeg: not found') ||
          error.message.includes('Command failed')) {
        errorMessage = '服务器未安装 FFmpeg，无法获取视频信息。请联系管理员安装 FFmpeg。';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * 构建视频信息响应
 */
function buildVideoInfoResponse(videoInfo: {
  format?: { duration?: string; bit_rate?: string; format_name?: string };
  streams?: Array<{ codec_type: string; width?: number; height?: number; codec_name?: string; r_frame_rate?: string }>;
}): NextResponse {
  const videoStream = videoInfo.streams?.find((s) => s.codec_type === 'video');
  const audioStream = videoInfo.streams?.find((s) => s.codec_type === 'audio');
  const format = videoInfo.format || {};

  return NextResponse.json({
    success: true,
    video_meta: {
      duration: parseFloat(format.duration || '0') || 0,
      resolution: `${videoStream?.width || 0}x${videoStream?.height || 0}`,
      width: videoStream?.width,
      height: videoStream?.height,
      codec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
      frameRate: videoStream?.r_frame_rate,
      bitrate: format.bit_rate,
      format: format.format_name,
    },
  });
}

/**
 * 清理临时目录
 */
async function cleanup(dir: string): Promise<void> {
  try {
    const { rm } = await import('fs/promises');
    await rm(dir, { recursive: true, force: true });
  } catch (e) {
    console.error(`[FFmpeg Trim] 清理失败:`, e);
  }
}
