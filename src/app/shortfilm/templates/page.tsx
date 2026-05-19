'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth-context';
import { 
  Bookmark, Trash2, Clock, User, Play, Loader2, Search, Plus, Package, AlertCircle, Edit2, Upload, ImagePlus, X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Template,
  getTemplates,
  deleteTemplate,
  updateTemplate,
  incrementTemplateUsage,
} from '@/lib/template-library';
import { toast } from 'sonner';
import { getProducts, Product } from '@/lib/products';
import { useQuery } from '@/lib/swr';
import { AppLayout } from '@/components/app-layout';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // 使用 SWR 管理模板数据
  const { data: templatesData, isLoading, isValidating, mutate: mutateTemplates } = useQuery<Template[]>(
    user ? `templates:all:${user.id}` : null,
    getTemplates,
    { dedupingInterval: 15000 }
  );
  const templates = templatesData || [];
  
  // 使用 SWR 管理产品数据
  const { data: productListData } = useQuery<Product[]>(
    user ? `templates:products:${user.id}` : null,
    async () => {
      const result = await getProducts();
      return Array.isArray(result) ? result : result.data;
    },
    { dedupingInterval: 15000 }
  );
  const productList = productListData || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [isUsingTemplate, setIsUsingTemplate] = useState(false);
  // 使用模板对话框
  const [useTemplateDialog, setUseTemplateDialog] = useState<Template | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  
  // 图片上传状态
  const [uploadingImages, setUploadingImages] = useState<Array<{ id: string; preview: string }>>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // 刷新模板
  const refreshTemplates = useCallback(() => {
    mutateTemplates();
  }, [mutateTemplates]);

  const handleUseTemplate = (template: Template) => {
    // 打开对话框，让用户输入短片名称
    setUseTemplateDialog(template);
    // 默认名称使用模板名称
    setNewProjectName(template.name || '');
  };

  const handleConfirmUseTemplate = async () => {
    if (!useTemplateDialog) return;
    
    // 防止重复点击
    if (isUsingTemplate) return;
    
    setIsUsingTemplate(true);
    try {
      await incrementTemplateUsage(useTemplateDialog.id);
      // 存储模板信息和项目名称
      sessionStorage.setItem('selected_template', JSON.stringify(useTemplateDialog));
      sessionStorage.setItem('new_project_name', newProjectName.trim() || useTemplateDialog.name || '未命名短片');
      router.push('/shortfilm/new?from_template=1');
    } finally {
      setIsUsingTemplate(false);
    }
  };

  const handleDelete = async (template: Template) => {
    const result = await deleteTemplate(template.id);
    if (result.success) {
      toast.success('模板已删除');
      await refreshTemplates();
    } else {
      toast.error(result.error || '删除失败');
    }
    setDeleteConfirm(null);
  };

  const handleEditSave = async () => {
    if (editTemplate) {
      await updateTemplate(editTemplate.id, {
        name: editTemplate.name,
        description: editTemplate.description,
        category: editTemplate.category,
        duration: editTemplate.duration,
        productName: editTemplate.productName,
        productInfo: editTemplate.productInfo,
        sellingPoints: editTemplate.sellingPoints,
        productImages: editTemplate.productImages,
      });
      await refreshTemplates();
      setEditTemplate(null);
    }
  };

  // 上传图片到对象存储
  const uploadImageToStorage = useCallback(async (file: File): Promise<{ key: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'templates');
    formData.append('fileName', `templates/${Date.now()}_${file.name}`);
    
    const response = await authFetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    if (result.success && result.url && result.key) {
      return { key: result.key, url: result.url };
    }
    throw new Error(result.error || '上传失败');
  }, []);

  // 处理图片上传
  const handleImageUpload = useCallback(async (files: File[]) => {
    if (!editTemplate || files.length === 0) return;
    
    // 过滤图片文件
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    
    // 先创建占位记录（显示上传中状态）
    const newUploadingImages = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      preview: URL.createObjectURL(file),
    }));
    
    setUploadingImages(prev => [...prev, ...newUploadingImages]);
    
    // 并行上传所有图片
    const uploadPromises = newUploadingImages.map(async (img, index) => {
      const file = imageFiles[index];
      try {
        const { key, url } = await uploadImageToStorage(file);
        return { id: img.id, key, url, success: true };
      } catch (error) {
        console.error('上传失败:', error);
        return { id: img.id, error: error instanceof Error ? error.message : '上传失败', success: false };
      }
    });
    
    const results = await Promise.all(uploadPromises);
    
    // 清理上传中状态
    setUploadingImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
    
    // 更新已上传的图片（存储 key 和 url）
    const successItems = results
      .filter(r => r.success && r.url && r.key)
      .map(r => ({ key: r.key!, url: r.url! }));
    
    if (successItems.length > 0) {
      setEditTemplate(prev => prev ? {
        ...prev,
        productImages: [...(prev.productImages || []), ...successItems]
      } : null);
    }
    
    // 显示失败提示
    const failedCount = results.filter(r => !r.success).length;
    if (failedCount > 0) {
      alert(`${failedCount} 张图片上传失败，请重试`);
    }
  }, [editTemplate, uploadImageToStorage]);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleImageUpload(files);
  }, [handleImageUpload]);

  // 移除图片
  const handleRemoveImage = useCallback((index: number, isUploading: boolean = false) => {
    if (isUploading) {
      setUploadingImages(prev => {
        const img = prev[index];
        if (img) URL.revokeObjectURL(img.preview);
        return prev.filter((_, i) => i !== index);
      });
    } else if (editTemplate) {
      const newImages = [...(editTemplate.productImages || [])];
      newImages.splice(index, 1);
      setEditTemplate({ ...editTemplate, productImages: newImages });
    }
  }, [editTemplate]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const filteredTemplates = searchQuery.trim() 
    ? templates.filter(t => {
        const lowerQuery = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(lowerQuery) ||
               t.description.toLowerCase().includes(lowerQuery);
      })
    : templates;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-purple-500" />
                广告模板
              </h1>
              <Badge variant="secondary" className="text-xs">
                {templates.length} 个模板
                {isValidating && <Loader2 className="w-3 h-3 ml-1 animate-spin inline" />}
              </Badge>
            </div>
            <Link href="/shortfilm/template-generator">
              <Button size="sm" className="bg-purple-500 hover:bg-purple-600">
                <Plus className="w-4 h-4 mr-1" />
                创建模板
              </Button>
            </Link>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* 搜索和筛选区域 */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索模板名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredTemplates.length} / {templates.length} 个模板
              </Badge>
            </div>

            {/* 模板列表 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Bookmark className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    {searchQuery ? '没有找到匹配的模板' : '还没有保存的模板'}
                  </p>
                  <Link href="/shortfilm/template-generator">
                    <Button className="mt-4">创建第一个模板</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => {
                  const productExists = productList.find(p => p.id === template.productId);
                  return (
                    <Card key={template.id} className="overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all flex flex-col">
                      {/* 顶部状态条 */}
                      <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500" />
                      
                      <CardHeader className="pb-2 pt-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{template.name}</CardTitle>
                            <CardDescription className="mt-1 line-clamp-2 text-xs">
                              {template.description || '暂无描述'}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs font-medium">
                            {template.duration}s
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 flex-1 flex flex-col">
                        {/* 产品图片展示 */}
                        {template.productImages && template.productImages.length > 0 && (
                          <div className="mb-3">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {template.productImages.slice(0, 3).map((img, idx) => {
                                // 兼容旧格式（纯URL字符串）和新格式（{key, url}对象）
                                const imgSrc = typeof img === 'string' ? img : img.url;
                                return (
                                  <div 
                                    key={idx} 
                                    className="relative w-16 h-16 rounded-md overflow-hidden border bg-muted shrink-0"
                                  >
                                    <img 
                                      src={imgSrc} 
                                      alt={`产品图${idx + 1}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </div>
                                );
                              })}
                              {template.productImages.length > 3 && (
                                <div className="w-16 h-16 rounded-md border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground shrink-0">
                                  +{template.productImages.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* 产品信息显示 */}
                        {template.productName && (
                          <div className="mb-2 text-xs">
                            {productExists ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
                                <Package className="w-3 h-3 text-blue-500" />
                                <span className="truncate">{template.productName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2 py-1">
                                <AlertCircle className="w-3 h-3" />
                                <span className="truncate">产品已删除</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* 卖点显示 */}
                        {template.sellingPoints && (
                          <div className="mb-3 text-xs">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-md px-2 py-1.5 border border-purple-100 dark:border-purple-900">
                              <span className="text-purple-700 dark:text-purple-300 font-medium">卖点：</span>
                              <span className="text-muted-foreground">{template.sellingPoints}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* 产品描述显示 */}
                        {template.productInfo && (
                          <div className="mb-3 text-xs">
                            <div className="bg-muted/50 rounded-md px-2 py-1.5 border">
                              <span className="text-muted-foreground line-clamp-2">{template.productInfo}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* 元信息 */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 mt-auto">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(template.updatedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {template.usageCount || 0} 次使用
                          </span>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-purple-500 hover:bg-purple-600"
                            onClick={() => handleUseTemplate(template)}
                            disabled={(!productExists && !!template.productId) || isUsingTemplate}
                          >
                            {isUsingTemplate ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 mr-1" />
                            )}
                            使用模板
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="px-2.5"
                            onClick={() => setEditTemplate(template)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteConfirm(template)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模板</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板 "{deleteConfirm?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑对话框 */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑模板</DialogTitle>
          </DialogHeader>
          {editTemplate && (
            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>模板名称</Label>
                  <Input
                    value={editTemplate.name}
                    onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>视频时长</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[16, 24, 32].map((d) => (
                      <div
                        key={d}
                        className={`p-2 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          editTemplate.duration === d
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        }`}
                        onClick={() => setEditTemplate({ ...editTemplate, duration: d })}
                      >
                        <div className="font-bold">{d}秒</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>描述</Label>
                <Textarea
                  value={editTemplate.description}
                  onChange={(e) => setEditTemplate({ ...editTemplate, description: e.target.value })}
                  className="mt-2"
                  rows={2}
                />
              </div>

              {/* 产品信息 */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  产品信息
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">产品名称</Label>
                    <Input
                      value={editTemplate.productName || ''}
                      onChange={(e) => setEditTemplate({ ...editTemplate, productName: e.target.value })}
                      className="mt-1"
                      placeholder="关联的产品名称"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">产品描述</Label>
                    <Textarea
                      value={editTemplate.productInfo || ''}
                      onChange={(e) => setEditTemplate({ ...editTemplate, productInfo: e.target.value })}
                      className="mt-1"
                      rows={3}
                      placeholder="产品的详细描述信息"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">核心卖点</Label>
                    <Textarea
                      value={editTemplate.sellingPoints || ''}
                      onChange={(e) => setEditTemplate({ ...editTemplate, sellingPoints: e.target.value })}
                      className="mt-1"
                      rows={2}
                      placeholder="产品的核心卖点，多个卖点用顿号分隔"
                    />
                  </div>
                </div>
              </div>

              {/* 产品图片 */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">产品图片</h4>
                
                {/* 已上传图片 + 上传中图片 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* 已上传的图片 */}
                  {editTemplate.productImages?.map((img, idx) => {
                    // 兼容旧格式和新格式
                    const imgSrc = typeof img === 'string' ? img : img.url;
                    return (
                      <div key={`uploaded-${idx}`} className="relative group">
                        <img
                          src={imgSrc}
                          alt={`产品图${idx + 1}`}
                          loading="lazy"
                          className="w-16 h-16 rounded-md object-cover border"
                        />
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  
                  {/* 上传中的图片 */}
                  {uploadingImages.map((img, idx) => (
                    <div key={img.id} className="relative">
                      <img
                        src={img.preview}
                        alt="上传中"
                        loading="lazy"
                        className="w-16 h-16 rounded-md object-cover border"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 拖拽上传区域 */}
                <div
                  className={cn(
                    "relative w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 overflow-hidden",
                    isDraggingOver 
                      ? "border-primary bg-primary/10 scale-[1.02]" 
                      : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
                  )}
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* 拖拽提示层 */}
                  {isDraggingOver && (
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-1">
                        <ImagePlus className="w-6 h-6 text-primary animate-bounce" />
                        <span className="text-sm font-medium text-primary">松开即可上传</span>
                      </div>
                    </div>
                  )}
                  {/* 默认提示 */}
                  {!isDraggingOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <ImagePlus className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">点击或拖拽上传</span>
                      <span className="text-xs text-muted-foreground/60">支持多选</span>
                    </div>
                  )}
                </div>
                
                {/* 隐藏的文件输入 */}
                <input
                  type="file"
                  id="product-image-upload"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      handleImageUpload(Array.from(files));
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>取消</Button>
            <Button onClick={handleEditSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 使用模板对话框 */}
      <Dialog open={!!useTemplateDialog} onOpenChange={(open) => !open && setUseTemplateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用模板创建短片</DialogTitle>
          </DialogHeader>
          {useTemplateDialog && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Bookmark className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium">{useTemplateDialog.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {useTemplateDialog.duration}s · {useTemplateDialog.productName || '无关联产品'}
                  </p>
                </div>
              </div>
              <div>
                <Label>短片名称</Label>
                <Input
                  placeholder="请输入短片名称"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-2"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseTemplateDialog(null)}>取消</Button>
            <Button 
              onClick={handleConfirmUseTemplate} 
              disabled={isUsingTemplate}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {isUsingTemplate ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              开始创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
