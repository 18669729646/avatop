'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth-context';
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Edit,
  MessageSquare,
  Image,
  Video,
  Cpu,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  IMAGE_MODELS,
} from '@/lib/system-config';

export default function ModelSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  
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
    setLoading(true);
    try {
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
    } catch (err) {
      console.error('加载配置失败:', err);
      setError('加载配置失败');
      setConfig(getSystemConfig());
    } finally {
      setLoading(false);
    }
  };

  // 开始编辑
  const startEdit = (api: TextApiConfig | ImageApiConfig | VideoApiConfig) => {
    setEditingId(api.id);
    const isCustomVideo = api.type === 'video' && api.model && !VIDEO_MODELS.includes(api.model as any);
    const isCustomImage = api.type === 'image' && api.model && !IMAGE_MODELS.includes(api.model as any);
    setUseCustomModel(!!isCustomVideo || !!isCustomImage);
    setEditForm({
      name: api.name,
      apiKey: '', // 清空，让用户重新输入或保持不变
      apiKeyMasked: api.apiKeyMasked || '', // 显示脱敏后的 Key
      baseUrl: api.baseUrl,
      model: api.model || '',
      defaultAspectRatio: (api as ImageApiConfig | VideoApiConfig).defaultAspectRatio || '',
      defaultResolution: (api as ImageApiConfig | VideoApiConfig).defaultResolution || '',
      seedanceDefaultDuration: String((api as VideoApiConfig).seedanceDefaultDuration || 5),
      seedanceDefaultWatermark: String((api as VideoApiConfig).seedanceDefaultWatermark || false),
      seedanceDefaultRealPersonMode: String((api as VideoApiConfig).seedanceDefaultRealPersonMode || false),
    });
    setError('');
    setSuccess('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setError('');
    setSuccess('');
  };

  // 保存编辑
  const saveEdit = async (type: 'text' | 'image' | 'video', id: string) => {
    setSaving(true);
    setError('');
    try {
      // 如果用户没有输入新的 API Key，传递脱敏格式让后端保留原有的
      const apiKeyToSend = editForm.apiKey || editForm.apiKeyMasked || '';
      
      const updates = {
        name: editForm.name,
        apiKey: apiKeyToSend,
        baseUrl: editForm.baseUrl,
        model: editForm.model || undefined,
      };

      let success = false;
      if (type === 'text') {
        success = await updateTextApiConfigAsync(id, updates);
      } else if (type === 'image') {
        success = await updateImageApiConfigAsync(id, {
          ...updates,
          defaultAspectRatio: editForm.defaultAspectRatio || undefined,
          defaultResolution: editForm.defaultResolution || undefined,
        });
      } else if (type === 'video') {
        success = await updateVideoApiConfigAsync(id, {
          ...updates,
          defaultAspectRatio: editForm.defaultAspectRatio || undefined,
          defaultResolution: editForm.defaultResolution || undefined,
          seedanceDefaultDuration: Number(editForm.seedanceDefaultDuration) || 5,
          seedanceDefaultWatermark: editForm.seedanceDefaultWatermark === 'true',
          seedanceDefaultRealPersonMode: editForm.seedanceDefaultRealPersonMode === 'true',
        });
      }

      if (success) {
        await loadConfig();
        setEditingId(null);
        setEditForm({});
        setSuccess('配置已保存');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('保存失败');
      }
    } catch (err) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 新增配置
  const handleAdd = async (type: 'text' | 'image' | 'video') => {
    setSaving(true);
    setError('');
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
          defaultResolution: '720p',
          seedanceDefaultDuration: 5,
          seedanceDefaultWatermark: false,
          seedanceDefaultRealPersonMode: false,
        });
      }

      await loadConfig();
      setSuccess('配置已添加');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('添加失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除配置
  const handleDelete = async (type: 'text' | 'image' | 'video', id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;
    
    setSaving(true);
    setError('');
    try {
      if (type === 'text') {
        await deleteTextApiConfigAsync(id);
      } else if (type === 'image') {
        await deleteImageApiConfigAsync(id);
      } else if (type === 'video') {
        await deleteVideoApiConfigAsync(id);
      }
      await loadConfig();
      setSuccess('配置已删除');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('删除失败');
    } finally {
      setSaving(false);
    }
  };

  // 设为默认
  const handleSetDefault = async (type: 'text' | 'image' | 'video', id: string) => {
    setSaving(true);
    setError('');
    try {
      await setDefaultApiAsync(type, id);
      await loadConfig();
      setSuccess('已设为默认');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('设置失败');
    } finally {
      setSaving(false);
    }
  };

  // 渲染API配置项
  const renderApiItem = (
    api: TextApiConfig | ImageApiConfig | VideoApiConfig,
    type: 'text' | 'image' | 'video',
    defaultId: string
  ) => {
    const isEditing = editingId === api.id;
    const isDefault = api.id === defaultId;

    if (isEditing) {
      return (
        <div key={api.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              {type === 'video' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomModel}
                        onChange={(e) => {
                          setUseCustomModel(e.target.checked);
                          if (e.target.checked) {
                            setEditForm({ ...editForm, model: '' });
                          } else {
                            setEditForm({ ...editForm, model: videoModels[0] || '' });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      自定义模型
                    </label>
                  </div>
                  {useCustomModel ? (
                    <Input
                      value={editForm.model || ''}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      placeholder="输入自定义模型名称"
                    />
                  ) : (
                    <Select
                      value={editForm.model || videoModels[0]}
                      onValueChange={(v) => setEditForm({ ...editForm, model: v })}
                      disabled={loadingVideoModels}
                    >
                      <SelectTrigger>
                        {loadingVideoModels ? '加载中...' : <SelectValue placeholder="选择模型" />}
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {videoModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : type === 'image' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomModel}
                        onChange={(e) => {
                          setUseCustomModel(e.target.checked);
                          if (e.target.checked) {
                            setEditForm({ ...editForm, model: '' });
                          } else {
                            setEditForm({ ...editForm, model: IMAGE_MODELS[0] || '' });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      自定义模型
                    </label>
                  </div>
                  {useCustomModel ? (
                    <Input
                      value={editForm.model || ''}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      placeholder="输入自定义模型名称"
                    />
                  ) : (
                    <Select
                      value={editForm.model || IMAGE_MODELS[0]}
                      onValueChange={(v) => setEditForm({ ...editForm, model: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择模型" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {IMAGE_MODELS.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <Input
                  value={editForm.model || ''}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={editForm.apiKey || ''}
              onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
              placeholder={editForm.apiKeyMasked ? `当前: ${editForm.apiKeyMasked}` : "输入API密钥"}
            />
            {editForm.apiKeyMasked && !editForm.apiKey && (
              <p className="text-xs text-muted-foreground">留空则保持原有密钥不变</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>API 地址</Label>
            <Input
              value={editForm.baseUrl || ''}
              onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
            />
          </div>
          {(type === 'image' || type === 'video') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>默认宽高比</Label>
                <Select
                  value={editForm.defaultAspectRatio || '1:1'}
                  onValueChange={(v) => setEditForm({ ...editForm, defaultAspectRatio: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="16:9">16:9（横屏）</SelectItem>
                    <SelectItem value="9:16">9:16（竖屏）</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                    {type === 'video' && (
                      <>
                        <SelectItem value="21:9">21:9（超宽屏）</SelectItem>
                        <SelectItem value="adaptive">自适应</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {type === 'image' && (
                <div className="space-y-2">
                  <Label>默认分辨率</Label>
                  <Select
                    value={editForm.defaultResolution || '2K'}
                    onValueChange={(v) => setEditForm({ ...editForm, defaultResolution: v })}
                  >
                    <SelectTrigger>
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
          {/* Seedance 2.0 专属配置 */}
          {type === 'video' && (
            <div className="space-y-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Video className="w-4 h-4" />
                Seedance 2.0 默认配置
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">默认分辨率</Label>
                  <Select
                    value={editForm.defaultResolution || '720p'}
                    onValueChange={(v) => setEditForm({ ...editForm, defaultResolution: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p</SelectItem>
                      <SelectItem value="720p">720p（推荐）</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">默认时长（秒）</Label>
                  <Select
                    value={editForm.seedanceDefaultDuration || '5'}
                    onValueChange={(v) => setEditForm({ ...editForm, seedanceDefaultDuration: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 秒</SelectItem>
                      <SelectItem value="5">5 秒（推荐）</SelectItem>
                      <SelectItem value="8">8 秒</SelectItem>
                      <SelectItem value="10">10 秒</SelectItem>
                      <SelectItem value="15">15 秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">默认水印</Label>
                    <p className="text-[10px] text-muted-foreground">开启后生成的视频默认带水印</p>
                  </div>
                  <Switch
                    checked={editForm.seedanceDefaultWatermark === 'true'}
                    onCheckedChange={(v) => setEditForm({ ...editForm, seedanceDefaultWatermark: String(v) })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">默认真人模式</Label>
                    <p className="text-[10px] text-muted-foreground">自动开启人脸审核绕过</p>
                  </div>
                  <Switch
                    checked={editForm.seedanceDefaultRealPersonMode === 'true'}
                    onCheckedChange={(v) => setEditForm({ ...editForm, seedanceDefaultRealPersonMode: String(v) })}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => saveEdit(type, api.id)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
              <Badge variant="default" className="shrink-0">默认</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {api.model && (
              <span className="text-sm text-muted-foreground truncate max-w-[150px]">{api.model}</span>
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
              onClick={() => startEdit(api)}
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
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            {(api.apiKeyMasked || api.apiKey) ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span>密钥已配置</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600">未配置密钥</span>
              </>
            )}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="truncate max-w-[200px]" title={api.baseUrl}>{api.baseUrl}</span>
        </div>
      </div>
    );
  };

  // 加载中
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>加载配置失败</p>
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
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-500" />
            <h1 className="text-lg font-semibold">模型配置</h1>
          </div>
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
                <Check className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>AI 模型配置</CardTitle>
            <CardDescription>
              配置文本生成、图片生成、视频生成的 API 密钥和模型参数
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  文本生成
                </TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  图片生成
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  视频生成
                </TabsTrigger>
              </TabsList>

              {/* 文本生成配置 */}
              <TabsContent value="text" className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => handleAdd('text')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增配置
                  </Button>
                </div>
                {config.textApis.map(api => renderApiItem(api, 'text', config.defaultTextApiId))}
              </TabsContent>

              {/* 图片生成配置 */}
              <TabsContent value="image" className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => handleAdd('image')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增配置
                  </Button>
                </div>
                {config.imageApis.map(api => renderApiItem(api, 'image', config.defaultImageApiId))}
              </TabsContent>

              {/* 视频生成配置 */}
              <TabsContent value="video" className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => handleAdd('video')} disabled={saving || loading}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增配置
                  </Button>
                </div>
                {config.videoApis.map(api => renderApiItem(api, 'video', config.defaultVideoApiId))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
