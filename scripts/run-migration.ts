#!/usr/bin/env npx tsx
/**
 * 数据库迁移脚本
 * 直接使用 PostgreSQL 连接执行迁移
 * 
 * 运行方式：npx tsx scripts/run-migration.ts
 */

import { Pool } from 'pg';

async function runMigration() {
  const databaseUrl = process.env.PGDATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ PGDATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  console.log('🔌 连接数据库...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 开始执行迁移...\n');
    
    // 第一步：创建用户表
    console.log('📦 创建用户表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        phone VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(64),
        avatar_url TEXT,
        role VARCHAR(32) DEFAULT 'user',
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);`);
    console.log('   ✅ users');
    
    // 第二步：创建用户积分表
    console.log('📦 创建用户积分表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_credits (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER DEFAULT 0 NOT NULL,
        total_purchased INTEGER DEFAULT 0 NOT NULL,
        total_used INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ user_credits');
    
    // 第三步：创建积分套餐表
    console.log('📦 创建积分套餐表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_packages (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        credits INTEGER NOT NULL,
        price INTEGER NOT NULL,
        bonus_credits INTEGER DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS credit_packages_active_idx ON credit_packages(is_active, sort_order);`);
    console.log('   ✅ credit_packages');
    
    // 第四步：创建积分订单表
    console.log('📦 创建积分订单表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_orders (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        package_id VARCHAR(64) REFERENCES credit_packages(id),
        credits INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        payment_method VARCHAR(32),
        payment_status VARCHAR(32) DEFAULT 'pending',
        payment_transaction_id VARCHAR(128),
        admin_note TEXT,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS credit_orders_user_idx ON credit_orders(user_id, created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS credit_orders_status_idx ON credit_orders(payment_status, created_at);`);
    console.log('   ✅ credit_orders');
    
    // 第五步：创建系统积分价格表
    console.log('📦 创建系统积分价格表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_credit_prices (
        id VARCHAR(64) PRIMARY KEY,
        action_type VARCHAR(64) UNIQUE NOT NULL,
        credits_required INTEGER NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ system_credit_prices');
    
    // 第六步：创建使用记录表
    console.log('📦 创建使用记录表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(64) NOT NULL,
        credits_used INTEGER NOT NULL,
        resource_id VARCHAR(64),
        resource_type VARCHAR(32),
        balance_before INTEGER,
        balance_after INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS usage_records_user_type_idx ON usage_records(user_id, action_type, created_at);`);
    console.log('   ✅ usage_records');
    
    // 第 6.5 步：创建积分交易记录表
    console.log('📦 创建积分交易记录表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type VARCHAR(32) NOT NULL,
        description TEXT,
        order_id VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON credit_transactions(user_id, created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS credit_transactions_type_idx ON credit_transactions(type, created_at);`);
    console.log('   ✅ credit_transactions');
    
    // 第七步：创建登录日志表
    console.log('📦 创建登录日志表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(32) NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        success BOOLEAN DEFAULT true,
        fail_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS auth_logs_user_idx ON auth_logs(user_id, created_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS auth_logs_created_idx ON auth_logs(created_at);`);
    console.log('   ✅ auth_logs');
    
    // 第八步：创建用户设置表
    console.log('📦 创建用户设置表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        language VARCHAR(16) DEFAULT 'zh-CN',
        timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ user_settings');
    
    // 第九步：创建系统配置表
    console.log('📦 创建系统配置表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('   ✅ system_settings');
    
    // ============================================================
    // 业务表添加 user_id 字段
    // ============================================================
    console.log('\n📦 业务表添加 user_id 字段...');
    
    const businessTables = [
      'task_queue',
      'image_history',
      'video_history',
      'character_library',
      'products',
      'shortfilm_projects',
      'shortfilm_templates',
      'prompt_templates',
      'user_preferences',
      'system_prompt_config'
    ];
    
    for (const table of businessTables) {
      try {
        // 先检查表是否存在
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          );
        `, [table]);
        
        if (!tableCheck.rows[0]?.exists) {
          console.log(`   ⚠️ ${table} (表不存在，跳过)`);
          continue;
        }
        
        // 添加 user_id 字段
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);`);
        
        // 创建索引
        await pool.query(`CREATE INDEX IF NOT EXISTS ${table}_user_idx ON ${table}(user_id);`);
        
        console.log(`   ✅ ${table}.user_id`);
      } catch (err: any) {
        console.log(`   ❌ ${table}: ${err.message}`);
      }
    }
    
    // ============================================================
    // 插入默认数据
    // ============================================================
    console.log('\n📦 插入默认数据...');
    
    // 积分价格配置
    await pool.query(`
      INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active) VALUES
        ('price_1', 'image_generate', 5, '生成一张图片', true),
        ('price_2', 'video_generate', 20, '生成一个视频', true),
        ('price_3', 'video_trim', 10, '截取视频', true),
        ('price_4', 'video_concat', 10, '合并视频', true),
        ('price_5', 'storage_upload', 1, '上传存储（每MB）', true)
      ON CONFLICT (action_type) DO NOTHING;
    `);
    console.log('   ✅ 积分价格配置');
    
    // 积分套餐配置
    await pool.query(`
      INSERT INTO credit_packages (id, name, credits, price, bonus_credits, description, is_active, sort_order) VALUES
        ('pkg_1', '体验包', 100, 1000, 0, '适合初次体验用户', true, 1),
        ('pkg_2', '标准包', 500, 4500, 50, '日常使用首选', true, 2),
        ('pkg_3', '超值包', 1000, 8000, 150, '赠送150积分', true, 3),
        ('pkg_4', '企业包', 5000, 35000, 1000, '适合企业用户', true, 4),
        ('pkg_5', '旗舰包', 10000, 60000, 3000, '最高性价比', true, 5)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('   ✅ 积分套餐配置');
    
    // 系统配置
    await pool.query(`
      INSERT INTO system_settings (key, value, description) VALUES
        ('new_user_bonus_credits', '50', '新用户注册赠送积分'),
        ('jwt_secret', '', 'JWT 密钥（启动时自动生成）'),
        ('jwt_expires_days', '7', 'JWT 过期天数')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('   ✅ 系统配置');
    
    // 通过环境变量创建管理员账号（安全方式）
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (adminPhone && adminPassword) {
      // 动态导入 bcrypt（ESM 模块）
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      // 检查管理员是否已存在
      const existingAdmin = await pool.query(
        'SELECT id FROM users WHERE phone = $1',
        [adminPhone]
      );
      
      if (existingAdmin.rows.length === 0) {
        // 创建新管理员，设置 force_change_password = true
        const adminId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await pool.query(`
          INSERT INTO users (id, phone, password_hash, nickname, role, status, force_change_password) VALUES
            ($1, $2, $3, '管理员', 'admin', 'active', true)
        `, [adminId, adminPhone, passwordHash]);
        
        // 给管理员分配初始积分
        await pool.query(`
          INSERT INTO user_credits (id, user_id, balance, total_purchased) VALUES
            ($1, $2, 10000, 10000)
        `, [`credits_${adminId}`, adminId]);
        
        console.log('   ✅ 管理员账号已创建（首次登录需修改密码）');
      } else {
        // 管理员已存在，更新密码（如果环境变量密码变更）
        await pool.query(
          'UPDATE users SET password_hash = $1, force_change_password = true WHERE phone = $2 AND role = $3',
          [passwordHash, adminPhone, 'admin']
        );
        console.log('   ✅ 管理员账号已更新');
      }
    } else {
      console.log('   ⚠️  未配置 ADMIN_PHONE 和 ADMIN_PASSWORD 环境变量，跳过管理员创建');
      console.log('      可稍后通过管理脚本创建管理员账号');
    }
    
    // ============================================================
    // 验证
    // ============================================================
    console.log('\n📋 验证迁移结果...\n');
    
    const tables = [
      'users', 'user_credits', 'credit_packages', 'credit_orders',
      'system_credit_prices', 'usage_records', 'auth_logs', 
      'user_settings', 'system_settings'
    ];
    
    console.log('新创建的表:');
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `, [table]);
      
      if (result.rows[0]?.exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} (未创建)`);
      }
    }
    
    console.log('\n业务表 user_id 字段:');
    for (const table of businessTables) {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'user_id';
      `, [table]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${table}.user_id`);
      } else {
        console.log(`   ⚠️ ${table}.user_id (未添加)`);
      }
    }
    
    // 统计数据
    console.log('\n默认数据统计:');
    const packagesResult = await pool.query('SELECT COUNT(*) FROM credit_packages;');
    console.log(`   积分套餐: ${packagesResult.rows[0]?.count} 条`);
    
    const pricesResult = await pool.query('SELECT COUNT(*) FROM system_credit_prices;');
    console.log(`   积分价格: ${pricesResult.rows[0]?.count} 条`);
    
    const adminResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin';");
    console.log(`   管理员账号: ${adminResult.rows[0]?.count} 个`);
    
    console.log('\n✅ 迁移完成!\n');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
