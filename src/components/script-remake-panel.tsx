'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductSelector } from './product-selector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ProductSelection } from '@/lib/products';
import { authFetch } from '@/lib/auth-context';
import { copyToClipboard } from '@/lib/prompt-templates';
import { Sparkles, Loader2, Copy, FileSpreadsheet } from 'lucide-react';

export interface ScriptRemakeSegment {
  order: number;
  durationSec: number;
  scene: string;
  voiceover: string;
  voiceoverCn?: string;
  action: string;
  productPlacement: string;
  camera: string;
  onScreenText: string;
  onScreenTextCn?: string;
}

export interface ScriptRemakeResult {
  id: string;
  projectId: string;
  productId: string;
  title: string;
  hook: string;
  painPoint: string;
  sellingPointScript: string;
  cta: string;
  fullScript: string;
  fullScriptCn?: string;
  segments: ScriptRemakeSegment[];
  shootingNotes: string;
  visualNotes: string;
  complianceNotes: string;
}

interface AnalysisProject {
  id: string;
  name: string;
  status: string;
  result?: unknown;
}

const TIKTOK_LANGUAGES = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: '英语（美国）' },
  { value: 'en-GB', label: '英语（英国）' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'id-ID', label: '印尼语' },
  { value: 'th-TH', label: '泰语' },
  { value: 'vi-VN', label: '越南语' },
  { value: 'ms-MY', label: '马来语' },
  { value: 'fil-PH', label: '菲律宾语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'de-DE', label: '德语' },
  { value: 'es-ES', label: '西班牙语（西班牙）' },
  { value: 'it-IT', label: '意大利语' },
  { value: 'pt-BR', label: '葡萄牙语（巴西）' },
  { value: 'es-MX', label: '西班牙语（墨西哥）' },
  { value: 'ru-RU', label: '俄语' },
  { value: 'ar-SA', label: '阿拉伯语' },
  { value: 'hi-IN', label: '印地语' },
  { value: 'tr-TR', label: '土耳其语' },
];

interface ScriptRemakePanelProps {
  selectedProject: AnalysisProject | undefined;
}

