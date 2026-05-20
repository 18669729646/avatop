import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { s3Storage } from '@/lib/s3-client';

const AUDIO_S3_EXPIRE = 7 * 24 * 60 * 60; // 7天

export interface AudioExtractResult {
  audioKey: string;
  audioUrl: string;
  audioDuration: number;
  audioFileSize: number;
}

/**
 * 从视频 Buffer 提取音频并上传到 S3
 * @param videoBuffer 视频文件的 Buffer
 * @param userId 用户ID
 * @param projectId 项目ID
 * @returns 音频的 S3 key、预签名URL、时长、文件大小
 */
export async function extractAudioFromBuffer(
  videoBuffer: Buffer,
  userId: string,
  projectId: string
): Promise<AudioExtractResult | null> {
  const tempVideoPath = `/tmp/${projectId}_video.mp4`;
  const tempAudioPath = `/tmp/${projectId}_audio.mp3`;

  try {
    // 写入临时视频文件
    await writeFile(tempVideoPath, videoBuffer);

    // 提取音频（使用 libmp3lame 编码为 MP3）
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-y',                    // 覆盖输出文件
        '-i', tempVideoPath,     // 输入视频
        '-vn',                   // 禁用视频
        '-acodec', 'libmp3lame', // MP3 编码
        '-q:a', '2',             // 音质等级（0-9，越小越好）
        '-ar', '44100',          // 采样率
        '-ac', '2',              // 双声道
        tempAudioPath,           // 输出音频
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit code ${code}: ${stderr.slice(-200)}`));
      });
      ffmpeg.on('error', (err) => reject(err));
    });

    // 读取音频文件
    const { readFile } = await import('fs/promises');
    const audioBuffer = await readFile(tempAudioPath);

    // 获取音频时长
    const duration = await getAudioDuration(tempAudioPath);

    // 上传到 S3（返回的 key 可能与 fileName 不同，SDK 会追加随机后缀）
    const audioKey = await s3Storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `analysis-master/audio/${userId}/${projectId}.mp3`,
      contentType: 'audio/mpeg',
    });

    // 生成预签名 URL（使用实际返回的 key）
    const audioUrl = await s3Storage.generatePresignedUrl({
      key: audioKey,
      expireTime: AUDIO_S3_EXPIRE,
    });

    return {
      audioKey,
      audioUrl,
      audioDuration: duration,
      audioFileSize: audioBuffer.length,
    };
  } catch (err) {
    console.error('[extractAudioFromBuffer] 音频提取失败:', err);
    return null;
  } finally {
    // 清理临时文件
    await unlink(tempVideoPath).catch(() => {});
    await unlink(tempAudioPath).catch(() => {});
  }
}

/**
 * 获取音频文件时长（秒）
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let stdout = '';
    let stderr = '';
    ffprobe.stdout.on('data', (data) => { stdout += data.toString(); });
    ffprobe.stderr.on('data', (data) => { stderr += data.toString(); });
    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        resolve(isNaN(duration) ? 0 : Math.round(duration));
      } else {
        reject(new Error(`ffprobe exit code ${code}: ${stderr.slice(-100)}`));
      }
    });
    ffprobe.on('error', (err) => reject(err));
  });
}
