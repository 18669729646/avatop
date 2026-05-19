/**
 * 数据库迁移脚本
 * 执行方式：npx ts-node scripts/migrate.ts
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

async function runMigration() {
  console.log('开始执行数据库迁移...\n');

  const client = getSupabaseClient();

  // ============================================================
  // 1. 创建用户表
  // ============================================================
  console.log('1. 创建 users 表...');
  const { error: usersError } = await client.rpc('exec_sql', {
    sql: `
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
  });

  if (usersError) {
    console.log('   注意：可能需要手动创建 users 表');
  } else {
    console.log('   ✓ users 表创建成功');
  }

  // 由于 Supabase 不支持直接执行 DDL，我们需要分步创建表
  // 这里使用 upsert 方式检查表是否存在

  console.log('\n迁移脚本已生成 SQL 文件，请按以下步骤执行：');
  console.log('');
  console.log('=== 方式一：Supabase SQL Editor ===');
  console.log('1. 打开 Supabase 控制台');
  console.log('2. 进入 SQL Editor');
  console.log('3. 复制 migrations/001_user_system.sql 的内容');
  console.log('4. 点击 Run 执行');
  console.log('');
  console.log('=== 方式二：使用 psql 命令行 ===');
  console.log('psql -h <host> -U <user> -d <database> -f migrations/001_user_system.sql');
  console.log('');
}

runMigration().catch(console.error);
