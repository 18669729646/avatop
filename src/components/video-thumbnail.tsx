'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { Video, Loader2 } from 'lucide-react';

interface VideoThumbnailProps {
  videoUrl: string;
  className?: string;
  onRefresh?: () => void;
}

// 自动重试配置
const MAX_RETRY = 3;
const RETRY_DELAY = 1500; // 1.5秒

/**
 * 视频缩略图组件
 * 使用 video 元素显示视频第一帧
 * 
 * 特性：
 * - 加载失败自动重试（最多3次）
 * - 不使用全局缓存（预签名 URL 可能过期）
 * - 使用 memo 优化渲染
 */
function VideoThumbnailInner({ videoUrl, className = '' }: VideoThumbnailProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!videoUrl) {
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => setStatus('error'), 0);
      return;
    }
    
    setTimeout(() => setStatus('loading'), 0);
    
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    
    const handleCanPlay = () => {
      if (isMountedRef.current) {
        setStatus('ready');
        setRetryCount(0);
      }
      cleanup();
    };
    
    const handleError = () => {
      if (!isMountedRef.current) return;
      
      // 自动重试
      if (retryCount < MAX_RETRY) {
        console.warn(`[VideoThumbnail] 视频加载失败，准备第 ${retryCount + 1} 次重试`);
        setRetryCount(prev => prev + 1);
        
        // 延迟重试
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            video.load(); // 重新加载
          }
        }, RETRY_DELAY);
      } else {
        // 重试次数耗尽，显示错误
        console.warn(`[VideoThumbnail] 视频加载失败，已重试 ${MAX_RETRY} 次`);
        setStatus('error');
        cleanup();
      }
    };
    
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.remove();
    };
    
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.src = videoUrl;
    video.load();
    
    // 设置总超时（考虑重试时间）
    const totalTimeout = 15000 + (MAX_RETRY * RETRY_DELAY);
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && status === 'loading') {
        console.warn('[VideoThumbnail] 视频加载总超时');
        setStatus('error');
        cleanup();
      }
    }, totalTimeout);
    
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      cleanup();
    };
  }, [videoUrl]); // 不依赖 retryCount，避免循环

  if (status === 'error') {
    return (
      <div className={`w-full h-full bg-pink-500/20 flex items-center justify-center ${className}`}>
        <Video className="w-5 h-5 text-pink-500" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center z-10">
          <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
        </div>
      )}
      <video
        src={videoUrl}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="auto"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
}

export const VideoThumbnail = memo(VideoThumbnailInner, (prevProps, nextProps) => {
  return prevProps.videoUrl === nextProps.videoUrl && prevProps.className === nextProps.className;
});
