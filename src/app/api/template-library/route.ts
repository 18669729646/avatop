import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';

// 模板数据结构
interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number;
  hookType: string;
  hookTypeName?: string;
  targetAudience: string;
  useCreator: boolean;
  creatorGender?: 'female' | 'male' | 'any';
  enableNarration?: boolean;
  segments: unknown[];
  templatePrompt?: unknown;
  productId?: string;
  productName?: string;
  productInfo?: string;
  sellingPoints?: string;
  productImages?: Array<{ key: string; url: string }>;
  finalPrompt?: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

// 将数据库记录转换为前端模板格式
function dbToTemplate(record: Record<string, unknown>): Template {
  return {
    id: record.id as string,
    name: record.name as string,
    description: (record.description as string) || '',
    category: (record.category as string) || 'custom',
    duration: (record.duration as number) || 0,
    hookType: (record.hook_type as string) || '',
    hookTypeName: record.hook_type_name as string | undefined,
    targetAudience: (record.target_audience as string) || '',
    useCreator: (record.use_creator as boolean) ?? true,
    creatorGender: record.creator_gender as 'female' | 'male' | 'any' | undefined,
    enableNarration: (record.enable_narration as boolean) ?? false,
    segments: (record.segments as unknown[]) || [],
    templatePrompt: record.template_prompt as unknown,
    productId: record.product_id as string | undefined,
    productName: record.product_name as string | undefined,
    productInfo: record.product_info as string | undefined,
    sellingPoints: record.selling_points as string | undefined,
    productImages: normalizeProductImages(record.product_images),
    finalPrompt: record.final_prompt as string | undefined,
    createdAt: new Date(record.created_at as string).getTime(),
    updatedAt: new Date(record.updated_at as string).getTime(),
    usageCount: (record.usage_count as number) || 0,
  };
}

// 兼容旧数据：将纯 URL 字符串转换为 { key, url } 格式
function normalizeProductImages(images: unknown): Array<{ key: string; url: string }> {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map((img: unknown) => {
    if (typeof img === 'string') {
      // 旧格式：纯 URL 字符串
      // 尝试从 URL 中提取 key
      try {
        const url = new URL(img);
        const key = url.pathname.substring(1); // 移除开头的 /
        return { key, url: img };
      } catch {
        return { key: img, url: img };
      }
    }
    // 新格式：已经是 { key, url } 对象
    return img as { key: string; url: string };
  });
}

