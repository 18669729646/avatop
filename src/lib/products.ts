// 产品管理工具 - 服务器端存储版本
import { 
  cache, 
  withCache, 
  invalidateCache, 
  invalidateCacheByPrefix,
  CacheKeys,
  CACHE_TTL 
} from './cache';
import { getAuthToken, getCurrentUserId } from './api';

// 产品图片
export interface ProductImage {
  id: string;
  key: string; // S3 存储的 key（永久有效）
  url: string;
  isPrimary: boolean; // 是否为主图
  description?: string; // 图片描述
  fileSize?: number; // 文件大小（字节）
  createdAt: number;
}

// 产品信息
export interface Product {
  id: string;
  name: string;
  description: string; // 产品描述
  sellingPoints: string[]; // 卖点列表
  targetAudience: string; // 目标受众
  usageScenarios: string; // 使用场景
  brandInfo: string; // 品牌信息
  priceRange: string; // 价格区间
  keywords: string[]; // 关键词标签
  images: ProductImage[]; // 产品图片列表
  createdAt: string | number;
  updatedAt: string | number;
  // 用户信息（管理员视图时显示）
  userId?: string;
  userPhone?: string;
  userNickname?: string;
}

// 简化的产品选择信息（用于传递给其他页面）
export interface ProductSelection {
  id: string;
  name: string;
  description: string;
  sellingPoints: string[];
  targetAudience: string;
  usageScenarios: string;
  brandInfo: string;
  priceRange: string;
  keywords: string[];
  primaryImage: string; // 主图 URL
  allImages: Array<{ key: string; url: string }>; // 所有图片（key + url）
}

const MAX_IMAGES_PER_PRODUCT = 20;

// 从 URL 中提取 key
function extractKeyFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // 移除开头的 /
  } catch {
    return url;
  }
}

