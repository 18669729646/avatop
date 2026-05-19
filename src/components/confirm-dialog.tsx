'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/lib/auth-context';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  requirePassword?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  danger = false,
  onConfirm,
  requirePassword = false,
}: ConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 如果需要密码验证
    if (requirePassword) {
      if (!password) {
        setError('请输入密码');
        return;
      }

      setIsLoading(true);
      try {
        // 验证密码
        const response = await authFetch('/api/admin/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || '密码验证失败');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        setError('网络错误，请重试');
        setIsLoading(false);
        return;
      }
    }

    // 执行确认操作
    try {
      await onConfirm();
      setPassword('');
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              {danger && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <DialogTitle>{title}</DialogTitle>
            </div>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {requirePassword && (
            <div className="py-4">
              <Label htmlFor="password" className="text-sm font-medium">
                请输入您的密码以确认操作
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="mt-2"
                disabled={isLoading}
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant={danger ? 'destructive' : 'default'}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                confirmText
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
