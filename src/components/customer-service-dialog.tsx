'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import Image from 'next/image';

// 客服信息类型
interface CustomerServiceInfo {
  qrcodeUrl: string;
  wechatId: string;
  phone: string;
  description: string;
}

interface CustomerServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerServiceDialog({ open, onOpenChange }: CustomerServiceDialogProps) {
  const [customerService, setCustomerService] = useState<CustomerServiceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载客服信息
  useEffect(() => {
    if (open && !customerService) {
      loadCustomerService();
    }
  }, [open, customerService]);

  const loadCustomerService = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/customer-service');
      const data = await response.json();
      if (data.success) {
        setCustomerService(data.data);
      } else {
        setError('加载客服信息失败');
      }
    } catch (err) {
      console.error('加载客服信息失败:', err);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        {/* 关闭按钮 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </button>

        <DialogHeader className="text-center">
          <DialogTitle className="text-xl">扫码添加客服</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            微信扫码，享受专属服务
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          ) : error ? (
            <div className="text-center">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCustomerService}
                className="mt-3"
              >
                重试
              </Button>
            </div>
          ) : customerService ? (
            <>
              {/* 二维码 */}
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <Image
                  src={customerService.qrcodeUrl}
                  alt="客服微信二维码"
                  width={180}
                  height={180}
                  className="w-45 h-45 object-cover rounded"
                  unoptimized
                />
              </div>

              {/* 微信号 */}
              {customerService.wechatId && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">客服微信号</p>
                  <p className="text-lg font-semibold text-primary">
                    {customerService.wechatId}
                  </p>
                </div>
              )}

              {/* 工作时间 */}
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  工作时间：9:00-22:00
                </p>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
