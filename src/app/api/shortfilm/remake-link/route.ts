import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { logInfo, logApiError } from '@/lib/logger';
import { checkStorageQuota } from '@/lib/storage-quota';
import { s3Storage } from '@/lib/s3-client';
import { URL_EXPIRE_TIME } from '@/lib/storage-types';
import { downloadVideoFromUrl } from '@/lib/video-downloader';

const SUPPORTED_PLATFORMS = [
  { id: 'tiktok', patterns: ['tiktok.com', 'vm.tiktok'] },
  { id: 'youtube', patterns: ['youtube.com', 'youtu.be'] },
  { id: 'instagram', patterns: ['instagram.com'] },
  { id: 'xiaohongshu', patterns: ['xiaohongshu.com', 'xhslink.com'] },
  { id: 'bilibili', patterns: ['bilibili.com', 'b23.tv'] },
  { id: 'douyin', patterns: ['douyin.com', 'v.douyin.com'] },
  { id: 'weibo', patterns: ['weibo.com', 'weibo.cn', 'm.weibo.cn'] },
  { id: 'kuaishou', patterns: ['kuaishou.com', 'gifshow.com', 'v.kuaishou.com'] },
];

function detectPlatform(url: string): string | null {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const platform of SUPPORTED_PLATFORMS) {
    if (platform.patterns.some(p => hostname === p || hostname.endsWith('.' + p))) {
      return platform.id;
    }
  }
  return null;
}

async function downloadAndUploadVideo(
  url: string,
  projectId: string,
): Promise<{
  videoKey: string;
  videoUrl: string;
  fileSize: number;
  duration?: number;
  title?: string;
  uploader?: string;
  thumbnail?: string;
  provider: string;
}> {
  const downloaded = await downloadVideoFromUrl(url, { projectId, provider: 'auto' });
  const s3Key = `video-remake/source/${projectId}/source-${Date.now()}.mp4`;

  const videoKey = await s3Storage.uploadFile({
    fileContent: downloaded.buffer,
    fileName: s3Key,
    contentType: downloaded.contentType,
  });

  const videoUrl = await s3Storage.generatePresignedUrl({
    key: videoKey,
    expireTime: URL_EXPIRE_TIME,
  });

  return {
    videoKey,
    videoUrl,
    fileSize: downloaded.buffer.length,
    duration: downloaded.duration,
    title: downloaded.title,
    uploader: downloaded.uploader,
    thumbnail: downloaded.thumbnail,
    provider: downloaded.provider,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const body = await request.json();
    const { url, projectId } = body;

    if (!url) {
      return NextResponse.json({ error: '请提供视频链接' }, { status: 400 });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      const supportedList = SUPPORTED_PLATFORMS.map(p => p.id).join('、');
      return NextResponse.json(
        { error: `不支持的视频平台，当前支持：${supportedList}` },
        { status: 400 }
      );
    }

    const storageCheck = await checkStorageQuota(auth.userId);
    if (!storageCheck.allowed) {
      return NextResponse.json({ error: storageCheck.error }, { status: 507 });
    }

    let videoKey: string | null = null;
    let videoUrl: string | null = null;
    let fileSize = 0;
    let duration = 30;
    let title = `${platform} 视频`;
    let uploader = '';
    let thumbnail = '';
    let provider = '';

    try {
      const uploadResult = await downloadAndUploadVideo(url, projectId || `tmp-${Date.now()}`);
      videoKey = uploadResult.videoKey;
      videoUrl = uploadResult.videoUrl;
      fileSize = uploadResult.fileSize;
      duration = uploadResult.duration || duration;
      title = uploadResult.title || title;
      uploader = uploadResult.uploader || '';
      thumbnail = uploadResult.thumbnail || '';
      provider = uploadResult.provider;
    } catch (downloadError) {
      console.error('[Shortfilm Remake Link] video download failed:', downloadError);
      return NextResponse.json(
        { error: '视频下载失败，请确认视频为公开可访问状态' },
        { status: 502 }
      );
    }

    if (projectId) {
      const client = getSupabaseClient();
      const { error: updateError } = await client
        .from('shortfilm_projects')
        .update({
          source_type: 'remake',
          source_video_key: videoKey,
          source_video_url: videoUrl,
          video_duration: duration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', auth.userId)
        .select('id')
        .single();

      if (updateError) {
        console.error('[Shortfilm Remake Link] 更新项目失败:', updateError);
        if (videoKey) {
          await s3Storage.deleteFile(videoKey).catch(() => false);
        }
        return NextResponse.json({ error: '项目不存在或无权限，视频已取消保存' }, { status: 404 });
      }
    }

    logInfo('api', '解析视频链接成功', { projectId, platform, url, duration, fileSize, provider }, auth.userId);

    return NextResponse.json({
      success: true,
      data: {
        platform,
        videoKey,
        videoUrl,
        duration,
        title,
        fileSize,
        uploader,
        thumbnail,
        provider,
      },
    });
  } catch (error) {
    logApiError('shortfilm/remake-link', 'POST', error);
    return NextResponse.json({ error: '解析失败' }, { status: 500 });
  }
}
