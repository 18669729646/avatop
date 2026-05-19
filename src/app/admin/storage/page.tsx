'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Database,
  Settings,
  Save,
  Trophy,
  TrendingUp,
} from 'lucide-react';

// 存储配置类型
interface StorageConfig {
  userQuotaMB: number;
  totalStorage: {
    bytes: number;
    mb: number;
    gb: number;
  };
  users: {
    total: number;
    active: number;
  };
}

// 用户存储排行类型
interface StorageUser {
  rank: number;
  id: string;
  phone: string;
  nickname: string | null;
  status: string;
  storageBytes: number;
  storageMB: number;
  percentOfTotal: number;
}

export default function AdminStoragePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [ranking, setRanking] = useState<StorageUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // 配置编辑
  const [quotaInput, setQuotaInput] = useState('500');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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

  // 加载数据
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadData();
  }, [authLoading, isAuthenticated, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载配置和排行
      const [configRes, rankingRes] = await Promise.all([
        authFetch('/api/admin/storage-config'),
        authFetch('/api/admin/storage-ranking?limit=50'),
      ]);

      const configData = await configRes.json();
      const rankingData = await rankingRes.json();

      if (configData.success) {
        setConfig(configData.data);
        setQuotaInput(configData.data.userQuotaMB.toString());
      }

      if (rankingData.success) {
        setRanking(rankingData.data.users);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveConfig = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const response = await authFetch('/api/admin/storage-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuotaMB: parseInt(quotaInput, 10) }),
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage('配置已保存');
        setConfig(prev => prev ? { ...prev, userQuotaMB: parseInt(quotaInput, 10) } : null);
      } else {
        setSaveMessage(data.error || '保存失败');
      }
    } catch (error) {
      setSaveMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 加载中
  if (authLoading || (loading && !config)) {
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
              存储管理仅限管理员访问
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
            <Database className="w-5 h-5" />
            <h1 className="text-lg font-semibold">存储管理</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 概览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">全站存储</p>
                  <p className="text-2xl font-bold">{config?.totalStorage.gb.toFixed(2) || 0} GB</p>
                </div>
                <Database className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">用户配额</p>
                  <p className="text-2xl font-bold">{config?.userQuotaMB || 500} MB</p>
                </div>
                <Settings className="w-8 h-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{config?.users.total || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{config?.users.active || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 配置修改 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              存储配置
            </CardTitle>
            <CardDescription>调整用户的默认存储配额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="quota">用户存储配额 (MB)</Label>
                <Input
                  id="quota"
                  type="number"
                  min={10}
                  max={10240}
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">范围：10 - 10240 MB</p>
              </div>
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                保存配置
              </Button>
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('失败') ? 'text-red-500' : 'text-green-500'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 存储排行 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              存储使用排行
            </CardTitle>
            <CardDescription>
              全站存储总量：{config?.totalStorage.mb.toFixed(0) || 0} MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">排名</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>存储使用</TableHead>
                    <TableHead>占比</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        {u.rank <= 3 ? (
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-xs ${
                            u.rank === 1 ? 'bg-amber-500' : u.rank === 2 ? 'bg-gray-400' : 'bg-amber-700'
                          }`}>
                            {u.rank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{u.rank}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.nickname || `用户 ${u.phone.slice(-4)}`}</p>
                          <p className="text-xs text-muted-foreground">{u.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`font-medium ${u.storageMB >= 500 ? 'text-red-600' : u.storageMB >= 400 ? 'text-amber-600' : ''}`}>
                            {u.storageMB.toFixed(1)} MB
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${u.storageMB >= 500 ? 'bg-red-500' : u.storageMB >= 400 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(u.percentOfTotal * 5, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{u.percentOfTotal.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.status === 'active' ? (
                          <Badge variant="default" className="bg-green-500">正常</Badge>
                        ) : (
                          <Badge variant="destructive">已冻结</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/users`}>查看详情</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ranking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
