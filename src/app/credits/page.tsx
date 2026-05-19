'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Coins, Zap, Gift, History, CheckCircle, Loader2, CreditCard, ArrowLeft, MessageCircle, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

// 积分套餐类型
interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonusCredits: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

// 使用记录类型
interface UsageRecord {
  id: string;
  userId: string;
  actionType: string;
  creditsUsed: number;
  resourceId: string | null;
  resourceType: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

// 积分交易记录类型
interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

// 客服信息类型
interface CustomerServiceInfo {
  qrcodeUrl: string;
  wechatId: string;
  phone: string;
  description: string;
}

// 操作类型中文映射（完整映射，确保使用记录显示中文）
const actionTypeMap: Record<string, string> = {
  image_generate: '生成图片',
  video_generate: '生成视频',
  video_trim: '截取视频',
  video_concat: '合并视频',
  script_generate: '生成脚本',
  shortfilm_image: '短片图片',
  storage_upload: '上传存储',
  bonus: '系统赠送',
  recharge: '积分充值',
  refund_duplicate: '重复扣积分退款',
};

// 价格说明中隐藏的类型（不在页面展示消费价格）
const hiddenPriceTypes = ['video_trim', 'shortfilm_image', 'storage_upload'];

export default function CreditsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({} as Record<string, number>);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [customerService, setCustomerService] = useState<CustomerServiceInfo>({
    qrcodeUrl: '/wechat-qrcode.jpg',
    wechatId: '',
    phone: '',
    description: '扫描二维码添加客服微信，转账后即可充值积分',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 未登录跳转
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 加载数据
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 并行加载套餐和积分信息
      const [packagesRes, creditsRes, customerServiceRes] = await Promise.all([
        authFetch('/api/credits/packages'),
        authFetch('/api/credits'),
        fetch('/api/customer-service'),
      ]);

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        if (data.success) {
          setPackages(data.data.packages || []);
          setPrices(data.data.prices || {});
        }
      }

      if (creditsRes.ok) {
        const data = await creditsRes.json();
        if (data.success) {
          setUsageRecords(data.data.usageRecords || []);
        }
      }

      if (customerServiceRes.ok) {
        const data = await customerServiceRes.json();
        if (data.success) {
          setCustomerService(data.data);
        }
      }

      // 加载交易记录
      const transactionsRes = await authFetch('/api/credits/transactions');
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        if (data.success) {
          setTransactions(data.data || []);
        }
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 购买套餐 - 跳转到支付页面
  const handlePurchase = async (pkg: CreditPackage) => {
    setError('');
    setSuccess('');
    setPurchasingId(pkg.id);

    try {
      const response = await authFetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await response.json();

      if (data.success && data.data.orderId) {
        // 跳转到支付页面
        router.push(`/payment?orderId=${data.data.orderId}&packageId=${pkg.id}`);
      } else {
        setError(data.error || '创建订单失败');
        // 5秒后清除错误消息
        setTimeout(() => setError(''), 5000);
      }
    } catch (err) {
      console.error('创建订单失败:', err);
      setError('网络错误，请重试');
      // 5秒后清除错误消息
      setTimeout(() => setError(''), 5000);
    } finally {
      setPurchasingId(null);
    }
  };

  // 加载中
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated || !user) {
    return null;
  }

  // 计算实际获得积分
  const getTotalCredits = (pkg: CreditPackage) => pkg.credits + pkg.bonusCredits;

  // 计算单价
  const getUnitPrice = (pkg: CreditPackage) => {
    const total = getTotalCredits(pkg);
    const priceInYuan = pkg.price; // 价格已经是元
    return (priceInYuan / total).toFixed(2);
  };

