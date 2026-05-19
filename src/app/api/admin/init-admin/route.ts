import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin, getAdminInitStatus } from '@/lib/init-admin';
import { verifyAuth } from '@/lib/auth-middleware';

/**
 * 初始化管理员 API
 * 
 * GET: 检查管理员初始化状态
 * POST: 手动触发管理员初始化（需要管理员权限）
 */

// GET: 检查状态
export async function GET() {
  const status = getAdminInitStatus();
  
  return NextResponse.json({
    success: true,
    status: {
      configured: status.configured,
      phone: status.phone ? `${status.phone.slice(0, 3)}****${status.phone.slice(-4)}` : undefined,
      message: status.message,
    },
  });
}

// POST: 手动触发初始化
export async function POST(request: NextRequest) {
  // 验证管理员权限
  const authResult = await verifyAuth(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    );
  }
  
  if (authResult.payload.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '仅管理员可以执行此操作' },
      { status: 403 }
    );
  }

  try {
    await initializeAdmin();
    
    return NextResponse.json({
      success: true,
      message: '管理员初始化完成',
      status: getAdminInitStatus(),
    });
  } catch (error) {
    console.error('[InitAdmin API] 初始化失败:', error);
    return NextResponse.json(
      { success: false, error: '初始化失败' },
      { status: 500 }
    );
  }
}
