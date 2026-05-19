'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PromptEditor } from '@/components/prompt-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authFetch, useAuth } from '@/lib/auth-context';
import { PROMPT_TYPE_CONFIGS, type PromptType } from '@/lib/prompt-variables';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SystemPromptConfig {
  id: string;
  system_prompt: string;
  default_prompt?: string;
  variables_used: string[];
  created_at: string;
  updated_at: string;
  is_initial?: boolean;
}

export default function PromptSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeType, setActiveType] = useState<PromptType>('shortfilm');
  const [configs, setConfigs] = useState<Record<PromptType, SystemPromptConfig | null>>({
    shortfilm: null,
    video_remake: null,
    analysis_master: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      if (user?.role !== 'admin') {
        router.push('/');
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const loadConfig = useCallback(async (type: PromptType) => {
    const response = await authFetch(`/api/system-prompt?type=${type}`);
    const data = await response.json();
    if (data.success) {
      setConfigs(prev => ({ ...prev, [type]: data.config }));
    } else {
      throw new Error(data.error || `加载 ${type} 配置失败`);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      if (authLoading || !isAuthenticated || user?.role !== 'admin') return;
      setLoading(true);
      try {
        await Promise.all((Object.keys(PROMPT_TYPE_CONFIGS) as PromptType[]).map(loadConfig));
      } catch (error) {
        console.error('Load config error:', error);
        toast.error('加载配置失败');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [authLoading, isAuthenticated, user, loadConfig]);

  const handlePromptSave = useCallback(async (type: PromptType, prompt: string) => {
    setSaving(true);
    try {
      const saveResponse = await authFetch('/api/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: prompt, confirmOverride: true, type }),
      });

      const saveData = await saveResponse.json();
      if (saveData.success) {
        toast.success(`${PROMPT_TYPE_CONFIGS[type].label}提示词模板已保存`);
        setConfigs(prev => ({ ...prev, [type]: saveData.config }));
      } else {
        throw new Error(saveData.error || '保存失败');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : '保存失败');
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const handlePromptReset = useCallback(async (type: PromptType) => {
    setSaving(true);
    try {
      const response = await authFetch(`/api/system-prompt?type=${type}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success(`已恢复${PROMPT_TYPE_CONFIGS[type].label}默认模板`);
        setConfigs(prev => ({ ...prev, [type]: data.config }));
      } else {
        throw new Error(data.error || '恢复默认失败');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error(error instanceof Error ? error.message : '恢复默认失败');
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const handlePromptSetDefault = useCallback(async (type: PromptType) => {
    setSaving(true);
    try {
      const response = await authFetch('/api/system-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`已将当前${PROMPT_TYPE_CONFIGS[type].label}模板设为默认模板`);
        setConfigs(prev => ({ ...prev, [type]: data.config }));
      } else {
        throw new Error(data.error || '设为默认失败');
      }
    } catch (error) {
      console.error('Set default error:', error);
      toast.error(error instanceof Error ? error.message : '设为默认失败');
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="w-full flex h-14 items-center px-6">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-semibold">提示词配置</h1>
          </div>
          {saving && (
            <span className="flex items-center gap-1 text-sm text-blue-600 ml-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </span>
          )}
        </div>
      </header>

      <main className="w-full py-6 px-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>提示词模板配置</CardTitle>
            <CardDescription>
              管理短片脚本、视频复刻解析与分析大师的 AI 提示词模板，使用 <code className="font-mono text-xs">{'{{变量名}}'}</code> 插入动态内容
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeType} onValueChange={(value) => setActiveType(value as PromptType)} className="space-y-6">
          <TabsList>
            {Object.entries(PROMPT_TYPE_CONFIGS).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key}>
                {cfg.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(PROMPT_TYPE_CONFIGS).map(([key, cfg]) => (
            <TabsContent key={key} value={key}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>{cfg.label}</CardTitle>
                  <CardDescription>{cfg.description}</CardDescription>
                </CardHeader>
              </Card>

              {key === 'shortfilm' && (
                <Alert className="mb-6">
                  <AlertDescription>
                    这里保留原有的短片脚本提示词配置能力，功能和之前保持一致。
                  </AlertDescription>
                </Alert>
              )}

              <Card className="p-4">
                <PromptEditor
                  key={key}
                  type={key as PromptType}
                  initialPrompt={configs[key as PromptType]?.system_prompt}
                  initialDefaultPrompt={configs[key as PromptType]?.default_prompt}
                  onSave={(prompt) => handlePromptSave(key as PromptType, prompt)}
                  onReset={() => handlePromptReset(key as PromptType)}
                  onSetDefault={() => handlePromptSetDefault(key as PromptType)}
                  isSaving={saving}
                />
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
