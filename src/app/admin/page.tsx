'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth, authFetch } from '@/lib/auth-context';
import {
  Loader2,
  ShieldX,
  Users,
  FileText,
  Bug,
  ArrowLeft,
  BarChart3,
  Settings,
  Database,
  Activity,
  Coins,
  Package,
  Cpu,
  MessageSquare,
  FileType,
  Film,
} from 'lucide-react';

// 统计数据类型
interface DashboardStats {
  users: {
    total: number;
    active: number;
    frozen: number;
    todayNew: number;
  };
  logs: {
    adminActions: number;
    systemErrors: number;
    todayErrors: number;
  };
  system: {
    totalImages: number;
    totalVideos: number;
    storageUsed: string;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // 权限验证
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      if (user?.role !== 'admin') {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // 加载统计数据
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadStats();
  }, [authLoading, isAuthenticated, user]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        console.error('加载统计数据失败:', data.error);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载中
  if (authLoading || (loading && !stats)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  // 访问被拒绝
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">访问受限</h2>
            <p className="text-muted-foreground mb-4">
              管理后台仅限管理员访问
            </p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 功能卡片配置
  const featureCards = [
    {
      title: '用户管理',
      description: '查看和管理用户账户',
      icon: Users,
      href: '/admin/users',
      color: 'bg-blue-500',
      stats: stats ? `${stats.users.total} 人` : '-',
      subStats: stats ? `今日新增 ${stats.users.todayNew}` : '',
    },
    {
      title: '操作记录',
      description: '管理员的操作日志',
      icon: FileText,
      href: '/admin/logs',
      color: 'bg-amber-500',
      stats: stats ? `${stats.logs.adminActions} 条` : '-',
      subStats: '',
    },
    {
      title: '积分管理',
      description: '积分价格配置',
      icon: Coins,
      href: '/admin/credits',
      color: 'bg-amber-600',
      stats: '7 项配置',
      subStats: '点击调整价格',
    },
    {
      title: '套餐管理',
      description: '充值套餐配置',
      icon: Package,
      href: '/admin/credit-packages',
      color: 'bg-indigo-500',
      stats: '套餐设置',
      subStats: '点击管理套餐',
    },
    {
      title: '成品案例',
      description: '管理首页展示的成品案例',
      icon: Film,
      href: '/admin/showcase-cases',
      color: 'bg-pink-500',
      stats: '案例管理',
      subStats: '点击添加案例',
    },
    {
      title: '客服配置',
      description: '客服二维码、联系方式',
      icon: MessageSquare,
      href: '/admin/customer-service',
      color: 'bg-teal-500',
      stats: '客服设置',
      subStats: '点击配置',
    },
    {
      title: '模型配置',
      description: '文本/图片/视频生成模型',
      icon: Cpu,
      href: '/admin/model-settings',
      color: 'bg-cyan-500',
      stats: 'API配置',
      subStats: '点击配置模型',
    },
    {
      title: '提示词配置',
      description: '脚本生成系统提示词模板',
      icon: FileType,
      href: '/admin/prompt-settings',
      color: 'bg-orange-500',
      stats: '提示词模板',
      subStats: '点击编辑',
    },
    {
      title: '系统日志',
      description: '系统运行和错误日志',
      icon: Bug,
      href: '/admin/system-logs',
      color: 'bg-red-500',
      stats: stats ? `今日 ${stats.logs.todayErrors} 条` : '-',
      subStats: stats && stats.logs.todayErrors > 0 ? '有新错误' : '运行正常',
      highlight: stats && stats.logs.todayErrors > 0,
    },
    {
      title: '数据统计',
      description: '系统资源使用情况',
      icon: BarChart3,
      href: '/admin/stats',
      color: 'bg-green-500',
      stats: stats ? `${stats.system.totalImages + stats.system.totalVideos} 个` : '-',
      subStats: stats ? `存储 ${stats.system.storageUsed}` : '',
    },
    {
      title: '存储管理',
      description: '存储配额与使用排行',
      icon: Database,
      href: '/admin/storage',
      color: 'bg-purple-500',
      stats: stats ? stats.system.storageUsed : '-',
      subStats: '点击查看详情',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-7xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回首页
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h1 className="text-lg font-semibold">管理后台</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">系统运行正常</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 欢迎信息 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">欢迎回来，{user?.nickname || '管理员'}</h2>
          <p className="text-muted-foreground">以下是系统概览和快捷入口</p>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总用户</p>
                  <p className="text-2xl font-bold">{stats?.users.total || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{stats?.users.active || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日错误</p>
                  <p className="text-2xl font-bold text-red-500">{stats?.logs.todayErrors || 0}</p>
                </div>
                <Bug className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">存储使用</p>
                  <p className="text-2xl font-bold">{stats?.system.storageUsed || '0 GB'}</p>
                </div>
                <Database className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 功能入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href}>
                <Card className={`h-full transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer ${card.highlight ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {card.highlight && (
                        <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full animate-pulse">
                          需关注
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg mb-1">{card.title}</CardTitle>
                    <CardDescription className="mb-3">{card.description}</CardDescription>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{card.stats}</span>
                      {card.subStats && (
                        <span className={`text-muted-foreground ${card.highlight ? 'text-red-500' : ''}`}>
                          {card.subStats}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* 快捷操作 */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">快捷操作</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/users">查看用户列表</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/showcase-cases">管理成品案例</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/system-logs">查看系统日志</Link>
            </Button>
            <Button variant="outline" onClick={() => loadStats()}>
              刷新统计数据
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