// API 请求辅助函数
async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  // 在服务器端，需要使用完整的 URL
  const fullUrl = typeof window === 'undefined' 
    ? `http://localhost:5000${url}` 
    : url;
  
  // 获取认证 token
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  // 添加 Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(fullUrl, {
    headers,
    ...options,
  });

  if (!response.ok) {
    // 如果是 401 错误，说明未登录或 token 过期，静默处理
    if (response.status === 401) {
      console.log(`[apiRequest] 未授权: ${url}`);
      throw new Error('未登录');
    }
    
    // 其他错误也静默处理，避免控制台显示错误
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    console.log(`[apiRequest] 请求失败: ${url}, 状态: ${response.status}, 错误: ${error.error}`);
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// ========== 产品管理 ==========

// 获取所有产品
export async function getProducts(
  forceRefresh = false,
  page?: number,
  pageSize?: number
): Promise<Product[] | { data: Product[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }> {
  try {
    const usePagination = page !== undefined && pageSize !== undefined;
    const token = getAuthToken();
    if (!token) {
      return usePagination ? { data: [] } : [];
    }

    const userId = getCurrentUserId();
    const params = new URLSearchParams({ 
      page: (page || 1).toString(), 
      pageSize: (pageSize || 20).toString() 
    });
    const cacheKey = userId ? `products:${userId}:${page || 1}:${pageSize || 20}` : `products:${page || 1}:${pageSize || 20}`;
    
    const result = await withCache(
      cacheKey,
      async () => {
        const response = await fetch(`/api/products/manage?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('[Products] 未授权，请先登录');
            return { data: [], pagination: undefined };
          }
          const errorText = await response.text();
          console.log('[Products] API error:', response.status, errorText);
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
          data: data.data || [],
          pagination: data.pagination,
        };
      },
      { ttl: CACHE_TTL.PRODUCTS, forceRefresh }
    );
    
    if (!usePagination) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.log('[Products] Failed to load:', error instanceof Error ? error.message : error);
    return { data: [] };
  }
}

// 获取单个产品
export async function getProduct(id: string, forceRefresh = false): Promise<Product | null> {
  try {
    return await withCache(
      CacheKeys.product(id),
      async () => {
        const result = await apiRequest<{ data: Product }>(`/api/products/manage/${id}`);
        return result.data;
      },
      { ttl: CACHE_TTL.PRODUCTS, forceRefresh }
    );
  } catch (error) {
    console.error('Failed to get product:', error);
    return null;
  }
}

// 创建新产品
export async function createProduct(data: {
  name: string;
  description?: string;
  sellingPoints?: string[];
  targetAudience?: string;
  usageScenarios?: string;
  brandInfo?: string;
  priceRange?: string;
  keywords?: string[];
}): Promise<Product | null> {
  try {
    const result = await apiRequest<{ data: Product }>('/api/products/manage', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        images: [],
      }),
    });
    
    // 使产品列表缓存失效
    invalidateCacheByPrefix('products:');
    
    return result.data;
  } catch (error) {
    console.error('Failed to create product:', error);
    return null;
  }
}

// 更新产品信息
export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'images' | 'createdAt'>>): Promise<Product | null> {
  try {
    // 获取当前产品（使用缓存）
    const product = await getProduct(id);
    if (!product) return null;

    // 更新产品
    const result = await apiRequest<{ data: Product }>(`/api/products/manage/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    // 使缓存失效
    invalidateCache(CacheKeys.product(id));
    invalidateCacheByPrefix('products:');
    
    return result.data;
  } catch (error) {
    console.error('Failed to update product:', error);
    return null;
  }
}

// 删除产品
export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/products/manage/${id}`, { method: 'DELETE' });
    
    // 使缓存失效
    invalidateCache(CacheKeys.product(id));
    invalidateCacheByPrefix('products:');
    
    return true;
  } catch (error) {
    console.error('Failed to delete product:', error);
    return false;
  }
}

// ========== 产品图片管理 ==========

// 添加图片到产品
export async function addImageToProduct(productId: string, imageData: {
  url: string;
  isPrimary?: boolean;
  description?: string;
}): Promise<ProductImage | null> {
  try {
    const product = await getProduct(productId);
    if (!product) return null;

    // 限制每个产品的图片数量
    if (product.images.length >= MAX_IMAGES_PER_PRODUCT) {
      console.warn('Maximum images per product reached');
      return null;
    }

    const now = Date.now();
    const newImage: ProductImage = {
      id: `img-${now}-${Math.random().toString(36).substr(2, 9)}`,
      key: extractKeyFromUrl(imageData.url),
      url: imageData.url,
      isPrimary: imageData.isPrimary ?? product.images.length === 0,
      description: imageData.description || '',
      createdAt: now,
    };

    // 如果设为主图，取消其他图片的主图标记
    if (newImage.isPrimary) {
      product.images.forEach(img => img.isPrimary = false);
    }

    product.images.push(newImage);

    // 保存更新
    await apiRequest<{ data: Product }>('/api/products/manage', {
      method: 'POST',
      body: JSON.stringify(product),
    });

    // 使缓存失效
    invalidateCache(CacheKeys.product(productId));
    invalidateCacheByPrefix('products:');

    return newImage;
  } catch (error) {
    console.error('Failed to add image to product:', error);
    return null;
  }
}

// 批量添加图片到产品
export async function addImagesToProduct(productId: string, images: Array<{ url: string; fileSize?: number }>): Promise<ProductImage[]> {
  try {
    const product = await getProduct(productId);
    if (!product) return [];

    const now = Date.now();
    const isFirstBatch = product.images.length === 0;
    const addedImages: ProductImage[] = [];

    images.forEach((img, i) => {
      if (product.images.length >= MAX_IMAGES_PER_PRODUCT) return;

      const newImage: ProductImage = {
        id: `img-${now}-${Math.random().toString(36).substr(2, 9)}-${i}`,
        key: extractKeyFromUrl(img.url),
        url: img.url,
        isPrimary: isFirstBatch && i === 0,
        description: '',
        fileSize: img.fileSize,
        createdAt: now,
      };

      product.images.push(newImage);
      addedImages.push(newImage);
    });

    if (addedImages.length > 0) {
      await apiRequest<{ data: Product }>(`/api/products/manage/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({
          images: product.images,
        }),
      });
      
      // 使缓存失效
      invalidateCache(CacheKeys.product(productId));
      invalidateCacheByPrefix('products:');
    }

    return addedImages;
  } catch (error) {
    console.error('Failed to add images to product:', error);
    return [];
  }
}

