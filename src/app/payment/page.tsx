'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, authFetch } from '@/lib/auth-context';
import { 
  ArrowLeft, 
  QrCode, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2,
  CreditCard,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 套餐信息
interface PackageInfo {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonusCredits: number;
}

// 支付状态
type PaymentStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [countdown, setCountdown] = useState(600); // 10分钟倒计时
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 微信收款码 URL（实际项目中应从后端获取）
  const WECHAT_PAY_URL = 'wxp://f2f0j5K8mN2pL7qR3sT9uV4wX6yZ1aB5cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ';
  
  // 收款金额（元）
  const amountYuan = packageInfo ? packageInfo.price.toString() : '0';
  
  // 总积分
  const totalCredits = packageInfo ? packageInfo.credits + packageInfo.bonusCredits : 0;

  // 未登录跳转
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 加载订单信息
  useEffect(() => {
    // 等待认证完成
    if (authLoading || !isAuthenticated) return;
    
    const pkgId = searchParams.get('packageId');
    const oid = searchParams.get('orderId');
    
    if (!pkgId || !oid) {
      setError('订单信息不完整');
      setIsLoading(false);
      return;
    }

    // 获取套餐信息
    const loadPackageInfo = async () => {
      try {
        const response = await authFetch('/api/credits/packages');
        const data = await response.json();
        
        if (data.success) {
          const pkg = data.data.packages.find((p: PackageInfo) => p.id === pkgId);
          if (pkg) {
            setPackageInfo(pkg);
            setOrderId(oid);
          } else {
            setError('套餐不存在');
          }
        } else {
          setError('获取套餐信息失败');
        }
      } catch (err) {
        console.error('加载套餐信息失败:', err);
        setError('网络错误');
      } finally {
        setIsLoading(false);
      }
    };

    loadPackageInfo();
  }, [searchParams, isAuthenticated, authLoading]);

  // 倒计时
  useEffect(() => {
    if (paymentStatus !== 'pending') return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setPaymentStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentStatus]);

  // 轮询支付状态
  useEffect(() => {
    if (!orderId || paymentStatus !== 'pending') return;

    const pollStatus = async () => {
      try {
        const response = await authFetch(`/api/payment/status?orderId=${orderId}`);
        const data = await response.json();
        
        if (data.success && data.status === 'paid') {
          setPaymentStatus('paid');
          await refreshUser();
        }
      } catch (err) {
        console.error('查询支付状态失败:', err);
      }
    };

    // 每3秒查询一次
    const interval = setInterval(pollStatus, 3000);
    
    return () => clearInterval(interval);
  }, [orderId, paymentStatus, refreshUser]);

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 复制收款码
  const handleCopyPayUrl = () => {
    navigator.clipboard.writeText(WECHAT_PAY_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 确认已支付（演示用，实际应该由后端接收支付回调）
  const handleConfirmPaid = async () => {
    if (!orderId || !packageInfo) return;
    
    try {
      const response = await authFetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus('paid');
        await refreshUser();
      } else {
        setError(data.error || '确认支付失败');
      }
    } catch (err) {
      setError('网络错误');
    }
  };

  // 取消支付
  const handleCancel = () => {
    router.push('/credits');
  };

  // 完成支付
  const handleComplete = () => {
    router.push('/credits');
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

  // 错误状态
  if (error && !packageInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">支付错误</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild>
              <Link href="/credits">返回积分中心</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-2xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/credits">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">支付订单</h1>
        </div>
      </header>

      <div className="container mx-auto py-8 px-4 max-w-2xl">
        {/* 订单信息 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">订单信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{packageInfo?.name}</p>
                <p className="text-sm text-muted-foreground">
                  获得 {totalCredits} 积分
                  {packageInfo && packageInfo.bonusCredits > 0 && (
                    <span className="text-green-600 ml-1">
                      （含赠送 {packageInfo.bonusCredits} 积分）
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">¥{amountYuan}</p>
                <p className="text-xs text-muted-foreground">订单号: {orderId?.slice(-12)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 支付状态卡片 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {paymentStatus === 'pending' && (
              <div className="text-center">
                {/* 二维码区域 */}
                <div className="bg-white p-6 rounded-lg inline-block mb-4 border">
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                    <QrCode className="w-32 h-32 text-gray-400" />
                  </div>
                </div>
                
                <p className="text-lg font-medium mb-1">请使用微信扫码支付</p>
                <p className="text-sm text-muted-foreground mb-4">
                  支付金额：<span className="text-primary font-bold">¥{amountYuan}</span>
                </p>

                {/* 倒计时 */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">支付剩余时间</span>
                  <span className="font-mono font-bold text-amber-500">{formatCountdown(countdown)}</span>
                </div>

                {/* 收款码复制 */}
                <div className="bg-muted rounded-lg p-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">收款码</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 truncate">{WECHAT_PAY_URL}</code>
                    <Button variant="ghost" size="sm" onClick={handleCopyPayUrl}>
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* 演示确认按钮 */}
                <Alert className="mb-4 border-blue-500 bg-blue-50">
                  <AlertDescription className="text-sm text-blue-700">
                    演示模式：点击下方按钮模拟支付完成
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={handleCancel}>
                    取消支付
                  </Button>
                  <Button className="flex-1" onClick={handleConfirmPaid}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    我已支付
                  </Button>
                </div>
              </div>
            )}

            {paymentStatus === 'paid' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-medium text-green-600 mb-1">支付成功</p>
                <p className="text-sm text-muted-foreground mb-4">
                  已获得 {totalCredits} 积分
                </p>
                <Button onClick={handleComplete}>
                  完成
                </Button>
              </div>
            )}

            {paymentStatus === 'expired' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-medium text-red-600 mb-1">订单已超时</p>
                <p className="text-sm text-muted-foreground mb-4">
                  请重新下单
                </p>
                <Button onClick={handleCancel}>
                  重新下单
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 支付说明 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">支付说明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. 请使用微信扫描上方二维码完成支付</p>
            <p>2. 支付金额必须与订单金额一致</p>
            <p>3. 支付成功后，积分将自动到账</p>
            <p>4. 如有疑问，请联系客服</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}
