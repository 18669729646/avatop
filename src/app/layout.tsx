import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Avatap - 跨境电商 AI 视频创作专家',
    template: '%s | Avatap',
  },
  description:
    '专为跨境电商打造的 AI 视频生成平台。支持60秒长视频生成，AI 自动生成脚本和强力钩子，助力内容创作，提升转化率。',
  keywords: [
    '跨境电商',
    'AI 视频生成',
    '长视频生成',
    '60秒视频',
    '脚本生成',
    '钩子模板',
    'TikTok 视频',
    '抖音视频',
    '产品视频',
    '营销视频',
    'Avatap',
  ],
  authors: [{ name: 'Avatap' }],
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* 浏览器兼容性：禁用双击缩放 */}
        <meta name="touch-action" content="manipulation" />
        {/* Safari 兼容性 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
