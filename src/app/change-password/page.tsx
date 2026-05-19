'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, authFetch } from '@/lib/auth-context';
import { AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react';

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isForceChange = searchParams.get('force') === '1';

  // 未登录则跳转到登录页
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!oldPassword) {
      setError('请输入当前密码');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // 3 秒后跳转
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setError(data.error || '修改密码失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">密码修改成功</h2>
            <p className="text-muted-foreground mb-4">
              正在跳转到首页...
            </p>
            <Button asChild>
              <Link href="/">立即跳转</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>
            {isForceChange ? '首次登录，请修改密码' : '修改密码'}
          </CardTitle>
          {isForceChange && (
            <CardDescription className="text-amber-600">
              为保障账户安全，首次登录需修改初始密码
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isForceChange && (
            <Alert className="mb-4 border-amber-500 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700">
                当前使用的是系统初始密码，请设置新密码以确保账户安全
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">当前密码</Label>
              <Input
                id="oldPassword"
                type="password"
                placeholder="请输入当前密码"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  修改中...
                </>
              ) : (
                '确认修改'
              )}
            </Button>

            {!isForceChange && (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/">取消</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ChangePasswordContent />
    </Suspense>
  );
}
