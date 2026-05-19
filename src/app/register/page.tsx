'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

// 密码验证规则
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: '密码至少 8 位' };
  }
  
  // 只允许：数字、大小写字母、常见符号
  const validPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]+$/;
  
  if (!validPattern.test(password)) {
    return { valid: false, error: '密码只能包含数字、字母和符号' };
  }
  
  return { valid: true };
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [password, setPasswd] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  // 验证手机号格式
  const validatePhone = useCallback((value: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(value);
  }, []);

  // 检测密码强度
  useEffect(() => {
    if (!password) {
      setPasswordStrength(null);
      return;
    }
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]/.test(password)) strength++;
    
    if (strength <= 1) setPasswordStrength('weak');
    else if (strength === 2) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validatePhone(phone)) {
      setError('请输入正确的手机号码');
      return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error!);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await register(phone, password);
      if (result.success) {
        setSuccess('注册成功！正在跳转...');
        setTimeout(() => router.push('/'), 1000);
      } else {
        setError(result.error || '注册失败');
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
          <CardTitle className="text-2xl font-bold">创建账户</CardTitle>
          <CardDescription>
            注册即可获得免费积分，开始创作之旅
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="border-green-500 text-green-700 bg-green-50">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
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
                  placeholder="至少 8 位，含数字、字母或符号"
                  value={password}
                  onChange={(e) => setPasswd(e.target.value)}
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
              {/* 密码强度指示器 */}
              {passwordStrength && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    <div className={`h-1.5 w-8 rounded ${passwordStrength === 'weak' ? 'bg-red-400' : passwordStrength === 'medium' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                    <div className={`h-1.5 w-8 rounded ${passwordStrength === 'medium' || passwordStrength === 'strong' ? passwordStrength === 'medium' ? 'bg-yellow-400' : 'bg-green-400' : 'bg-gray-200'}`} />
                    <div className={`h-1.5 w-8 rounded ${passwordStrength === 'strong' ? 'bg-green-400' : 'bg-gray-200'}`} />
                  </div>
                  <span className={`text-xs ${passwordStrength === 'weak' ? 'text-red-500' : passwordStrength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {passwordStrength === 'weak' ? '弱' : passwordStrength === 'medium' ? '中' : '强'}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                密码至少 8 位，只能包含数字、字母和符号
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  两次输入的密码不一致
                </p>
              )}
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            已有账户？{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              立即登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
