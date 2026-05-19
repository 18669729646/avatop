'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, authFetch } from '@/lib/auth-context';
import { LogVisualizations } from '@/components/admin/log-visualizations';
import {
  ArrowLeft,
  Loader2,
  ShieldX,
  Bug,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Info,
  AlertTriangle,
  XCircle,
  Trash2,
  Eye,
  RefreshCw,
} from 'lucide-react';

// 日志信息类型
interface SystemLog {
  id: string;
  level: string;
  levelName: string;
  category: string;
  categoryName: string;
  message: string;
  detail: Record<string, unknown> | null;
  userId: string | null;
  requestId: string | null;
  stackTrace: string | null;
  createdAt: string;
}

// 分页信息
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function SystemLogsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // 筛选条件
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 日志详情弹窗
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 清理日志
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');
  const [cleaning, setCleaning] = useState(false);

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

  // 加载日志列表
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadLogs();
  }, [authLoading, isAuthenticated, user, pagination.page, levelFilter, categoryFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (levelFilter && levelFilter !== 'all') {
        params.append('level', levelFilter);
      }

      if (categoryFilter && categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await authFetch(`/api/admin/system-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
      } else {
        console.error('加载日志列表失败:', data.error);
      }
    } catch (error) {
      console.error('加载日志列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLogs();
  };

  // 清理日志
  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const response = await authFetch(
        `/api/admin/system-logs?daysToKeep=${cleanupDays}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        setCleanupOpen(false);
        // 重新加载日志列表
        setPagination(prev => ({ ...prev, page: 1 }));
        await loadLogs();
      } else {
        console.error('清理日志失败:', data.error);
      }
    } catch (error) {
      console.error('清理日志失败:', error);
    } finally {
      setCleaning(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取日志级别图标和颜色
  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'info':
        return {
          icon: <Info className="w-4 h-4" />,
          color: 'bg-blue-500',
          badge: 'default',
        };
      case 'warn':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'bg-amber-500',
          badge: 'warning',
        };
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'bg-red-500',
          badge: 'destructive',
        };
      default:
        return {
          icon: <Info className="w-4 h-4" />,
          color: 'bg-gray-500',
          badge: 'default',
        };
    }
  };

  // 查看详情
  const viewDetail = (log: SystemLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  // 加载中
  if (authLoading || (loading && logs.length === 0)) {
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
              系统日志仅限管理员查看
            </p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <Bug className="w-5 h-5" />
            <h1 className="text-lg font-semibold">系统日志</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCleanupOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              清理
            </Button>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 标签页 */}
        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list">日志列表</TabsTrigger>
            <TabsTrigger value="visualization">可视化分析</TabsTrigger>
          </TabsList>

          {/* 日志列表标签页 */}
          <TabsContent value="list" className="space-y-6">
            {/* 筛选条件 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-[140px]">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="日志级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部级别</SelectItem>
                    <SelectItem value="info">信息</SelectItem>
                    <SelectItem value="warn">警告</SelectItem>
                    <SelectItem value="error">错误</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[160px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="日志分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="api">API请求</SelectItem>
                    <SelectItem value="auth">认证</SelectItem>
                    <SelectItem value="payment">支付</SelectItem>
                    <SelectItem value="video">视频处理</SelectItem>
                    <SelectItem value="image">图片处理</SelectItem>
                    <SelectItem value="task">任务队列</SelectItem>
                    <SelectItem value="storage">存储</SelectItem>
                    <SelectItem value="credits">积分</SelectItem>
                    <SelectItem value="system">系统</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] flex gap-2">
                <Input
                  placeholder="搜索日志内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日志列表 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">系统日志列表</CardTitle>
                <CardDescription>共 {pagination.total} 条记录</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">级别</TableHead>
                    <TableHead className="w-[100px]">分类</TableHead>
                    <TableHead>消息</TableHead>
                    <TableHead className="w-[120px]">用户</TableHead>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const levelInfo = getLevelInfo(log.level);
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={levelInfo.badge as 'default' | 'secondary' | 'destructive' | 'outline' | undefined}>
                            <span className="flex items-center gap-1">
                              {levelInfo.icon}
                              {log.levelName}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.categoryName}</Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm truncate max-w-[300px]" title={log.message}>
                            {log.message}
                          </p>
                        </TableCell>
                        <TableCell>
                          {log.userId ? (
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.userId.slice(0, 12)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetail(log)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无日志记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 可视化分析标签页 */}
      <TabsContent value="visualization">
        <LogVisualizations />
      </TabsContent>
    </Tabs>

    {/* 日志详情弹窗 */}
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && (
                <>
                  {getLevelInfo(selectedLog.level).icon}
                  日志详情
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.createdAt && formatDate(selectedLog.createdAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">级别</p>
                  <Badge variant={getLevelInfo(selectedLog.level).badge as 'default' | 'secondary' | 'destructive' | 'outline' | undefined}>
                    {selectedLog.levelName}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">分类</p>
                  <Badge variant="outline">{selectedLog.categoryName}</Badge>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">消息</p>
                <p className="text-sm bg-muted p-2 rounded">{selectedLog.message}</p>
              </div>

              {selectedLog.userId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">用户 ID</p>
                  <p className="text-sm font-mono">{selectedLog.userId}</p>
                </div>
              )}

              {selectedLog.requestId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">请求 ID</p>
                  <p className="text-sm font-mono">{selectedLog.requestId}</p>
                </div>
              )}

              {selectedLog.detail && Object.keys(selectedLog.detail).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">详细信息</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.detail, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.stackTrace && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">堆栈跟踪</p>
                  <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 清理日志确认对话框 */}
      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清理日志</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除 <span className="font-bold">{cleanupDays}</span> 天前的所有日志记录。
              <br />
              此操作不可撤销，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">保留天数</label>
            <Select value={cleanupDays} onValueChange={setCleanupDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">最近 7 天</SelectItem>
                <SelectItem value="15">最近 15 天</SelectItem>
                <SelectItem value="30">最近 30 天</SelectItem>
                <SelectItem value="60">最近 60 天</SelectItem>
                <SelectItem value="90">最近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} disabled={cleaning}>
              {cleaning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认清理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
