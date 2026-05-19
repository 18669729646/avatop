import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { checkStorageQuota } from '@/lib/storage-quota';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Storage } from '@/lib/s3-client';
import { pool } from '@/lib/db-pool';
import { logStorageError, errorResponse } from '@/lib/logger';

// 从 URL 中提取存储 key
function extractKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

// 删除 S3 文件
async function deleteS3File(key: string, userId?: string): Promise<boolean> {
  if (!key) return false;

  try {
    await s3Storage.deleteFile(key);
    console.log(`[Characters] 成功删除 S3 文件: ${key}`);
    return true;
  } catch (error) {
    console.error(`[Characters] 删除 S3 文件失败: ${key}`, error);
    logStorageError('删除角色图片', error, {
      key,
    }, userId);
    return false;
  }
}

// 生成唯一 trace ID
function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// 生成唯一ID
function generateId(prefix: string = 'char'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 获取角色库列表（用户数据隔离，管理员可查看所有）
export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  console.log(`[TRACE-Characters-API-${traceId}] GET: 获取角色列表`);
  
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 1: 用户身份验证成功`);
    
    // 判断用户是否为管理员
    const isUserAdmin = auth.payload.role === 'admin';
    
    // 获取分页参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // 使用 PostgreSQL 直接查询，支持 JOIN 获取用户信息
    let sqlQuery = `
      SELECT 
        c.*,
        u.phone as user_phone,
        u.nickname as user_nickname
      FROM character_library c
      LEFT JOIN users u ON c.user_id = u.id
    `;
    
    // 构建总数查询
    let countQuery = `
      SELECT COUNT(*) as total
      FROM character_library c
    `;
    
    const params: (string | number)[] = [];
    let paramIndex = 1;
    
    // 普通用户只能查看自己的角色
    if (!isUserAdmin) {
      sqlQuery += ` WHERE c.user_id = $${paramIndex}`;
      countQuery += ` WHERE c.user_id = $${paramIndex}`;
      params.push(auth.userId);
      paramIndex++;
    }
    
    // 先查询总数
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / pageSize);
    
    // 添加排序和分页
    sqlQuery += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);
    
    const queryResult = await pool.query(sqlQuery, params);
    const data = queryResult.rows;
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 2: 查询成功`, {
      count: data?.length || 0,
      isAdmin: isUserAdmin,
      page,
      pageSize,
      total,
      totalPages,
    });
    
    // 转换字段名
    const result = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      url: item.url,
      description: item.description,
      tags: item.tags || [],
      createdAt: item.created_at,
      // 用户信息（管理员视图时显示）
      userId: item.user_id,
      userPhone: item.user_phone,
      userNickname: item.user_nickname,
    }));
    
    return NextResponse.json({ 
      data: result,
      isAdmin: isUserAdmin,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error(`[TRACE-Characters-API-${traceId}] ERROR: 获取角色库失败`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: '获取角色库失败', traceId }, { status: 500 });
  }
}

// 添加角色到库（支持单个和批量，关联用户）
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  console.log(`[TRACE-Characters-API-${traceId}] POST: 添加角色`);
  
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    // 检查存储空间是否足够
    const s3StorageCheck = await checkStorageQuota(auth.userId);
    if (!s3StorageCheck.allowed) {
      return NextResponse.json(
        { error: s3StorageCheck.error, traceId },
        { status: 507 } // 507 Insufficient Storage
      );
    }
    
    const body = await request.json();
    console.log(`[TRACE-Characters-API-${traceId}] Step 1: 解析请求体`, {
      hasCharacters: !!body.characters,
      isBatch: !!(body.characters && Array.isArray(body.characters)),
      hasSingleChar: !!(body.name && body.url),
    });
    
    // 支持批量添加：{ characters: [...] }
    if (body.characters && Array.isArray(body.characters)) {
      return await batchAddCharacters(body.characters, auth.userId, traceId);
    }
    
    // 单个添加
    const { name, url, description, tags } = body;
    
    if (!name || !url) {
      console.error(`[TRACE-Characters-API-${traceId}] Step 2-ERROR: 缺少必要参数`, {
        hasName: !!name,
        hasUrl: !!url,
      });
      return NextResponse.json({ error: '名称和URL不能为空', traceId }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    const id = generateId('char');
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 3: 准备插入单条记录`, {
      id,
      name,
      urlLength: url.length,
    });
    
    // 插入时关联用户
    const { data, error } = await client
      .from('character_library')
      .insert({
        id,
        user_id: auth.userId,
        name,
        url,
        description: description || '',
        tags: tags || [],
      })
      .select()
      .single();
    
    if (error) {
      console.error(`[TRACE-Characters-API-${traceId}] Step 4-ERROR: 插入失败`, {
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
      });
      return NextResponse.json({ error: error.message, traceId }, { status: 500 });
    }
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 4: 插入成功`, { id: data.id });
    
    return NextResponse.json({
      data: {
        id: data.id,
        name: data.name,
        url: data.url,
        description: data.description,
        tags: data.tags || [],
        createdAt: data.created_at,
      }
    });
  } catch (error) {
    console.error(`[TRACE-Characters-API-${traceId}] ERROR: 添加角色失败`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: '添加角色失败', traceId }, { status: 500 });
  }
}

