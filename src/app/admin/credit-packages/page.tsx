'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ShieldX,
  Package,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  GripVertical,
  Gift,
} from 'lucide-react';

// 套餐类型
interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonusCredits: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCreditPackagesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [newUserBonusCredits, setNewUserBonusCredits] = useState(50);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // 新增套餐弹窗
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: '',
    credits: 100,
    price: 10, // 改为元
    bonusCredits: 0,
    description: '',
    sortOrder: 0,
  });

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
    loadPackages();
  }, [authLoading, isAuthenticated, user]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/credit-packages');
      const data = await response.json();

      if (data.success) {
        setPackages(data.data.packages);
        setNewUserBonusCredits(data.data.newUserBonusCredits || 50);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新套餐字段
  const updatePackage = (id: string, field: keyof CreditPackage, value: unknown) => {
    setPackages(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // 保存所有修改
  const savePackages = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const response = await authFetch('/api/admin/credit-packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages, newUserBonusCredits }),
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage('配置已保存');
        loadPackages();
      } else {
        setSaveMessage(data.error || '保存失败');
      }
    } catch (error) {
      setSaveMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 新增套餐
  const handleAddPackage = async () => {
    if (!newPackage.name || newPackage.credits <= 0 || newPackage.price <= 0) {
      setSaveMessage('请填写完整的套餐信息');
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch('/api/admin/credit-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPackage),
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage('套餐已添加');
        setAddDialogOpen(false);
        setNewPackage({
          name: '',
          credits: 100,
          price: 10, // 默认10元
          bonusCredits: 0,
          description: '',
          sortOrder: 0,
        });
        loadPackages();
      } else {
        setSaveMessage(data.error || '添加失败');
      }
    } catch (error) {
      setSaveMessage('添加失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除套餐
  const handleDeletePackage = async (pkg: CreditPackage) => {
    if (!confirm(`确定要删除套餐「${pkg.name}」吗？`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/admin/credit-packages/${pkg.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage(data.message || '套餐已删除');
        loadPackages();
      } else {
        setSaveMessage(data.error || '删除失败');
      }
    } catch (error) {
      setSaveMessage('删除失败');
    }
  };

  // 移动套餐顺序
  const movePackage = (index: number, direction: 'up' | 'down') => {
    const newPackages = [...packages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newPackages.length) return;
    
    // 交换 sortOrder
    const tempSort = newPackages[index].sortOrder;
    newPackages[index].sortOrder = newPackages[targetIndex].sortOrder;
    newPackages[targetIndex].sortOrder = tempSort;
    
    // 重新排序
    newPackages.sort((a, b) => a.sortOrder - b.sortOrder);
    setPackages(newPackages);
  };

  // 加载中
  if (authLoading || (loading && packages.length === 0)) {
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
              套餐管理仅限管理员访问
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
            <Package className="w-5 h-5" />
            <h1 className="text-lg font-semibold">充值套餐管理</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadPackages} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  新增套餐
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增充值套餐</DialogTitle>
                  <DialogDescription>
                    创建新的积分充值套餐
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">套餐名称</Label>
                      <Input
                        id="name"
                        value={newPackage.name}
                        onChange={(e) => setNewPackage(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="如：基础版"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sortOrder">排序权重</Label>
                      <Input
                        id="sortOrder"
                        type="number"
                        value={newPackage.sortOrder}
                        onChange={(e) => setNewPackage(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="credits">积分数量</Label>
                      <Input
                        id="credits"
                        type="number"
                        value={newPackage.credits}
                        onChange={(e) => setNewPackage(prev => ({ ...prev, credits: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">价格（元）</Label>
                      <Input
                        id="price"
                        type="number"
                        value={newPackage.price}
                        onChange={(e) => setNewPackage(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bonusCredits">赠送积分</Label>
                      <Input
                        id="bonusCredits"
                        type="number"
                        value={newPackage.bonusCredits}
                        onChange={(e) => setNewPackage(prev => ({ ...prev, bonusCredits: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">描述（可选）</Label>
                    <Input
                      id="description"
                      value={newPackage.description}
                      onChange={(e) => setNewPackage(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="套餐描述"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddPackage} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* 说明卡片 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">充值套餐配置</CardTitle>
            <CardDescription>
              管理用户可购买的积分套餐，支持调整名称、价格、积分、排序等
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>当前共 {packages.length} 个套餐</span>
              <span>•</span>
              <span>价格单位：元（人民币）</span>
            </div>
          </CardContent>
        </Card>

        {/* 新用户赠送积分配置 */}
        <Card className="mb-6 border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" />
              新用户注册赠送
            </CardTitle>
            <CardDescription>
              设置新用户注册时自动获得的积分数量
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="newUserBonus" className="text-sm">赠送积分</Label>
                <Input
                  id="newUserBonus"
                  type="number"
                  min={0}
                  max={10000}
                  value={newUserBonusCredits}
                  onChange={(e) => setNewUserBonusCredits(parseInt(e.target.value) || 0)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">积分</span>
              </div>
              <p className="text-sm text-muted-foreground">
                当前设置：新用户注册后自动获得 <span className="font-bold text-green-600">{newUserBonusCredits}</span> 积分
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 套餐列表 */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">排序</TableHead>
                  <TableHead>套餐名称</TableHead>
                  <TableHead className="w-[100px]">积分</TableHead>
                  <TableHead className="w-[100px]">价格</TableHead>
                  <TableHead className="w-[80px]">赠送</TableHead>
                  <TableHead className="w-[80px]">状态</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg, index) => (
                  <TableRow key={pkg.id} className={!pkg.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => movePackage(index, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => movePackage(index, 'down')}
                            disabled={index === packages.length - 1}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={pkg.name}
                        onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={pkg.credits}
                        onChange={(e) => updatePackage(pkg.id, 'credits', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">¥</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={pkg.price}
                            onChange={(e) => updatePackage(pkg.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={pkg.bonusCredits}
                        onChange={(e) => updatePackage(pkg.id, 'bonusCredits', parseInt(e.target.value) || 0)}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={pkg.isActive}
                        onCheckedChange={(checked) => updatePackage(pkg.id, 'isActive', checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeletePackage(pkg)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {packages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      暂无套餐数据，点击上方「新增套餐」创建
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
              <Button onClick={savePackages} disabled={saving}>
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
            <li>• 价格单位为「元」，直接输入人民币金额即可</li>
            <li>• 排序权重越小，显示越靠前</li>
            <li>• 已有订单的套餐删除时会自动禁用而非真正删除</li>
            <li>• 禁用套餐后用户将无法购买，但已有订单不受影响</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
