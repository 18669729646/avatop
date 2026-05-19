'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { SWRProvider } from '@/lib/swr';

// 处理 ChunkLoadError：当开发环境热更新后 chunk 文件不存在时自动刷新页面
function ChunkErrorHandler() {
  useEffect(() => {
    const isChunkError = (error: unknown): boolean => {
      if (!error) return false;
      const err = error as { name?: string; code?: string; message?: string; digest?: string };
      const message = err?.message || '';
      const name = err?.name || '';
      
      return (
        name === 'ChunkLoadError' ||
        err?.code === 'MODULE_NOT_FOUND' ||
        message.includes('Loading chunk') ||
        message.includes('Loading CSS chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('chunk load failed') ||
        // Next.js 动态加载失败
        message.includes('Failed to fetch dynamically imported module') ||
        // webpack chunk 加载超时
        message.includes('Loading chunk') && message.includes('failed')
      );
    };

    // 监听全局错误
    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.error) || isChunkError({ message: event.message })) {
        console.warn('[ChunkErrorHandler] 检测到 ChunkLoadError，正在刷新页面...');
        event.preventDefault();
        window.location.reload();
      }
    };

    // 监听未处理的 Promise 拒绝（Next.js 动态 import 通过 Promise）
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason)) {
        console.warn('[ChunkErrorHandler] 检测到 ChunkLoadError (Promise)，正在刷新页面...');
        event.preventDefault();
        window.location.reload();
      }
    };

    // Next.js 内部 chunk 加载错误可能通过 console.error 输出
    // 重写 console.error 捕获
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args.map(a => typeof a === 'string' ? a : (a as { message?: string })?.message || '').join(' ');
      if (message.includes('ChunkLoadError') || message.includes('chunk load failed')) {
        console.warn('[ChunkErrorHandler] 检测到 ChunkLoadError (console)，正在刷新页面...');
        window.location.reload();
        return;
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);
  
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SWRProvider>
        <ChunkErrorHandler />
        {children}
      </SWRProvider>
    </AuthProvider>
  );
}