// 批量添加角色（关联用户）
async function batchAddCharacters(
  characters: Array<{ name: string; url: string; description?: string; tags?: string[] }>,
  userId: string,
  traceId: string
): Promise<NextResponse> {
  console.log(`[TRACE-Characters-API-${traceId}] Step 3: 批量添加角色`, {
    count: characters.length,
    names: characters.map(c => c.name),
  });
  
  if (!characters || characters.length === 0) {
    console.error(`[TRACE-Characters-API-${traceId}] Step 3-ERROR: 角色列表为空`);
    return NextResponse.json({ error: '角色列表不能为空', traceId }, { status: 400 });
  }
  
  const client = getSupabaseClient();
  
  // 准备批量插入的数据（关联用户）
  const insertData = characters.map(char => ({
    id: generateId('char'),
    user_id: userId,
    name: char.name,
    url: char.url,
    description: char.description || '',
    tags: char.tags || [],
  }));
  
  console.log(`[TRACE-Characters-API-${traceId}] Step 4: 准备批量插入`, {
    count: insertData.length,
    ids: insertData.map(d => d.id),
  });
  
  const { data, error } = await client
    .from('character_library')
    .insert(insertData)
    .select();
  
  if (error) {
    console.error(`[TRACE-Characters-API-${traceId}] Step 5-ERROR: 批量插入失败`, {
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
    });
    return NextResponse.json({ error: error.message, traceId }, { status: 500 });
  }
  
  console.log(`[TRACE-Characters-API-${traceId}] Step 5: 批量插入成功`, {
    count: data?.length || 0,
  });
  
  return NextResponse.json({
    data: (data || []).map(item => ({
      id: item.id,
      name: item.name,
      url: item.url,
      description: item.description,
      tags: item.tags || [],
      createdAt: item.created_at,
    })),
    count: data?.length || 0,
    traceId,
  });
}

// 删除角色（只能删除自己的，同时删除 S3 文件）
export async function DELETE(request: NextRequest) {
  const traceId = generateTraceId();
  console.log(`[TRACE-Characters-API-${traceId}] DELETE: 删除角色`);
  
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 1: 解析参数`, { id });
    
    if (!id) {
      console.error(`[TRACE-Characters-API-${traceId}] Step 1-ERROR: ID为空`);
      return NextResponse.json({ error: 'ID不能为空', traceId }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 先获取记录，删除 S3 文件，再删除数据库记录
    const { data: record } = await client
      .from('character_library')
      .select('url, key')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single();
    
    if (record) {
      // 删除 S3 文件
      const key = record.key || extractKeyFromUrl(record.url);
      if (key) {
        await deleteS3File(key);
      }
    }
    
    // 删除数据库记录
    const { error } = await client
      .from('character_library')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);
    
    if (error) {
      console.error(`[TRACE-Characters-API-${traceId}] Step 2-ERROR: 删除失败`, {
        errorCode: error.code,
        errorMessage: error.message,
      });
      return NextResponse.json({ error: error.message, traceId }, { status: 500 });
    }
    
    console.log(`[TRACE-Characters-API-${traceId}] Step 2: 删除成功`, { id });
    
    return NextResponse.json({ success: true, traceId });
  } catch (error) {
    console.error(`[TRACE-Characters-API-${traceId}] ERROR: 删除角色失败`, {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: '删除角色失败', traceId }, { status: 500 });
  }
}
