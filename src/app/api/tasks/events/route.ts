import { NextRequest, NextResponse } from 'next/server';
import { subscribeToTaskEvents, getListenerCount } from '@/lib/task-events';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control',
  'Access-Control-Allow-Credentials': 'true',
};

// OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST - 不支持
export async function POST() {
  return NextResponse.json({ error: 'SSE endpoint only supports GET' }, { status: 405 });
}

// GET - SSE stream
export async function GET(request: NextRequest) {
  try {
    const encoder = new TextEncoder();
    let isClosed = false;

    // 创建 ReadableStream，使用 pull 模式保持连接活跃
    let pullCount = 0;
    const stream = new ReadableStream({
      pull(controller) {
        // 首次 pull 时发送连接成功事件并启动订阅
        if (pullCount === 0) {
          pullCount++;
          const connectMsg = `event: connected\ndata: ${JSON.stringify({ message: 'SSE连接已建立', timestamp: Date.now() })}\n\n`;
          controller.enqueue(encoder.encode(connectMsg));

          // 订阅任务事件
          const unsubscribe = subscribeToTaskEvents((data: unknown) => {
            if (isClosed) return;
            try {
              const msg = `event: task-update\ndata: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(msg));
            } catch {
              isClosed = true;
              unsubscribe();
            }
          });

          // 心跳保活 - 每 30 秒发送一次
          const heartbeat = setInterval(() => {
            if (isClosed) {
              clearInterval(heartbeat);
              return;
            }
            try {
              const heartbeatMsg = `:heartbeat ${Date.now()}\n\n`;
              controller.enqueue(encoder.encode(heartbeatMsg));
            } catch {
              isClosed = true;
              clearInterval(heartbeat);
              unsubscribe();
            }
          }, 30_000);

          // 客户端断开时清理
          request.signal.addEventListener('abort', () => {
            isClosed = true;
            clearInterval(heartbeat);
            unsubscribe();
            try { controller.close(); } catch { /* already closed */ }
          });

          console.log(`[SSE] 连接已建立, 当前监听数: ${getListenerCount()}`);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('[SSE] 连接建立失败:', error);
    return NextResponse.json(
      { error: 'SSE连接建立失败' },
      { status: 500, headers: corsHeaders }
    );
  }
}
