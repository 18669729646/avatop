'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PromptEditor } from '@/components/prompt-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/auth-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Settings, 
  FileText, 
  CheckCircle, 
  MessageSquare, 
  Image, 
  Video, 
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Check,
  Edit,
  ShieldX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import {
  getSystemConfig,
  getSystemConfigAsync,
  addTextApiConfigAsync,
  addImageApiConfigAsync,
  addVideoApiConfigAsync,
  updateTextApiConfigAsync,
  updateImageApiConfigAsync,
  updateVideoApiConfigAsync,
  deleteTextApiConfigAsync,
  deleteImageApiConfigAsync,
  deleteVideoApiConfigAsync,
  setDefaultApiAsync,
  TextApiConfig,
  ImageApiConfig,
  VideoApiConfig,
  SystemConfig,
  VIDEO_MODELS,
} from '@/lib/system-config';
import { getDefaultSystemPrompt } from '@/lib/prompt-variables';

interface SystemPromptConfig {
  id: string;
  system_prompt: string;
  default_prompt?: string;
  variables_used: string[];
  created_at: string;
  updated_at: string;
  is_initial?: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [promptConfig, setPromptConfig] = useState<SystemPromptConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  // 从 URL 参数读取初始 tab，默认为 'prompt'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'prompt';
    }
    return 'prompt';
  });
  
  // API 配置编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editingType, setEditingType] = useState<'text' | 'image' | 'video' | null>(null);
  
  // 视频模型列表
  const [videoModels, setVideoModels] = useState<string[]>([...VIDEO_MODELS]);
  const [loadingVideoModels, setLoadingVideoModels] = useState(false);

  // 权限验证
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      if (user?.role !== 'admin') {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  // 加载配置
  useEffect(() => {
    // 等待权限验证完成
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    
    async function loadAllConfig() {
      setLoading(true);
      try {
        // 加载系统配置（强制刷新缓存，确保获取最新配置）
        const serverConfig = await getSystemConfigAsync(true);
        setConfig(serverConfig);
        
        // 加载提示词配置
        const promptResponse = await authFetch('/api/system-prompt');
        const promptData = await promptResponse.json();
        if (promptData.success) {
          setPromptConfig(promptData.config);
        }
      } catch (error) {
        console.error('Load config error:', error);
        toast.error('加载配置失败');
      } finally {
        setLoading(false);
      }
    }
    
    loadAllConfig();
  }, [authLoading, isAuthenticated, user]);

  // 开始编辑 API 配置
  const startEdit = (api: TextApiConfig | ImageApiConfig | VideoApiConfig, type: 'text' | 'image' | 'video') => {
    setEditingId(api.id);
    setEditingType(type);
    setEditForm({
      name: api.name,
      apiKey: api.apiKey,
      baseUrl: api.baseUrl,
      model: api.model || '',
      defaultAspectRatio: (api as ImageApiConfig | VideoApiConfig).defaultAspectRatio || '',
      defaultResolution: (api as ImageApiConfig).defaultResolution || '',
    });
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditingType(null);
    setEditForm({});
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingType || !editingId) return;
    
    setSaving(true);
    try {
      const updates = {
        name: editForm.name,
        apiKey: editForm.apiKey,
        baseUrl: editForm.baseUrl,
        model: editForm.model || undefined,
        defaultAspectRatio: editForm.defaultAspectRatio || undefined,
        defaultResolution: editForm.defaultResolution || undefined,
      };

      if (editingType === 'text') {
        await updateTextApiConfigAsync(editingId, updates);
      } else if (editingType === 'image') {
        await updateImageApiConfigAsync(editingId, updates);
      } else if (editingType === 'video') {
        await updateVideoApiConfigAsync(editingId, updates);
      }

      // 重新加载配置
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
      cancelEdit();
      toast.success('配置已保存');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 添加新配置
  const handleAdd = async (type: 'text' | 'image' | 'video') => {
    setSaving(true);
    try {
      const newApi = {
        name: '新配置',
        apiKey: '',
        baseUrl: 'https://yunwu.ai',
        model: type === 'text' ? 'gemini-3.1-pro-preview' : 
               type === 'image' ? 'gemini-3-pro-image-preview' : 'veo_3_1-fast',
        isDefault: false,
      };

      if (type === 'text') {
        await addTextApiConfigAsync({ ...newApi, type: 'text' });
      } else if (type === 'image') {
        await addImageApiConfigAsync({
          ...newApi,
          type: 'image',
          defaultAspectRatio: '1:1',
          defaultResolution: '2K',
        });
      } else if (type === 'video') {
        await addVideoApiConfigAsync({
          ...newApi,
          type: 'video',
          defaultAspectRatio: '9:16',
        });
      }

      // 重新加载配置
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
      toast.success('配置已添加');
    } finally {
      setSaving(false);
    }
  };

  // 删除配置
  const handleDelete = async (type: 'text' | 'image' | 'video', id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;
    
    setSaving(true);
    try {
      if (type === 'text') {
        await deleteTextApiConfigAsync(id);
      } else if (type === 'image') {
        await deleteImageApiConfigAsync(id);
      } else if (type === 'video') {
        await deleteVideoApiConfigAsync(id);
      }
      
      // 重新加载配置
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
      toast.success('配置已删除');
    } finally {
      setSaving(false);
    }
  };

  // 设为默认
  const handleSetDefault = async (type: 'text' | 'image' | 'video', id: string) => {
    setSaving(true);
    try {
      await setDefaultApiAsync(type, id);
      // 重新加载配置
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
      toast.success('已设为默认');
    } finally {
      setSaving(false);
    }
  };

  // 保存提示词配置
  const handlePromptSave = async (prompt: string) => {
    setSaving(true);
    try {
      // 先请求确认
      const confirmResponse = await fetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: prompt }),
      });
      
      const confirmData = await confirmResponse.json();
      
      if (confirmData.needsConfirm) {
        // 需要确认，再次请求保存
        const saveResponse = await fetch('/api/system-prompt', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            systemPrompt: prompt,
            confirmOverride: true 
          }),
        });
        
        const saveData = await saveResponse.json();
        
        if (saveData.success) {
          toast.success('系统提示词模板已保存');
          setPromptConfig(saveData.config);
        } else {
          throw new Error(saveData.error || '保存失败');
        }
      } else if (confirmData.success) {
        toast.success('系统提示词模板已保存');
        setPromptConfig(confirmData.config);
      } else {
        throw new Error(confirmData.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : '保存失败');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // 恢复默认提示词
  const handlePromptReset = async () => {
    try {
      const response = await fetch('/api/system-prompt', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('已恢复默认模板');
        setPromptConfig(data.config);
      } else {
        throw new Error(data.error || '恢复默认失败');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('恢复默认失败');
      throw error;
    }
  };

  // 设为默认模板
  const handlePromptSetDefault = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/system-prompt', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('已将当前模板设为默认模板');
        setPromptConfig(data.config);
      } else {
        throw new Error(data.error || '设为默认失败');
      }
    } catch (error) {
      console.error('Set default error:', error);
      toast.error(error instanceof Error ? error.message : '设为默认失败');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // 渲染 API 配置项
  const renderApiItem = (
    api: TextApiConfig | ImageApiConfig | VideoApiConfig,
    type: 'text' | 'image' | 'video',
    defaultId: string
  ) => {
    const isEditing = editingId === api.id && editingType === type;
    const isDefault = api.id === defaultId;

    if (isEditing) {
      return (
        <div key={api.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">名称</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">模型</Label>
              {type === 'video' ? (
                <Select
                  value={editForm.model || ''}
                  onValueChange={(v) => setEditForm({ ...editForm, model: v })}
                  disabled={loadingVideoModels}
                >
                  <SelectTrigger className="mt-1">
                    {loadingVideoModels ? (
                      <span className="text-muted-foreground">加载中...</span>
                    ) : (
                      <SelectValue placeholder="选择模型" />
                    )}
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {videoModels.length > 0 ? (
                      videoModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-sm text-muted-foreground">
                        暂无可用模型
                      </div>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={editForm.model || ''}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                  className="mt-1"
                />
              )}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={editForm.apiKey || ''}
              onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
              className="mt-1"
              placeholder="输入API密钥"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API 地址</Label>
            <Input
              value={editForm.baseUrl || ''}
              onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
              className="mt-1"
            />
          </div>
          {(type === 'image' || type === 'video') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">默认宽高比</Label>
                <Select
                  value={editForm.defaultAspectRatio || '1:1'}
                  onValueChange={(v) => setEditForm({ ...editForm, defaultAspectRatio: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === 'image' && (
                <div>
                  <Label className="text-xs text-muted-foreground">默认分辨率</Label>
                  <Select
                    value={editForm.defaultResolution || '2K'}
                    onValueChange={(v) => setEditForm({ ...editForm, defaultResolution: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1K">1K</SelectItem>
                      <SelectItem value="2K">2K</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      );
    }

    // 查看模式
    return (
      <div
        key={api.id}
        className={cn(
          "p-4 rounded-lg border transition-colors",
          isDefault 
            ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20" 
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{api.name}</span>
            {isDefault && (
              <Badge variant="default" className="text-xs shrink-0">默认</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {api.model && (
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">{api.model}</span>
            )}
            {!isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSetDefault(type, api.id)}
                title="设为默认"
                disabled={saving || loading}
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEdit(api, type)}
              title="编辑"
              disabled={saving || loading}
            >
              <Edit className="w-4 h-4" />
            </Button>
            {!isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => handleDelete(type, api.id)}
                title="删除"
                disabled={saving || loading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {api.apiKey ? (
              <>
                <Check className="w-3 h-3 text-green-500" />
                <span>密钥已配置</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">未配置密钥</span>
              </>
            )}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="truncate max-w-[200px]" title={api.baseUrl}>{api.baseUrl}</span>
        </div>
      </div>
    );
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  // 访问被拒绝
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">访问受限</h2>
            <p className="text-muted-foreground mb-4">
              系统设置仅限管理员访问，您没有权限查看此页面
            </p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="h-screen bg-background overflow-auto"
      onWheel={(e) => {
        // 确保页面级别的滚轮事件可以正常工作
        // 当子组件（如 textarea 或 ScrollArea）滚动到边界时，事件会冒泡到这里
        // 让页面自然滚动
      }}
    >
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">系统设置</h1>
          {saving && (
            <span className="flex items-center gap-1 text-sm text-blue-600 ml-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </span>
          )}
        </div>
      </header>

      {/* 主内容 */}
      <main className="container py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-10">
            <TabsTrigger value="prompt" className="gap-2">
              <FileText className="w-4 h-4" />
              提示词模板
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              文本生成
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-2">
              <Image className="w-4 h-4" />
              图片生成
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2">
              <Video className="w-4 h-4" />
              视频生成
            </TabsTrigger>
          </TabsList>

          {/* 提示词模板 */}
          <TabsContent value="prompt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">系统提示词模板配置</CardTitle>
                <CardDescription>
                  自定义脚本生成时使用的系统提示词模板。模板中的变量（如 <code className="font-mono text-xs">{'{{productInfo}}'}</code>）会在生成时自动替换为实际值。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="p-4">
              <PromptEditor
                type="shortfilm"
                initialPrompt={promptConfig?.system_prompt || getDefaultSystemPrompt()}
                onSave={handlePromptSave}
                onReset={handlePromptReset}
                onSetDefault={handlePromptSetDefault}
                isSaving={saving}
              />
            </Card>
          </TabsContent>

          {/* 文本生成配置 */}
          <TabsContent value="text" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">文本生成 API 配置</CardTitle>
                    <CardDescription>
                      配置用于脚本生成、文本处理的 API 服务
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleAdd('text')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-1" />
                    新增配置
                  </Button>
                </div>
              </CardHeader>
            </Card>
            
            <div className="space-y-3">
              {config?.textApis.map(api => renderApiItem(api, 'text', config.defaultTextApiId))}
            </div>
          </TabsContent>

          {/* 图片生成配置 */}
          <TabsContent value="image" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">图片生成 API 配置</CardTitle>
                    <CardDescription>
                      配置用于 AI 图片生成的 API 服务
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleAdd('image')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-1" />
                    新增配置
                  </Button>
                </div>
              </CardHeader>
            </Card>
            
            <div className="space-y-3">
              {config?.imageApis.map(api => renderApiItem(api, 'image', config.defaultImageApiId))}
            </div>
          </TabsContent>

          {/* 视频生成配置 */}
          <TabsContent value="video" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">视频生成 API 配置</CardTitle>
                    <CardDescription>
                      配置用于 AI 视频生成的 API 服务
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleAdd('video')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-1" />
                    新增配置
                  </Button>
                </div>
              </CardHeader>
            </Card>
            
            <div className="space-y-3">
              {config?.videoApis.map(api => renderApiItem(api, 'video', config.defaultVideoApiId))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
