import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth-middleware';
import { checkStorageQuota } from '@/lib/storage-quota';
import { filterSensitiveParams, filterTasksForUser, isAdmin } from '@/lib/task-security';
import { pool } from '@/lib/db-pool';
import { ANALYSIS_MASTER_TASK_TYPES } from '@/lib/task-types';

// 任务列表返回类型（包含用户信息）
type TaskWithUser = {
  id: string;
  user_id: string;
  type: string;
  status: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  results: Record<string, unknown>[] | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retry: number;
  project_id: string | null;
  heartbeat_at: string | null;
  last_error: string | null;
  // 关联的用户信息
  user_phone?: string;
  user_nickname?: string;
};

// 获取任务列表（用户数据隔离，管理员可查看所有）
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const userId = searchParams.get('userId'); // 管理员筛选特定用户
    const limit = parseInt(searchParams.get('limit') || '100');
    const excludeAnalysisMaster = searchParams.get('excludeAnalysisMaster') === 'true';
    
    const isUserAdmin = isAdmin(auth.payload.role);
    
    // 使用 PostgreSQL 直接查询，支持 JOIN
    let sqlQuery = `
      SELECT 
        t.*,
        u.phone as user_phone,
        u.nickname as user_nickname
      FROM task_queue t
      LEFT JOIN users u ON t.user_id = u.id
    `;
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;
    
    // 非管理员只能查看自己的任务
    if (!isUserAdmin) {
      conditions.push(`t.user_id = $${paramIndex}`);
      params.push(auth.userId);
      paramIndex++;
    } else {
      // 管理员可以筛选特定用户
      if (userId) {
        conditions.push(`t.user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
      }
    }
    
    if (status) {
      conditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (type) {
      conditions.push(`t.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (excludeAnalysisMaster) {
      const placeholders = ANALYSIS_MASTER_TASK_TYPES.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`t.type NOT IN (${placeholders})`);
      params.push(...ANALYSIS_MASTER_TASK_TYPES);
    }
    
    if (conditions.length > 0) {
      sqlQuery += ` WHERE ` + conditions.join(' AND ');
    }
    
    sqlQuery += ` ORDER BY 
      COALESCE(t.started_at, t.completed_at, t.created_at) DESC 
      LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await pool.query(sqlQuery, params);
    const data: TaskWithUser[] = result.rows;
    
    // 按最新活动时间排序（不区分状态优先级）
    const sortedData = data.sort((a, b) => {
      const getActivityTime = (task: typeof a): number => {
        if (task.started_at) {
          return new Date(task.started_at).getTime();
        }
        if (task.completed_at) {
          return new Date(task.completed_at).getTime();
        }
        return new Date(task.created_at).getTime();
      };
      
      return getActivityTime(b) - getActivityTime(a);
    });
    
    // 根据用户角色过滤敏感信息
    const filteredData = filterTasksForUser(sortedData, auth.payload.role);
    
    // 返回数据，包含是否为管理员的标识
    return NextResponse.json({ 
      data: filteredData,
      isAdmin: isUserAdmin,
    });
  } catch (error) {
    console.error('[Tasks API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取任务列表失败' },
      { status: 500 }
    );
  }
}

// 创建任务后自动触发服务端执行
async function triggerBackgroundProcessing(taskId: string, authHeader: string | null): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  
  // 异步触发，不等待完成
  fetch(`${baseUrl}/api/tasks/process`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ taskId }),
  }).catch(err => {
    console.error('[Tasks API] 触发后台处理失败:', err);
  });
}

// 创建任务（关联用户）
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return unauthorizedResponse(auth.error, auth.status);
    }
    
    const body = await request.json();
    const { id, type, params, projectId, maxRetry = 5 } = body;
    
    if (!id || !type || !params) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    if (!['image', 'video', 'script', 'analysis'].includes(type)) {
      return NextResponse.json({ error: '无效的任务类型，支持: image, video, script, analysis' }, { status: 400 });
    }
    
    // 检查存储空间是否足够（图片和视频任务需要检查）
    if (type === 'image' || type === 'video') {
      const storageCheck = await checkStorageQuota(auth.userId);
      if (!storageCheck.allowed) {
        return NextResponse.json(
          { error: storageCheck.error },
          { status: 507 } // 507 Insufficient Storage
        );
      }
    }
    
    // 过滤敏感字段：不存储 apiKey，但保留 model 和 baseUrl 用于执行时识别配置
    const safeParams = { ...params };
    delete safeParams.apiKey;
    
    const client = getSupabaseClient();
    
    // 插入时关联用户
    const { data, error } = await client
      .from('task_queue')
      .insert({
        id,
        user_id: auth.userId,
        type,
        status: 'pending',
        params: safeParams,
        project_id: projectId || null,
        retry_count: 0,
        max_retry: maxRetry,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Tasks API] 创建失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 异步触发服务端任务执行（不阻塞响应）
    triggerBackgroundProcessing(id, request.headers.get('authorization'));
    
    // 返回时也要过滤敏感信息
    const filteredData = {
      ...data,
      params: filterSensitiveParams(data.params, isAdmin(auth.success ? auth.payload.role : undefined)),
    };
    
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    console.error('[Tasks API] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建任务失败' },
      { status: 500 }
    );
  }
}
