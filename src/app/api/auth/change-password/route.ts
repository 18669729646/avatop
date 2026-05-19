import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { verifyAuth } from '@/lib/auth-middleware';
import { pool } from '@/lib/db-pool';

// 修改密码 API
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.payload.userId;

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    // 参数验证
    if (!oldPassword) {
      return NextResponse.json(
        { success: false, error: '请输入当前密码' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: '新密码至少 8 位' },
        { status: 400 }
      );
    }

    // 验证新密码格式（只能包含数字、字母和符号）
    const validPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]+$/;
    if (!validPattern.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: '新密码只能包含数字、字母和符号' },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: '新密码不能与当前密码相同' },
        { status: 400 }
      );
    }

    // 查询用户当前密码
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 验证当前密码
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 400 }
      );
    }

    // 生成新密码哈希
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码并清除强制修改标志
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           force_change_password = false, 
           password_changed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, userId]
    );

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      { success: false, error: '修改密码失败，请稍后重试' },
      { status: 500 }
    );
  }
}