  return (
    <div 
      className="h-screen bg-background overflow-auto"
      onWheel={(e) => {
        // 确保页面级别的滚轮事件可以正常工作
      }}
    >
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-6xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">积分中心</h1>
        </div>
      </header>

      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* 积分余额卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5" />
              当前余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{user.credits?.balance || 0}</div>
            <p className="text-sm opacity-80 mt-1">积分</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              累计获得
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {user.credits?.totalPurchased || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">积分</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              累计使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              {user.credits?.totalUsed || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">积分</p>
          </CardContent>
        </Card>
      </div>

      {/* 消息提示 */}
      {(error || success) && (
        <div className="mb-6">
          {error && (
            <Alert variant="destructive" className="animate-in fade-in duration-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-green-500 text-green-700 bg-green-50 animate-in fade-in duration-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList>
          <TabsTrigger value="packages" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            充值套餐
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            使用记录
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            充值记录
          </TabsTrigger>
          <TabsTrigger value="prices" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            价格说明
          </TabsTrigger>
        </TabsList>

        {/* 充值套餐 */}
        <TabsContent value="packages">
          {/* 客服联系卡片 - 放在套餐上方 */}
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* 二维码区域 */}
                <div className="flex-shrink-0">
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    <Image 
                      src={customerService.qrcodeUrl} 
                      alt="客服微信二维码" 
                      width={160} 
                      height={160}
                      className="w-40 h-40 object-cover rounded"
                      unoptimized
                    />
                  </div>
                </div>
                
                {/* 联系说明 */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold">联系客服充值</h3>
                  </div>
                  <p className="text-muted-foreground mb-3">
                    {customerService.description}
                  </p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>• 支持微信、支付宝转账</p>
                    <p>• 充值金额任意，1元=10积分</p>
                    <p>• 工作时间：9:00-22:00，通常5分钟内到账</p>
                    <p>• 请备注您的手机号或用户ID</p>
                    {customerService.wechatId && (
                      <p className="text-green-600 font-medium">• 客服微信号：{customerService.wechatId}</p>
                    )}
                    {customerService.phone && (
                      <p>• 客服电话：{customerService.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {packages.map((pkg, index) => (
              <Card
                key={pkg.id}
                className={cn(
                  'relative overflow-hidden transition-all hover:shadow-lg flex flex-col',
                  index === 2 && 'border-amber-500 ring-2 ring-amber-500/20'
                )}
              >
                {index === 2 && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-3 py-1 rounded-bl-lg z-10">
                    推荐
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {pkg.name}
                    {pkg.bonusCredits > 0 ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        送 {pkg.bonusCredits} 积分
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">
                        基础款
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="min-h-[20px]">{pkg.description || '基础套餐'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      ¥{pkg.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      获得 {getTotalCredits(pkg)} 积分（约 ¥{getUnitPrice(pkg)}/积分）
                    </div>
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground flex-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {pkg.credits} 基础积分
                    </li>
                    {pkg.bonusCredits > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {pkg.bonusCredits} 赠送积分
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      永久有效
                    </li>
                  </ul>
                  <Button
                    type="button"
                    className="w-full mt-auto"
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasingId !== null}
                  >
                    {purchasingId === pkg.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      '立即购买'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {packages.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无可用套餐
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 使用记录 */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>使用记录</CardTitle>
              <CardDescription>您的积分消费明细</CardDescription>
            </CardHeader>
            <CardContent>
              {usageRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>操作类型</TableHead>
                      <TableHead className="text-right">消耗积分</TableHead>
                      <TableHead className="text-right">余额变化</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {actionTypeMap[record.actionType] || record.actionType}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          -{record.creditsUsed}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.balanceBefore} → {record.balanceAfter}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(record.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  暂无使用记录
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 充值记录 */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>充值记录</CardTitle>
              <CardDescription>您的积分充值历史</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类型</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="text-right">积分变化</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          <Badge variant={txn.amount > 0 ? 'default' : 'secondary'}>
                            {txn.type === 'bonus' ? '赠送' : txn.type === 'recharge' ? '充值' : txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{txn.description}</TableCell>
                        <TableCell className={cn(
                          'text-right font-medium',
                          txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {txn.amount > 0 ? '+' : ''}{txn.amount}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  暂无充值记录
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 价格说明 */}
        <TabsContent value="prices">
          <Card>
            <CardHeader>
              <CardTitle>功能价格说明</CardTitle>
              <CardDescription>各功能消耗积分明细</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                  <div className="col-span-2 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </div>
                ) : prices && Object.keys(prices).length > 0 ? (
                  Object.entries(prices)
                    .filter(([actionType]) => !hiddenPriceTypes.includes(actionType))
                    .map(([actionType, credits]) => (
                    <div
                      key={actionType}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          {actionType === 'image_generate' && <Coins className="h-5 w-5 text-primary" />}
                          {actionType === 'video_generate' && <Zap className="h-5 w-5 text-primary" />}
                          {actionType === 'video_concat' && <CreditCard className="h-5 w-5 text-primary" />}
                          {actionType === 'script_generate' && <CreditCard className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <div className="font-medium">{actionTypeMap[actionType] || actionType}</div>
                          <div className="text-sm text-muted-foreground">每次</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{credits}</div>
                        <div className="text-sm text-muted-foreground">积分</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-12 text-center text-muted-foreground">
                    暂无价格配置
                  </div>
                )}
              </div>


            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
