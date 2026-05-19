import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db-pool';

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}_${randomBytes(4).toString('hex')}`;
}

// 验证密码格式：至少8位，只允许数字、字母、符号
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: '密码至少 8 位' };
  }
  
  // 只允许：数字、大小写字母、常见符号
  // 允许的符号：!@#$%^&*()_+-=[]{}|;':",./<>?`~
  const validPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]+$/;
  
  if (!validPattern.test(password)) {
    return { valid: false, error: '密码只能包含数字、字母和符号' };
  }
  
  return { valid: true };
}

// 注册 API
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const body = await request.json();
    const { phone, password } = body;

    // 参数验证 - 手机号
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号码' },
        { status: 400 }
      );
    }

    // 参数验证 - 密码
    if (!password) {
      return NextResponse.json(
        { success: false, error: '请输入密码' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error },
        { status: 400 }
      );
    }

    // 检查手机号是否已注册
    const existingUser = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: '该手机号已注册，请直接登录' },
        { status: 400 }
      );
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 生成用户 ID
    const userId = `user_${generateId()}`;

    // 开始事务
    await client.query('BEGIN');

    try {
      // 创建用户
      const userResult = await client.query(
        `INSERT INTO users (id, phone, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'user', 'active', NOW(), NOW())
         RETURNING id, phone, nickname, avatar_url, role, status, created_at`,
        [userId, phone, passwordHash]
      );

      const user = userResult.rows[0];

      // 获取新用户赠送积分配置
      const creditConfigResult = await client.query(
        `SELECT value FROM system_settings WHERE key = 'new_user_bonus_credits'`
      );
      const new_user_credits = parseInt(creditConfigResult.rows[0]?.value || '50', 10);

      // 创建用户积分账户
      await client.query(
        `INSERT INTO user_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
         VALUES ($1, $2, $3, $3, 0, NOW(), NOW())`,
        [`credits_${generateId()}`, user.id, new_user_credits]
      );

      // 记录赠送积分
      if (new_user_credits > 0) {
        await client.query(
          `INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
           VALUES ($1, $2, $3, 'bonus', '新用户注册赠送', NOW())`,
          [`txn_${generateId()}`, user.id, new_user_credits]
        );
      }

      // 提交事务
      await client.query('COMMIT');

      // 生成 JWT Token
      const token = jwt.sign(
        { userId: user.id, phone: user.phone, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 获取用户完整信息
      const fullUserResult = await client.query(
        `SELECT u.id, u.phone, u.nickname, u.avatar_url, u.role, u.status, u.created_at, u.last_login_at,
                uc.balance, uc.total_purchased, uc.total_used
         FROM users u
         LEFT JOIN user_credits uc ON u.id = uc.user_id
         WHERE u.id = $1`,
        [user.id]
      );

      const fullUser = fullUserResult.rows[0];

      // 更新最后登录时间
      await client.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      console.log(`[Auth] 用户注册成功: ${phone}`);

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: fullUser.id,
            phone: fullUser.phone,
            nickname: fullUser.nickname,
            avatarUrl: fullUser.avatar_url,
            role: fullUser.role,
            status: fullUser.status,
            createdAt: fullUser.created_at,
            lastLoginAt: fullUser.last_login_at,
            credits: {
              balance: fullUser.balance || 0,
              totalPurchased: fullUser.total_purchased || 0,
              totalUsed: fullUser.total_used || 0,
            },
          },
          token,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { success: false, error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
