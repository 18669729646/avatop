import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // 增加 API 路由请求体大小限制到 500MB
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  // 增加 API 路由超时时间（用于长时间运行的任务如视频生成）
  // 注意：这在 Vercel 等 Serverless 平台可能有限制
  serverExternalPackages: ['@node-rs/argon2'],
  // 开发环境下的页面缓存配置
  onDemandEntries: {
    // 页面在开发环境中保持活跃的时间（毫秒）
    maxInactiveAge: 60 * 60 * 1000, // 1小时
    // 同时保持活跃的页面数量
    pagesBufferLength: 10,
  },
};

export default nextConfig;
