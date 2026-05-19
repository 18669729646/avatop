'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Video,
  Film,
  FolderOpen,
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Sun,
  Bookmark,
  BookOpen,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getQueueStats } from '@/lib/queue';
import { useAuth } from '@/lib/auth-context';
import { UserMenu } from '@/components/user-menu';
import { Loader2 } from 'lucide-react';
import { AuthDialog } from '@/components/auth-dialog';

// 环境变量
const COZE_PROJECT_ENV = process.env.COZE_PROJECT_ENV || 'DEV';

// 导航项配置
const navigationItems = [
  {
    id: 'landing',
    label: '首页',
    href: '/landing',
    icon: Sparkles,
    description: 'SaaS 首页',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    id: 'library',
    label: '图库管理',
    href: '/library',
    icon: FolderOpen,
    description: '角色与产品图库',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
  },
  {
    id: 'templates',
    label: '广告模板',
    href: '/shortfilm/templates',
    icon: Bookmark,
    description: '脚本模板管理',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    id: 'shortfilm',
    label: '短片管理',
    href: '/shortfilm',
    icon: Film,
    description: '短片项目管理',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'video-remake',
    label: '视频复刻',
    href: '/video-remake',
    icon: Clapperboard,
    description: '爆款短视频AI复刻',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
  },
  {
    id: 'remake-pro',
    label: '复刻大师',
    href: '/remake-pro',
    icon: Sparkles,
    description: '爆款骨架复用+产品替换',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'analysis-master',
    label: '分析大师',
    href: '/analysis-master',
    icon: Clapperboard,
    description: '短视频分镜拆解',
    color: 'text-fuchsia-500',
    bgColor: 'bg-fuchsia-500/10',
  },
  {
    id: 'image',
    label: '图片生成',
    href: '/',
    icon: Sparkles,
    description: 'AI 图片生成工具',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'video',
    label: '视频生成',
    href: '/video',
    icon: Video,
    description: 'AI 视频生成工具',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'queue',
    label: '任务队列',
    href: '/queue',
    icon: ListOrdered,
    description: '生成任务队列',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    showBadge: true,
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

// 内部布局组件
function AppLayoutInner({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [queueStats, setQueueStats] = useState({ total: 0, pending: 0, running: 0, success: 0, failed: 0 });
  const [mounted, setMounted] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'change-password'>('login');

  // 不需要认证的页面
  const publicPaths = ['/login', '/register', '/landing'];
  const isPublicPath = publicPaths.includes(pathname);
  
  // 判断是否是管理员
  const isAdmin = user?.role === 'admin';

  // 从 localStorage 加载折叠状态
  useEffect(() => {
    // 使用 setTimeout 避免同步 setState
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    
    // 加载侧边栏折叠状态（纯客户端 UI 状态，使用 localStorage）
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }
    
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
  }, []);

  // 认证检查
  useEffect(() => {
    if (!mounted || authLoading) return;
    
    // 如果不是公开页面且未登录，重定向到 SaaS 首页
    if (!isPublicPath && !isAuthenticated) {
      router.push('/landing');
    }
    
    // 如果已登录且访问登录/注册页，重定向到功能首页
    // 已登录用户可以访问 SaaS 首页 (/landing)
    if (isPublicPath && isAuthenticated && pathname !== '/landing') {
      router.push('/');
    }
  }, [mounted, authLoading, isAuthenticated, isPublicPath, router]);

  // 保存折叠状态到 localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('sidebar_collapsed', String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed, mounted]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B 切换侧边栏
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 计算活跃状态
  const isActive = useCallback((href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    // 特殊处理：广告模板路径不匹配短片管理
    if (href === '/shortfilm' && pathname.startsWith('/shortfilm/templates')) {
      return false;
    }
    return pathname.startsWith(href);
  }, [pathname]);

  // 计算队列徽章数字
  const queueBadge = queueStats.pending + queueStats.running + queueStats.failed;

  // 公开页面直接渲染内容（无侧边栏）
  if (isPublicPath) {
    return <>{children}</>;
  }

  if (!mounted || authLoading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未认证时显示加载状态（等待重定向）
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={cn(
            'flex flex-col border-r bg-muted/30 transition-all duration-300 ease-in-out shrink-0',
            collapsed ? 'w-12' : 'w-44'
          )}
        >
          {/* Logo 区域 */}
          <div className={cn(
            'flex items-center h-14 px-3 border-b shrink-0',
            collapsed ? 'justify-center' : 'justify-between'
          )}>
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2">
                <img 
                  src="/logo.png" 
                  alt="Avatap 影拓" 
                  className="h-12 w-auto object-contain"
                />
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 导航区域 */}
          <nav className="flex-1 min-h-0 overflow-y-auto py-2">
            <div className="space-y-1 px-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-lg py-1.5 text-sm font-medium transition-all duration-200',
                      'hover:bg-accent hover:text-accent-foreground',
                      active && 'bg-accent text-accent-foreground',
                      collapsed ? 'justify-center px-0 gap-0' : 'gap-3 px-3'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
                      active ? item.bgColor : 'bg-muted'
                    )}>
                      <Icon className={cn('h-4 w-4', active ? item.color : 'text-muted-foreground')} />
                    </div>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.id === 'shortfilm' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white text-[9px] font-bold italic shadow-sm shrink-0 ml-auto">
                            AI
                          </span>
                        )}
                        {item.id === 'video-remake' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white text-[9px] font-bold italic shadow-sm shrink-0 ml-auto">
                            AI
                          </span>
                        )}
                        {item.id === 'remake-pro' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white text-[9px] font-bold italic shadow-sm shrink-0 ml-auto">
                            PRO
                          </span>
                        )}
                        {item.showBadge && queueBadge > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-[20px] px-1 text-xs">
                            {queueBadge}
                          </Badge>
                        )}
                      </>
                    )}
                    {collapsed && item.showBadge && queueBadge > 0 && (
                      <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* 底部区域 */}
          <div className="border-t p-2 shrink-0">
            {/* 使用指南按钮 */}
            <Button
              variant="ghost"
              title={collapsed ? '使用指南' : undefined}
              className={cn(
                'flex items-center w-full rounded-lg py-1.5 text-sm font-medium transition-all duration-200',
                'hover:bg-accent hover:text-accent-foreground',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              )}
              onClick={() => window.open('/guide', '_blank')}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-indigo-500/10">
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </div>
              {!collapsed && <span>使用指南</span>}
            </Button>
            
            {/* 调试新手引导按钮 - 仅管理员显示 */}
            {isAdmin && (
              <Button
                variant="ghost"
                title={collapsed ? '调试引导' : undefined}
                className={cn(
                  'flex items-center w-full rounded-lg py-1.5 text-sm font-medium transition-all duration-200',
                  'hover:bg-accent hover:text-accent-foreground',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                )}
                onClick={() => {
                  const debugInfo = {
                    user: isAuthenticated ? JSON.stringify({ id: user?.id, role: user?.role }) : null,
                    localStorage_onboarding_dont_show: localStorage.getItem('onboarding_dont_show'),
                    localStorage_auth_token: localStorage.getItem('auth_token') ? '存在' : '不存在',
                    pathname: window.location.pathname,
                    environment: COZE_PROJECT_ENV,
                  };
                  console.log('[调试] 新手引导状态:', debugInfo);
                  
                  // 弹出确认对话框
                  const action = confirm(
                    `新手引导调试信息：\n\n` +
                    JSON.stringify(debugInfo, null, 2) +
                    `\n\n点击"确定"清除标记并刷新页面查看引导，\n点击"取消"仅查看信息。`
                  );
                  
                  if (action) {
                    localStorage.removeItem('onboarding_dont_show');
                    window.location.reload();
                  }
                }}
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-orange-500/10">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                </div>
                {!collapsed && <span>调试引导</span>}
              </Button>
            )}
            
            {/* 用户菜单 */}
            <div className="mt-2 pt-2 border-t">
              <UserMenu 
                collapsed={collapsed} 
                onOpenAuthDialog={(tab) => {
                  setAuthTab(tab);
                  setAuthDialogOpen(true);
                }}
              />
            </div>
          </div>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {children}
        </main>
      </div>

      {/* 认证弹窗 - 在所有页面都渲染，包括 SaaS 首页 */}
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authTab}
        showChangePassword={isAuthenticated}
      />
    </TooltipProvider>
  );
}

// 导出的 AppLayout 组件
export function AppLayout({ children }: AppLayoutProps) {
  return <AppLayoutInner>{children}</AppLayoutInner>;
}
