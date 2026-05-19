'use client';

import { useRef, useEffect, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
}

export function VideoPlayer({ src, autoPlay = true, controls = true, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (videoRef.current && autoPlay) {
      videoRef.current.play().catch(() => {
        // 自动播放失败，忽略（可能需要用户交互）
      });
    }
  }, [src, autoPlay]);

  return (
    <div className={`w-full ${className}`}>
      {error ? (
        <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground">
          视频加载失败
        </div>
      ) : (
        <div className="w-full">
          <video
            ref={videoRef}
            src={src}
            controls={controls}
            autoPlay={autoPlay}
            className="w-full max-h-[60vh] rounded-lg"
            onError={() => setError(true)}
          />
        </div>
      )}
    </div>
  );
}
