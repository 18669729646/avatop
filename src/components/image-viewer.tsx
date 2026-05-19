'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Download, FolderOpen, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose?: () => void;
  fileName?: string;
  // 图片列表支持
  images?: { url: string; id: string }[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
}

// 检查是否支持 File System Access API
const isFileSystemAccessSupported = () => {
  return 'showSaveFilePicker' in window;
};

export function ImageViewer({ 
  src, 
  alt = '预览图', 
  onClose, 
  fileName = 'image.png',
  images,
  currentIndex = 0,
  onIndexChange,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [initialScale, setInitialScale] = useState(1); // 初始适应缩放比例
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 缩放范围
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;
  const SCALE_STEP = 0.2;

  // 计算适应容器的缩放比例
  const calculateFitScale = useCallback(() => {
    if (!containerRef.current || !imageRef.current || !isImageLoaded) return 1;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgWidth = imageRef.current.naturalWidth;
    const imgHeight = imageRef.current.naturalHeight;
    
    console.log('[ImageViewer] 容器尺寸:', containerRect.width, 'x', containerRect.height);
    console.log('[ImageViewer] 图片尺寸:', imgWidth, 'x', imgHeight);
    
    // 计算适应容器的缩放比例（留一些边距）
    const padding = 0.95; // 95% 的容器大小
    const scaleX = (containerRect.width * padding) / imgWidth;
    const scaleY = (containerRect.height * padding) / imgHeight;
    
    // 取较小的比例，确保图片完整显示
    // 如果图片比容器小，允许放大到容器大小
    // 如果图片比容器大，缩小到容器内
    const fitScale = Math.min(scaleX, scaleY);
    
    console.log('[ImageViewer] 计算缩放比例:', fitScale, '(scaleX:', scaleX, ', scaleY:', scaleY, ')');
    
    return Math.max(MIN_SCALE, fitScale);
  }, [isImageLoaded]);

  // 图片加载完成后设置初始缩放（图片居中显示）
  useEffect(() => {
    if (isImageLoaded) {
      const fitScale = calculateFitScale();
      setInitialScale(fitScale);
      setScale(fitScale);
      // 初始位置：居中
      setPosition({ x: 0, y: 0 });
    }
  }, [isImageLoaded, calculateFitScale]);

  // 重置缩放和位置（重置到适应容器的大小，靠上对齐）
  const resetView = useCallback(() => {
    setScale(initialScale);
    setPosition({ x: 0, y: 0 });
  }, [initialScale]);

  // 放大
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + SCALE_STEP, MAX_SCALE));
  }, []);

  // 缩小
  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - SCALE_STEP, MIN_SCALE);
      if (newScale <= initialScale) {
        // 缩小到初始缩放比例时，重置到靠上对齐位置
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, [initialScale]);

  // 切换到上一张图片
  const goToPrevious = useCallback(() => {
    if (images && images.length > 1 && currentIndex > 0) {
      onIndexChange?.(currentIndex - 1);
      // 重置缩放和位置
      setIsImageLoaded(false);
    }
  }, [images, currentIndex, onIndexChange]);

  // 切换到下一张图片
  const goToNext = useCallback(() => {
    if (images && images.length > 1 && currentIndex < images.length - 1) {
      onIndexChange?.(currentIndex + 1);
      // 重置缩放和位置
      setIsImageLoaded(false);
    }
  }, [images, currentIndex, onIndexChange]);

  // 当前显示的图片
  const currentImage = images && images.length > 0 ? images[currentIndex]?.url : src;

  // 下载图片 - 使用 File System Access API
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      // 确定文件类型
      const defaultName = fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.webp') 
        ? fileName 
        : `${fileName.replace(/\.[^.]+$/, '')}.png`;

      // 尝试使用 File System Access API（需要在用户交互的同一事件循环中调用）
      if ('showSaveFilePicker' in window) {
        try {
          // 定义文件类型配置
          const fileTypeOptions = {
            suggestedName: defaultName,
            types: [
              {
                description: '图片文件',
                accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
              },
            ],
            excludeAcceptAllOption: false,
          };
          
          // @ts-expect-error - File System Access API
          const handle = await window.showSaveFilePicker(fileTypeOptions);
          
          // 用户选择了保存位置，现在获取图片数据
          const response = await fetch(currentImage);
          const blob = await response.blob();
          
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          console.log('[下载] 文件保存成功');
          setIsDownloading(false);
          return;
        } catch (err: unknown) {
          const error = err as { name?: string; message?: string };
          console.log('[下载] showSaveFilePicker 错误:', error.name, error.message);
          // 用户取消
          if (error.name === 'AbortError') {
            setIsDownloading(false);
            return;
          }
          // 其他错误，回退到传统下载
          console.log('[下载] 回退到传统下载方式');
        }
      } else {
        console.log('[下载] 浏览器不支持 File System Access API，使用传统下载');
      }
      
      // 回退到传统下载方式
      const response = await fetch(currentImage);
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
  }, [currentImage, fileName, isDownloading]);

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
    if (e.button === 0) { // 左键
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
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, zoomIn, zoomOut, resetView, goToPrevious, goToNext]);

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
        {onClose && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* 图片容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-muted/20 min-h-0"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 左箭头 - 切换到上一张 */}
        {images && images.length > 1 && currentIndex > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <img
            ref={imageRef}
            src={currentImage}
            alt={alt}
            className="select-none"
            style={{ maxWidth: 'none', maxHeight: 'none' }}
            draggable={false}
            onLoad={() => setIsImageLoaded(true)}
          />
        </div>
        
        {/* 右箭头 - 切换到下一张 */}
        {images && images.length > 1 && currentIndex < images.length - 1 && (
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 提示 */}
      <div className="text-xs text-muted-foreground text-center py-1 border-t bg-muted/30">
        {images && images.length > 1 ? (
          <span>
            第 {currentIndex + 1}/{images.length} 张 · 左右键或箭头切换 · 滚轮缩放 · 拖拽移动 · ESC 关闭
          </span>
        ) : (
          <span>滚轮缩放 · 拖拽移动 · 按 ESC 关闭</span>
        )}
      </div>
    </div>
  );
}
