import { NextRequest } from 'next/server';
import { pool } from '@/lib/db-pool';
import type { AdminActionType, AdminActionName, AdminLogDetail } from './admin-log-utils';

// 重新导出类型供服务端使用
export type { AdminActionType, AdminActionName, AdminLogDetail } from './admin-log-utils';

// 日志记录参数
export interface AdminLogParams {
  adminId: string;
  actionType: AdminActionType;
  actionName: AdminActionName;
  targetId?: string;
  targetInfo?: string;
  detail?: AdminLogDetail;
  request?: NextRequest;
}

/**
 * 记录管理员操作日志
 * 仅在服务端调用
 */
export async function logAdminAction(params: AdminLogParams): Promise<void> {
  const { adminId, actionType, actionName, targetId, targetInfo, detail, request } = params;

  try {
    // 获取请求信息
    const ipAddress = request?.headers?.get('x-forwarded-for') || 
                      request?.headers?.get('x-real-ip') || 
                      'unknown';
    const userAgent = request?.headers?.get('user-agent') || 'unknown';

    await pool.query(
      `INSERT INTO admin_logs (admin_id, action_type, action_name, target_id, target_info, detail, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminId,
        actionType,
        actionName,
        targetId || null,
        targetInfo || null,
        JSON.stringify(detail || {}),
        ipAddress,
        userAgent.substring(0, 500), // 限制长度
      ]
    );

    console.log(`[AdminLog] ${adminId} performed ${actionType}.${actionName} on ${targetId || 'system'}`);
  } catch (error) {
    // 日志记录失败不应影响主流程
    console.error('记录管理员操作日志失败:', error);
  }
}