// 从产品中删除图片
export async function removeImageFromProduct(productId: string, imageId: string): Promise<boolean> {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const imageIndex = product.images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return false;

    const wasPrimary = product.images[imageIndex].isPrimary;
    product.images.splice(imageIndex, 1);

    // 如果删除的是主图，自动设置第一张图片为主图
    if (wasPrimary && product.images.length > 0) {
      product.images[0].isPrimary = true;
    }

    await apiRequest<{ data: Product }>(`/api/products/manage/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        images: product.images,
      }),
    });

    // 使缓存失效
    invalidateCache(CacheKeys.product(productId));
    invalidateCacheByPrefix('products:');

    return true;
  } catch (error) {
    console.error('Failed to remove image from product:', error);
    return false;
  }
}

// 设置主图
export async function setPrimaryImage(productId: string, imageId: string): Promise<boolean> {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const imageIndex = product.images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return false;

    // 取消所有图片的主图标记
    product.images.forEach(img => img.isPrimary = false);
    // 设置新的主图
    product.images[imageIndex].isPrimary = true;

    await apiRequest<{ data: Product }>(`/api/products/manage/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        images: product.images,
      }),
    });

    // 使缓存失效
    invalidateCache(CacheKeys.product(productId));
    invalidateCacheByPrefix('products:');

    return true;
  } catch (error) {
    console.error('Failed to set primary image:', error);
    return false;
  }
}

// 更新图片描述
export async function updateImageDescription(productId: string, imageId: string, description: string): Promise<boolean> {
  try {
    const product = await getProduct(productId);
    if (!product) return false;

    const imageIndex = product.images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return false;

    product.images[imageIndex].description = description;

    await apiRequest<{ data: Product }>(`/api/products/manage/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        images: product.images,
      }),
    });

    // 使缓存失效
    invalidateCache(CacheKeys.product(productId));
    invalidateCacheByPrefix('products:');

    return true;
  } catch (error) {
    console.error('Failed to update image description:', error);
    return false;
  }
}

// ========== 辅助函数 ==========

// 获取产品选择信息（用于传递给其他页面）
export async function getProductSelection(productId: string): Promise<ProductSelection | null> {
  const product = await getProduct(productId);
  if (!product) return null;

  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sellingPoints: product.sellingPoints,
    targetAudience: product.targetAudience,
    usageScenarios: product.usageScenarios,
    brandInfo: product.brandInfo,
    priceRange: product.priceRange,
    keywords: product.keywords,
    primaryImage: primaryImage?.url || '',
    allImages: product.images.map(img => ({ key: img.key, url: img.url })),
  };
}

// 生成产品描述文本（用于 AI 提示词）
export function generateProductDescriptionText(product: ProductSelection): string {
  const parts: string[] = [];

  parts.push(`产品名称：${product.name}`);

  if (product.description) {
    parts.push(`产品描述：${product.description}`);
  }

  if (product.sellingPoints.length > 0) {
    parts.push(`核心卖点：${product.sellingPoints.join('、')}`);
  }

  if (product.targetAudience) {
    parts.push(`目标受众：${product.targetAudience}`);
  }

  if (product.usageScenarios) {
    parts.push(`使用场景：${product.usageScenarios}`);
  }

  if (product.brandInfo) {
    parts.push(`品牌信息：${product.brandInfo}`);
  }

  if (product.priceRange) {
    parts.push(`价格区间：${product.priceRange}`);
  }

  if (product.keywords.length > 0) {
    parts.push(`关键词：${product.keywords.join('、')}`);
  }

  return parts.join('\n');
}

// 清空所有产品
export async function clearAllProducts(): Promise<boolean> {
  try {
    const products = await getProducts();
    const productsArray = Array.isArray(products) ? products : products.data;
    await Promise.all(productsArray.map(p => deleteProduct(p.id)));
    return true;
  } catch (error) {
    console.error('Failed to clear all products:', error);
    return false;
  }
}

// 获取产品统计信息
export async function getProductsStats(forceRefresh = false): Promise<{
  totalProducts: number;
  totalImages: number;
  productsWithImages: number;
}> {
  const products = await getProducts(forceRefresh);
  const productsArray = Array.isArray(products) ? products : products.data;
  let totalImages = 0;
  let productsWithImages = 0;

  productsArray.forEach(p => {
    totalImages += p.images.length;
    if (p.images.length > 0) productsWithImages++;
  });

  return {
    totalProducts: productsArray.length,
    totalImages,
    productsWithImages,
  };
}

// 搜索产品（客户端过滤）
export async function searchProducts(query: string): Promise<Product[]> {
  const products = await getProducts();
  const productsArray = Array.isArray(products) ? products : products.data;
  const lowerQuery = query.toLowerCase();
  
  return productsArray.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
    p.sellingPoints.some(s => s.toLowerCase().includes(lowerQuery))
  );
}
