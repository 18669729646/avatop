/**
 * 视频拼接工具 - 使用 FFmpeg 无损拼接
 */

import { MergedVideo } from './shortfilm';
import { authFetch } from './auth-context';

// 进度回调类型
export type ProgressCallback = (progress: {
  stage: 'preparing' | 'downloading' | 'concatenating' | 'uploading' | 'done';
  progress: number; // 0-100
  message: string;
}) => void;

/**
 * 检查浏览器支持（总是返回支持，因为实际处理在后端）
 */
export function checkBrowserSupport(): { supported: boolean; reason?: string } {
  return { supported: true };
}

/**
 * 使用 FFmpeg 无损拼接视频
 * 直接复制流，不重新编码，零质量损失
 * 
 * @param videoUrls 视频 URL 列表
 * @param projectName 项目名称
 * @param onProgress 进度回调
 * @param trimSeconds 每个视频尾部切除的秒数（可选）
 * @returns 拼接后的视频记录
 */
export async function concatenateVideos(
  videoUrls: string[],
  projectName?: string,
  onProgress?: ProgressCallback,
  trimSeconds: number = 0
): Promise<MergedVideo> {
  if (videoUrls.length === 0) {
    throw new Error('没有视频需要拼接');
  }

  // 如果只有一个视频，特殊处理
  if (videoUrls.length === 1) {
    onProgress?.({
      stage: 'preparing',
      progress: 10,
      message: '正在处理单个视频...',
    });
    
    // 调用 FFmpeg 截取 API（即使不截取，也会返回正确的视频信息）
    const response = await authFetch('/api/video/concat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrls,
        projectName,
        trimSeconds: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    onProgress?.({
      stage: 'done',
      progress: 100,
      message: '完成',
    });
    
    return data.video;
  }

  // 多个视频拼接
  onProgress?.({
    stage: 'preparing',
    progress: 5,
    message: '正在准备视频拼接...',
  });

  console.log('[VideoMerger] 使用 FFmpeg 无损拼接，视频数量:', videoUrls.length);

  try {
    onProgress?.({
      stage: 'downloading',
      progress: 15,
      message: '正在下载视频...',
    });

    const response = await authFetch('/api/video/concat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrls,
        projectName,
        trimSeconds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API 请求失败: ${response.status}`);
    }

    onProgress?.({
      stage: 'concatenating',
      progress: 50,
      message: '正在无损拼接视频...',
    });

    const data = await response.json();

    onProgress?.({
      stage: 'uploading',
      progress: 85,
      message: '正在保存视频...',
    });

    onProgress?.({
      stage: 'done',
      progress: 100,
      message: '视频拼接完成！',
    });

    console.log('[VideoMerger] FFmpeg 无损拼接成功:', data.video);

    return data.video;
  } catch (error) {
    console.error('[VideoMerger] 拼接失败:', error);
    throw error;
  }
}

/**
 * 截取视频
 * 
 * @param videoUrl 视频 URL
 * @param startTime 开始时间（秒）
 * @param endTime 结束时间（秒）
 * @param lossless 是否无损截取（默认 true）
 * @param crf 编码质量（仅 lossless=false 时有效，默认 18，越小质量越好）
 * @returns 截取后的视频 URL 和元数据
 */
export async function trimVideo(
  videoUrl: string,
  startTime: number = 0,
  endTime?: number,
  lossless: boolean = true,
  crf: number = 18
): Promise<{
  url: string;
  videoMeta: {
    duration: number;
    resolution: string;
  };
  method: string;
}> {
  const response = await authFetch('/api/video/ffmpeg-trim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl,
      startTime,
      endTime,
      lossless,
      crf,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `截取视频失败: ${response.status}`);
  }

  const data = await response.json();

  return {
    url: data.url,
    videoMeta: {
      duration: data.video_meta.duration,
      resolution: data.video_meta.resolution,
    },
    method: data.method,
  };
}

/**
 * 获取视频信息
 * 
 * @param videoUrl 视频 URL
 * @returns 视频元数据
 */
export async function getVideoInfo(videoUrl: string): Promise<{
  duration: number;
  resolution: string;
  width: number;
  height: number;
  codec: string;
  frameRate: string;
  bitrate: number;
}> {
  const response = await authFetch(`/api/video/ffmpeg-trim?url=${encodeURIComponent(videoUrl)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `获取视频信息失败: ${response.status}`);
  }

  const data = await response.json();

  return {
    duration: data.video_meta.duration,
    resolution: data.video_meta.resolution,
    width: data.video_meta.width,
    height: data.video_meta.height,
    codec: data.video_meta.codec,
    frameRate: data.video_meta.frameRate,
    bitrate: data.video_meta.bitrate,
  };
}
