'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { QueueStats } from '@/lib/queue';

export interface QueueStatsContextValue {
  queueStats: QueueStats;
  refreshQueueStats: () => Promise<void>;
}

const defaultQueueStats: QueueStats = {
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
  return useContext(QueueStatsContext) ?? {
    queueStats: defaultQueueStats,
    refreshQueueStats: async () => {},
  };
}
