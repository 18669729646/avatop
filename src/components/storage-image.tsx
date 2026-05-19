'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { StorageItem, needsRefresh, extractKeyFromUrl } from '@/lib/storage-types';

export interface StorageImageProps {
  /** 存储项（包含 key 和 url）或纯 URL 字符串（兼容旧数据） */
  item: StorageItem | string;
  /** 图片替代文本 */
  alt: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
  /** 图片类名 */
  className?: string;
  /** 容器类名 */
  containerClassName?: string;
  /** 图片填充模式 */
  fill?: boolean;
  /** 图片适应模式 */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** 加载失败时的回调 */
  onError?: () => void;
  /** 是否自动刷新过期 URL（默认 true） */
  autoRefresh?: boolean;
  /** 最大刷新次数（默认 2 次） */
  maxRefreshAttempts?: number;
  /** 刷新前的延迟（毫秒，默认 500） */
  refreshDelay?: number;
  /** 加载中占位符 */
  loadingPlaceholder?: React.ReactNode;
  /** 错误占位符 */
  errorPlaceholder?: React.ReactNode;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 统一的存储图片组件
 * - 支持自动刷新过期的签名 URL
 * - 兼容旧数据格式（纯 URL 字符串）
 */
export function StorageImage({
  item,
  alt,
  width,
  height,
  className,
  containerClassName,
  fill = false,
  objectFit = 'cover',
  onError,
  autoRefresh = true,
  maxRefreshAttempts = 2,
  refreshDelay = 500,
  loadingPlaceholder,
  errorPlaceholder,
  onClick,
}: StorageImageProps) {
  // 解析存储项
  const parsedItem = typeof item === 'string' 
    ? { key: extractKeyFromUrl(item), url: item } 
    : item;
  
  const [url, setUrl] = useState(parsedItem.url);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  // 刷新 URL
  const refreshUrl = useCallback(async () => {
    if (!parsedItem.key || refreshAttempts >= maxRefreshAttempts) {
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/storage/refresh-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [parsedItem.key] }),
      });
      
      const data = await response.json();
      if (data.success && data.urlMap[parsedItem.key]) {
        setUrl(data.urlMap[parsedItem.key]);
        setRefreshAttempts(prev => prev + 1);
        setHasError(false);
        return true;
      }
    } catch (error) {
      console.error('[StorageImage] 刷新 URL 失败:', error);
    } finally {
      setIsLoading(false);
    }
    return false;
  }, [parsedItem.key, refreshAttempts, maxRefreshAttempts]);

  // 检查是否需要刷新（提前刷新策略）
  useEffect(() => {
    if (!autoRefresh || typeof item !== 'object') return;
    
    // 如果没有 urlGeneratedAt，或者 URL 已接近过期，提前刷新
    if (needsRefresh(item.urlGeneratedAt) && parsedItem.key && refreshAttempts < maxRefreshAttempts) {
      console.log('[StorageImage] URL 即将过期，提前刷新');
      refreshUrl();
    }
  }, [item, autoRefresh, parsedItem.key, refreshAttempts, maxRefreshAttempts, refreshUrl]);

  // 处理图片加载错误
  const handleError = useCallback(async () => {
    setHasError(true);
    
    if (autoRefresh && refreshAttempts < maxRefreshAttempts) {
      // 等待一段时间后刷新
      await new Promise(resolve => setTimeout(resolve, refreshDelay));
      const success = await refreshUrl();
      if (success) {
        // 刷新成功，重置错误状态
        return;
      }
    }
    
    onError?.();
  }, [autoRefresh, refreshAttempts, maxRefreshAttempts, refreshDelay, refreshUrl, onError]);

  // 处理图片加载成功
  const handleLoad = useCallback(() => {
    setHasError(false);
    setIsLoading(false);
  }, []);

  // 默认加载中占位符
  const defaultLoadingPlaceholder = (
    <div className={cn(
      "flex items-center justify-center bg-muted animate-pulse",
      containerClassName
    )}>
      <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );

  // 默认错误占位符
  const defaultErrorPlaceholder = (
    <div className={cn(
      "flex items-center justify-center bg-muted",
      containerClassName
    )}>
      <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
  );

  // 如果没有 URL 或已错误且刷新失败
  if (!url || (hasError && refreshAttempts >= maxRefreshAttempts)) {
    return errorPlaceholder || defaultErrorPlaceholder;
  }

  // 加载中
  if (isLoading && loadingPlaceholder) {
    return loadingPlaceholder;
  }

  // 图片元素
  const imageElement = fill ? (
    <Image
      src={url}
      alt={alt}
      fill
      className={cn(
        className,
        objectFit === 'cover' && 'object-cover',
        objectFit === 'contain' && 'object-contain',
        objectFit === 'fill' && 'object-fill',
        objectFit === 'none' && 'object-none',
        objectFit === 'scale-down' && 'object-scale-down',
      )}
      onError={handleError}
      onLoad={handleLoad}
      onClick={onClick}
      unoptimized // 禁用 Next.js 图片优化，因为是动态 URL
    />
  ) : (
    <Image
      src={url}
      alt={alt}
      width={width || 100}
      height={height || 100}
      className={cn(
        className,
        objectFit === 'cover' && 'object-cover',
        objectFit === 'contain' && 'object-contain',
        objectFit === 'fill' && 'object-fill',
        objectFit === 'none' && 'object-none',
        objectFit === 'scale-down' && 'object-scale-down',
      )}
      onError={handleError}
      onLoad={handleLoad}
      onClick={onClick}
      unoptimized
    />
  );

  // 如果有容器类名，包装一层
  if (containerClassName) {
    return (
      <div className={containerClassName}>
        {imageElement}
      </div>
    );
  }

  return imageElement;
}

/**
 * 简单的图片组件（不使用 Next.js Image）
 * 适用于不需要优化的小图片或缩略图
 */
export function StorageImg({
  item,
  alt,
  className,
  onError,
  autoRefresh = true,
  maxRefreshAttempts = 2,
  onClick,
}: Omit<StorageImageProps, 'width' | 'height' | 'fill' | 'objectFit' | 'containerClassName'>) {
  // 解析存储项
  const parsedItem = typeof item === 'string' 
    ? { key: extractKeyFromUrl(item), url: item } 
    : item;
  
  const [url, setUrl] = useState(parsedItem.url);
  const [hasError, setHasError] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  // 刷新 URL
  const refreshUrl = useCallback(async () => {
    if (!parsedItem.key || refreshAttempts >= maxRefreshAttempts) {
      return false;
    }

    try {
      const response = await fetch('/api/storage/refresh-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [parsedItem.key] }),
      });
      
      const data = await response.json();
      if (data.success && data.urlMap[parsedItem.key]) {
        setUrl(data.urlMap[parsedItem.key]);
        setRefreshAttempts(prev => prev + 1);
        setHasError(false);
        return true;
      }
    } catch (error) {
      console.error('[StorageImg] 刷新 URL 失败:', error);
    }
    return false;
  }, [parsedItem.key, refreshAttempts, maxRefreshAttempts]);

  // 处理图片加载错误
  const handleError = useCallback(async () => {
    setHasError(true);
    
    if (autoRefresh && refreshAttempts < maxRefreshAttempts) {
      const success = await refreshUrl();
      if (success) {
        return;
      }
    }
    
    onError?.();
  }, [autoRefresh, refreshAttempts, maxRefreshAttempts, refreshUrl, onError]);

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={handleError}
      onClick={onClick}
    />
  );
}