export function ScriptRemakePanel({ selectedProject }: ScriptRemakePanelProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductSelection | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [scriptRemakeResult, setScriptRemakeResult] = useState<ScriptRemakeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  const canGenerate = selectedProject?.status === 'completed' &&
                      selectedProject?.result &&
                      selectedProduct;

  const handleProductSelect = (product: ProductSelection) => {
    setSelectedProduct(product);
    setShowProductSelector(false);
    setScriptRemakeResult(null);
    setError('');
    setCurrentTaskId(null);
  };

  const pollScriptRemakeStatus = async (taskId: string, maxAttempts = 60): Promise<ScriptRemakeResult | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await authFetch(`/api/analysis-master/script-remake?id=${taskId}`, {
          method: 'GET',
        });

        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          if (data.status === 'completed') {
            const segments = Array.isArray(data.segments) ? data.segments : [];
            
            return {
              id: data.id,
              projectId: data.project_id,
              productId: data.product_id,
              title: data.title || '',
              hook: data.hook || '',
              painPoint: data.pain_point || '',
              sellingPointScript: data.selling_point_script || '',
              cta: data.cta || '',
              fullScript: data.full_script || '',
              fullScriptCn: data.full_script_cn || '',
              segments: segments.map((seg: Record<string, unknown>, index: number) => ({
                order: typeof seg.order === 'number' ? seg.order : index + 1,
                durationSec: typeof seg.durationSec === 'number' ? seg.durationSec : 8,
                scene: String(seg.scene || ''),
                voiceover: String(seg.voiceover || ''),
                voiceoverCn: String(seg.voiceoverCn || seg.voiceover_cn || ''),
                action: String(seg.action || ''),
                productPlacement: String(seg.productPlacement || ''),
                camera: String(seg.camera || ''),
                onScreenText: String(seg.onScreenText || ''),
                onScreenTextCn: String(seg.onScreenTextCn || seg.onScreenText_cn || ''),
              })),
              shootingNotes: data.shooting_notes || '',
              visualNotes: data.visual_notes || '',
              complianceNotes: data.compliance_notes || '',
            };
          } else if (data.status === 'failed') {
            throw new Error(data.error || '脚本生成失败');
          }
        }
      } catch (err) {
        console.error(`[Script Remake Panel] 轮询失败: ${(err as Error).message}`);
      }

      setGenerating(true);
    }

    return null;
  };

  const handleGenerate = async () => {
    if (!selectedProject?.id || !selectedProduct) return;

    setLoading(true);
    setGenerating(true);
    setError('');
    setScriptRemakeResult(null);
    setCurrentTaskId(null);

    try {
      const response = await authFetch('/api/analysis-master/script-remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          productId: selectedProduct.id,
          language: selectedLanguage,
          includeChinese: true,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || '脚本生成失败');
        setGenerating(false);
        return;
      }

      const taskId = result.data.taskId;
      setCurrentTaskId(taskId);

      const scriptResult = await pollScriptRemakeStatus(taskId);

      if (scriptResult) {
        setScriptRemakeResult(scriptResult);
      } else {
        setError('脚本生成超时，请稍后刷新查看');
      }
    } catch (err) {
      setError((err as Error).message || '脚本生成失败');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!scriptRemakeResult) return;

    try {
      const response = await authFetch('/api/analysis-master/script-remake/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: scriptRemakeResult.id }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `script-remake-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message || '导出失败');
    }
  };

  const handleCopy = async (text: string, fieldName: string) => {
    await copyToClipboard(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    if (!scriptRemakeResult) return;

    const currentLangLabel = TIKTOK_LANGUAGES.find(l => l.value === selectedLanguage)?.label || '目标语言';

    const segmentsText = scriptRemakeResult.segments
      .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`)
      .join('\n');

    const segmentsTextCn = scriptRemakeResult.segments
      .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceoverCn || seg.voiceover}｜动作：${seg.action}`)
      .join('\n');

    const allText = `【标题】\n${scriptRemakeResult.title || ''}\n\n【开头钩子】\n${scriptRemakeResult.hook || ''}\n\n【痛点场景】\n${scriptRemakeResult.painPoint || ''}\n\n【核心卖点】\n${scriptRemakeResult.sellingPointScript || ''}\n\n【CTA】\n${scriptRemakeResult.cta || ''}\n\n【完整口播】(${currentLangLabel})\n${scriptRemakeResult.fullScript || ''}\n\n【完整口播】(中文)\n${scriptRemakeResult.fullScriptCn || ''}\n\n【分镜脚本】(${currentLangLabel})\n${segmentsText}\n\n【分镜脚本】(中文)\n${segmentsTextCn}\n\n【拍摄建议】\n${scriptRemakeResult.shootingNotes || ''}\n\n【视觉展示建议】\n${scriptRemakeResult.visualNotes || ''}\n\n【合规注意】\n${scriptRemakeResult.complianceNotes || ''}`;

    handleCopy(allText, 'all');
  };

  return (
    <>
      <Card className="shadow-sm border-purple-500/30 bg-purple-500/5">
        <CardHeader className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <CardTitle className="text-base">脚本复刻</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedProject?.status !== 'completed' && (
            <div className="text-sm text-muted-foreground text-center py-4">
              <div className="text-yellow-500 mb-1">请先完成视频反推</div>
              <div>完成分析后即可使用脚本复刻功能</div>
            </div>
          )}

          {selectedProject?.status === 'completed' && selectedProject?.result !== undefined && selectedProject?.result !== null && (
            <div className="space-y-4">
              {!selectedProduct ? (
                <div className="text-center py-4">
                  <Button
                    onClick={() => setShowProductSelector(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    选择产品
                  </Button>
                  <div className="text-sm text-muted-foreground mt-2">选择一个产品以生成复刻脚本</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 bg-muted/50">
                    <div className="flex items-center gap-3">
                      {selectedProduct.allImages.length > 0 ? (
                        <img
                          src={selectedProduct.allImages[0].url}
                          alt={selectedProduct.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-xs text-muted-foreground">无图片</div>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{selectedProduct.name}</div>
                        <div className="text-xs text-muted-foreground">
                          卖点: {selectedProduct.sellingPoints.length}个 | 关键词: {selectedProduct.keywords.length}个
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowProductSelector(true)}>
                        更换
                      </Button>
                    </div>
                  </div>

                  {(!selectedProduct.allImages || selectedProduct.allImages.length === 0) && (
                    <div className="text-sm text-yellow-600 bg-yellow-500/10 rounded-md p-3 border border-yellow-500/30">
                      ⚠️ 该产品未上传图片，AI将主要基于文字信息仿写
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>
                  )}

                  {!scriptRemakeResult ? (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="language-select" className="text-sm">
                            选择口播语言
                          </Label>
                          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                            <SelectTrigger id="language-select">
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIKTOK_LANGUAGES.map(lang => (
                                <SelectItem key={lang.value} value={lang.value}>
                                  {lang.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleGenerate}
                          disabled={loading || !canGenerate}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          {loading || generating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {generating ? 'AI生成中，请稍候...' : '提交任务...'}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              生成复刻脚本
                            </>
                          )}
                        </Button>
                      </div>
                      {generating && (
                        <div className="text-xs text-muted-foreground text-center">
                          任务已提交，后台生成中，请勿关闭页面
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Button onClick={handleCopyAll} variant="outline" className="flex-1">
                          <Copy className="w-4 h-4 mr-2" />
                          {copiedField === 'all' ? '已复制' : '复制全部'}
                        </Button>
                        <Button onClick={handleExport} className="flex-1 bg-green-600 hover:bg-green-700">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          导出Excel
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">标题</div>
                          <div className="font-medium">{scriptRemakeResult.title}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">开头钩子</div>
                          <div className="font-medium">{scriptRemakeResult.hook}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">痛点场景</div>
                          <div>{scriptRemakeResult.painPoint}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-1">核心卖点</div>
                          <div>{scriptRemakeResult.sellingPointScript}</div>
                        </div>
                        <div className="rounded-md border p-3 bg-muted/30 sm:col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">CTA</div>
                          <div>{scriptRemakeResult.cta}</div>
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">完整口播</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.fullScript, 'fullScript')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'fullScript' ? '已复制' : '复制'}
                            </button>
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.fullScriptCn || '', 'fullScriptCn')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'fullScriptCn' ? '已复制' : '复制(中文)'}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 space-y-4">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">目标语言</div>
                            <div className="text-sm whitespace-pre-wrap max-h-32 overflow-auto">{scriptRemakeResult.fullScript}</div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">中文</div>
                            <div className="text-sm whitespace-pre-wrap max-h-32 overflow-auto">{scriptRemakeResult.fullScriptCn}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">分镜脚本</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const segmentsText = scriptRemakeResult.segments
                                  .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceover}｜动作：${seg.action}`)
                                  .join('\n');
                                handleCopy(segmentsText, 'segments');
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'segments' ? '已复制' : '复制'}
                            </button>
                            <button
                              onClick={() => {
                                const segmentsTextCn = scriptRemakeResult.segments
                                  .map(seg => `${seg.order}. ${seg.durationSec}秒｜画面：${seg.scene}｜口播：${seg.voiceoverCn || seg.voiceover}｜动作：${seg.action}`)
                                  .join('\n');
                                handleCopy(segmentsTextCn, 'segmentsCn');
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'segmentsCn' ? '已复制' : '复制(中文)'}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 space-y-3 max-h-80 overflow-auto">
                          {scriptRemakeResult.segments.map(seg => (
                            <div key={seg.order} className="rounded-md bg-muted/30 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-xs">场景 {seg.order}</Badge>
                                <span className="text-xs text-muted-foreground">{seg.durationSec}秒</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div><span className="text-muted-foreground">画面：</span>{seg.scene}</div>
                                <div><span className="text-muted-foreground">口播：</span>{seg.voiceover}</div>
                                {seg.voiceoverCn && <div><span className="text-muted-foreground">口播(中)：</span>{seg.voiceoverCn}</div>}
                                <div><span className="text-muted-foreground">动作：</span>{seg.action}</div>
                                <div><span className="text-muted-foreground">镜头：</span>{seg.camera}</div>
                                {seg.onScreenText && <div><span className="text-muted-foreground">屏幕文字：</span>{seg.onScreenText}</div>}
                                {seg.onScreenTextCn && <div><span className="text-muted-foreground">屏幕文字(中)：</span>{seg.onScreenTextCn}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium text-muted-foreground">拍摄建议</span>
                          <button
                            onClick={() => handleCopy(scriptRemakeResult.shootingNotes, 'shootingNotes')}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedField === 'shootingNotes' ? '已复制' : '复制'}
                          </button>
                        </div>
                        <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemakeResult.shootingNotes}</div>
                      </div>

                      {scriptRemakeResult.visualNotes && (
                        <div className="rounded-md border">
                          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
                            <span className="text-xs font-medium text-muted-foreground">视觉展示建议</span>
                            <button
                              onClick={() => handleCopy(scriptRemakeResult.visualNotes, 'visualNotes')}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === 'visualNotes' ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="p-3 text-sm whitespace-pre-wrap">{scriptRemakeResult.visualNotes}</div>
                        </div>
                      )}

                      <div className="rounded-md border bg-green-500/5 border-green-500/30">
                        <div className="px-3 py-2 border-b bg-green-500/10">
                          <span className="text-xs font-medium text-green-700">合规注意</span>
                        </div>
                        <div className="p-3 text-sm text-muted-foreground">{scriptRemakeResult.complianceNotes}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductSelector
        open={showProductSelector}
        onOpenChange={setShowProductSelector}
        onSelect={handleProductSelect}
        title="选择产品"
        description="选择一个产品以生成复刻脚本"
      />
    </>
  );
}
