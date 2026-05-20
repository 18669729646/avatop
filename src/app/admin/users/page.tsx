'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Search,
  ShieldX,
  Users,
  Coins,
  Ban,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Image,
  Video,
  Users2,
  Package,
  ListTodo,
  Activity,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/confirm-dialog';

// 用户信息类型
interface UserInfo {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  credits: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
  usageCount: number;
  dataStats: {
    images: number;
    videos: number;
    characters: number;
    products: number;
    tasks: number;
  };
  storage: {
    bytes: number;
    mb: number;
  };
}

// 分页信息
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function UserManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 积分调整对话框
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<'add' | 'deduct'>('add');
  const [creditReason, setCreditReason] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // 冻结确认对话框
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeSubmitting, setFreezeSubmitting] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');

  // 用户操作记录对话框
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityUser, setActivityUser] = useState<UserInfo | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  
  // 用户存储详情
  const [storageDetail, setStorageDetail] = useState<{
    quotaMB: number;
    totalMB: number;
    percentUsed: number;
    isOverLimit: boolean;
    breakdown: {
      images: { count: number; mb: number; percent: number };
      videos: { count: number; mb: number; percent: number };
      characters: { count: number; mb: number; percent: number };
      analysisMaster: { count: number; mb: number; percent: number };
    };
  } | null>(null);

  // 密码验证对话框
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

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

  // 加载用户列表
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadUsers();
  }, [authLoading, isAuthenticated, user, pagination.page, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        status: statusFilter,
      });

      const response = await authFetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data.users);
        setPagination(data.data.pagination);
      } else {
        console.error('加载用户列表失败:', data.error);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadUsers();
  };

  // 打开积分调整对话框
  const openCreditDialog = (user: UserInfo) => {
    setSelectedUser(user);
    setCreditAmount('');
    setCreditType('add');
    setCreditReason('');
    setCreditDialogOpen(true);
  };

  // 提交积分调整
  const handleCreditSubmit = async () => {
    if (!selectedUser || !creditAmount) return;

    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert('请输入有效的积分数量');
      return;
    }

    // 设置待执行操作，打开密码验证对话框
    setPendingAction(() => async () => {
      setCreditSubmitting(true);
      try {
        const response = await authFetch(`/api/admin/users/${selectedUser.id}/credits`, {
          method: 'PUT',
          body: JSON.stringify({
            amount,
            type: creditType,
            reason: creditReason,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setCreditDialogOpen(false);
          loadUsers();
          alert(data.message);
        } else {
          alert(data.error);
        }
      } catch (error) {
        alert('操作失败');
      } finally {
        setCreditSubmitting(false);
      }
    });
    setPasswordDialogOpen(true);
  };

  // 打开冻结对话框
  const openFreezeDialog = (user: UserInfo) => {
    setSelectedUser(user);
    setFreezeReason('');
    setFreezeDialogOpen(true);
  };

  // 提交冻结/解冻
  const handleFreezeSubmit = async () => {
    if (!selectedUser) return;

    const newStatus = selectedUser.status === 'active' ? 'frozen' : 'active';
    
    // 设置待执行操作，打开密码验证对话框
    setPendingAction(() => async () => {
      setFreezeSubmitting(true);
      try {
        const response = await authFetch(`/api/admin/users/${selectedUser.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({
            status: newStatus,
            reason: freezeReason,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setFreezeDialogOpen(false);
          loadUsers();
          alert(data.message);
        } else {
          alert(data.error);
        }
      } catch (error) {
        alert('操作失败');
      } finally {
        setFreezeSubmitting(false);
      }
    });
    setPasswordDialogOpen(true);
  };

  // 打开用户操作记录对话框
  const openActivityDialog = async (user: UserInfo) => {
    setActivityUser(user);
    setActivityDialogOpen(true);
    setActivityPage(1);
    loadActivities(user, 1);
    loadStorageDetail(user);
  };

  // 加载用户操作记录
  const loadActivities = async (user: UserInfo, page: number) => {
    setActivityLoading(true);
    setActivityPage(page);

    try {
      const response = await authFetch(`/api/admin/users/${user.id}/activity?page=${page}&pageSize=10`);
      const data = await response.json();

      if (data.success) {
        setActivities(data.data.activities);
        setActivityTotal(data.data.pagination.total);
        setActivityTotalPages(data.data.pagination.totalPages);
      } else {
        console.error('加载操作记录失败:', data.error);
      }
    } catch (error) {
      console.error('加载操作记录失败:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  // 加载用户存储详情
  const loadStorageDetail = async (user: UserInfo) => {
    try {
      const response = await authFetch(`/api/admin/users/${user.id}/storage`);
      const data = await response.json();

      if (data.success) {
        setStorageDetail(data.data);
      }
    } catch (error) {
      console.error('加载存储详情失败:', error);
    }
  };

  // 获取活动类型图标
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <LogIn className="w-4 h-4 text-green-500" />;
      case 'usage':
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 加载中
  if (authLoading || (loading && users.length === 0)) {
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
              用户管理仅限管理员访问，您没有权限查看此页面
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
            <Users className="w-5 h-5" />
            <h1 className="text-lg font-semibold">用户管理</h1>
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
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">搜索</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="手机号或昵称"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs text-muted-foreground">状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="frozen">已冻结</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">用户列表</CardTitle>
            <CardDescription>共 {pagination.total} 个用户</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户信息</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>积分</TableHead>
                    <TableHead>存储使用</TableHead>
                    <TableHead>数据统计</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.nickname || `用户 ${u.phone.slice(-4)}`}</p>
                          <p className="text-sm text-muted-foreground">{u.phone}</p>
                          {u.role === 'admin' && (
                            <Badge variant="outline" className="text-xs mt-1">管理员</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.status === 'active' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            正常
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <Ban className="w-3 h-3 mr-1" />
                            已冻结
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-amber-600">{u.credits.balance}</p>
                          <p className="text-xs text-muted-foreground">
                            累计: {u.credits.totalPurchased} / 已用: {u.credits.totalUsed}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`font-medium ${u.storage.mb >= 500 ? 'text-red-600' : u.storage.mb >= 400 ? 'text-amber-600' : ''}`}>
                            {u.storage.mb.toFixed(1)} MB
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.storage.mb >= 500 ? '已超限' : u.storage.mb >= 400 ? '即将满' : '正常'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="flex items-center gap-1">
                            <Image className="w-3 h-3 text-muted-foreground" />
                            <span>图片: {u.dataStats.images}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Video className="w-3 h-3 text-muted-foreground" />
                            <span>视频: {u.dataStats.videos}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users2 className="w-3 h-3 text-muted-foreground" />
                            <span>角色: {u.dataStats.characters}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-muted-foreground" />
                            <span>产品: {u.dataStats.products}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ListTodo className="w-3 h-3 text-muted-foreground" />
                            <span>任务: {u.dataStats.tasks}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{formatDate(u.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openActivityDialog(u)}
                          >
                            <Activity className="w-4 h-4 mr-1" />
                            记录
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCreditDialog(u)}
                          >
                            <Coins className="w-4 h-4 mr-1" />
                            积分
                          </Button>
                          {u.role !== 'admin' && (
                            <Button
                              variant={u.status === 'active' ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() => openFreezeDialog(u)}
                            >
                              {u.status === 'active' ? (
                                <>
                                  <Ban className="w-4 h-4 mr-1" />
                                  冻结
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  解冻
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无用户数据
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

      {/* 积分调整对话框 */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整用户积分</DialogTitle>
            <DialogDescription>
              用户: {selectedUser?.nickname || selectedUser?.phone}
              <br />
              当前积分: {selectedUser?.credits.balance}
            </DialogDescription>
          </DialogHeader>
          {selectedUser?.role === 'admin' && (
            <Alert>
              <AlertDescription>
                正在调整管理员的积分
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>操作类型</Label>
              <Select value={creditType} onValueChange={(v) => setCreditType(v as 'add' | 'deduct')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">增加积分</SelectItem>
                  <SelectItem value="deduct">扣减积分</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                placeholder="请输入积分数量"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>原因（可选）</Label>
              <Input
                placeholder="请输入调整原因"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreditSubmit} disabled={creditSubmitting}>
              {creditSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 冻结确认对话框 */}
      <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.status === 'active' ? '冻结用户' : '解冻用户'}
            </DialogTitle>
            <DialogDescription>
              用户: {selectedUser?.nickname || selectedUser?.phone}
              <br />
              {selectedUser?.status === 'active' 
                ? '冻结后该用户将无法登录和使用系统' 
                : '解冻后该用户可以正常登录和使用系统'}
            </DialogDescription>
          </DialogHeader>
          {selectedUser?.status === 'active' && (
            <div className="space-y-2 py-4">
              <Label>冻结原因（可选）</Label>
              <Input
                placeholder="请输入冻结原因"
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={selectedUser?.status === 'active' ? 'destructive' : 'default'}
              onClick={handleFreezeSubmit}
              disabled={freezeSubmitting}
            >
              {freezeSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedUser?.status === 'active' ? '确认冻结' : '确认解冻'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用户操作记录对话框 */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>用户操作记录</DialogTitle>
            <DialogDescription>
              {activityUser && (
                <span>
                  用户: {activityUser.nickname || `用户 ${activityUser.phone.slice(-4)}`} 
                  ({activityUser.phone})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 min-h-0">
            {/* 存储使用详情 */}
            {storageDetail && (
              <div className="mb-4 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  存储使用详情
                </h4>
                <div className="space-y-3">
                  {/* 总量进度条 */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>总使用量</span>
                      <span className={storageDetail.isOverLimit ? 'text-red-600 font-medium' : ''}>
                        {storageDetail.totalMB.toFixed(1)} MB / {storageDetail.quotaMB} MB
                        {storageDetail.isOverLimit && ' (已超限)'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${storageDetail.isOverLimit ? 'bg-red-500' : storageDetail.percentUsed >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(storageDetail.percentUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* 分类占比 */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="p-2 rounded bg-white dark:bg-slate-700">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Image className="w-3 h-3" />
                        <span>图片</span>
                      </div>
                      <p className="font-medium">{storageDetail.breakdown.images.mb.toFixed(1)} MB</p>
                      <p className="text-xs text-muted-foreground">{storageDetail.breakdown.images.count} 个文件 ({storageDetail.breakdown.images.percent}%)</p>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-700">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Video className="w-3 h-3" />
                        <span>视频</span>
                      </div>
                      <p className="font-medium">{storageDetail.breakdown.videos.mb.toFixed(1)} MB</p>
                      <p className="text-xs text-muted-foreground">{storageDetail.breakdown.videos.count} 个文件 ({storageDetail.breakdown.videos.percent}%)</p>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-700">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Users2 className="w-3 h-3" />
                        <span>角色</span>
                      </div>
                      <p className="font-medium">{storageDetail.breakdown.characters.mb.toFixed(1)} MB</p>
                      <p className="text-xs text-muted-foreground">{storageDetail.breakdown.characters.count} 个文件 ({storageDetail.breakdown.characters.percent}%)</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Video className="w-3 h-3" />
                        <span>分析大师</span>
                      </div>
                      <p className="font-medium">{storageDetail.breakdown.analysisMaster.mb.toFixed(1)} MB</p>
                      <p className="text-xs text-muted-foreground">{storageDetail.breakdown.analysisMaster.count} 个文件 ({storageDetail.breakdown.analysisMaster.percent}%)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 操作记录列表 */}
            <h4 className="font-medium mb-2">操作记录</h4>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无操作记录
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((item, index) => (
                  <div
                    key={`${item.type}-${item.id || index}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="mt-0.5">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{item.description}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      {item.type === 'usage' && (
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          {item.creditsUsed !== undefined && (
                            <span className="text-amber-600">
                              消耗: {item.creditsUsed} 积分
                            </span>
                          )}
                          {item.balanceBefore !== undefined && item.balanceAfter !== undefined && (
                            <span>
                              余额: {item.balanceBefore} → {item.balanceAfter}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 分页控件 */}
          {activityTotalPages > 1 && (
            <div className="flex items-center justify-between py-3 border-t">
              <span className="text-sm text-muted-foreground">
                共 {activityTotal} 条，第 {activityPage}/{activityTotalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activityPage <= 1 || activityLoading}
                  onClick={() => activityUser && loadActivities(activityUser, activityPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activityPage >= activityTotalPages || activityLoading}
                  onClick={() => activityUser && loadActivities(activityUser, activityPage + 1)}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 密码验证对话框 */}
      <ConfirmDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        title="安全验证"
        description="此操作需要管理员密码确认"
        confirmText="确认执行"
        onConfirm={async () => {
          if (pendingAction) {
            await pendingAction();
            setPendingAction(null);
          }
        }}
        requirePassword={true}
      />
    </div>
  );
}
