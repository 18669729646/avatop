import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // 处理 @vite/client 请求，避免 404 错误
  if (request.nextUrl.pathname === '/@vite/client') {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/@vite/client'],
};
