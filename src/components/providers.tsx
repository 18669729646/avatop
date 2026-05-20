'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { SWRProvider } from '@/lib/swr';

// 处理 ChunkLoadError：当热更新后 chunk 文件不存在时自动刷新页面
function ChunkErrorHandler() {
  useEffect(() => {
    const reload = () => {
      console.warn('[ChunkErrorHandler] 检测到 ChunkLoadError，正在刷新页面...');
      window.location.reload();
    };

    // 方式1：监听全局错误事件
    const handleError = (event: ErrorEvent) => {
      const message = event.error?.message || event.message || '';
      const name = event.error?.name || '';
      if (
        name === 'ChunkLoadError' ||
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('chunk load failed') ||
        message.includes('Failed to fetch dynamically imported module')
      ) {
        event.preventDefault();
        reload();
      }
    };

    // 方式2：监听未处理的 Promise 拒绝
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = (reason instanceof Error ? reason.message : String(reason)) || '';
      const name = reason instanceof Error ? reason.name : '';
      if (
        name === 'ChunkLoadError' ||
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('chunk load failed')
      ) {
        event.preventDefault();
        reload();
      }
    };

    // 方式3：直接 patch webpack 5 的 chunk 加载函数（最有效）
    // webpack 5 通过 __webpack_require__.e 加载 chunk，失败时抛出 ChunkLoadError
    const patchWebpackChunkLoading = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const originalE = win.__webpack_require__?.e;
      if (typeof originalE === 'function') {
        win.__webpack_require__.e = function patchedE(chunkId: unknown) {
          return originalE.call(win.__webpack_require__, chunkId).catch((err: Error) => {
            if (
              err?.name === 'ChunkLoadError' ||
              err?.message?.includes('chunk') ||
              err?.message?.includes('Chunk')
            ) {
              reload();
            }
            throw err;
          });
        };
      }
    };

    // 延迟执行，等待 webpack 初始化
    const timer = setTimeout(patchWebpackChunkLoading, 100);

    // 方式4：监听 console.error 中的 ChunkLoadError
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args.map(a => typeof a === 'string' ? a : (a as { message?: string })?.message || '').join(' ');
      if (message.includes('ChunkLoadError') || message.includes('chunk load failed')) {
        reload();
        return;
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);
  
  return null;
}

import { Component, ReactNode } from 'react';

// React Error Boundary：捕获子组件渲染阶段的 ChunkLoadError
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const message = error?.message || '';
    const name = error?.name || '';
    if (
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('chunk load failed') ||
      message.includes('Failed to fetch dynamically imported module')
    ) {
      console.warn('[ChunkErrorBoundary] 检测到 ChunkLoadError，正在刷新页面...');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>页面正在更新，请稍候...</p>
          <button onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SWRProvider>
        <ChunkErrorHandler />
        <ChunkErrorBoundary>{children}</ChunkErrorBoundary>
      </SWRProvider>
    </AuthProvider>
  );
}
