'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  fallback?: React.ReactNode;
  showPlaceholder?: boolean;
  placeholderBg?: string;
  onLoad?: () => void;
}

/**
 * 懒加载图片组件（适用于外部 URL）
 * - 自动懒加载
 * - 加载占位符
 * - 错误处理
 */
export function LazyImage({
  src,
  alt,
  className,
  fallback,
  showPlaceholder = true,
  placeholderBg = 'bg-muted',
  onLoad,
  ...props
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  console.log('[LazyImage] State:', { src, isLoading, hasError, isInView, showPlaceholder });

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    console.log('[LazyImage] Setting up IntersectionObserver for:', src);

    const observer = new IntersectionObserver(
      ([entry]) => {
        console.log('[LazyImage] IntersectionObserver entry:', entry.isIntersecting, src);
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    const currentRef = containerRef.current || imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      console.log('[LazyImage] IntersectionObserver observing:', src);
    } else {
      console.warn('[LazyImage] No ref to observe:', src);
    }

    return () => {
      observer.disconnect();
    };
  }, [src]);

  const handleLoad = () => {
    console.log('[LazyImage] Image loaded:', src);
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    console.error('[LazyImage] Image error:', src);
    setIsLoading(false);
    setHasError(true);
  };

  // 加载占位符
  if (!isInView) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'animate-pulse',
          placeholderBg,
          className,
          'flex items-center justify-center'
        )}
      />
    );
  }

  // 加载中占位符
  if (isLoading && showPlaceholder && !hasError) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'animate-pulse',
          placeholderBg,
          className,
          'flex items-center justify-center'
        )}
      >
        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
      </div>
    );
  }

  // 错误状态
  if (hasError) {
    return (
      <div
        className={cn(
          placeholderBg,
          className,
          'flex items-center justify-center text-muted-foreground'
        )}
      >
        {fallback || <span className="text-xs">加载失败</span>}
      </div>
    );
  }

  // 正常加载
  return (
    <div ref={containerRef} className="w-full h-full">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}
