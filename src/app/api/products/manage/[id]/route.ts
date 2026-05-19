import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import fs from 'fs';
import { s3Storage } from '@/lib/s3-client';
import { logStorageError, errorResponse } from '@/lib/logger';

function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

async function deleteS3File(key: string, userId?: string): Promise<boolean> {
  if (!key) return false;

  try {
    const success = await s3Storage.deleteFile(key);
    if (success) {
      console.log(`[Products API] 成功删除 S3 文件: ${key}`);
    } else {
      console.error(`[Products API] 删除 S3 文件失败: ${key}`);
      logStorageError('删除产品图片', new Error('deleteFile returned false'), {
        key,
      }, userId);
    }
    return success;
  } catch (error) {
    console.error(`[Products API] 删除 S3 文件失败: ${key}`, error);
    logStorageError('删除产品图片', error, {
      key,
    }, userId);
    return false;
  }
}

// 批量删除 S3 文件
async function deleteS3Files(urls: Array<string | { url?: string; key?: string }>, userId?: string): Promise<void> {
  for (const item of urls) {
    const key = typeof item === 'string'
      ? extractKeyFromUrl(item)
      : (item.key || extractKeyFromUrl(item.url || ''));
    if (key) {
      await deleteS3File(key, userId);
    }
  }
}

const TEMPLATE_LIBRARY_LOCAL_PATH = '/tmp/template-library.json';

// 模板接口
interface Template {
  id: string;
  productId?: string;
  productName?: string;
  productInfo?: string;
  productImages?: string[];
  sellingPoints?: string;
  updatedAt: number;
  [key: string]: unknown;
}

// 读取本地模板库
function readLocalTemplates(): Template[] {
  try {
    if (fs.existsSync(TEMPLATE_LIBRARY_LOCAL_PATH)) {
      const content = fs.readFileSync(TEMPLATE_LIBRARY_LOCAL_PATH, 'utf-8');
      const data = JSON.parse(content);
      return data.templates || [];
    }
  } catch (error) {
    console.error('[Products API] Failed to read local templates:', error);
  }
  return [];
}

// 写入本地模板库
function writeLocalTemplates(templates: Template[]): void {
  try {
    const content = JSON.stringify({ templates, updatedAt: Date.now() });
    fs.writeFileSync(TEMPLATE_LIBRARY_LOCAL_PATH, content, 'utf-8');
    console.log('[Products API] Updated local templates file');
  } catch (error) {
    console.error('[Products API] Failed to write local templates:', error);
  }
}

// 更新关联产品的模板
function updateTemplatesForProduct(
  productId: string,
  productData: {
    name: string;
    description: string;
    sellingPoints?: string[];
    images?: { url: string }[];
  }
): number {
  const templates = readLocalTemplates();
  let updatedCount = 0;
  
  const productImages = productData.images?.map(img => img.url) || [];
  const productInfo = [
    productData.description,
    productData.sellingPoints && productData.sellingPoints.length > 0 
      ? `卖点：${productData.sellingPoints.join('、')}` 
      : '',
  ].filter(Boolean).join('\n');
  
  for (let i = 0; i < templates.length; i++) {
    if (templates[i].productId === productId) {
      templates[i] = {
        ...templates[i],
        productName: productData.name,
        productInfo: productInfo,
        productImages: productImages,
        sellingPoints: productData.sellingPoints?.join('、') || '',
        updatedAt: Date.now(),
      };
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    writeLocalTemplates(templates);
    console.log(`[Products API] Updated ${updatedCount} templates for product: ${productId}`);
  }
  
  return updatedCount;
}

// 获取单个产品（用户数据隔离）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { id } = await params;
    
    const client = getSupabaseClient();
    
    // 只能查看自己的产品
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (error) {
      console.error('[Products API] 查询失败:', error);
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }
    
    // 转换字段名
    const result = {
      id: data.id,
      name: data.name,
      description: data.description,
      sellingPoints: data.selling_points || [],
      targetAudience: data.target_audience,
      usageScenarios: data.usage_scenarios,
      brandInfo: data.brand_info,
      priceRange: data.price_range,
      keywords: data.keywords || [],
      images: data.images || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Products API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取产品失败' },
      { status: 500 }
    );
  }
}

// 更新产品（只能更新自己的）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { id } = await params;
    const body = await request.json();
    
    const client = getSupabaseClient();
    
    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sellingPoints !== undefined) updateData.selling_points = body.sellingPoints;
    if (body.targetAudience !== undefined) updateData.target_audience = body.targetAudience;
    if (body.usageScenarios !== undefined) updateData.usage_scenarios = body.usageScenarios;
    if (body.brandInfo !== undefined) updateData.brand_info = body.brandInfo;
    if (body.priceRange !== undefined) updateData.price_range = body.priceRange;
    if (body.keywords !== undefined) updateData.keywords = body.keywords;
    if (body.images !== undefined) updateData.images = body.images;
    
    updateData.updated_at = new Date().toISOString();
    
    // 只能更新自己的产品
    const { data, error } = await client
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single();
    
    if (error) {
      console.error('[Products API] 更新失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: '产品不存在或无权限' }, { status: 404 });
    }
    
    // 构建返回数据
    const result = {
      id: data.id,
      name: data.name,
      description: data.description,
      sellingPoints: data.selling_points,
      targetAudience: data.target_audience,
      usageScenarios: data.usage_scenarios,
      brandInfo: data.brand_info,
      priceRange: data.price_range,
      keywords: data.keywords,
      images: data.images,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    // 异步更新关联的模板（不阻塞响应）
    updateTemplatesForProduct(id, {
      name: data.name,
      description: data.description,
      sellingPoints: data.selling_points,
      images: data.images,
    });
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[Products API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新产品失败' },
      { status: 500 }
    );
  }
}

// 删除产品（只能删除自己的，同时删除 S3 文件）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { id } = await params;
    
    const client = getSupabaseClient();
    
    // 先获取产品信息，删除 S3 文件，再删除数据库记录
    const { data: product } = await client
      .from('products')
      .select('images')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (product && product.images) {
      // 删除产品图片
      const images = product.images as Array<{ key?: string; url?: string }>;
      await deleteS3Files(images);
    }
    
    // 删除数据库记录
    const { error } = await client
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);
    
    if (error) {
      console.error('[Products API] 删除失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Products API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除产品失败' },
      { status: 500 }
    );
  }
}
