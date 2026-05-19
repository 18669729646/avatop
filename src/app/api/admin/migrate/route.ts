import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { pool } from '@/lib/db-pool';

/**
 * 数据库迁移 API
 * 通过调用此接口执行数据库迁移
 * 
 * 使用方式：
 * POST /api/admin/migrate
 * Body: { "secret": "your-migration-secret" }
 * 
 * 注意：需要在环境变量中设置 MIGRATION_SECRET 来保护此接口
 */

// 检查表是否存在的辅助函数
async function tableExists(client: ReturnType<typeof getSupabaseClient>, tableName: string): Promise<boolean> {
  const { data, error } = await client
    .rpc('exec_sql', { query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')` })
    .maybeSingle();
  
  // 如果 RPC 不存在，用另一种方式检查
  if (error) {
    // 尝试查询表，如果报错说明表不存在
    const { error: queryError } = await client.from(tableName).select('id').limit(1);
    return !queryError;
  }
  
  return (data as { exists: boolean })?.exists ?? false;
}

// 执行单条 SQL
async function execSQL(client: ReturnType<typeof getSupabaseClient>, sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Supabase 客户端不支持直接执行 DDL
    // 我们需要通过 RPC 来执行
    const { error } = await client.rpc('exec_ddl', { sql });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证密钥（可选，建议设置）
    const body = await request.json().catch(() => ({}));
    const migrationSecret = process.env.MIGRATION_SECRET;
    
    if (migrationSecret && body.secret !== migrationSecret) {
      return NextResponse.json(
        { error: '无效的迁移密钥' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();
    const results: { table: string; status: string; message?: string }[] = [];

    // 检查并创建用户表
    const tables = [
      {
        name: 'users',
        createSQL: `
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
          CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
        `
      },
      {
        name: 'user_credits',
        createSQL: `
          CREATE TABLE IF NOT EXISTS user_credits (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            balance INTEGER DEFAULT 0 NOT NULL,
            total_purchased INTEGER DEFAULT 0 NOT NULL,
            total_used INTEGER DEFAULT 0 NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      },
      {
        name: 'credit_packages',
        createSQL: `
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
          CREATE INDEX IF NOT EXISTS credit_packages_active_idx ON credit_packages(is_active, sort_order);
        `
      },
      {
        name: 'credit_orders',
        createSQL: `
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
          CREATE INDEX IF NOT EXISTS credit_orders_user_idx ON credit_orders(user_id, created_at);
          CREATE INDEX IF NOT EXISTS credit_orders_status_idx ON credit_orders(payment_status, created_at);
        `
      },
      {
        name: 'system_credit_prices',
        createSQL: `
          CREATE TABLE IF NOT EXISTS system_credit_prices (
            id VARCHAR(64) PRIMARY KEY,
            action_type VARCHAR(64) UNIQUE NOT NULL,
            credits_required INTEGER NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      },
      {
        name: 'usage_records',
        createSQL: `
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
          CREATE INDEX IF NOT EXISTS usage_records_user_type_idx ON usage_records(user_id, action_type, created_at);
        `
      },
      {
        name: 'auth_logs',
        createSQL: `
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
          CREATE INDEX IF NOT EXISTS auth_logs_user_idx ON auth_logs(user_id, created_at);
        `
      },
      {
        name: 'user_settings',
        createSQL: `
          CREATE TABLE IF NOT EXISTS user_settings (
            user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            language VARCHAR(16) DEFAULT 'zh-CN',
            timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      },
      {
        name: 'system_settings',
        createSQL: `
          CREATE TABLE IF NOT EXISTS system_settings (
            key VARCHAR(64) PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      },
      {
        name: 'admin_logs',
        createSQL: `
          CREATE TABLE IF NOT EXISTS admin_logs (
            id SERIAL PRIMARY KEY,
            admin_id TEXT NOT NULL REFERENCES users(id),
            action_type TEXT NOT NULL,
            action_name TEXT NOT NULL,
            target_id TEXT,
            target_info TEXT,
            detail JSONB,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
          CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
          CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_admin_logs_target_id ON admin_logs(target_id);
        `
      }
    ];

    // 检查每个表是否存在
    for (const table of tables) {
      try {
        // 尝试查询表来检查是否存在
        const { error: checkError } = await client
          .from(table.name)
          .select('id')
          .limit(1);
        
        if (checkError) {
          // 表不存在，记录需要创建
          results.push({
            table: table.name,
            status: 'needs_creation',
            message: '表不存在，需要在 Supabase 控制台创建'
          });
        } else {
          results.push({
            table: table.name,
            status: 'exists',
            message: '表已存在'
          });
        }
      } catch (err) {
        results.push({
          table: table.name,
          status: 'error',
          message: String(err)
        });
      }
    }

    // 检查业务表是否有 user_id 字段
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

    for (const tableName of businessTables) {
      try {
        // 尝试查询 user_id 字段
        const { error } = await client
          .from(tableName)
          .select('id, user_id')
          .limit(1);
        
        if (error) {
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            results.push({
              table: tableName,
              status: 'needs_user_id',
              message: '需要添加 user_id 字段'
            });
          } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
            results.push({
              table: tableName,
              status: 'table_not_exists',
              message: '表不存在'
            });
          } else {
            results.push({
              table: tableName,
              status: 'check_error',
              message: error.message
            });
          }
        } else {
          results.push({
            table: tableName,
            status: 'has_user_id',
            message: '已有 user_id 字段'
          });
        }
      } catch (err) {
        results.push({
          table: tableName,
          status: 'error',
          message: String(err)
        });
      }
    }

    // 检查默认数据
    const defaultDataStatus = {
      creditPackages: false,
      creditPrices: false,
      systemSettings: false,
      adminUser: false
    };

    // 检查并插入积分价格配置
    const { data: prices } = await client.from('system_credit_prices').select('id').limit(1);
    defaultDataStatus.creditPrices = (prices?.length ?? 0) > 0;
    if (!defaultDataStatus.creditPrices) {
      await pool.query(`
        INSERT INTO system_credit_prices (id, action_type, credits_required, description, is_active) VALUES
          ('price_1', 'image_generate', 5, '生成一张图片', true),
          ('price_2', 'video_generate', 20, '生成一个视频', true),
          ('price_3', 'video_trim', 10, '截取视频', true),
          ('price_4', 'video_concat', 10, '合并视频', true),
          ('price_5', 'storage_upload', 1, '上传存储（每MB）', true),
          ('price_6', 'script_generate', 10, '生成脚本', true),
          ('price_7', 'shortfilm_image', 5, '短片图片生成', true)
        ON CONFLICT (action_type) DO NOTHING;
      `);
      defaultDataStatus.creditPrices = true;
      console.log('   ✅ 积分价格配置已插入');
    }

    // 检查并插入积分套餐配置
    const { data: packages } = await client.from('credit_packages').select('id').limit(1);
    defaultDataStatus.creditPackages = (packages?.length ?? 0) > 0;
    if (!defaultDataStatus.creditPackages) {
      await pool.query(`
        INSERT INTO credit_packages (id, name, credits, price, bonus_credits, description, is_active, sort_order) VALUES
          ('pkg_1', '体验包', 100, 1000, 0, '适合初次体验用户', true, 1),
          ('pkg_2', '标准包', 500, 4500, 50, '日常使用首选', true, 2),
          ('pkg_3', '超值包', 1000, 8000, 150, '赠送150积分', true, 3),
          ('pkg_4', '企业包', 5000, 35000, 1000, '适合企业用户', true, 4),
          ('pkg_5', '旗舰包', 10000, 60000, 3000, '最高性价比', true, 5)
        ON CONFLICT (id) DO NOTHING;
      `);
      defaultDataStatus.creditPackages = true;
      console.log('   ✅ 积分套餐配置已插入');
    }

    // 检查并插入系统设置
    const { data: settings } = await client.from('system_settings').select('key').limit(1);
    defaultDataStatus.systemSettings = (settings?.length ?? 0) > 0;
    if (!defaultDataStatus.systemSettings) {
      await pool.query(`
        INSERT INTO system_settings (key, value, description) VALUES
          ('new_user_bonus_credits', '50', '新用户注册赠送积分'),
          ('jwt_secret', '', 'JWT 密钥（启动时自动生成）'),
          ('jwt_expires_days', '7', 'JWT 过期天数')
        ON CONFLICT (key) DO NOTHING;
      `);
      defaultDataStatus.systemSettings = true;
      console.log('   ✅ 系统配置已插入');
    }

    // 检查管理员账号
    const { data: admin } = await client.from('users').select('id').eq('role', 'admin').limit(1);
    defaultDataStatus.adminUser = (admin?.length ?? 0) > 0;
    
    // 通过环境变量创建管理员账号
    const adminPhone = process.env.INITIAL_ADMIN_PHONE;
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    
    if (!defaultDataStatus.adminUser && adminPhone && adminPassword) {
      // 动态导入 bcrypt（ESM 模块）
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const adminId = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(`
        INSERT INTO users (id, phone, password_hash, nickname, role, status) VALUES
          ($1, $2, $3, '管理员', 'admin', 'active')
      `, [adminId, adminPhone, passwordHash]);
      
      // 给管理员分配初始积分
      await pool.query(`
        INSERT INTO user_credits (id, user_id, balance, total_purchased) VALUES
          ($1, $2, 10000, 10000)
      `, [`credits_${adminId}`, adminId]);
      
      defaultDataStatus.adminUser = true;
      console.log('   ✅ 管理员账号已创建');
    }

    return NextResponse.json({
      success: true,
      message: '数据库状态检查完成，默认数据已初始化',
      tables: results,
      defaultData: defaultDataStatus,
    });

  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json(
      { error: '迁移检查失败', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
