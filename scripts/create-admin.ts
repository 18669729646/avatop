#!/usr/bin/env npx ts-node
/**
 * 创建管理员账号命令行工具
 * 
 * 使用方式：
 *   npx ts-node scripts/create-admin.ts --phone 138xxxx --password yourpassword
 *   npx ts-node scripts/create-admin.ts --phone 138xxxx --password yourpassword --force
 * 
 * 参数：
 *   --phone     管理员手机号（必填）
 *   --password  管理员密码（必填，至少6位）
 *   --force     强制覆盖已存在的账号
 */

interface Args {
  phone?: string;
  password?: string;
  force: boolean;
}

function parseArgs(): Args {
  const args: Args = { force: false };
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phone' && argv[i + 1]) {
      args.phone = argv[++i];
    } else if (arg === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    } else if (arg === '--force') {
      args.force = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.phone || !args.password) {
    console.log('用法: npx ts-node scripts/create-admin.ts --phone <手机号> --password <密码> [--force]');
    console.log('');
    console.log('参数:');
    console.log('  --phone     管理员手机号（必填，11位）');
    console.log('  --password  管理员密码（必填，至少6位）');
    console.log('  --force     强制覆盖已存在的账号');
    process.exit(1);
  }

  console.log('正在创建管理员账号...\n');

  // 动态导入
  const { createAdmin } = await import('../src/lib/admin-init');
  
  const result = await createAdmin(args.phone, args.password, args.force);
  
  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`   手机号: ${args.phone}`);
    process.exit(0);
  } else {
    console.log(`❌ ${result.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
