import { NextRequest, NextResponse } from 'next/server';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { consumeCredits } from '@/lib/credits';
import { checkStorageQuota } from '@/lib/storage-quota';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { s3Storage } from '@/lib/s3-client';

const execAsync = promisify(exec);

// 临时目录
const TMP_DIR = '/tmp/video-concat';

/**
 * 视频拼接 API
 * 使用 FFmpeg 无损拼接，零质量损失
 * 
 * 参数：
 * - videoUrls: 视频 URL 列表
 * - projectName: 项目名称
 * - trimSeconds: 每个视频尾部切除的秒数（默认 0）
 * - transitions: 已废弃，FFmpeg 无损拼接不支持转场
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 检查存储空间是否足够
    const s3StorageCheck = await checkStorageQuota(auth.userId);
    if (!s3StorageCheck.allowed) {
      return NextResponse.json(
        { error: s3StorageCheck.error },
        { status: 507 } // 507 Insufficient Storage
      );
    }
    
    const body = await request.json();
    const { videoUrls, projectName, trimSeconds = 0, transitions } = body;
    
    // 忽略 transitions 参数，提示用户
    if (transitions && transitions.length > 0) {
      console.log('[Video Concat] 注意：FFmpeg 无损拼接不支持转场效果，已忽略 transitions 参数');
    }
    
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: '请提供视频 URL 列表' },
        { status: 400 }
      );
    }

    console.log(`[Video Concat] FFmpeg 无损拼接 ${videoUrls.length} 个视频，切除尾部: ${trimSeconds}s`);

    // 确保临时目录存在
    if (!existsSync(TMP_DIR)) {
      await mkdir(TMP_DIR, { recursive: true });
    }

    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const sessionDir = `${TMP_DIR}/${sessionId}`;
    await mkdir(sessionDir, { recursive: true });

    // 1. 下载所有视频到本地
    const localFiles: string[] = [];
    const videoInfos: { duration: number; resolution: string }[] = [];
    
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      const localPath = `${sessionDir}/video_${i}.mp4`;
      
      console.log(`[Video Concat] 下载视频 ${i + 1}/${videoUrls.length}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载视频 ${i + 1} 失败: ${response.status}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(localPath, buffer);
      localFiles.push(localPath);
      
      // 获取视频信息
      const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${localPath}"`;
      const probeResult = await execAsync(probeCmd);
      const videoInfo = JSON.parse(probeResult.stdout);
      const videoStream = videoInfo.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
      const duration = parseFloat(videoInfo.format?.duration) || 0;
      const resolution = `${videoStream?.width || 0}x${videoStream?.height || 0}`;
      
      videoInfos.push({ duration, resolution });
      
      console.log(`[Video Concat] 视频 ${i + 1}: ${(buffer.length / 1024 / 1024).toFixed(2)}MB, ${duration}s, ${resolution}`);
    }

    // 检查分辨率是否一致
    const resolutions = [...new Set(videoInfos.map(v => v.resolution))];
    if (resolutions.length > 1) {
      console.warn(`[Video Concat] 警告：视频分辨率不一致: ${resolutions.join(', ')}`);
    }

    // 2. 如果需要截取尾部，先处理每个视频
    let filesToConcat = localFiles;
    
    if (trimSeconds > 0) {
      console.log(`[Video Concat] 截取每个视频尾部 ${trimSeconds}s`);
      const trimmedFiles: string[] = [];
      
      for (let i = 0; i < localFiles.length; i++) {
        const inputPath = localFiles[i];
        const outputPath = `${sessionDir}/trimmed_${i}.mp4`;
        const { duration } = videoInfos[i];
        
        const trimEndTime = Math.max(0.1, duration - trimSeconds);
        
        // 使用 FFmpeg 无损截取
        const trimCmd = `ffmpeg -y -i "${inputPath}" -t ${trimEndTime} -c copy "${outputPath}"`;
        console.log(`[Video Concat] 截取 ${i + 1}: ${duration}s -> ${trimEndTime}s`);
        
        try {
          await execAsync(trimCmd, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 });
          trimmedFiles.push(outputPath);
        } catch (trimError) {
          console.warn(`[Video Concat] 截取失败，使用原视频:`, trimError);
          trimmedFiles.push(inputPath);
        }
      }
      
      filesToConcat = trimmedFiles;
    }

    // 3. 创建文件列表
    const listPath = `${sessionDir}/filelist.txt`;
    const listContent = filesToConcat.map(f => `file '${f}'`).join('\n');
    await writeFile(listPath, listContent);
    
    console.log(`[Video Concat] 执行无损拼接...`);

    // 4. 执行 FFmpeg 无损拼接
    const outputPath = `${sessionDir}/output.mp4`;
    const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
    
    try {
      await execAsync(ffmpegCmd, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
      });
      console.log(`[Video Concat] FFmpeg 执行完成`);
    } catch (ffmpegError) {
      const err = ffmpegError as Error;
      console.error(`[Video Concat] FFmpeg 执行失败:`, err.message);
      throw new Error(`视频拼接失败: ${err.message}`);
    }

    // 5. 检查并上传结果
    if (!existsSync(outputPath)) {
      throw new Error('拼接后的视频文件不存在');
    }

    const outputBuffer = await readFile(outputPath);
    const outputSize = outputBuffer.length;
    
    // 获取输出视频信息
    const outputProbeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${outputPath}"`;
    const outputProbeResult = await execAsync(outputProbeCmd);
    const outputInfo = JSON.parse(outputProbeResult.stdout);
    const outputVideoStream = outputInfo.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
    const outputDuration = parseFloat(outputInfo.format?.duration) || 0;
    const outputResolution = `${outputVideoStream?.width || 0}x${outputVideoStream?.height || 0}`;
    
    console.log(`[Video Concat] 完成: ${(outputSize / 1024 / 1024).toFixed(2)}MB, ${outputDuration}s, ${outputResolution}`);

    // 6. 上传到对象存储
    const fileName = `shortfilm/merged/${projectName || 'video'}_${Date.now()}.mp4`;
    const s3StorageKey = await s3Storage.uploadFile({
      fileContent: outputBuffer,
      fileName: fileName,
      contentType: 'video/mp4',
    });

    const signedUrl = await s3Storage.generatePresignedUrl({
      key: s3StorageKey,
      expireTime: URL_EXPIRE_TIME, // 1年
    });

    console.log(`[Video Concat] 上传完成: ${s3StorageKey}`);

    // 扣除积分（视频合成成功）
    const creditResult = await consumeCredits(auth.userId, 'video_concat', s3StorageKey, 'video');
    if (!creditResult.success) {
      console.error('[Video Concat] 扣除积分失败:', creditResult.error);
    } else if (creditResult.skipped) {
      console.log('[Video Concat] 积分已扣除过，跳过重复扣除');
    } else {
      console.log(`[Video Concat] 扣除积分成功: ${creditResult.creditsUsed} 积分`);
    }

    // 7. 清理临时文件
    try {
      const { rm } = await import('fs/promises');
      await rm(sessionDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`[Video Concat] 清理失败:`, e);
    }

    // 8. 返回结果
    const videoRecord = {
      id: `mv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: signedUrl,
      s3StorageKey: s3StorageKey,
      projectName: projectName || '未命名短片',
      videoCount: videoUrls.length,
      duration: outputDuration,
      size: outputSize,
      resolution: outputResolution,
      createdAt: Date.now(),
      method: 'ffmpeg-lossless',
    };

    return NextResponse.json({
      success: true,
      video: videoRecord,
    });
    
  } catch (error) {
    console.error('[Video Concat] 错误:', error);
    
    let errorMessage = '视频拼接失败';
    
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
