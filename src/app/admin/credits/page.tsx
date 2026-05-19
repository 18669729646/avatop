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
  Coins,
  Save,
  RefreshCw,
} from 'lucide-react';

// 积分价格类型
interface CreditPrice {
  id: string;
  actionType: string;
  actionTypeName: string;
  creditsRequired: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCreditsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [prices, setPrices] = useState<CreditPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
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
    loadPrices();
  }, [authLoading, isAuthenticated, user]);

  const loadPrices = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/credit-prices');
      const data = await response.json();

      if (data.success) {
        setPrices(data.data.prices);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新积分值
  const updatePrice = (actionType: string, value: number) => {
    setPrices(prev => prev.map(p => 
      p.actionType === actionType ? { ...p, creditsRequired: value } : p
    ));
  };

  // 保存配置
  const savePrices = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const response = await authFetch('/api/admin/credit-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prices: prices.map(p => ({
            actionType: p.actionType,
            creditsRequired: p.creditsRequired,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage('配置已保存');
        loadPrices();
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
  if (authLoading || (loading && prices.length === 0)) {
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
              积分管理仅限管理员访问
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
            <Coins className="w-5 h-5" />
            <h1 className="text-lg font-semibold">积分管理</h1>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={loadPrices} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* 说明卡片 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">积分价格配置</CardTitle>
            <CardDescription>
              配置各项操作需要消耗的积分数量，修改后立即生效
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>当前共 {prices.length} 项配置</span>
              <span>•</span>
              <span>积分值必须 ≥ 0</span>
            </div>
          </CardContent>
        </Card>

        {/* 配置列表 */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>操作类型</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="w-[120px]">积分消耗</TableHead>
                  <TableHead className="w-[80px]">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((price) => (
                  <TableRow key={price.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="font-medium">{price.actionTypeName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{price.actionType}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {price.description || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        value={price.creditsRequired}
                        onChange={(e) => updatePrice(price.actionType, parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      {price.isActive ? (
                        <Badge variant="default" className="bg-green-500">启用</Badge>
                      ) : (
                        <Badge variant="secondary">禁用</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {prices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      暂无配置数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* 保存按钮 */}
            <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t">
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('失败') ? 'text-red-500' : 'text-green-500'}`}>
                  {saveMessage}
                </span>
              )}
              <Button onClick={savePrices} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 注意事项 */}
        <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">注意事项</h4>
          <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <li>• 修改积分配置后立即生效，无需重启服务</li>
            <li>• 设置为 0 表示该操作免费</li>
            <li>• 请谨慎调整，避免影响用户体验</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
