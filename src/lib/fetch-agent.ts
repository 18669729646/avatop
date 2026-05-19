/**
 * 全局 fetch Agent 配置
 *
 * 解决 Node.js 内置 undici fetch 的默认超时问题：
 * - connectTimeout: 建立 TCP 连接的超时时间
 * - headersTimeout: 等待响应头的超时时间
 * - bodyTimeout: 等待响应体的超时时间
 *
 * 默认值较小（约 5 分钟），需要增加到 10 分钟以支持长时间运行的 API 调用
 */

import { Agent } from 'undici';

// 长时间运行的 API 调用 Agent（10 分钟超时）
export const longRunningAgent = new Agent({
  connectTimeout: 10 * 60 * 1000,    // 10 分钟连接超时
  headersTimeout: 10 * 60 * 1000,     // 10 分钟
  bodyTimeout: 10 * 60 * 1000,        // 10 分钟
  keepAliveTimeout: 60 * 1000,         // 1 分钟 keep-alive
  keepAliveMaxTimeout: 10 * 60 * 1000,  // 最大 10 分钟
});

// 默认 Agent（5 分钟超时，用于普通 API 调用）
export const defaultAgent = new Agent({
  connectTimeout: 30 * 1000,      // 30 秒连接超时
  headersTimeout: 5 * 60 * 1000,   // 5 分钟
  bodyTimeout: 5 * 60 * 1000,      // 5 分钟
});

// 导出便捷函数
export function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeout?: 'long' | 'default' } = {}
): ReturnType<typeof fetch> {
  const { timeout = 'default', ...fetchOptions } = options;
  const agent = timeout === 'long' ? longRunningAgent : defaultAgent;
  
  return fetch(url, {
    ...fetchOptions,
    // @ts-expect-error - Node.js undici Agent 类型定义
    dispatcher: agent,
  });
}
