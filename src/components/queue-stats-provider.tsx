'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getQueueStats, type QueueStats } from '@/lib/queue';
import { DEFAULT_QUEUE_STATS, QueueStatsProvider } from '@/lib/queue-stats-context';

interface QueueStatsRootProviderProps {
  children: ReactNode;
}

export function QueueStatsRootProvider({ children }: QueueStatsRootProviderProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [queueStats, setQueueStats] = useState<QueueStats>(DEFAULT_QUEUE_STATS);

  const refreshQueueStats = useCallback(async () => {
    try {
      const result = await getQueueStats();
      setQueueStats(result.stats);
    } catch {
      // 忽略错误，下次轮询会重试
    }
  }, []);

  useEffect(() => {
    const isPublicPath = pathname === '/login' || pathname === '/register' || pathname === '/landing';

    if (isPublicPath || authLoading || !isAuthenticated) {
      setQueueStats(DEFAULT_QUEUE_STATS);
      return;
    }

    void refreshQueueStats();

    const interval = setInterval(() => {
      void refreshQueueStats();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [authLoading, isAuthenticated, pathname, refreshQueueStats]);

  return (
    <QueueStatsProvider value={{ queueStats, refreshQueueStats }}>
      {children}
    </QueueStatsProvider>
  );
}
