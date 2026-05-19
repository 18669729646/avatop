'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle, X } from 'lucide-react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register' | 'change-password';
  showChangePassword?: boolean; // 是否显示更改密码标签页
}

// 密码验证规则
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: '密码至少 8 位' };
  }
  
  const validPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]+$/;
  
  if (!validPattern.test(password)) {
    return { valid: false, error: '密码只能包含数字、字母和符号' };
  }
  
  return { valid: true };
}

// 验证手机号格式
function validatePhone(value: string) {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(value);
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login', showChangePassword = false }: AuthDialogProps) {
  const router = useRouter();
  const { login, register, changePassword, isAuthenticated, user } = useAuth();
  
  // 登录状态
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginRemainingAttempts, setLoginRemainingAttempts] = useState<number | null>(null);
  const [loginLockedTime, setLoginLockedTime] = useState<number | null>(null);

  // 注册状态
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  // 更改密码状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [newPasswordStrength, setNewPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  // 重定向逻辑 - 只在登录/注册成功后触发
  // 更改密码不应该触发这个逻辑
  // 移除自动关闭逻辑，因为在 login/register handler 中已经处理了

  // 注册密码强度检测
  useEffect(() => {
    if (!registerPassword) {
      setPasswordStrength(null);
      return;
    }
    
    let strength = 0;
    if (registerPassword.length >= 8) strength++;
    if (/[a-z]/.test(registerPassword) && /[A-Z]/.test(registerPassword)) strength++;
    if (/[0-9]/.test(registerPassword)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]/.test(registerPassword)) strength++;
    
    if (strength <= 1) setPasswordStrength('weak');
    else if (strength === 2) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [registerPassword]);

  // 更改密码密码强度检测
  useEffect(() => {
    if (!newPassword) {
      setNewPasswordStrength(null);
      return;
    }
    
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]/.test(newPassword)) strength++;
    
    if (strength <= 1) setNewPasswordStrength('weak');
    else if (strength === 2) setNewPasswordStrength('medium');
    else setNewPasswordStrength('strong');
  }, [newPassword]);

  // 登录处理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginRemainingAttempts(null);
    setLoginLockedTime(null);
    
    if (!validatePhone(loginPhone)) {
      setLoginError('请输入正确的手机号码');
      return;
    }
    
    if (loginPassword.length < 8) {
      setLoginError('密码至少 8 位');
      return;
    }
    
    setLoginLoading(true);
    
    try {
      const result = await login(loginPhone, loginPassword);
      if (result.success) {
        // 关闭弹窗，跳转到首页
        onOpenChange(false);
        router.push('/');
      } else {
        setLoginError(result.error || '登录失败');
        
        if (result.remainingAttempts !== undefined) {
          setLoginRemainingAttempts(result.remainingAttempts);
        }
        
        if (result.remainingTime) {
          setLoginLockedTime(result.remainingTime);
        }
      }
    } catch (err) {
      setLoginError('网络错误，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  // 注册处理
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    
    if (!validatePhone(registerPhone)) {
      setRegisterError('请输入正确的手机号码');
      return;
    }
    
    const passwordValidation = validatePassword(registerPassword);
    if (!passwordValidation.valid) {
      setRegisterError(passwordValidation.error!);
      return;
    }
    
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }
    
    setRegisterLoading(true);
    
    try {
      const result = await register(registerPhone, registerPassword);
      if (result.success) {
        setRegisterSuccess('注册成功！正在跳转...');
        setTimeout(() => {
          onOpenChange(false);
          router.push('/');
        }, 1000);
      } else {
        setRegisterError(result.error || '注册失败');
      }
    } catch (err) {
      setRegisterError('网络错误，请重试');
    } finally {
      setRegisterLoading(false);
    }
  };

  // 更改密码处理
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (oldPassword.length < 8) {
      setChangePasswordError('旧密码至少 8 位');
      return;
    }
    
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setChangePasswordError(passwordValidation.error!);
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('两次输入的新密码不一致');
      return;
    }
    
    if (oldPassword === newPassword) {
      setChangePasswordError('新密码不能与旧密码相同');
      return;
    }
    
    setChangePasswordLoading(true);
    
    try {
      const result = await changePassword(oldPassword, newPassword);
      if (result.success) {
        setChangePasswordSuccess('密码修改成功！');
        // 清空表单
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setChangePasswordError(result.error || '密码修改失败');
      }
    } catch (err) {
      setChangePasswordError('网络错误，请重试');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // 渲染密码强度指示器
  const renderPasswordStrength = (strength: 'weak' | 'medium' | 'strong' | null) => {
    if (!strength) return null;
    
    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="flex gap-1">
          <div className={`h-1.5 w-8 rounded ${strength === 'weak' ? 'bg-red-400' : strength === 'medium' ? 'bg-yellow-400' : 'bg-green-400'}`} />
          <div className={`h-1.5 w-8 rounded ${strength === 'medium' || strength === 'strong' ? strength === 'medium' ? 'bg-yellow-400' : 'bg-green-400' : 'bg-gray-200'}`} />
          <div className={`h-1.5 w-8 rounded ${strength === 'strong' ? 'bg-green-400' : 'bg-gray-200'}`} />
        </div>
        <span className={`text-xs ${strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
          {strength === 'weak' ? '弱' : strength === 'medium' ? '中' : '强'}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </button>

        <DialogHeader className="pt-6 px-6 pb-2">
          <div className="flex justify-center mb-2">
            <img src="/logo.png" alt="Avatap 影拓" className="h-16 w-auto" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">欢迎使用 Avatap</DialogTitle>
          <DialogDescription className="text-center">
            AI 视频创作专家，助力跨境电商内容创作
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className={`grid w-full ${showChangePassword ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
            {showChangePassword && (
              <TabsTrigger value="change-password">改密</TabsTrigger>
            )}
          </TabsList>

          {/* 登录标签页 */}
          <TabsContent value="login" className="mt-4 px-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {loginError}
                    {loginRemainingAttempts !== null && loginRemainingAttempts > 0 && (
                      <span className="block mt-1 text-sm opacity-80">
                        还剩 {loginRemainingAttempts} 次尝试机会
                      </span>
                    )}
                    {loginLockedTime && (
                      <span className="block mt-1 text-sm opacity-80">
                        请 {Math.ceil(loginLockedTime / 60)} 分钟后重试
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="login-phone">手机号</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="pl-10"
                    disabled={loginLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={loginLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* 注册标签页 */}
          <TabsContent value="register" className="mt-4 px-6 pb-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {registerError && (
                <Alert variant="destructive">
                  <AlertDescription>{registerError}</AlertDescription>
                </Alert>
              )}
              
              {registerSuccess && (
                <Alert className="border-green-500 text-green-700 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{registerSuccess}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="register-phone">手机号</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    className="pl-10"
                    disabled={registerLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="至少 8 位，含数字、字母或符号"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={registerLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {renderPasswordStrength(passwordStrength)}
                <p className="text-xs text-muted-foreground">
                  密码至少 8 位，只能包含数字、字母和符号
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="register-confirm-password"
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入密码"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={registerLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRegisterConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {registerConfirmPassword && registerPassword !== registerConfirmPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    两次输入的密码不一致
                  </p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={registerLoading}>
                {registerLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* 更改密码标签页 */}
          <TabsContent value="change-password" className="mt-4 px-6 pb-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              {changePasswordError && (
                <Alert variant="destructive">
                  <AlertDescription>{changePasswordError}</AlertDescription>
                </Alert>
              )}
              
              {changePasswordSuccess && (
                <Alert className="border-green-500 text-green-700 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{changePasswordSuccess}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="old-password">旧密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="old-password"
                    type={showOldPassword ? 'text' : 'password'}
                    placeholder="请输入旧密码"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={changePasswordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOldPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="至少 8 位，含数字、字母或符号"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={changePasswordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {renderPasswordStrength(newPasswordStrength)}
                <p className="text-xs text-muted-foreground">
                  密码至少 8 位，只能包含数字、字母和符号
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">确认新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    placeholder="请再次输入新密码"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={changePasswordLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    两次输入的新密码不一致
                  </p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={changePasswordLoading}>
                {changePasswordLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    修改中...
                  </>
                ) : (
                  '修改密码'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
