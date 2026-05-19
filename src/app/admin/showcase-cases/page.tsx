/* eslint-disable react-hooks/immutability, react-hooks/purity */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth, authFetch } from '@/lib/auth-context';
import { ShowcaseCase } from '@/types/showcase';
import { UploadZone } from '@/components/upload-zone';
import { VideoPlayer } from '@/components/video-player';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Film,
  Loader2,
  Play,
  Image as ImageIcon,
  Search,
  Film as FilmIcon,
  Star,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';

// 分页信息
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ShowcaseCasesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [cases, setCases] = useState<ShowcaseCase[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // 新增/编辑对话框
  const [showDialog, setShowDialog] = useState(false);
  const [editingCase, setEditingCase] = useState<ShowcaseCase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'shortfilm',
    category: '',
    thumbnailUrl: '',
    mediaUrl: '',
    mediaType: 'video',
    prompt: '',
    model: '',
    duration: '',
    isFeatured: false,
    displayOrder: 0,
  });

  // 视频播放
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const uploadStartTimeRef = useRef<number>(0);

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

  // 加载案例列表
  useEffect(() => {
    if (authLoading || !isAuthenticated || user?.role !== 'admin') {
      return;
    }
    loadCases();
  }, [authLoading, isAuthenticated, user, pagination.page, categoryFilter, typeFilter]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        category: categoryFilter === 'all' ? '' : categoryFilter,
        type: typeFilter === 'all' ? '' : typeFilter,
      });

      const response = await authFetch(`/api/admin/showcase-cases?${params}`);
      const data = await response.json();

      if (data.success) {
        setCases(data.data.cases || data.data);
        if (data.data.pagination) {
          setPagination(data.data.pagination);
        }
      } else {
        console.error('加载案例失败:', data.error);
      }
    } catch (error) {
      console.error('加载案例失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadCases();
  };

  // 上传文件
  const handleUploadFile = async (file: File, type: 'thumbnail' | 'media') => {
    setUploading(true);
    uploadStartTimeRef.current = performance.now();
    console.log(`[上传开始] ${type === 'thumbnail' ? '缩略图' : '媒体文件'}`, {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      fileType: file.type,
    });

    try {
      const currentThumbnailUrl = formData.thumbnailUrl;

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('folder', type === 'thumbnail' ? 'thumbnails' : 'videos');

      console.log('[上传] 准备发送请求到 /api/upload-showcase');

      const response = await authFetch('/api/upload-showcase', {
        method: 'POST',
        body: uploadFormData,
      });

      const elapsedTime = (performance.now() - uploadStartTimeRef.current) / 1000;
      console.log(`[上传] 收到响应，耗时: ${elapsedTime}秒，状态: ${response.status}`);

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[上传失败] 响应状态:', response.status, response.statusText);
        console.error('[上传失败] 响应内容:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          alert(errorData.error || `上传失败 (${response.status})`);
        } catch {
          alert(`上传失败: ${errorText.substring(0, 200)}`);
        }
        return;
      }

      const data = await response.json();
      console.log('[上传] 响应数据:', data);

      if (data.success) {
        console.log(`[上传成功] ${type === 'thumbnail' ? '缩略图' : '媒体文件'} 已保存`);
        if (type === 'thumbnail') {
          setFormData(prev => ({ ...prev, thumbnailUrl: data.data.url }));
        } else {
          setFormData(prev => ({ ...prev, mediaUrl: data.data.url, mediaType: data.data.mediaType }));

          if (data.data.mediaType === 'video' && !currentThumbnailUrl) {
            console.log('[上传完成] 视频上传成功，尝试自动提取缩略图...');
            await extractThumbnailFromVideo(data.data.url);
          }
        }
      } else {
        alert(data.error || '上传失败');
      }
    } catch (error) {
      const elapsedTime = (performance.now() - uploadStartTimeRef.current) / 1000;
      console.error('[上传异常]', error, `耗时: ${elapsedTime}秒`);
      alert('上传失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      const totalTime = (performance.now() - uploadStartTimeRef.current) / 1000;
      console.log(`[上传结束] 总耗时: ${totalTime}秒`);
      setUploading(false);
    }
  };

  // 从视频提取缩略图
  const extractThumbnailFromVideo = async (videoUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.currentTime = 1;

      video.onloadeddata = () => {
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('[提取缩略图] 无法获取 Canvas 上下文');
            resolve();
            return;
          }

          const aspectRatio = video.videoWidth / video.videoHeight;
          canvas.width = 480;
          canvas.height = Math.round(480 / aspectRatio);

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async (blob) => {
            if (!blob) {
              console.warn('[提取缩略图] 无法转换图片');
              resolve();
              return;
            }

            const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            await handleUploadFile(file, 'thumbnail');
            resolve();
          }, 'image/jpeg', 0.8);
        }, 100);
      };

      video.onerror = () => {
        console.warn('[提取缩略图] 视频加载失败');
        resolve();
      };
    });
  };

  // 保存案例
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        duration: formData.duration ? parseInt(formData.duration) : undefined,
      };

      if (editingCase) {
        await authFetch(`/api/admin/showcase-cases?id=${editingCase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch('/api/admin/showcase-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setShowDialog(false);
      resetForm();
      loadCases();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 删除缩略图
  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnailUrl: '' }));
  };

  // 删除媒体文件
  const handleRemoveMedia = () => {
    setFormData(prev => ({ ...prev, mediaUrl: '', mediaType: 'video' }));
  };

  // 打开编辑对话框
  const handleEdit = (item: ShowcaseCase) => {
    setEditingCase(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      type: item.type,
      category: item.category || '',
      thumbnailUrl: item.thumbnailUrl,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
      prompt: item.prompt || '',
      model: item.model || '',
      duration: item.duration?.toString() || '',
      isFeatured: item.isFeatured,
      displayOrder: item.displayOrder,
    });
    setShowDialog(true);
  };

  // 删除案例
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个案例吗？')) return;

    try {
      await authFetch(`/api/admin/showcase-cases?id=${id}`, {
        method: 'DELETE',
      });
      loadCases();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 切换精选状态
  const handleToggleFeatured = async (item: ShowcaseCase) => {
    try {
      await authFetch(`/api/admin/showcase-cases?id=${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !item.isFeatured }),
      });
      loadCases();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'shortfilm',
      category: '',
      thumbnailUrl: '',
      mediaUrl: '',
      mediaType: 'video',
      prompt: '',
      model: '',
      duration: '',
      isFeatured: false,
      displayOrder: 0,
    });
    setEditingCase(null);
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 加载中
  if (authLoading || (loading && cases.length === 0)) {
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
              <FilmIcon className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">访问受限</h2>
            <p className="text-muted-foreground mb-4">
              成品案例管理仅限管理员访问，您没有权限查看此页面
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
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4 max-w-7xl">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回管理后台
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FilmIcon className="w-5 h-5" />
            <h1 className="text-lg font-semibold">成品案例管理</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 筛选条件 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">搜索</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="标题或描述"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs text-muted-foreground">类型</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="shortfilm">短片</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                    <SelectItem value="image">图片</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <Label className="text-xs text-muted-foreground">分类</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="美妆">美妆</SelectItem>
                    <SelectItem value="数码">数码</SelectItem>
                    <SelectItem value="家居">家居</SelectItem>
                    <SelectItem value="服饰">服饰</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="w-4 h-4 mr-1" />
                  新增案例
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 案例列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">案例列表</CardTitle>
            <CardDescription>共 {pagination.total || cases.length} 个案例</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>封面</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>精选</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="w-24 h-14 bg-muted rounded overflow-hidden relative cursor-pointer group">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="w-full h-full object-contain"
                              onClick={() => {
                                if (item.mediaType === 'video') {
                                  setPlayingVideo(item.id);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              {item.mediaType === 'video' ? <Film className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                            </div>
                          )}
                          {item.mediaType === 'video' && (
                            <div 
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
                              onClick={() => setPlayingVideo(item.id)}
                            >
                              <Play className="w-8 h-8 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.type === 'shortfilm' ? '短片' : item.type === 'video' ? '视频' : '图片'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.category || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{item.duration ? `${item.duration}秒` : '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.isFeatured ? (
                          <Badge variant="default" className="bg-amber-500">
                            <Star className="w-3 h-3 mr-1 fill-white" />
                            精选
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{item.displayOrder}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleFeatured(item)}
                          >
                            {item.isFeatured ? (
                              <>取消精选</>
                            ) : (
                              <>
                                <Star className="w-4 h-4 mr-1" />
                                精选
                              </>
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        暂无案例数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {pagination.totalPages && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增/编辑对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingCase ? '编辑案例' : '新增案例'}</DialogTitle>
            <DialogDescription>
              {editingCase ? '修改案例信息' : '创建新的成品案例'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto py-4 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>标题 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="案例标题"
                />
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="美妆">美妆</SelectItem>
                    <SelectItem value="数码">数码</SelectItem>
                    <SelectItem value="家居">家居</SelectItem>
                    <SelectItem value="服饰">服饰</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="案例描述"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <UploadZone
                label="缩略图"
                accept="image/*"
                fileUrl={formData.thumbnailUrl}
                uploading={uploading}
                onFileSelect={(file) => {
                  if (file.size > 0) handleUploadFile(file, 'thumbnail');
                }}
                onRemove={handleRemoveThumbnail}
                hint="支持 JPG、PNG、WebP 格式，建议小于 5MB"
              />
              <p className="text-xs text-muted-foreground">
                提示：上传视频后会自动提取缩略图，可省略此步骤
              </p>
            </div>

            <div className="space-y-2">
              <UploadZone
                label="媒体文件 *"
                accept="video/*,image/*"
                fileUrl={formData.mediaUrl}
                uploading={uploading}
                onFileSelect={(file) => {
                  if (file.size > 0) handleUploadFile(file, 'media');
                }}
                onRemove={handleRemoveMedia}
                hint="支持 MP4、WebM、MOV 等视频格式，建议小于 10MB"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模型</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="使用的模型"
                />
              </div>
              <div className="space-y-2">
                <Label>时长（秒）</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="视频时长"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>提示词</Label>
              <Textarea
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="使用的提示词"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">设为精选</div>
                  <p className="text-xs text-muted-foreground">在首页优先展示</p>
                </div>
                <Switch
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFeatured: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label>显示顺序</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) }))}
                  placeholder="数字越小越靠前"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving || uploading}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 视频播放对话框 */}
      {playingVideo && (
        <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
          <DialogContent className="max-w-lg">
            <VisuallyHidden>
              <DialogTitle>视频预览</DialogTitle>
            </VisuallyHidden>
            {(() => {
              const video = cases.find(c => c.id === playingVideo);
              return video && video.mediaUrl ? (
                <VideoPlayer src={video.mediaUrl} />
              ) : null;
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
