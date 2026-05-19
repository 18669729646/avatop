import { NextRequest, NextResponse } from 'next/server';
import { subscribeToTaskEvents, TaskEventData } from '@/lib/task-events';

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 存储所有活跃的客户端连接
const clients = new Map<ReadableStreamDefaultController, { id: string; heartbeat: NodeJS.Timeout }>();
let clientCounter = 0;

// 处理 CORS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}

// 处理 POST 请求（返回 JSON 错误，避免前端 JSON 解析错误）
export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'This endpoint only supports GET requests for SSE connections' },
    { status: 405 }
  );
}

export async function GET(request: NextRequest) {
  const clientId = `client-${++clientCounter}`;
  
  // 创建可读流用于 SSE
  const stream = new ReadableStream({
    start(controller) {
      // 设置心跳
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          clients.delete(controller);
        }
      }, 30000);
      
      // 注册客户端
      clients.set(controller, { id: clientId, heartbeat });
      console.log(`[SSE] 客户端连接: ${clientId}, 当前连接数: ${clients.size}`);
      
      // 发送连接成功消息
      const connectMessage = `data: ${JSON.stringify({ 
        type: 'connected', 
        clientId,
        timestamp: Date.now() 
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMessage));
      
      // 订阅任务事件
      const unsubscribe = subscribeToTaskEvents((data: TaskEventData) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch {
          // 发送失败，客户端可能已断开
          clearInterval(heartbeat);
          clients.delete(controller);
          unsubscribe();
        }
      });
      
      // 存储取消订阅函数
      const clientData = clients.get(controller);
      if (clientData) {
        (clientData as { unsubscribe?: () => void }).unsubscribe = unsubscribe;
      }
    },
    
    cancel(controller) {
      const clientData = clients.get(controller);
      if (clientData) {
        clearInterval(clientData.heartbeat);
        const unsubscribe = (clientData as { unsubscribe?: () => void }).unsubscribe;
        if (unsubscribe) unsubscribe();
        clients.delete(controller);
      }
      console.log(`[SSE] 客户端断开: ${clientId}, 当前连接数: ${clients.size}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
