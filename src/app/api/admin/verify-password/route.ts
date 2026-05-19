/**
 * 管理员密码验证 API
 * 用于敏感操作的二次确认
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { requireAdmin } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

/**
 * POST /api/admin/verify-password
 * 验证管理员密码（用于敏感操作的二次确认）
 */
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authResult = await requireAdmin(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: '请输入密码' },
        { status: 400 }
      );
    }

    // 获取管理员密码
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [authResult.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '密码错误' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '密码验证成功',
    });
  } catch (error) {
    console.error('[Admin] 密码验证失败:', error);
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    );
  }
}
