'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Package, Image as ImageIcon, Search, Check, Lightbulb, 
  Users, Tag, ExternalLink, Star
} from 'lucide-react';
import Link from 'next/link';
import {
  Product,
  ProductSelection,
  getProducts,
  getProductSelection,
  searchProducts,
} from '@/lib/products';
import { useDebouncedValue } from '@/hooks/use-debounce';

interface ProductSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: ProductSelection) => void;
  selectedProductId?: string;
  title?: string;
  description?: string;
}

export function ProductSelector({
  open,
  onOpenChange,
  onSelect,
  selectedProductId,
  title = '选择产品',
  description = '从产品库中选择一个产品，产品图片和信息将自动带入',
}: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 防抖搜索词（300ms 延迟）
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // 加载产品列表
  useEffect(() => {
    if (open) {
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => setIsLoading(true), 0);
      getProducts()
        .then(result => {
          const data = Array.isArray(result) ? result : result.data;
          // 使用 setTimeout 避免同步 setState
          setTimeout(() => {
            setProducts(data);
            setFilteredProducts(data);
          }, 0);
        })
        .catch(error => {
          console.error('[ProductSelector] Failed to load products:', error);
        })
        .finally(() => {
          setTimeout(() => setIsLoading(false), 0);
        });
      setTimeout(() => setLocalSelectedId(selectedProductId || null), 0);
    }
  }, [open, selectedProductId]);

  // 搜索过滤（使用防抖后的搜索词）
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      searchProducts(debouncedSearchQuery).then(setFilteredProducts).catch(() => {});
    } else {
      // 使用 setTimeout 避免同步 setState
      setTimeout(() => setFilteredProducts(products), 0);
    }
  }, [debouncedSearchQuery, products]);

  // 选择产品
  const handleSelect = async (product: Product) => {
    const selection = await getProductSelection(product.id);
    if (selection) {
      setLocalSelectedId(product.id);
      onSelect(selection);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* 搜索栏 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="搜索产品名称、关键词..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 产品列表 */}
        <ScrollArea className="flex-1 -mx-6">
          <div className="px-6 pb-4">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredProducts.map((product) => {
                  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
                  const isSelected = localSelectedId === product.id;
                  
                  return (
                    <Card
                      key={product.id}
                      className={`cursor-pointer transition-all hover:border-blue-300 ${
                        isSelected 
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20' 
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      onClick={() => handleSelect(product)}
                    >
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          {/* 产品图片 */}
                          <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 relative">
                            {primaryImage ? (
                              <img
                                src={primaryImage.url}
                                alt={product.name}
                                loading="lazy"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-slate-300" />
                              </div>
                            )}
                            {/* 图片数量 */}
                            {product.images.length > 1 && (
                              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded flex items-center gap-0.5">
                                <ImageIcon className="w-2.5 h-2.5" />
                                {product.images.length}
                              </div>
                            )}
                            {/* 选中标记 */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="bg-blue-500 text-white rounded-full p-1">
                                  <Check className="w-4 h-4" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 产品信息 */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium truncate">{product.name}</h4>
                              {product.images.length > 0 && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  <ImageIcon className="w-3 h-3 mr-1" />
                                  {product.images.length}图
                                </Badge>
                              )}
                            </div>
                            
                            {product.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {product.description}
                              </p>
                            )}

                            {/* 详细信息标签 */}
                            <div className="flex flex-wrap gap-1">
                              {product.sellingPoints.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <Lightbulb className="w-2.5 h-2.5 mr-1" />
                                  {product.sellingPoints.length} 卖点
                                </Badge>
                              )}
                              {product.targetAudience && (
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="w-2.5 h-2.5 mr-1" />
                                  受众
                                </Badge>
                              )}
                              {product.keywords.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Tag className="w-2.5 h-2.5 mr-1" />
                                  {product.keywords.length} 关键词
                                </Badge>
                              )}
                            </div>

                            {/* 主图标记 */}
                            {primaryImage?.isPrimary && (
                              <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                                <Star className="w-3 h-3" />
                                有主图
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400">未找到匹配的产品</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => setSearchQuery('')}
                    >
                      清除搜索
                    </Button>
                  </>
                ) : (
                  <>
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400">暂无产品</p>
                    <p className="text-sm text-slate-400 mt-1">请先在图库管理中创建产品</p>
                    <Link href="/library" target="_blank">
                      <Button variant="outline" size="sm" className="mt-3">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        前往图库管理
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        {filteredProducts.length > 0 && (
          <div className="text-xs text-slate-400 text-center pt-2 border-t">
            点击产品卡片即可选择 · 共 {filteredProducts.length} 个产品
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 简化的产品预览卡片（用于显示已选择的产品）
interface ProductPreviewProps {
  product: ProductSelection;
  onChange?: () => void;
  onRemove?: () => void;
  showFullInfo?: boolean;
}

export function ProductPreview({ 
  product, 
  onChange, 
  onRemove,
  showFullInfo = false 
}: ProductPreviewProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* 产品图片 */}
          <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 relative">
            {product.primaryImage ? (
              <img
                src={product.primaryImage}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-slate-300" />
              </div>
            )}
            {product.allImages.length > 1 && (
              <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1 rounded">
                +{product.allImages.length - 1}
              </div>
            )}
          </div>

          {/* 产品信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{product.name}</h4>
              <div className="flex gap-1 shrink-0">
                {onChange && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onChange}>
                    更换
                  </Button>
                )}
                {onRemove && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600" onClick={onRemove}>
                    移除
                  </Button>
                )}
              </div>
            </div>
            
            {showFullInfo && product.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                {product.description}
              </p>
            )}

            {/* 简要标签 */}
            <div className="flex flex-wrap gap-1 mt-1">
              {product.sellingPoints.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4">
                  {product.sellingPoints.length} 卖点
                </Badge>
              )}
              {product.keywords.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-4">
                  {product.keywords.slice(0, 2).join(' · ')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
