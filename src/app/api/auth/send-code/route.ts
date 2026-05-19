import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db-pool';

// 生成 6 位验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 生成唯一 ID
function generateId(): string {
  return `vc_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

// 发送验证码 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号码' },
        { status: 400 }
      );
    }

    // 检查是否已有未过期的验证码（60秒内）
    const existingResult = await pool.query(
      `SELECT code, expires_at FROM verification_codes 
       WHERE phone = $1 AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      const remainingSeconds = Math.ceil(
        (new Date(existing.expires_at).getTime() - Date.now()) / 1000
      );
      
      // 如果验证码还在有效期内（5分钟），返回剩余时间
      if (remainingSeconds > 240) { // 还剩4分钟以上，说明刚发送不久
        // 开发环境：返回验证码
        if (process.env.NODE_ENV === 'development' || process.env.COZE_PROJECT_ENV === 'DEV') {
          return NextResponse.json({
            success: true,
            message: '验证码已发送',
            _debugCode: existing.code,
          });
        }
        return NextResponse.json(
          { success: false, error: `验证码已发送，请 ${remainingSeconds} 秒后重试` },
          { status: 429 }
        );
      }
    }

    // 生成验证码
    const code = generateCode();
    const id = generateId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟后过期

    // 删除该手机的旧验证码
    await pool.query('DELETE FROM verification_codes WHERE phone = $1', [phone]);

    // 存储验证码到数据库
    await pool.query(
      `INSERT INTO verification_codes (id, phone, code, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, phone, code, expiresAt]
    );

    // 生产环境：发送短信
    // 这里应该调用短信服务商 API 发送验证码
    // 示例：await sendSMS(phone, `您的验证码是 ${code}，5 分钟内有效`);

    // 开发环境：模拟发送，并返回验证码
    if (process.env.NODE_ENV === 'development' || process.env.COZE_PROJECT_ENV === 'DEV') {
      console.log(`[DEV] 验证码已生成: ${phone} -> ${code}`);
      return NextResponse.json({
        success: true,
        message: '验证码已发送（开发模式）',
        _debugCode: code,
      });
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return NextResponse.json(
      { success: false, error: '发送验证码失败' },
      { status: 500 }
    );
  }
}
