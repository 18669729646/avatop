'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, authFetch } from '@/lib/auth-context';
import {
  Loader2,
  ArrowLeft,
  Upload,
  CheckCircle,
  QrCode,
  MessageCircle,
  Phone,
  FileText,
  Trash2,
} from 'lucide-react';

// 客服配置类型
interface CustomerServiceConfig {
  qrcodeUrl: string;
  qrcodeUpdatedAt: string | null;
  wechatId: string;
  phone: string;
  description: string;
}

export default function CustomerServicePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<CustomerServiceConfig>({
    qrcodeUrl: '',
    qrcodeUpdatedAt: null,
    wechatId: '',
    phone: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 权限验证
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // 加载配置
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadConfig();
  }, [authLoading, isAuthenticated, user]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch('/api/admin/customer-service');
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
      } else {
        setError(data.error || '加载配置失败');
      }
    } catch (err) {
      console.error('加载配置失败:', err);
      setError('加载配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      // 验证文件大小（最大 5MB）
      if (file.size > 5 * 1024 * 1024) {
        setError('图片大小不能超过 5MB');
        return;
      }
      setSelectedFile(file);
      setError('');
      
      // 创建预览 URL
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 清除选择的文件
  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 保存配置
  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const formData = new FormData();
      
      if (selectedFile) {
        formData.append('qrcode', selectedFile);
      }
      formData.append('wechatId', config.wechatId);
      formData.append('phone', config.phone);
      formData.append('description', config.description);

      const response = await authFetch('/api/admin/customer-service', {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('配置已保存');
        // 清除文件选择
        handleClearFile();
        // 重新加载配置
        await loadConfig();
        // 3秒后清除成功消息
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || '保存失败');
      }
    } catch (err) {
      console.error('保存配置失败:', err);
      setError('保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 加载中
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-4xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">客服配置</h1>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* 消息提示 */}
        {(error || success) && (
          <div className="mb-6">
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
          </div>
        )}

        {/* 客服二维码配置 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-500" />
              <CardTitle>客服二维码</CardTitle>
            </div>
            <CardDescription>
              上传客服微信二维码图片，用户在积分中心充值时将显示此二维码
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 当前二维码预览 */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  {previewUrl ? '新二维码预览' : '当前二维码'}
                </Label>
                <div className="bg-white p-3 rounded-lg shadow-sm border w-fit">
                  {previewUrl || config.qrcodeUrl ? (
                    <Image
                      src={previewUrl || config.qrcodeUrl}
                      alt="客服二维码"
                      width={160}
                      height={160}
                      className="w-40 h-40 object-cover rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 rounded flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">暂无二维码</p>
                      </div>
                    </div>
                  )}
                </div>
                {config.qrcodeUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    上次更新: {new Date(config.qrcodeUpdatedAt).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>

              {/* 上传区域 */}
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  上传新二维码
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="qrcode-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      选择图片
                    </Button>
                    {selectedFile && (
                      <>
                        <span className="text-sm text-muted-foreground">
                          {selectedFile.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFile}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    支持 JPG、PNG 格式，建议尺寸 200x200 像素，最大 5MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 联系方式配置 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-teal-500" />
              <CardTitle>联系方式</CardTitle>
            </div>
            <CardDescription>
              配置客服的微信号和联系电话
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wechatId" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  微信号
                </Label>
                <Input
                  id="wechatId"
                  value={config.wechatId}
                  onChange={(e) => setConfig({ ...config, wechatId: e.target.value })}
                  placeholder="输入客服微信号"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  联系电话
                </Label>
                <Input
                  id="phone"
                  value={config.phone}
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  placeholder="输入客服联系电话"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 说明文字配置 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-500" />
              <CardTitle>联系说明</CardTitle>
            </div>
            <CardDescription>
              配置积分中心显示的客服联系说明文字
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="输入客服联系说明，例如工作时间、充值流程等"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => loadConfig()}>
            重置
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