// 将前端模板格式转换为数据库记录
function templateToDb(template: Template): Record<string, unknown> {
  console.log('[TemplateLibrary API] templateToDb called');
  console.log('[TemplateLibrary API] template.hookType:', template.hookType);
  console.log('[TemplateLibrary API] template.hookTypeName:', template.hookTypeName);
  
  return {
    id: template.id || `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: template.name,
    description: template.description || null,
    category: template.category || 'custom',
    duration: template.duration || 0,
    hook_type: template.hookType || null,
    hook_type_name: template.hookTypeName || null,
    target_audience: template.targetAudience || null,
    use_creator: template.useCreator ?? true,
    creator_gender: template.creatorGender || null,
    enable_narration: template.enableNarration ?? false,
    segments: template.segments || [],
    template_prompt: template.templatePrompt || null,
    product_id: template.productId || null,
    product_name: template.productName || null,
    product_info: template.productInfo || null,
    selling_points: template.sellingPoints || null,
    product_images: template.productImages || [],
    final_prompt: template.finalPrompt || null,
    usage_count: template.usageCount || 0,
  };
}

// 获取模板库（用户数据隔离 + 系统模板）
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const client = getSupabaseClient();
    
    // 查询用户的模板 + 系统模板
    const { data, error } = await client
      .from('shortfilm_templates')
      .select('*')
      .or(`user_id.eq.${auth.userId},is_system.eq.true`)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('[TemplateLibrary] 数据库查询失败:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        templates: [] 
      }, { status: 500 });
    }
    
    const templates = (data || []).map(dbToTemplate);
    
    return NextResponse.json({ 
      success: true, 
      templates,
      source: 'database'
    });
  } catch (error) {
    console.error('[TemplateLibrary] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取模板库失败', templates: [] },
      { status: 500 }
    );
  }
}

// 保存模板库（批量保存，用户数据隔离）
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { templates } = await request.json();
    
    if (!Array.isArray(templates)) {
      return NextResponse.json(
        { success: false, error: '无效的模板数据' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 获取现有模板ID列表（仅限当前用户的）
    const { data: existingData } = await client
      .from('shortfilm_templates')
      .select('id')
      .eq('user_id', auth.userId);
    
    const existingIds = new Set((existingData || []).map(r => r.id));
    
    // 分离新增和更新
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
    
    for (const template of templates) {
      console.log('[TemplateLibrary API] Processing template:', template.id, 'hookType:', template.hookType, 'hookTypeName:', template.hookTypeName);
      
      const dbData = templateToDb(template);
      
      console.log('[TemplateLibrary API] After templateToDb, hook_type:', dbData.hook_type, 'hook_type_name:', dbData.hook_type_name);
      
      if (existingIds.has(template.id)) {
        toUpdate.push({ id: template.id, data: dbData });
      } else {
        // 新建模板时写入 user_id
        toInsert.push({
          ...dbData,
          user_id: auth.userId,
          is_system: false, // 用户创建的不是系统模板
        });
      }
    }
    
    // 批量插入新模板
    if (toInsert.length > 0) {
      const { error: insertError } = await client
        .from('shortfilm_templates')
        .insert(toInsert);
      
      if (insertError) {
        console.error('[TemplateLibrary] 批量插入失败:', insertError);
      }
    }
    
    // 逐个更新现有模板（只能更新自己的）
    for (const { id, data } of toUpdate) {
      const { error: updateError } = await client
        .from('shortfilm_templates')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', auth.userId); // 只能更新自己的模板
      
      if (updateError) {
        console.error('[TemplateLibrary] 更新模板失败:', id, updateError);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      count: templates.length 
    });
  } catch (error) {
    console.error('[TemplateLibrary] POST error:', error);
    return NextResponse.json(
      { success: false, error: '保存模板库失败' },
      { status: 500 }
    );
  }
}

// 删除模板（支持删除单个或全部）
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');
    
    const client = getSupabaseClient();
    
    // 删除用户所有模板（不包括系统模板）
    if (all === 'true' || !id) {
      const { error } = await client
        .from('shortfilm_templates')
        .delete()
        .eq('user_id', auth.userId)
        .eq('is_system', false); // 不删除系统模板
      
      if (error) {
        console.error('[TemplateLibrary] 批量删除失败:', error);
        return NextResponse.json({ 
          success: false, 
          error: error.message 
        }, { status: 500 });
      }
      
      return NextResponse.json({ success: true });
    }
    
    // 删除单个模板
    
    // 先检查模板是否存在以及权限
    const { data: template, error: fetchError } = await client
      .from('shortfilm_templates')
      .select('id, user_id, is_system')
      .eq('id', id)
      .single();
    
    if (fetchError || !template) {
      return NextResponse.json({ success: true }); // 模板不存在，视为删除成功
    }
    
    // 检查是否是系统模板
    if (template.is_system === true) {
      return NextResponse.json({ 
        success: false, 
        error: '系统模板无法删除' 
      }, { status: 403 });
    }
    
    // 检查是否是用户自己的模板
    if (template.user_id !== auth.userId) {
      return NextResponse.json({ 
        success: false, 
        error: '无权删除此模板' 
      }, { status: 403 });
    }
    
    // 执行删除
    const { error } = await client
      .from('shortfilm_templates')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[TemplateLibrary] 删除失败:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TemplateLibrary] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

// 更新单个模板（只能更新自己的模板）
export async function PUT(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }

    const template = await request.json();
    
    if (!template.id) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    const dbData = templateToDb(template);
    
    // 排除 id 字段，避免更新主键
    const { id, ...updateData } = dbData as { id: string; [key: string]: unknown };
    
    const { error } = await client
      .from('shortfilm_templates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id)
      .eq('user_id', auth.userId); // 只能更新自己的模板
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TemplateLibrary] PUT error:', error);
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    );
  }
}
