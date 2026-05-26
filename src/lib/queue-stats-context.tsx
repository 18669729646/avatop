'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { QueueStats } from '@/lib/queue';

export interface QueueStatsContextValue {
  queueStats: QueueStats;
  refreshQueueStats: () => Promise<void>;
}

export const DEFAULT_QUEUE_STATS: QueueStats = {
  total: 0,
  pending: 0,
  running: 0,
  retrying: 0,
  success: 0,
  failed: 0,
};

const QueueStatsContext = createContext<QueueStatsContextValue | null>(null);

export function QueueStatsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: QueueStatsContextValue;
}) {
  return <QueueStatsContext.Provider value={value}>{children}</QueueStatsContext.Provider>;
}

export function useQueueStatsContext(): QueueStatsContextValue {
  const context = useContext(QueueStatsContext);
  if (context) {
    return context;
  }

  const error = new Error('useQueueStatsContext must be used within QueueStatsProvider');
  if (process.env.NODE_ENV !== 'production') {
    throw error;
  }

  console.warn(error.message);
  return {
    queueStats: DEFAULT_QUEUE_STATS,
    refreshQueueStats: async () => {},
  };
}
