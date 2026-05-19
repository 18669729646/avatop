'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth, authFetch } from '@/lib/auth-context';
import {
  ArrowLeft,
  Loader2,
  ShieldX,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Settings,
  Database,
} from 'lucide-react';
import { getActionTypeName, getActionDisplayName } from '@/lib/admin-log-utils';

// 日志信息类型
interface AdminLog {
  id: number;
  adminId: string;
  adminNickname: string | null;
  adminPhone: string;
  actionType: string;
  actionName: string;
  targetId: string | null;
  targetInfo: string | null;
  detail: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

// 分页信息
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminLogsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [actionTypeFilter, setActionTypeFilter] = useState('all');

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
  }, [authLoading, isAuthenticated, user, pagination.page, actionTypeFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (actionTypeFilter && actionTypeFilter !== 'all') {
        params.append('actionType', actionTypeFilter);
      }

      const response = await authFetch(`/api/admin/logs?${params}`);
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

  // 获取操作类型图标
  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'user_manage':
        return <User className="w-4 h-4" />;
      case 'system_settings':
        return <Settings className="w-4 h-4" />;
      case 'data_manage':
        return <Database className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // 获取操作类型颜色
  const getActionTypeColor = (type: string) => {
    switch (type) {
      case 'user_manage':
        return 'bg-blue-500';
      case 'system_settings':
        return 'bg-amber-500';
      case 'data_manage':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 格式化详情
  const formatDetail = (detail: Record<string, unknown>) => {
    if (!detail || Object.keys(detail).length === 0) {
      return '-';
    }
    
    const parts: string[] = [];
    
    if (detail.amount !== undefined) {
      const type = detail.type === 'add' ? '+' : '-';
      parts.push(`积分: ${type}${detail.amount}`);
    }
    
    if (detail.reason) {
      parts.push(`原因: ${detail.reason}`);
    }
    
    if (detail.before && detail.after) {
      const beforeStatus = (detail.before as Record<string, unknown>).status;
      const afterStatus = (detail.after as Record<string, unknown>).status;
      if (beforeStatus !== undefined && afterStatus !== undefined) {
        parts.push(`${beforeStatus} → ${afterStatus}`);
      }
    }

    return parts.length > 0 ? parts.join(' | ') : JSON.stringify(detail);
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
              操作记录仅限管理员查看
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
            <FileText className="w-5 h-5" />
            <h1 className="text-lg font-semibold">操作记录</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 筛选条件 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-[200px]">
                <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="user_manage">用户管理</SelectItem>
                    <SelectItem value="system_settings">系统设置</SelectItem>
                    <SelectItem value="data_manage">数据管理</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 日志列表 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">操作记录列表</CardTitle>
                <CardDescription>共 {pagination.total} 条记录（只读）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>操作者</TableHead>
                    <TableHead>操作类型</TableHead>
                    <TableHead>操作动作</TableHead>
                    <TableHead>操作对象</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead>IP地址</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {log.adminNickname || `管理员 ${log.adminPhone.slice(-4)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{log.adminPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getActionTypeColor(log.actionType)} text-white`}>
                          <span className="flex items-center gap-1">
                            {getActionTypeIcon(log.actionType)}
                            {getActionTypeName(log.actionType)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{getActionDisplayName(log.actionName)}</span>
                      </TableCell>
                      <TableCell>
                        {log.targetInfo ? (
                          <div>
                            <p>{log.targetInfo}</p>
                            {log.targetId && (
                              <p className="text-xs text-muted-foreground">
                                ID: {log.targetId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDetail(log.detail)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono">
                          {log.ipAddress}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无操作记录
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
      </div>
    </div>
  );
}
