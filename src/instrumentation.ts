/**
 * Next.js Instrumentation Hook
 * 在应用启动时执行一次
 * 
 * 用于初始化管理员账号等一次性任务
 */

export async function register() {
  // 只在 Node.js 环境执行（不在 Edge Runtime 执行）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Startup] 应用启动中...');
    
    // 初始化管理员账号
    try {
      const { initAdmin } = await import('./lib/admin-init');
      await initAdmin();
    } catch (error) {
      console.error('[Startup] 管理员初始化失败:', error);
    }
    
    console.log('[Startup] 应用启动完成');
  }
}
