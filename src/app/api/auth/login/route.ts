import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/db-pool';
import {
  isAccountLocked,
  recordLoginFail,
  clearLoginFailRecord,
  getRemainingAttempts,
  getLockMessage,
} from '@/lib/login-security';
import { logAuthError, logInfo } from '@/lib/logger';
import { JWT_SECRET } from '@/lib/auth';

// 登录 API
export async function POST(request: NextRequest) {
  try {
    if (!JWT_SECRET) {
      return NextResponse.json(
        { success: false, error: '服务端认证密钥未配置，请联系管理员' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { phone, password } = body;

    // 参数验证
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号码' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: '请输入密码' },
        { status: 400 }
      );
    }

    // 检查账号是否被锁定
    const lockStatus = isAccountLocked(phone);
    if (lockStatus.locked) {
      const lockMessage = getLockMessage(phone);
      // 记录账号被锁定
      logAuthError('登录', new Error('账号已被锁定'), { phone, remainingTime: lockStatus.remainingTime });
      return NextResponse.json(
        { success: false, error: lockMessage || '账号已被锁定', remainingTime: lockStatus.remainingTime },
        { status: 429 } // Too Many Requests
      );
    }

    // 查询用户
    const result = await pool.query(
      `SELECT u.id, u.phone, u.password_hash, u.nickname, u.avatar_url, u.role, u.status, u.created_at, u.last_login_at,
              u.force_change_password, uc.balance, uc.total_purchased, uc.total_used
       FROM users u
       LEFT JOIN user_credits uc ON u.id = uc.user_id
       WHERE u.phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      // 记录登录失败
      const failResult = recordLoginFail(phone);
      const remainingAttempts = getRemainingAttempts(phone);
      
      // 记录用户不存在
      logAuthError('登录', new Error('用户不存在'), { phone, remainingAttempts });
      
      return NextResponse.json(
        { 
          success: false, 
          error: '手机号或密码错误',
          remainingAttempts,
          hint: remainingAttempts > 0 ? `还剩 ${remainingAttempts} 次尝试机会` : undefined,
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // 检查用户状态
    if (user.status !== 'active') {
      // 记录账号被禁用
      logAuthError('登录', new Error('账户已被禁用'), { phone, userId: user.id, status: user.status });
      return NextResponse.json(
        { success: false, error: '账户已被禁用，请联系客服' },
        { status: 403 }
      );
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // 记录登录失败
      const failResult = recordLoginFail(phone);
      const remainingAttempts = getRemainingAttempts(phone);
      
      // 记录密码错误
      logAuthError('登录', new Error('密码错误'), {
        phone,
        userId: user.id,
        remainingAttempts,
        locked: failResult.locked,
      });
      
      // 如果达到最大失败次数，返回锁定信息
      if (failResult.locked) {
        return NextResponse.json(
          { 
            success: false, 
            error: `密码错误次数过多，账号已被锁定 15 分钟`,
            locked: true,
            remainingTime: failResult.remainingTime,
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: '手机号或密码错误',
          remainingAttempts,
          hint: remainingAttempts > 0 ? `还剩 ${remainingAttempts} 次尝试机会` : undefined,
        },
        { status: 401 }
      );
    }

    // 登录成功，清除失败记录
    clearLoginFailRecord(phone);

    // 生成 JWT Token（包含用户状态）
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 更新最后登录时间
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // 记录登录成功
    logInfo('auth', '用户登录成功', { phone, userId: user.id }, user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          role: user.role,
          status: user.status,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
          forceChangePassword: user.force_change_password || false,
          credits: {
            balance: user.balance || 0,
            totalPurchased: user.total_purchased || 0,
            totalUsed: user.total_used || 0,
          },
        },
        token,
      },
    });
  } catch (error) {
    logAuthError('登录', error);
    console.error('登录失败:', error);
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    );
  }
}
