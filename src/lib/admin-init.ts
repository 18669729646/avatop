/**
 * 管理员初始化模块
 * 
 * 通过环境变量配置管理员账号：
 * - ADMIN_PHONE: 管理员手机号
 * - ADMIN_PASSWORD: 管理员密码
 * 
 * 功能：
 * 1. 应用启动时自动检查并创建/更新管理员
 * 2. 新创建的管理员首次登录需强制修改密码
 */

import bcrypt from 'bcrypt';
import { pool } from '@/lib/db-pool';

/**
 * 初始化管理员账号
 * 在应用启动时调用
 */
export async function initAdmin(): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 未配置环境变量则跳过
  if (!adminPhone || !adminPassword) {
    console.log('[Admin Init] 未配置 ADMIN_PHONE 和 ADMIN_PASSWORD，跳过管理员初始化');
    return;
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(adminPhone)) {
    console.error('[Admin Init] ADMIN_PHONE 格式不正确，应为 11 位手机号');
    return;
  }

  // 验证密码强度
  if (adminPassword.length < 6) {
    console.error('[Admin Init] ADMIN_PASSWORD 长度不能少于 6 位');
    return;
  }

  const client = await pool.connect();
  
  try {
    // 检查管理员是否已存在
    const existingResult = await client.query(
      'SELECT id, password_hash, force_change_password FROM users WHERE phone = $1 AND role = $2',
      [adminPhone, 'admin']
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    if (existingResult.rows.length === 0) {
      // 创建新管理员
      const adminId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      await client.query('BEGIN');
      
      try {
        // 创建用户
        await client.query(
          `INSERT INTO users (id, phone, password_hash, nickname, role, status, force_change_password, created_at, updated_at)
           VALUES ($1, $2, $3, '管理员', 'admin', 'active', true, NOW(), NOW())`,
          [adminId, adminPhone, passwordHash]
        );

        // 创建积分账户
        await client.query(
          `INSERT INTO user_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
           VALUES ($1, $2, 10000, 10000, 0, NOW(), NOW())`,
          [`credits_${adminId}`, adminId]
        );

        await client.query('COMMIT');
        console.log(`[Admin Init] 管理员账号已创建: ${adminPhone}`);
        console.log('[Admin Init] 该管理员首次登录需修改密码');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } else {
      // 管理员已存在，检查密码是否需要更新
      const existing = existingResult.rows[0];
      const passwordChanged = await bcrypt.compare(adminPassword, existing.password_hash);
      
      if (!passwordChanged) {
        // 环境变量密码已变更，更新密码并重置强制修改标志
        await client.query(
          'UPDATE users SET password_hash = $1, force_change_password = true, updated_at = NOW() WHERE id = $2',
          [passwordHash, existing.id]
        );
        console.log(`[Admin Init] 管理员密码已更新: ${adminPhone}`);
        console.log('[Admin Init] 该管理员需重新修改密码');
      } else {
        // 密码未变更，保持原状态
        console.log(`[Admin Init] 管理员账号已存在: ${adminPhone}`);
        if (existing.force_change_password) {
          console.log('[Admin Init] 该管理员尚未修改初始密码');
        }
      }
    }
  } catch (error) {
    console.error('[Admin Init] 初始化失败:', error);
  } finally {
    client.release();
  }
}

/**
 * 创建管理员账号（命令行工具使用）
 * @param phone 手机号
 * @param password 密码
 * @param force 是否强制覆盖已存在的管理员
 */
export async function createAdmin(
  phone: string,
  password: string,
  force: boolean = false
): Promise<{ success: boolean; message: string }> {
  // 验证手机号
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, message: '手机号格式不正确' };
  }

  // 验证密码
  if (password.length < 6) {
    return { success: false, message: '密码长度不能少于 6 位' };
  }

  const client = await pool.connect();
  
  try {
    // 检查是否已存在
    const existingResult = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    const passwordHash = await bcrypt.hash(password, 10);

    if (existingResult.rows.length > 0 && !force) {
      return { success: false, message: '该手机号已注册，使用 --force 参数强制覆盖' };
    }

    await client.query('BEGIN');

    try {
      if (existingResult.rows.length > 0) {
        // 更新现有用户为管理员
        await client.query(
          `UPDATE users 
           SET password_hash = $1, role = 'admin', force_change_password = true, updated_at = NOW()
           WHERE phone = $2`,
          [passwordHash, phone]
        );
      } else {
        // 创建新管理员
        const adminId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        await client.query(
          `INSERT INTO users (id, phone, password_hash, nickname, role, status, force_change_password, created_at, updated_at)
           VALUES ($1, $2, $3, '管理员', 'admin', 'active', true, NOW(), NOW())`,
          [adminId, phone, passwordHash]
        );

        // 创建积分账户
        await client.query(
          `INSERT INTO user_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
           VALUES ($1, $2, 10000, 10000, 0, NOW(), NOW())`,
          [`credits_${adminId}`, adminId]
        );
      }

      await client.query('COMMIT');
      return { 
        success: true, 
        message: existingResult.rows.length > 0 
          ? '管理员账号已更新，首次登录需修改密码' 
          : '管理员账号已创建，首次登录需修改密码' 
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('创建管理员失败:', error);
    return { success: false, message: '创建失败，请查看日志' };
  } finally {
    client.release();
  }
}
