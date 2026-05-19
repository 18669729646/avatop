/**
 * Next.js Instrumentation Hook
 * 
 * 在应用启动时执行的初始化逻辑
 * 仅在 Node.js 环境中运行（服务端）
 * 
 * 文档：https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 仅在服务端执行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] 应用启动中...');
    
    // 初始化管理员账户
    try {
      const { initializeAdmin } = await import('@/lib/init-admin');
      await initializeAdmin();
    } catch (error) {
      console.error('[Instrumentation] 初始化管理员失败:', error);
    }
    
    console.log('[Instrumentation] 应用启动完成');
  }
}
