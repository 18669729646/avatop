'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Image as ImageIcon, Check, Package, Layers, ImageIcon as ImageIconLucide, Upload, Loader2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/products';
import { authFetch } from '@/lib/auth-context';
import { getCharacterLibrary, CharacterItem } from '@/lib/history';

interface ReferenceImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (urls: string[]) => void;
  currentReferences?: string[];
  productImages: Product[];
  generatedImages: { taskId: string; taskOrder: number; url: string }[];
}

export function ReferenceImageDialog({
  open,
  onOpenChange,
  onSelect,
  currentReferences = [],
  productImages,
  generatedImages,
}: ReferenceImageDialogProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [characterLibrary, setCharacterLibrary] = useState<CharacterItem[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const prevOpenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 使用 useMemo 缓存 currentReferences 的 JSON 字符串，避免每次渲染都变化
  const currentRefsKey = useMemo(() => JSON.stringify(currentReferences), [currentReferences]);

  // 只在对话框打开时同步状态
  useEffect(() => {
    // 只在对话框从关闭变为打开时同步
    if (open && !prevOpenRef.current) {
      setSelectedUrls(new Set(currentReferences));
      // 加载角色图库
      loadCharacterLibrary();
    }
    prevOpenRef.current = open;
  }, [open, currentRefsKey]);

  // 加载角色图库
  const loadCharacterLibrary = async () => {
    setIsLoadingCharacters(true);
    try {
      const result = await getCharacterLibrary();
      const items = Array.isArray(result) ? result : result.data;
      setCharacterLibrary(items || []);
    } catch (error) {
      console.error('加载角色图库失败:', error);
    } finally {
      setIsLoadingCharacters(false);
    }
  };

  const toggleSelect = (url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedUrls));
    onOpenChange(false);
  };

  const handleClear = () => {
    onSelect([]);
    onOpenChange(false);
  };

  // 上传本地图片
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      // 循环上传每个文件（/api/upload-image 一次只支持单个文件）
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'shortfilm-references');

        const response = await authFetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success && data.url) {
          return data.url;
        } else {
          console.error('上传失败:', data.error);
          throw new Error(data.error || '上传失败');
        }
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedUrls(prev => [...prev, ...urls]);
      // 自动选中新上传的图片
      setSelectedUrls(prev => {
        const newSet = new Set(prev);
        urls.forEach((url: string) => newSet.add(url));
        return newSet;
      });
    } catch (error) {
      console.error('上传失败:', error);
      // 可以在这里添加 toast 提示
    } finally {
      setIsUploading(false);
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除已上传的图片
  const handleRemoveUploaded = (url: string) => {
    setUploadedUrls(prev => prev.filter(u => u !== url));
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      newSet.delete(url);
      return newSet;
    });
  };

  const isSelected = (url: string) => selectedUrls.has(url);

  // 检查是否有可选的图片
  const hasProductImages = productImages.length > 0;
  const hasGeneratedImages = generatedImages.length > 0;
  const hasUploadedImages = uploadedUrls.length > 0;
  const hasCharacterImages = characterLibrary.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIconLucide className="w-5 h-5" />
            选择参考图（可多选）
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-auto">
          {/* 上传本地图片 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">上传本地图片</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* 已上传的图片 */}
              {uploadedUrls.map((url, idx) => (
                <div
                  key={`uploaded-${idx}`}
                  onClick={() => toggleSelect(url)}
                  className={cn(
                    "relative w-24 h-24 rounded-lg border-2 overflow-hidden cursor-pointer flex-shrink-0 transition-all group",
                    isSelected(url)
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <img
                    src={url}
                    alt={`上传图片 ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {isSelected(url) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* 删除按钮 */}
                  <button
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveUploaded(url);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* 上传按钮 */}
              <label className={cn(
                "w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all",
                isUploading ? "border-muted-foreground/30 bg-muted/50" : "border-border hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <>
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    <span className="text-xs text-muted-foreground mt-1">上传中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">上传图片</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* 产品图库 */}
          {hasProductImages && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">产品图库</span>
                <span className="text-xs text-muted-foreground">({productImages.length}个产品)</span>
              </div>
              <ScrollArea className="h-32">
                <div className="flex gap-2 pb-2">
                  {productImages.map((product) => {
                    const primaryImg = product.images.find(img => img.isPrimary) || product.images[0];
                    if (!primaryImg) return null;
                    
                    // 检查该产品的所有图片是否都被选中
                    const productImageUrls = product.images.map(img => img.url);
                    const allSelected = productImageUrls.every(url => isSelected(url));
                    const someSelected = productImageUrls.some(url => isSelected(url));
                    
                    // 点击产品时，切换该产品所有图片的选中状态
                    const handleProductClick = () => {
                      if (allSelected) {
                        // 取消选中该产品的所有图片
                        setSelectedUrls(prev => {
                          const newSet = new Set(prev);
                          productImageUrls.forEach(url => newSet.delete(url));
                          return newSet;
                        });
                      } else {
                        // 选中该产品的所有图片
                        setSelectedUrls(prev => {
                          const newSet = new Set(prev);
                          productImageUrls.forEach(url => newSet.add(url));
                          return newSet;
                        });
                      }
                    };
                    
                    return (
                      <div
                        key={product.id}
                        onClick={handleProductClick}
                        className={cn(
                          "relative w-24 h-24 rounded-lg border-2 overflow-hidden cursor-pointer flex-shrink-0 transition-all",
                          allSelected
                            ? "border-primary ring-2 ring-primary/30"
                            : someSelected
                            ? "border-primary/50 ring-1 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <img
                          src={primaryImg.url}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center truncate">
                          {product.name} ({product.images.length}张)
                        </div>
                        {allSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {someSelected && !allSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-primary/60 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 角色图库 */}
          {hasCharacterImages && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">角色图库</span>
                <span className="text-xs text-muted-foreground">({characterLibrary.length})</span>
              </div>
              <ScrollArea className="h-32">
                <div className="flex gap-2 pb-2">
                  {characterLibrary.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => toggleSelect(character.url)}
                      className={cn(
                        "relative w-24 h-24 rounded-lg border-2 overflow-hidden cursor-pointer flex-shrink-0 transition-all",
                        isSelected(character.url)
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <img
                        src={character.url}
                        alt={character.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center truncate">
                        {character.name}
                      </div>
                      {isSelected(character.url) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 已生成的图片 */}
          {hasGeneratedImages && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">已生成图片</span>
                <span className="text-xs text-muted-foreground">({generatedImages.length})</span>
              </div>
              <ScrollArea className="h-48">
                <div className="flex gap-2 pb-2">
                  {generatedImages.map((img) => (
                    <div
                      key={img.taskId}
                      onClick={() => toggleSelect(img.url)}
                      className={cn(
                        "relative w-20 aspect-[9/16] rounded-lg border-2 overflow-hidden cursor-pointer flex-shrink-0 transition-all bg-muted",
                        isSelected(img.url)
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <img
                        src={img.url}
                        alt={`段落 ${img.taskOrder}`}
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center">
                        段落 {img.taskOrder}
                      </div>
                      {isSelected(img.url) && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 无可选图片提示 */}
          {!hasProductImages && !hasGeneratedImages && !hasUploadedImages && !hasCharacterImages && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">暂无可选的参考图</p>
              <p className="text-xs mt-1">请上传本地图片、添加产品图片或角色图片</p>
            </div>
          )}

          {/* 已选择的数量 */}
          {selectedUrls.size > 0 && (
            <div className="text-sm text-muted-foreground">
              已选择 <span className="font-medium text-foreground">{selectedUrls.size}</span> 张参考图
            </div>
          )}

          {/* 无参考图选项 */}
          <div
            onClick={() => setSelectedUrls(new Set())}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              selectedUrls.size === 0
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">不使用参考图</div>
              <div className="text-xs text-muted-foreground">仅使用提示词生成图片</div>
            </div>
            {selectedUrls.size === 0 && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClear} size="sm">
            移除参考图
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
              取消
            </Button>
            <Button onClick={handleConfirm} size="sm">
              确认选择
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
