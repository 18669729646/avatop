'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  ImagePlus, X, User, Package, Trash2, Edit2, Check, Plus, 
  Star, StarOff, Image as ImageIcon, MoreVertical, Loader2, Eye,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ImageViewer } from '@/components/image-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CharacterItem,
  getCharacterLibrary,
  addToCharacterLibrary,
  updateCharacterInLibrary,
  removeFromCharacterLibrary,
} from '@/lib/history';
import {
  Product,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addImagesToProduct,
  removeImageFromProduct,
  setPrimaryImage,
  getProductsStats,
} from '@/lib/products';
import { useQueryWithRefresh } from '@/lib/swr';
import { invalidateCacheByPrefix } from '@/lib/cache';
import { AppLayout } from '@/components/app-layout';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { getAuthToken } from '@/lib/api';
import { CharacterGridSkeleton, ProductCardSkeleton } from '@/components/skeletons';
import { useAuth } from '@/lib/auth-context';

// 产品卡片组件
function ProductCard({
  product,
  isAdmin,
  onEdit,
  onDelete,
  onImageUpload,
  onSetPrimaryImage,
  onDeleteImage,
  onPreviewImage,
}: {
  product: Product;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onImageUpload: (productId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetPrimaryImage: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
  onPreviewImage: (imageId: string) => void;
}) {
  const [showAllImages, setShowAllImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const displayImages = showAllImages ? product.images : product.images.slice(0, 6);
  const hasMoreImages = product.images.length > 6;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      await onImageUpload(product.id, e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{product.name}</CardTitle>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
            )}
            {product.sellingPoints && product.sellingPoints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {product.sellingPoints.map((point, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                    {point}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 ml-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {/* 用户信息（管理员视图时显示） */}
        {isAdmin && product.userPhone && (
          <div className="flex items-center gap-1 mb-2">
            <User className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              {product.userPhone}
            </span>
          </div>
        )}
        {/* 图片网格 */}
        <div className="grid grid-cols-4 gap-1.5">
          {displayImages.map((img) => (
            <div
              key={img.id}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden border-2 group cursor-pointer",
                img.isPrimary ? "border-primary" : "border-transparent hover:border-border"
              )}
              onClick={() => !img.isPrimary && onSetPrimaryImage(img.id)}
            >
              <img src={img.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              {img.isPrimary && (
                <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Star className="w-2.5 h-2.5" />
                </div>
              )}
              {/* 悬停操作层 */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onPreviewImage(img.id); }}
                  title="预览"
                >
                  <Eye className="w-3 h-3" />
                </Button>
                {!img.isPrimary && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); onSetPrimaryImage(img.id); }}
                    title="设为主图"
                  >
                    <Star className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); onDeleteImage(img.id); }}
                  title="删除图片"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {/* 添加图片按钮 */}
          <label className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors",
            uploading && "pointer-events-none opacity-50"
          )}>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Plus className="w-5 h-5 text-muted-foreground" />
            )}
          </label>
        </div>
        {/* 展开更多按钮 */}
        {hasMoreImages && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => setShowAllImages(!showAllImages)}
          >
            {showAllImages ? (
              <>收起 ({product.images.length} 张)</>
            ) : (
              <>查看全部 ({product.images.length} 张)</>
            )}
          </Button>
        )}
        {product.images.length > 0 && !hasMoreImages && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            点击图片设为主图
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LibraryPage() {
  // 获取用户信息
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // 分页 state
  const [characterPagination, setCharacterPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [productPagination, setProductPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  
  // 使用 SWR 管理角色图库数据（key 包含用户ID，避免数据混淆）
  const { data: charactersData, isLoading: charactersLoading, refresh: refreshCharacters } = useQueryWithRefresh<{ data: CharacterItem[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>(
    user?.id ? `library:characters:${user.id}:${characterPagination.page}` : null,
    async () => {
      const result = await getCharacterLibrary(false, characterPagination.page, characterPagination.pageSize);
      return Array.isArray(result) ? { data: result } : result;
    },
    { dedupingInterval: 10000 }
  );
  const characters = charactersData?.data || [];
  const charactersPaginationInfo = charactersData?.pagination;
  
  // 更新角色分页信息
  useEffect(() => {
    if (charactersPaginationInfo) {
      setCharacterPagination(charactersPaginationInfo);
    }
  }, [charactersPaginationInfo]);
  
  // 使用 SWR 管理产品数据（key 包含用户ID，避免数据混淆）
  const { data: productsData, isLoading: productsLoading, refresh: refreshProductsData } = useQueryWithRefresh<{ data: Product[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>(
    user?.id ? `library:products:${user.id}:${productPagination.page}` : null,
    async () => {
      const result = await getProducts(false, productPagination.page, productPagination.pageSize);
      return Array.isArray(result) ? { data: result } : result;
    },
    { dedupingInterval: 10000 }
  );
  const products = productsData?.data || [];
  const productsPaginationInfo = productsData?.pagination;
  
  // 更新产品分页信息
  useEffect(() => {
    if (productsPaginationInfo) {
      setProductPagination(productsPaginationInfo);
    }
  }, [productsPaginationInfo]);
  
  // 使用 SWR 管理产品统计（key 包含用户ID，避免数据混淆）
  const { data: productsStatsData, refresh: refreshStats } = useQueryWithRefresh<{ totalProducts: number; totalImages: number; productsWithImages: number }>(
    user?.id ? `library:products:${user.id}:stats` : null,
    getProductsStats,
    { dedupingInterval: 10000 }
  );
  const productsStats = productsStatsData || { totalProducts: 0, totalImages: 0, productsWithImages: 0 };
  
  const [characterName, setCharacterName] = useState('');
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingCharacterName, setEditingCharacterName] = useState('');
  const [characterUploading, setCharacterUploading] = useState(false);
  
  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  // 产品图片预览状态
  const [productPreview, setProductPreview] = useState<{
    images: { url: string; id: string }[];
    currentIndex: number;
    productName: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState('characters');

  // 产品编辑对话框
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    sellingPoints: [] as string[],
    targetAudience: '',
  });

  // 删除确认
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const characterInputRef = useRef<HTMLInputElement>(null);

  // 刷新产品数据
  const refreshProducts = useCallback(async () => {
    await Promise.all([refreshProductsData(), refreshStats()]);
  }, [refreshProductsData, refreshStats]);

  useEffect(() => {
    // 预热 API 路由（开发模式下避免首次请求编译延迟）
    const warmupApis = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API预热] 开始预热上传相关API...');
        const warmupStart = Date.now();
        
        // 预热 upload-image API（用最小化请求）
        try {
          const formData = new FormData();
          formData.append('warmup', 'true'); // 标记为预热请求
          
          await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });
          
          console.log(`[API预热] 完成，耗时 ${Date.now() - warmupStart}ms`);
        } catch (e) {
          // 预热失败不影响正常使用
          console.log('[API预热] 已触发编译');
        }
      }
    };
    
    warmupApis(); // 后台预热，不阻塞数据加载
  }, []);

  // 角色操作 - 优化版：使用 FormData 二进制上传 + 批量添加
  const handleCharacterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('[TRACE-角色上传] Step 1: 文件选择', { 
      filesCount: files?.length,
      files: files ? Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })) : null
    });
    
    if (!files || files.length === 0) {
      console.log('[TRACE-角色上传] Step 1.1: 没有选择文件，退出');
      return;
    }

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    console.log('[TRACE-角色上传] Step 2: 过滤有效图片', { 
      validCount: validFiles.length,
      invalidFiles: Array.from(files).filter(f => !f.type.startsWith('image/')).map(f => f.name)
    });
    
    if (validFiles.length === 0) {
      console.log('[TRACE-角色上传] Step 2.1: 没有有效图片，退出');
      return;
    }

    setCharacterUploading(true);
    console.log(`[TRACE-角色上传] Step 3: 开始上传 ${validFiles.length} 张图片`);
    const startTime = Date.now();

    try {
      // 并行上传所有图片（使用 FormData 二进制上传，更高效）
      const uploadPromises = validFiles.map(async (file, index) => {
        const traceId = `${Date.now()}-${index}`;
        console.log(`[TRACE-角色上传-${traceId}] Step 4: 准备上传`, {
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(2)}KB`,
          fileType: file.type
        });
        
        try {
          // 使用 FormData 二进制上传，避免 base64 编码开销
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder', 'characters');
          formData.append('fileName', `characters/${Date.now()}_${index}_${file.name}`);
          
          console.log(`[TRACE-角色上传-${traceId}] Step 5: FormData 构造完成，开始 fetch`);
          
          const response = await authFetch('/api/upload-image', {
            method: 'POST',
            body: formData, // 直接发送 FormData，不需要 JSON
          });
          
          console.log(`[TRACE-角色上传-${traceId}] Step 6: 收到响应`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });
          
          const result = await response.json();
          console.log(`[TRACE-角色上传-${traceId}] Step 7: 解析响应`, {
            success: result.success,
            hasUrl: !!result.url,
            error: result.error,
            key: result.key
          });
          
          const name = characterName.trim() || `角色 ${characters.length + index + 1}`;
          
          if (result.success && result.url) {
            console.log(`[TRACE-角色上传-${traceId}] Step 8: 上传成功`, { name, urlLength: result.url.length });
            return { name, url: result.url };
          } else {
            console.error(`[TRACE-角色上传-${traceId}] Step 8-FAIL: 上传失败`, result);
            return null;
          }
        } catch (error) {
          console.error(`[TRACE-角色上传-${traceId}] Step 8-ERROR: 上传异常`, {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          });
          return null;
        }
      });

      console.log('[TRACE-角色上传] Step 9: 等待所有上传完成...');
      const uploadResults = await Promise.all(uploadPromises);
      console.log('[TRACE-角色上传] Step 10: 上传结果', {
        total: uploadResults.length,
        success: uploadResults.filter(r => r !== null).length,
        failed: uploadResults.filter(r => r === null).length
      });
      
      const successItems = uploadResults.filter((item): item is { name: string; url: string } => item !== null);
      
      // 批量添加到角色库（一次 API 调用）
      if (successItems.length > 0) {
        console.log('[TRACE-角色上传] Step 11: 准备批量添加角色', {
          count: successItems.length,
          items: successItems.map(i => i.name)
        });
        
        try {
          const batchResponse = await authFetch('/api/characters', {
            method: 'POST',
            body: JSON.stringify({ characters: successItems }),
          });
          
          console.log('[TRACE-角色上传] Step 12: 批量添加响应', {
            status: batchResponse.status,
            ok: batchResponse.ok
          });
          
          const batchResult = await batchResponse.json();
          console.log('[TRACE-角色上传] Step 13: 批量添加结果', batchResult);
          
          if (batchResponse.ok) {
            console.log(`[TRACE-角色上传] 批量添加 ${successItems.length} 个角色成功`);
          } else {
            console.error('[TRACE-角色上传] 批量添加失败:', batchResult);
          }
        } catch (error) {
          console.error('[TRACE-角色上传] 批量添加异常:', {
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[TRACE-角色上传] Step 14: 完成，耗时 ${elapsed}ms`);
      
      setCharacterName('');
      console.log('[TRACE-角色上传] Step 15: 使缓存失效...');
      // 使缓存失效，确保刷新时获取最新数据
      invalidateCacheByPrefix('characters:');
      console.log('[TRACE-角色上传] Step 16: 刷新角色列表...');
      // 使用 SWR 刷新
      refreshCharacters();
      if (characterInputRef.current) characterInputRef.current.value = '';
    } catch (error) {
      console.error('[TRACE-角色上传] 整体流程异常:', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setCharacterUploading(false);
      console.log('[TRACE-角色上传] Step 17: 上传流程结束');
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    await removeFromCharacterLibrary(id);
    refreshCharacters();
  };

  const startEditCharacter = (item: CharacterItem) => {
    setEditingCharacterId(item.id);
    setEditingCharacterName(item.name);
  };

  const saveCharacterName = async () => {
    if (editingCharacterId && editingCharacterName.trim()) {
      await updateCharacterInLibrary(editingCharacterId, { name: editingCharacterName.trim() });
      refreshCharacters();
    }
    setEditingCharacterId(null);
    setEditingCharacterName('');
  };

  // 产品操作
  const openNewProductDialog = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', sellingPoints: [], targetAudience: '' });
    setShowProductDialog(true);
  };

  const openEditProductDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      sellingPoints: product.sellingPoints || [],
      targetAudience: product.targetAudience || '',
    });
    setShowProductDialog(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) return;

    // 过滤掉空行
    const sellingPoints = productForm.sellingPoints.map(s => s.trim()).filter(Boolean);

    if (editingProduct) {
      await updateProduct(editingProduct.id, { ...productForm, sellingPoints });
    } else {
      await createProduct({ ...productForm, sellingPoints });
    }
    
    await refreshProducts();
    setShowProductDialog(false);
  };

  const handleDeleteProduct = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id);
      await refreshProducts();
      setProductToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleProductImageUpload = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    console.log(`[TRACE-产品图片上传] 开始上传 ${validFiles.length} 张图片...`);
    const startTime = Date.now();

    // 并行上传所有图片（使用 FormData 二进制上传，更高效）
    type UploadResult = { url: string; fileSize?: number } | null;
    
    const uploadPromises = validFiles.map(async (file, index): Promise<UploadResult> => {
      const traceId = `${Date.now()}-${index}`;
      const stepTimes: Record<string, number> = {};
      
      try {
        stepTimes['start'] = Date.now();
        console.log(`[TRACE-产品图片上传-${traceId}] Step 1: 准备上传`, {
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(2)}KB`,
          fileType: file.type
        });
        
        // 压缩图片到 2K（2048px）以内，质量 100%
        const compressedBlob = await compressImage(file, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 1,
        });
        
        // 使用 FormData 二进制上传，避免 base64 编码开销
        const formData = new FormData();
        formData.append('file', compressedBlob, file.name);
        formData.append('folder', `products/${productId}`);
        formData.append('fileName', `products/${productId}/${Date.now()}_${index}_${file.name}`);
        
        stepTimes['formData'] = Date.now();
        console.log(`[TRACE-产品图片上传-${traceId}] Step 2: FormData 构造完成，耗时 ${stepTimes['formData'] - stepTimes['start']}ms`);
        
        const fetchStartTime = Date.now();
        console.log(`[TRACE-产品图片上传-${traceId}] Step 2.1: 开始 fetch 请求`);
        
        const response = await authFetch('/api/upload-image', {
          method: 'POST',
          body: formData, // 直接发送 FormData，不需要 JSON
        });
        
        const fetchEndTime = Date.now();
        stepTimes['fetchComplete'] = fetchEndTime;
        console.log(`[TRACE-产品图片上传-${traceId}] Step 2.2: fetch 完成，网络耗时 ${fetchEndTime - fetchStartTime}ms`, {
          status: response.status,
          ok: response.ok
        });
        
        const jsonStartTime = Date.now();
        const result = await response.json();
        stepTimes['jsonParse'] = Date.now();
        console.log(`[TRACE-产品图片上传-${traceId}] Step 2.3: JSON 解析完成，耗时 ${stepTimes['jsonParse'] - jsonStartTime}ms`);
        
        if (result.success && result.url) {
          console.log(`[TRACE-产品图片上传-${traceId}] Step 3: 上传成功，总耗时 ${Date.now() - stepTimes['start']}ms`);
          return { url: result.url, fileSize: result.fileSize };
        } else {
          console.error(`[TRACE-产品图片上传-${traceId}] Step 3-FAIL: 上传失败`, result.error);
          return null;
        }
      } catch (error) {
        console.error(`[TRACE-产品图片上传-${traceId}] Step 3-ERROR: 上传异常`, error);
        return null;
      }
    });

    // 等待所有上传完成
    const results = await Promise.all(uploadPromises);
    const successfulImages = results
      .filter((img): img is { url: string; fileSize?: number } => img !== null)
      .map(img => ({ url: img.url, fileSize: img.fileSize }));

    const elapsed = Date.now() - startTime;
    console.log(`[TRACE-产品图片上传] 完成: ${successfulImages.length}/${validFiles.length} 张，耗时 ${elapsed}ms`);

    // 批量添加图片
    if (successfulImages.length > 0) {
      await addImagesToProduct(productId, successfulImages);
      // 使缓存失效，确保刷新时获取最新数据
      invalidateCacheByPrefix('products:');
      await refreshProducts();
    }
    
    // 清空当前 input，允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">图库管理</h1>
              <Badge variant="secondary" className="text-xs">
                {characters.length} 角色 · {productsStats.totalProducts} 产品
              </Badge>
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-6 pt-4 shrink-0">
              <TabsList>
                <TabsTrigger value="characters" className="gap-2">
                  <User className="w-4 h-4" />
                  角色图库
                </TabsTrigger>
                <TabsTrigger value="products" className="gap-2">
                  <Package className="w-4 h-4" />
                  产品图库
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="characters" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-6 max-w-5xl mx-auto space-y-6">
                  {/* 上传区域 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">添加角色</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 items-center">
                        <Input
                          placeholder="角色名称（可选，多图上传时自动编号）"
                          value={characterName}
                          onChange={(e) => setCharacterName(e.target.value)}
                          className="max-w-sm"
                        />
                        <input
                          ref={characterInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleCharacterUpload}
                        />
                        <Button 
                          onClick={() => characterInputRef.current?.click()}
                          disabled={characterUploading}
                        >
                          {characterUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              上传中...
                            </>
                          ) : (
                            <>
                              <ImagePlus className="w-4 h-4 mr-2" />
                              上传图片
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">支持批量上传多张图片</p>
                    </CardContent>
                  </Card>

                  {/* 角色列表 */}
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      共 {characters.length} 个角色
                    </div>
                  </div>
                  {charactersLoading ? (
                    <CharacterGridSkeleton count={10} />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {characters.map((item) => (
                        <Card key={item.id} className="group overflow-hidden py-0 gap-0">
                          <div className="aspect-square relative bg-muted overflow-hidden cursor-pointer" onClick={() => setPreviewImage({ url: item.url, name: item.name })}>
                            <img 
                              src={item.url} 
                              alt={item.name} 
                              loading="lazy"
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                          {/* 悬停遮罩和操作按钮 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                              <p className="text-xs text-white/90 truncate font-medium">{item.name}</p>
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="h-7 w-7 p-0 bg-white/20 hover:bg-white/40 border-0 text-white" 
                                  onClick={() => startEditCharacter(item)} 
                                  title="编辑名称"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="h-7 w-7 p-0 bg-white/20 hover:bg-red-500/80 border-0 text-white" 
                                  onClick={() => handleDeleteCharacter(item.id)} 
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 bg-card">
                          {/* 用户信息（管理员视图时显示） */}
                          {isAdmin && item.userPhone && (
                            <div className="flex items-center gap-1 mb-1">
                              <User className="w-2.5 h-2.5 text-blue-500" />
                              <span className="text-xs text-muted-foreground truncate">
                                {item.userPhone}
                              </span>
                            </div>
                          )}
                          {editingCharacterId === item.id ? (
                            <div className="flex gap-1">
                              <Input
                                value={editingCharacterName}
                                onChange={(e) => setEditingCharacterName(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && saveCharacterName()}
                              />
                              <Button size="sm" className="h-7 w-7 p-0" onClick={saveCharacterName}>
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs font-medium truncate text-center" title={item.name}>{item.name}</p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                  )}

                  {/* 分页控件 */}
                  {characterPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between py-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        共 {characterPagination.total} 个，第 {characterPagination.page}/{characterPagination.totalPages} 页
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={characterPagination.page <= 1 || charactersLoading}
                          onClick={() => setCharacterPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={characterPagination.page >= characterPagination.totalPages || charactersLoading}
                          onClick={() => setCharacterPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!charactersLoading && characters.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>还没有角色图片</p>
                        <p className="text-sm mt-1">上传角色图片后可在生成时选择</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="products" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-6 max-w-5xl mx-auto space-y-6">
                  {/* 添加按钮 */}
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      共 {productsStats.totalProducts} 个产品，{productsStats.totalImages} 张图片
                    </div>
                    <Button onClick={openNewProductDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加产品
                    </Button>
                  </div>

                  {/* 产品列表 */}
                  {productsLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array(4).fill(0).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isAdmin={isAdmin}
                        onEdit={() => openEditProductDialog(product)}
                        onDelete={() => { setProductToDelete(product); setShowDeleteConfirm(true); }}
                        onImageUpload={handleProductImageUpload}
                        onSetPrimaryImage={async (imageId) => {
                          await setPrimaryImage(product.id, imageId);
                          await refreshProducts();
                        }}
                        onDeleteImage={async (imageId) => {
                          await removeImageFromProduct(product.id, imageId);
                          await refreshProducts();
                        }}
                        onPreviewImage={(imageId) => {
                          const imgIndex = product.images.findIndex(i => i.id === imageId);
                          if (imgIndex !== -1) {
                            setProductPreview({
                              images: product.images.map(img => ({ url: img.url, id: img.id })),
                              currentIndex: imgIndex,
                              productName: product.name,
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                  )}

                  {/* 分页控件 */}
                  {productPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between py-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        共 {productPagination.total} 个，第 {productPagination.page}/{productPagination.totalPages} 页
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={productPagination.page <= 1 || productsLoading}
                          onClick={() => setProductPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={productPagination.page >= productPagination.totalPages || productsLoading}
                          onClick={() => setProductPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                          下一页
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!productsLoading && products.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>还没有产品</p>
                        <p className="text-sm mt-1">添加产品后可在生成时选择产品图片</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 产品编辑对话框 */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? '编辑产品' : '添加产品'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>产品名称</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="产品名称"
                className="mt-2"
              />
            </div>
            <div>
              <Label>产品描述</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                placeholder="产品描述"
                className="mt-2"
              />
            </div>
            <div>
              <Label>核心卖点（每行一个）</Label>
              <Textarea
                value={productForm.sellingPoints.join('\n')}
                onChange={(e) => setProductForm({ ...productForm, sellingPoints: e.target.value.split('\n') })}
                placeholder="每行一个卖点"
                className="mt-2 min-h-[100px]"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductDialog(false)}>取消</Button>
            <Button onClick={handleSaveProduct}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除产品</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除产品 "{productToDelete?.name}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 图片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {previewImage && (
            <ImageViewer
              src={previewImage.url}
              alt={previewImage.name}
              fileName={`${previewImage.name}.png`}
              onClose={() => setPreviewImage(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 产品图片预览对话框 */}
      <Dialog open={!!productPreview} onOpenChange={(open) => !open && setProductPreview(null)}>
        <DialogContent className="max-w-2xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {productPreview && (
            <ImageViewer
              src={productPreview.images[productPreview.currentIndex]?.url || ''}
              alt={productPreview.productName}
              fileName={`${productPreview.productName}-${productPreview.currentIndex + 1}.png`}
              images={productPreview.images}
              currentIndex={productPreview.currentIndex}
              onIndexChange={(index) => setProductPreview(prev => prev ? { ...prev, currentIndex: index } : null)}
              onClose={() => setProductPreview(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
