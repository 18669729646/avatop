'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Sparkles, Bookmark
} from 'lucide-react';
import { TemplateGeneratorCore, GeneratedTemplate } from '@/components/template-generator-core';
import { 
  Template,
  getTemplates,
} from '@/lib/template-library';
import { AppLayout } from '@/components/app-layout';

export default function TemplateGeneratorPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  // 加载模板列表（仅用于显示数量）
  useEffect(() => {
    setIsLoading(true);
    getTemplates()
      .then(data => {
        if (Array.isArray(data)) {
          setTemplates(data);
        } else {
          setTemplates([]);
        }
      })
      .catch(() => {
        setTemplates([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // 应用模板 - 跳转到短片创作页面
  const handleApply = (template: GeneratedTemplate) => {
    // 防止重复点击
    if (isApplying) return;
    
    setIsApplying(true);
    try {
      // 将模板存储到 sessionStorage，供短片创作页面读取
      sessionStorage.setItem('selected_template', JSON.stringify(template));
      
      // 跳转到短片创作页面
      router.push('/shortfilm/new?from_template=1');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* 页面标题栏 */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/shortfilm')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI 模板生成器
              </h1>
            </div>
            <Link href="/shortfilm/templates">
              <Button variant="outline" size="sm">
                <Bookmark className="w-4 h-4 mr-1" />
                广告模板
                {!isLoading && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {templates.length}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-7xl mx-auto">
              <TemplateGeneratorCore 
                onApply={handleApply}
                showApplyButton={true}
                isApplying={isApplying}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </AppLayout>
  );
}
