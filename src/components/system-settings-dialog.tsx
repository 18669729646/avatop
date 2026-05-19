'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  Plus,
  Trash2,
  Check,
  Edit,
  MessageSquare,
  Image,
  Video,
  Database,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Loader2,
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
} from '@/lib/system-config';
import {
  getStorageStats,
  clearAllHistoryData,
  StorageStats,
} from '@/lib/history';

interface SystemSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemSettingsDialog({ open, onOpenChange }: SystemSettingsDialogProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  
  // 视频模型列表（初始使用常量，重置时从 API 获取）
  const [videoModels, setVideoModels] = useState<string[]>([...VIDEO_MODELS]);
  const [loadingVideoModels, setLoadingVideoModels] = useState(false);

  // 刷新存储统计
  const refreshStorageStats = async () => {
    setRefreshingStats(true);
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } finally {
      setRefreshingStats(false);
    }
  };

  // 获取视频模型列表（从 API 获取）
  const fetchVideoModels = async (apiKey?: string, baseUrl?: string) => {
    setLoadingVideoModels(true);
    try {
      const params = new URLSearchParams();
      if (apiKey) params.append('apiKey', apiKey);
      if (baseUrl) params.append('baseUrl', baseUrl);
      
      const response = await fetch(`/api/video/models?${params.toString()}`);
      const data = await response.json();
      
      if (data.models && Array.isArray(data.models)) {
        setVideoModels(data.models);
        console.log(`[视频模型] 已加载 ${data.models.length} 个模型 (来源: ${data.source})`);
      }
    } catch (error) {
      console.error('[视频模型] 获取失败:', error);
    } finally {
      setLoadingVideoModels(false);
    }
  };

  // 从服务器加载配置
  const loadConfig = async () => {
    setLoading(true);
    try {
      const serverConfig = await getSystemConfigAsync();
      setConfig(serverConfig);
    } catch (error) {
      console.error('加载配置失败:', error);
      // 失败时使用本地缓存
      setConfig(getSystemConfig());
    } finally {
      setLoading(false);
    }
  };

  // 加载配置
  useEffect(() => {
    if (open) {
      setEditingId(null);
      setEditForm({});
      // 从服务器加载配置
      loadConfig();
      // 异步加载存储统计
      refreshStorageStats();
      // 重置视频模型列表为常量默认值
      setVideoModels([...VIDEO_MODELS]);
    }
  }, [open]);
  
  // 清除所有历史数据（仅清除当前用户的数据）
  const handleClearAllData = async () => {
    if (confirm('确定要清除您账户下的所有历史数据吗？\n\n这将删除：\n- 图片生成历史\n- 视频生成历史\n- 角色图库\n- 产品图库\n- 任务队列\n- 短片项目\n\n此操作不可恢复！')) {
      await clearAllHistoryData();
      const stats = await getStorageStats();
      setStorageStats(stats);
      alert('您的所有历史数据已清除！');
    }
  };
  
  // 格式化字节大小
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading && !config) return null;
  
  // 显示加载状态
  if (!config) return null;

  // 开始编辑
  const startEdit = (api: TextApiConfig | ImageApiConfig | VideoApiConfig) => {
    setEditingId(api.id);
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
    setEditForm({});
  };

  // 保存编辑
  const saveEdit = async (type: 'text' | 'image' | 'video', id: string) => {
    setSaving(true);
    try {
      const updates = {
        name: editForm.name,
        apiKey: editForm.apiKey,
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
        });
      }

      if (success) {
        // 重新加载配置
        await loadConfig();
        setEditingId(null);
        setEditForm({});
      }
    } finally {
      setSaving(false);
    }
  };

  // 新增配置
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
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  // 删除配置
  const handleDelete = async (type: 'text' | 'image' | 'video', id: string) => {
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
      await loadConfig();
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
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  // 渲染API配置项 - 卡片形式
  const renderApiItem = (
    api: TextApiConfig | ImageApiConfig | VideoApiConfig,
    type: 'text' | 'image' | 'video',
    defaultId: string
  ) => {
    const isEditing = editingId === api.id;
    const isDefault = api.id === defaultId;

    if (isEditing) {
      return (
        <div key={api.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">名称</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1 h-7 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">模型</Label>
              {type === 'video' ? (
                <Select
                  value={editForm.model || ''}
                  onValueChange={(v) => setEditForm({ ...editForm, model: v })}
                  disabled={loadingVideoModels}
                >
                  <SelectTrigger className="mt-1 h-7 text-xs">
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
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        暂无可用模型
                      </div>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={editForm.model || ''}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                  className="mt-1 h-7 text-xs"
                />
              )}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={editForm.apiKey || ''}
              onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
              className="mt-1 h-7 text-xs"
              placeholder="输入API密钥"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">API 地址</Label>
            <Input
              value={editForm.baseUrl || ''}
              onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
              className="mt-1 h-7 text-xs"
            />
          </div>
          {(type === 'image' || type === 'video') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">默认宽高比</Label>
                <Select
                  value={editForm.defaultAspectRatio || '1:1'}
                  onValueChange={(v) => setEditForm({ ...editForm, defaultAspectRatio: v })}
                >
                  <SelectTrigger className="mt-1 h-7 text-xs">
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
                  <Label className="text-[10px] text-muted-foreground">默认分辨率</Label>
                  <Select
                    value={editForm.defaultResolution || '2K'}
                    onValueChange={(v) => setEditForm({ ...editForm, defaultResolution: v })}
                  >
                    <SelectTrigger className="mt-1 h-7 text-xs">
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
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 text-xs" disabled={saving}>
              取消
            </Button>
            <Button size="sm" onClick={() => saveEdit(type, api.id)} className="h-7 text-xs" disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              保存
            </Button>
          </div>
        </div>
      );
    }

    // 查看模式 - 卡片形式
    return (
      <div
        key={api.id}
        className={cn(
          "p-3 rounded-lg border transition-colors",
          isDefault 
            ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20" 
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{api.name}</span>
            {isDefault && (
              <Badge variant="default" className="text-[10px] h-4 px-1.5 shrink-0">默认</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {api.model && (
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">{api.model}</span>
            )}
            {!isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleSetDefault(type, api.id)}
                title="设为默认"
                disabled={saving || loading}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => startEdit(api)}
              title="编辑"
              disabled={saving || loading}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            {!api.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                onClick={() => handleDelete(type, api.id)}
                title="删除"
                disabled={saving || loading}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        {/* 密钥状态指示 */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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
          <span className="truncate max-w-[150px]" title={api.baseUrl}>{api.baseUrl}</span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-auto max-h-[80vh] flex flex-col p-4">
        <DialogHeader className="pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-1.5 text-base">
            <Settings2 className="w-4 h-4" />
            系统设置
            {loading && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                加载中...
              </span>
            )}
            {saving && (
              <span className="flex items-center gap-1 text-xs text-blue-600 ml-2">
                <Save className="w-3 h-3 animate-pulse" />
                保存中...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 h-8 shrink-0">
            <TabsTrigger value="text" className="flex items-center gap-1 text-xs h-7" disabled={loading}>
              <MessageSquare className="w-3 h-3" />
              文本生成
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-1 text-xs h-7" disabled={loading}>
              <Image className="w-3 h-3" />
              图片生成
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1 text-xs h-7" disabled={loading}>
              <Video className="w-3 h-3" />
              视频生成
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-1 text-xs h-7" disabled={loading}>
              <Database className="w-3 h-3" />
              数据管理
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-3 overflow-y-auto">
            {/* 文本生成配置 */}
            <TabsContent value="text" className="m-0" forceMount>
              <div className={cn("space-y-2", activeTab !== 'text' && "hidden")}>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => handleAdd('text')} className="h-7 text-xs" disabled={saving || loading}>
                    <Plus className="w-3 h-3 mr-1" />
                    新增配置
                  </Button>
                </div>
                {config.textApis.map(api => renderApiItem(api, 'text', config.defaultTextApiId))}
              </div>
            </TabsContent>

            {/* 图片生成配置 */}
            <TabsContent value="image" className="m-0" forceMount>
              <div className={cn("space-y-2", activeTab !== 'image' && "hidden")}>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => handleAdd('image')} className="h-7 text-xs" disabled={saving || loading}>
                    <Plus className="w-3 h-3 mr-1" />
                    新增配置
                  </Button>
                </div>
                {config.imageApis.map(api => renderApiItem(api, 'image', config.defaultImageApiId))}
              </div>
            </TabsContent>

            {/* 视频生成配置 */}
            <TabsContent value="video" className="m-0" forceMount>
              <div className={cn("space-y-2", activeTab !== 'video' && "hidden")}>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => handleAdd('video')} className="h-7 text-xs" disabled={saving || loading}>
                    <Plus className="w-3 h-3 mr-1" />
                    新增配置
                  </Button>
                </div>
                {config.videoApis.map(api => renderApiItem(api, 'video', config.defaultVideoApiId))}
              </div>
            </TabsContent>

            {/* 数据管理 */}
            <TabsContent value="data" className="m-0" forceMount>
              <div className={cn("space-y-3", activeTab !== 'data' && "hidden")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HardDrive className="w-3.5 h-3.5" />
                    服务器存储使用情况
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5"
                    onClick={refreshStorageStats}
                    disabled={refreshingStats}
                  >
                    <RefreshCw className={cn("w-3 h-3", refreshingStats && "animate-spin")} />
                  </Button>
                </div>
                
                {storageStats && (
                  <>
                    {/* 存储大小进度条 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>总存储使用量</span>
                        <span>{formatBytes(storageStats.totalSize)} / 5 GB</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all",
                            storageStats.totalSize > 4 * 1024 * 1024 * 1024 
                              ? "bg-red-500" 
                              : storageStats.totalSize > 2.5 * 1024 * 1024 * 1024 
                                ? "bg-yellow-500" 
                                : "bg-blue-500"
                          )}
                          style={{ width: `${Math.min((storageStats.totalSize / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                        />
                      </div>
                      {storageStats.totalSize > 4 * 1024 * 1024 * 1024 && (
                        <p className="text-[10px] text-red-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          存储空间即将用尽，建议清理数据
                        </p>
                      )}
                    </div>
                    
                    {/* 数据统计 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded">
                        <span>生成图片</span>
                        <span className="font-medium">{storageStats.imageHistory}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded">
                        <span>生成视频</span>
                        <span className="font-medium">{storageStats.videoHistory}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded">
                        <span>角色图库</span>
                        <span className="font-medium">{storageStats.characterLibrary}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded">
                        <span>产品图库</span>
                        <span className="font-medium">{storageStats.productLibrary}</span>
                      </div>
                    </div>
                  </>
                )}
                
                {/* 清理按钮 */}
                <div className="pt-3 border-t">
                  <Button 
                    variant="destructive" 
                    className="w-full h-8 text-xs"
                    onClick={handleClearAllData}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    清除我的历史数据
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    仅清除您账户下的历史数据，系统配置和其他用户数据不受影响
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex justify-end shrink-0 pt-2">
          <Button size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
