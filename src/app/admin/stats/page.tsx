'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth, authFetch } from '@/lib/auth-context';
import {
  ArrowLeft,
  Loader2,
  ShieldX,
  BarChart3,
  Image,
  Video,
  Users,
  Database,
  HardDrive,
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Film,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 统计数据类型
interface StatsData {
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
  projects: {
    total: number;
    hasImages: number;
    hasVideos: number;
  };
  library: {
    characters: number;
    products: number;
    templates: number;
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    retrying: number;
    success: number;
    failed: number;
  };
  credits: {
    totalBalance: number;
    totalPurchased: number;
    totalUsed: number;
    packagesSold: number;
  };
}

export default function AdminStatsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<StatsData | null>(null);
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
              数据统计仅限管理员查看
            </p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 计算活跃率
  const activeRate = stats ? ((stats.users.active / stats.users.total) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-7xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回管理后台
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <h1 className="text-lg font-semibold">数据统计</h1>
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadStats}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 概览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 总用户数 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-3xl font-bold">{stats?.users.total || 0}</p>
                  <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    今日新增 {stats?.users.todayNew || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 活跃用户 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-3xl font-bold">{stats?.users.active || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    活跃率 {activeRate}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 生成图片 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">生成图片</p>
                  <p className="text-3xl font-bold">{stats?.system.totalImages || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    累计生成
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 生成视频 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">生成视频</p>
                  <p className="text-3xl font-bold">{stats?.system.totalVideos || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    累计生成
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Video className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 短片项目统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="w-5 h-5" />
              短片项目
            </CardTitle>
            <CardDescription>短片项目统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">总项目数</span>
              <span className="font-semibold">{stats?.projects.total || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">已生成图片</span>
              <span className="font-semibold text-blue-500">{stats?.projects.hasImages || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">已生成视频</span>
              <span className="font-semibold text-purple-500">{stats?.projects.hasVideos || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* 图库统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-5 h-5" />
              图库统计
            </CardTitle>
            <CardDescription>角色图库和产品图库统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">角色图库</span>
              <span className="font-semibold">{stats?.library.characters || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">产品图库</span>
              <span className="font-semibold">{stats?.library.products || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">广告模板</span>
              <span className="font-semibold">{stats?.library.templates || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* 任务队列统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-5 h-5" />
              任务队列
            </CardTitle>
            <CardDescription>任务队列状态统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">待处理</span>
              <span className="font-semibold text-yellow-500">{stats?.tasks.pending || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">运行中</span>
              <span className="font-semibold text-blue-500">{stats?.tasks.running || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">重试中</span>
              <span className="font-semibold text-orange-500">{stats?.tasks.retrying || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <span className="text-sm">成功</span>
              <span className="font-semibold text-green-500">{stats?.tasks.success || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <span className="text-sm">失败</span>
              <span className="font-semibold text-red-500">{stats?.tasks.failed || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* 积分统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              积分统计
            </CardTitle>
            <CardDescription>积分充值和消耗统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <span className="text-sm">当前总余额</span>
              <span className="font-semibold text-blue-500">{stats?.credits.totalBalance || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">累计充值</span>
              <span className="font-semibold">{stats?.credits.totalPurchased || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm">累计消耗</span>
              <span className="font-semibold">{stats?.credits.totalUsed || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <span className="text-sm">套餐销售数</span>
              <span className="font-semibold text-green-500">{stats?.credits.packagesSold || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* 详细统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* 用户统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5" />
                用户统计
              </CardTitle>
              <CardDescription>用户账户状态概览</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">总用户数</span>
                <span className="font-semibold">{stats?.users.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">活跃用户</span>
                <span className="font-semibold text-green-500">{stats?.users.active || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">冻结用户</span>
                <span className="font-semibold text-red-500">{stats?.users.frozen || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <span className="text-sm">今日新增</span>
                <span className="font-semibold text-blue-500">{stats?.users.todayNew || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 短片项目统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="w-5 h-5" />
                短片项目
              </CardTitle>
              <CardDescription>短片项目统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">总项目数</span>
                <span className="font-semibold">{stats?.projects.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">已生成图片</span>
                <span className="font-semibold text-blue-500">{stats?.projects.hasImages || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">已生成视频</span>
                <span className="font-semibold text-purple-500">{stats?.projects.hasVideos || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 图库统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5" />
                图库统计
              </CardTitle>
              <CardDescription>角色图库和产品图库统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">角色图库</span>
                <span className="font-semibold">{stats?.library.characters || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">产品图库</span>
                <span className="font-semibold">{stats?.library.products || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">广告模板</span>
                <span className="font-semibold">{stats?.library.templates || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 任务队列统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5" />
                任务队列
              </CardTitle>
              <CardDescription>任务队列状态统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">待处理</span>
                <span className="font-semibold text-yellow-500">{stats?.tasks.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">运行中</span>
                <span className="font-semibold text-blue-500">{stats?.tasks.running || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <span className="text-sm">成功</span>
                <span className="font-semibold text-green-500">{stats?.tasks.success || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <span className="text-sm">失败</span>
                <span className="font-semibold text-red-500">{stats?.tasks.failed || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 积分统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                积分统计
              </CardTitle>
              <CardDescription>积分充值和消耗统计</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <span className="text-sm">当前总余额</span>
                <span className="font-semibold text-blue-500">{stats?.credits.totalBalance || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">累计充值</span>
                <span className="font-semibold">{stats?.credits.totalPurchased || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">累计消耗</span>
                <span className="font-semibold">{stats?.credits.totalUsed || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <span className="text-sm">套餐销售数</span>
                <span className="font-semibold text-green-500">{stats?.credits.packagesSold || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 内容统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-5 h-5" />
                内容统计
              </CardTitle>
              <CardDescription>生成内容数量概览</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">生成图片总数</span>
                <span className="font-semibold">{stats?.system.totalImages || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">生成视频总数</span>
                <span className="font-semibold">{stats?.system.totalVideos || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">总生成数量</span>
                <span className="font-semibold">
                  {(stats?.system.totalImages || 0) + (stats?.system.totalVideos || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <span className="text-sm">存储使用量</span>
                <span className="font-semibold text-purple-500">{stats?.system.storageUsed || '0 GB'}</span>
              </div>
            </CardContent>
          </Card>

          {/* 系统日志统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                日志统计
              </CardTitle>
              <CardDescription>系统日志概览</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">管理员操作记录</span>
                <span className="font-semibold">{stats?.logs.adminActions || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">系统错误记录</span>
                <span className="font-semibold">{stats?.logs.systemErrors || 0}</span>
              </div>
              <div className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                stats?.logs.todayErrors && stats.logs.todayErrors > 0
                  ? "bg-red-50 dark:bg-red-950/20"
                  : "bg-green-50 dark:bg-green-950/20"
              )}>
                <span className="text-sm">今日错误</span>
                <span className={cn(
                  "font-semibold",
                  stats?.logs.todayErrors && stats.logs.todayErrors > 0
                    ? "text-red-500"
                    : "text-green-500"
                )}>
                  {stats?.logs.todayErrors || 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快捷操作</CardTitle>
              <CardDescription>常用管理功能入口</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/admin/users">
                  <Users className="w-4 h-4 mr-2" />
                  用户管理
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/admin/storage">
                  <Database className="w-4 h-4 mr-2" />
                  存储管理
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/admin/system-logs">
                  <HardDrive className="w-4 h-4 mr-2" />
                  系统日志
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/admin/logs">
                  <Activity className="w-4 h-4 mr-2" />
                  操作记录
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
