'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Phone, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [frozenMessage, setFrozenMessage] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedTime, setLockedTime] = useState<number | null>(null);

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // 检查冻结提示
  useEffect(() => {
    const message = sessionStorage.getItem('frozen_message');
    if (message) {
      setFrozenMessage(message);
      sessionStorage.removeItem('frozen_message');
    }
  }, []);

  // 验证手机号格式
  const validatePhone = (value: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRemainingAttempts(null);
    setLockedTime(null);
    
    if (!validatePhone(phone)) {
      setError('请输入正确的手机号码');
      return;
    }
    
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await login(phone, password);
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || '登录失败');
        
        // 处理剩余尝试次数
        if (result.remainingAttempts !== undefined) {
          setRemainingAttempts(result.remainingAttempts);
        }
        
        // 处理锁定时间
        if (result.remainingTime) {
          setLockedTime(result.remainingTime);
        }
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载中状态
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Avatap 影拓" className="h-24 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
          <CardDescription>
            登录您的账户，继续创作之旅
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {frozenMessage && (
              <Alert variant="destructive">
                <AlertDescription>{frozenMessage}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <span className="block mt-1 text-sm opacity-80">
                      还剩 {remainingAttempts} 次尝试机会
                    </span>
                  )}
                  {lockedTime && (
                    <span className="block mt-1 text-sm opacity-80">
                      请 {Math.ceil(lockedTime / 60)} 分钟后重试
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            还没有账户？{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
