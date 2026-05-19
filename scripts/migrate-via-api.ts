/**
 * 数据库迁移脚本 - 通过 Supabase API 逐步创建表
 * 执行方式：npx tsx scripts/migrate-via-api.ts
 */

const SUPABASE_URL = process.env.COZE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // 需要服务角色密钥

async function runMigration() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('错误：请设置以下环境变量：');
    console.error('  - COZE_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY (需要在 Supabase 控制台获取)');
    console.log('\n请在 Supabase SQL Editor 中执行迁移 SQL。');
    process.exit(1);
  }

  console.log('============================================');
  console.log('数据库迁移');
  console.log('============================================\n');

  // 这里使用 REST API 执行 SQL
  // 但 Supabase REST API 不支持执行原始 DDL
  
  console.log('由于安全限制，请通过 Supabase 控制台执行迁移：\n');
  console.log('步骤：');
  console.log('1. 打开 Supabase 控制台: https://supabase.com/dashboard');
  console.log('2. 选择你的项目');
  console.log('3. 点击左侧菜单 "SQL Editor"');
  console.log('4. 点击 "New query"');
  console.log('5. 复制 migrations/001_user_system.sql 的内容');
  console.log('6. 点击 "Run" 执行\n');
  
  console.log('或者使用 psql 命令行：');
  console.log('psql "$DATABASE_URL" -f migrations/001_user_system.sql\n');
}

runMigration();
