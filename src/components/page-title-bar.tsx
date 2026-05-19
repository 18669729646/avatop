'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getQueueStats } from '@/lib/queue';
import Link from 'next/link';

interface PageTitleBarProps {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  showQueueStatus?: boolean;
}

export function PageTitleBar({ 
  title, 
  description, 
  badge, 
  actions,
  showQueueStatus = false 
}: PageTitleBarProps) {
  const [queueStats, setQueueStats] = useState({ total: 0, pending: 0, running: 0, success: 0, failed: 0 });

  useEffect(() => {
    if (showQueueStatus) {
      getQueueStats().then(result => setQueueStats(result.stats)).catch(() => {});
      const interval = setInterval(async () => {
        try {
          const result = await getQueueStats();
          setQueueStats(result.stats);
        } catch {
          // 忽略错误，下次轮询会重试
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [showQueueStatus]);

  return (
    <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
          {description && (
            <span className="text-sm text-muted-foreground hidden md:inline">
              {description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showQueueStatus && (
            <>
              {queueStats.running > 0 && (
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  生成中 {queueStats.running}
                </Badge>
              )}
              {queueStats.pending > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-200">
                  排队中 {queueStats.pending}
                </Badge>
              )}
            </>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
