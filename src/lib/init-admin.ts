/**
 * 初始化管理员账户
 * 
 * 在应用启动时检查并创建初始管理员账户
 * 通过环境变量配置：
 * - INITIAL_ADMIN_PHONE: 管理员手机号
 * - INITIAL_ADMIN_PASSWORD: 管理员密码
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db-pool';

let initialized = false;

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * 初始化管理员账户
 * 在应用启动时调用，确保存在至少一个管理员账户
 */
export async function initializeAdmin(): Promise<void> {
  // 避免重复初始化
  if (initialized) {
    return;
  }

  const adminPhone = process.env.INITIAL_ADMIN_PHONE;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  // 如果没有配置环境变量，跳过初始化
  if (!adminPhone || !adminPassword) {
    console.log('[InitAdmin] 未配置 INITIAL_ADMIN_PHONE 或 INITIAL_ADMIN_PASSWORD，跳过管理员初始化');
    initialized = true;
    return;
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(adminPhone)) {
    console.error('[InitAdmin] INITIAL_ADMIN_PHONE 格式不正确，应为11位手机号');
    initialized = true;
    return;
  }

  // 验证密码格式
  if (adminPassword.length < 8) {
    console.error('[InitAdmin] INITIAL_ADMIN_PASSWORD 至少需要8位');
    initialized = true;
    return;
  }

  const client = await pool.connect();

  try {
    // 检查是否已存在该手机号的用户
    const existingUser = await client.query(
      'SELECT id, role FROM users WHERE phone = $1',
      [adminPhone]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      
      // 如果用户已存在但不是管理员，升级为管理员
      if (user.role !== 'admin') {
        await client.query(
          'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
          ['admin', user.id]
        );
        console.log(`[InitAdmin] 用户 ${adminPhone} 已升级为管理员`);
      } else {
        console.log(`[InitAdmin] 管理员 ${adminPhone} 已存在`);
      }
      
      initialized = true;
      return;
    }

    // 创建新管理员账户
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userId = `admin_${generateId()}`;

    await client.query('BEGIN');

    try {
      // 创建用户
      await client.query(
        `INSERT INTO users (id, phone, password_hash, nickname, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, '管理员', 'admin', 'active', NOW(), NOW())`,
        [userId, adminPhone, passwordHash]
      );

      // 创建用户积分账户
      const new_user_credits = 0; // 管理员默认不需要积分
      await client.query(
        `INSERT INTO user_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
         VALUES ($1, $2, $3, $3, 0, NOW(), NOW())`,
        [`credits_${generateId()}`, userId, new_user_credits]
      );

      await client.query('COMMIT');
      console.log(`[InitAdmin] 管理员账户创建成功: ${adminPhone}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    initialized = true;
  } catch (error) {
    console.error('[InitAdmin] 初始化管理员失败:', error);
  } finally {
    client.release();
  }
}

/**
 * 检查是否需要初始化管理员
 * 返回配置状态信息
 */
export function getAdminInitStatus(): {
  configured: boolean;
  phone?: string;
  message: string;
} {
  const adminPhone = process.env.INITIAL_ADMIN_PHONE;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminPhone && !adminPassword) {
    return {
      configured: false,
      message: '未配置初始管理员环境变量',
    };
  }

  if (!adminPhone) {
    return {
      configured: false,
      message: '已配置 INITIAL_ADMIN_PASSWORD，但缺少 INITIAL_ADMIN_PHONE',
    };
  }

  if (!adminPassword) {
    return {
      configured: false,
      message: '已配置 INITIAL_ADMIN_PHONE，但缺少 INITIAL_ADMIN_PASSWORD',
    };
  }

  if (!/^1[3-9]\d{9}$/.test(adminPhone)) {
    return {
      configured: false,
      phone: adminPhone,
      message: 'INITIAL_ADMIN_PHONE 格式不正确，应为11位手机号',
    };
  }

  if (adminPassword.length < 8) {
    return {
      configured: false,
      phone: adminPhone,
      message: 'INITIAL_ADMIN_PASSWORD 至少需要8位',
    };
  }

  return {
    configured: true,
    phone: adminPhone,
    message: '初始管理员配置正确',
  };
}
