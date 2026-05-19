import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/lib/db-pool';

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 获取当前用户信息 API
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取 Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // 验证 Token
    let decoded: { userId: string; phone: string; role: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as typeof decoded;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token 无效或已过期' },
        { status: 401 }
      );
    }

    // 查询用户信息
    const result = await pool.query(
      `SELECT u.id, u.phone, u.nickname, u.avatar_url, u.role, u.status, u.created_at, u.last_login_at,
              uc.balance, uc.total_purchased, uc.total_used
       FROM users u
       LEFT JOIN user_credits uc ON u.id = uc.user_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '账户已被禁用' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        credits: {
          balance: user.balance || 0,
          totalPurchased: user.total_purchased || 0,
          totalUsed: user.total_used || 0,
        },
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
