'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, authFetch } from '@/lib/auth-context';
import {
  ArrowLeft,
  Database,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Trash2,
  Image,
  Video,
  Users,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 数据统计类型
interface DataStats {
  imageHistory: number;
  videoHistory: number;
  characterLibrary: number;
  productLibrary: number;
  totalSize: number;
  // 管理员额外数据
  totalUsers?: number;
  totalUsageRecords?: number;
}

export default function DataManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  // 权限验证
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 加载数据统计
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }
    loadStats();
  }, [authLoading, isAuthenticated]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/data/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('加载数据统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清除数据
  const handleClearData = async () => {
    if (!confirm('确定要清除您的历史数据吗？此操作不可恢复！')) {
      return;
    }

    setClearing(true);
    try {
      const response = await authFetch('/api/data/clear', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        loadStats();
      } else {
        alert(data.error || '清除失败');
      }
    } catch (error) {
      alert('清除失败');
    } finally {
      setClearing(false);
    }
  };

  // 格式化字节大小
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

  // 未登录
  if (!isAuthenticated) {
    return null;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-4xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <h1 className="text-lg font-semibold">
              {isAdmin ? '全站数据管理' : '数据管理'}
            </h1>
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

      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* 管理员提示 */}
        {isAdmin && (
          <Alert className="mb-6 border-blue-500 bg-blue-50">
            <AlertDescription className="text-sm text-blue-700">
              您是管理员，以下显示的是全站数据统计。清除数据将影响所有用户。
            </AlertDescription>
          </Alert>
        )}

        {/* 存储统计 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">存储使用情况</CardTitle>
            <CardDescription>
              {isAdmin ? '全站存储使用统计' : '您的存储使用统计'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats && (
              <>
                {/* 存储大小进度条 */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>总存储使用量</span>
                    <span>{formatBytes(stats.totalSize)} / 5 GB</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        stats.totalSize > 4 * 1024 * 1024 * 1024
                          ? "bg-red-500"
                          : stats.totalSize > 2.5 * 1024 * 1024 * 1024
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min((stats.totalSize / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                    />
                  </div>
                  {stats.totalSize > 4 * 1024 * 1024 * 1024 && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      存储空间即将用尽，建议清理数据
                    </p>
                  )}
                </div>

                {/* 数据统计 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-blue-500" />
                      <span>生成图片</span>
                    </div>
                    <span className="font-medium">{stats.imageHistory}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-500" />
                      <span>生成视频</span>
                    </div>
                    <span className="font-medium">{stats.videoHistory}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <span>角色图库</span>
                    </div>
                    <span className="font-medium">{stats.characterLibrary}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-500" />
                      <span>产品图库</span>
                    </div>
                    <span className="font-medium">{stats.productLibrary}</span>
                  </div>
                </div>

                {/* 管理员额外统计 */}
                {isAdmin && (
                  <>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium mb-3">全站统计</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span>注册用户</span>
                          <span className="font-medium">{stats.totalUsers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span>使用记录</span>
                          <span className="font-medium">{stats.totalUsageRecords || 0}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据操作</CardTitle>
              <CardDescription>
                清除您的历史数据（不可恢复）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={clearing || loading}
              >
                {clearing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    清除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除我的历史数据
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                仅清除您账户下的历史数据，系统配置和其他用户数据不受影响。
              </p>
            </CardContent>
          </Card>
        )}

        {/* 管理员提示 */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据操作</CardTitle>
              <CardDescription>
                管理员数据操作
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertDescription className="text-sm">
                  管理员清除全站数据功能暂未开放，如需清除数据请联系技术支持。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
