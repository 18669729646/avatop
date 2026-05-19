'use client';

import { useState, useRef, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallback?: React.ReactNode;
  showPlaceholder?: boolean;
  placeholderBg?: string;
}

/**
 * 优化的图片组件
 * - 自动懒加载
 * - 加载占位符
 * - 错误处理
 * - 优化性能
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fallback,
  showPlaceholder = true,
  placeholderBg = 'bg-muted',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // 提前 50px 开始加载
        threshold: 0.01,
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.disconnect();
      }
    };
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // 加载占位符
  if (!isInView) {
    return (
      <div
        ref={imgRef}
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
        className={cn(
          'animate-pulse',
          placeholderBg,
          className,
          'flex items-center justify-center'
        )}
      >
        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
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
        {fallback || <span className="text-sm">加载失败</span>}
      </div>
    );
  }

  // 正常加载
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
      {...props}
    />
  );
}
