'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Download, Play, Pause, Volume2, VolumeX, FolderOpen, Loader2 } from 'lucide-react';

interface VideoViewerProps {
  src: string;
  poster?: string;
  onClose?: () => void;
  fileName?: string;
}

// 检查是否支持 File System Access API
const isFileSystemAccessSupported = () => {
  return 'showSaveFilePicker' in window;
};

export function VideoViewer({ src, poster, onClose, fileName = 'video.mp4' }: VideoViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSrcRef = useRef<string>(src);

  // 缩放范围
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 4;
  const SCALE_STEP = 0.25;

  // 监听 src 变化，重置状态
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      setIsLoading(true);
      setIsPlaying(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      prevSrcRef.current = src;
    }
  }, [src]);

  // 重置缩放和位置
  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 放大
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  // 缩小
  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - SCALE_STEP, MIN_SCALE));
  }, []);

  // 鼠标滚轮缩放
  // 鼠标滚轮缩放（只改变大小，不改变位置）
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(scale + delta, MAX_SCALE));
    
    if (newScale !== scale) {
      setScale(newScale);
    }
  }, [scale]);

  // 鼠标按下开始拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  // 鼠标移动拖拽
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // 鼠标释放结束拖拽
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标离开容器结束拖拽
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 播放/暂停
  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // 静音切换
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // 下载视频
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const defaultName = fileName.endsWith('.mp4') || fileName.endsWith('.webm') 
        ? fileName 
        : `${fileName.replace(/\.[^.]+$/, '')}.mp4`;

      if (isFileSystemAccessSupported()) {
        try {
          // @ts-expect-error - File System Access API
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [
              {
                description: '视频文件',
                accept: { 'video/mp4': ['.mp4'], 'video/webm': ['.webm'] },
              },
            ],
            excludeAcceptAllOption: false,
          });
          
          const response = await fetch(src);
          const blob = await response.blob();
          
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setIsDownloading(false);
          return;
        } catch (err: unknown) {
          const error = err as { name?: string };
          if (error.name === 'AbortError') {
            setIsDownloading(false);
            return;
          }
        }
      }
      
      // 回退到传统下载方式
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[下载] 下载失败:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [src, fileName, isDownloading]);

  // 视频结束事件
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // 视频可以播放
  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 视频开始加载
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  // 视频等待缓冲
  const handleWaiting = useCallback(() => {
    setIsLoading(true);
  }, []);

  // 视频播放中
  const handlePlaying = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose?.();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetView();
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (isPlaying) {
              videoRef.current.pause();
            } else {
              videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, zoomIn, zoomOut, resetView, isPlaying]);

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-center gap-2 p-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= MIN_SCALE}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= MAX_SCALE}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={resetView}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="outline" size="sm" onClick={togglePlay}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={toggleMute}>
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin">⏳</span>
              下载中...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              {isFileSystemAccessSupported() ? <FolderOpen className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              下载
            </span>
          )}
        </Button>
      </div>

      {/* 视频容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-black relative flex items-center justify-center"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
            onEnded={handleEnded}
            onCanPlay={handleCanPlay}
            onLoadStart={handleLoadStart}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onClick={togglePlay}
          />
        </div>
        
        {/* 加载指示器 */}
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity duration-300"
          style={{ opacity: isLoading ? 1 : 0, pointerEvents: isLoading ? 'auto' : 'none' }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-white" />
            <span className="text-white text-sm">视频加载中...</span>
          </div>
        </div>
        
        {/* 播放按钮覆盖层 */}
        {!isPlaying && !isLoading && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-7 h-7 text-gray-800 ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* 提示 */}
      <div className="text-xs text-muted-foreground text-center py-1 border-t bg-muted/30">
        滚轮缩放 · 拖拽移动 · 空格播放/暂停 · 按 ESC 关闭
      </div>
    </div>
  );
}
