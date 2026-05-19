import { Metadata } from 'next';
import { GuideContent } from './guide-content';

export const metadata: Metadata = {
  title: '使用指南 - AI 内容生成平台',
  description: 'AI 图片、视频、短片生成平台完整使用指南',
};

export default function GuidePage() {
  return <GuideContent />;
}
