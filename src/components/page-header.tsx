'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video, Sparkles, FolderOpen, ListOrdered, Settings2, Film } from 'lucide-react';
import { SystemSettingsDialog } from '@/components/system-settings-dialog';
import { useQueueStatsContext } from '@/lib/queue-stats-context';

interface PageHeaderProps {
  currentPage: 'image' | 'video' | 'library' | 'shortfilm' | 'queue';
  title: string;
  description: string;
}

export function PageHeader({ currentPage, title, description }: PageHeaderProps) {
  const { queueStats } = useQueueStatsContext();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="space-y-4">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6">
        {/* Logo 和品牌 */}
        <Link href="/" className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Avatap 影拓" 
            className="h-16 w-auto object-contain"
          />
        </Link>

        {/* 导航菜单 */}
        <nav className="flex items-center gap-1">
          <Link href="/">
            <Button 
              variant={currentPage === 'image' ? 'default' : 'ghost'} 
              size="sm"
              className={currentPage === 'image' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              图片生成
            </Button>
          </Link>
          <Link href="/video">
            <Button 
              variant={currentPage === 'video' ? 'default' : 'ghost'} 
              size="sm"
              className={currentPage === 'video' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Video className="w-4 h-4 mr-1" />
              视频生成
            </Button>
          </Link>
          <Link href="/shortfilm">
            <Button 
              variant={currentPage === 'shortfilm' ? 'default' : 'ghost'} 
              size="sm"
              className={currentPage === 'shortfilm' ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              <Film className="w-4 h-4 mr-1" />
              短片创作
            </Button>
          </Link>
          <Link href="/library">
            <Button 
              variant={currentPage === 'library' ? 'default' : 'ghost'} 
              size="sm"
              className={currentPage === 'library' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              图库管理
            </Button>
          </Link>
          <Link href="/queue">
            <Button 
              variant={currentPage === 'queue' ? 'default' : 'ghost'} 
              size="sm"
              className={`relative ${currentPage === 'queue' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            >
              <ListOrdered className="w-4 h-4 mr-1" />
              任务队列
              {(queueStats.pending > 0 || queueStats.running > 0 || queueStats.failed > 0) && currentPage !== 'queue' && (
                <span className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-red-500 text-white text-xs rounded-full">
                  {queueStats.pending + queueStats.running + queueStats.failed}
                </span>
              )}
            </Button>
          </Link>
          
          {/* 系统设置按钮 */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </nav>
      </header>

      {/* 页面标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          {title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>

      {/* 系统设置对话框 */}
      <SystemSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
