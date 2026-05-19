'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { 
  User, 
  LogOut, 
  Coins, 
  CreditCard,
  ChevronDown,
  Loader2,
  Database,
  Shield,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  collapsed?: boolean;
  onOpenAuthDialog?: (tab: 'login' | 'register' | 'change-password') => void;
}

export function UserMenu({ collapsed = false, onOpenAuthDialog }: UserMenuProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 菜单打开时刷新用户信息（获取最新积分）
  const handleMenuOpenChange = (open: boolean) => {
    if (open) {
      refreshUser();
    }
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未登录状态
  if (!isAuthenticated || !user) {
    return (
      <div className={cn("p-2", collapsed && "flex justify-center")}>
        <Button
          variant="default"
          size={collapsed ? "icon" : "default"}
          onClick={() => onOpenAuthDialog?.('login')}
          className={cn(!collapsed && "w-full")}
        >
          {collapsed ? <User className="h-4 w-4" /> : '登录'}
        </Button>
      </div>
    );
  }

  // 获取用户头像首字母
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // 处理登出
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 折叠状态 - 简化显示
  if (collapsed) {
    return (
      <DropdownMenu onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="relative h-10 w-10 rounded-full p-0"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {user.nickname ? getInitials(user.nickname) : user.phone.slice(-4)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.nickname || `用户 ${user.phone.slice(-4)}`}</p>
              <p className="text-xs text-muted-foreground">{user.phone}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <Coins className="mr-2 h-4 w-4 text-amber-500" />
            <span>积分余额</span>
            <Badge variant="secondary" className="ml-auto">
              {user.credits?.balance || 0}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/data" className="cursor-pointer">
              <Database className="mr-2 h-4 w-4" />
              <span>数据管理</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/credits" className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>充值积分</span>
            </Link>
          </DropdownMenuItem>
          {user.role === 'admin' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>管理后台</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              onOpenAuthDialog?.('change-password');
            }}
          >
            <Lock className="mr-2 h-4 w-4" />
            <span>更改密码</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              handleLogout();
            }}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 展开状态 - 完整显示
  return (
    <DropdownMenu onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 p-2 h-auto"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {user.nickname ? getInitials(user.nickname) : user.phone.slice(-4)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">
              {user.nickname || `用户 ${user.phone.slice(-4)}`}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Coins className="h-3 w-3 text-amber-500" />
              <span>{user.credits?.balance || 0} 积分</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-xs text-muted-foreground">{user.phone}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {user.role === 'admin' ? '管理员' : '普通用户'}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">积分余额</span>
            <Badge variant="secondary">
              {user.credits?.balance || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>累计使用</span>
            <span>{user.credits?.totalUsed || 0}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/data" className="cursor-pointer">
            <Database className="mr-2 h-4 w-4" />
            <span>数据管理</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/credits" className="cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>充值积分</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            onOpenAuthDialog?.('change-password');
          }}
        >
          <Lock className="mr-2 h-4 w-4" />
          <span>更改密码</span>
        </DropdownMenuItem>
        {user.role === 'admin' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>管理后台</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600"
          onSelect={(e) => {
            e.preventDefault();
            handleLogout();
          }}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
